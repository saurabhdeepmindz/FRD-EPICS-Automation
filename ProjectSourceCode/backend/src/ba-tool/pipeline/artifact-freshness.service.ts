import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * T-02 — forward-propagation freshness checker.
 *
 * Compares each downstream artifact's `sourceArtifactVersions` against the current
 * latest upstream version to decide whether it is STALE (built from a superseded
 * PRD/HLD). Covers the project-scoped artifacts that carry populated source
 * versions: the Screen Map (built from PRD), the PRD-sourced wireframes (built from
 * PRD + Screen Map), HLD (built from PRD), and E2E flows (built from PRD + HLD).
 *
 * Read-only on the DB except a best-effort cache write to the latest PRD's
 * `metadata.freshness`. A missing source version is treated as "unknown →
 * recommend regenerate" rather than an error.
 */

export interface FreshnessEntry {
  artifactType: 'SCREEN_MAP' | 'DESIGN_SYSTEM' | 'WIREFRAME' | 'HLD' | 'E2E_FLOW';
  id: string;
  label: string;
  builtFrom: { prdVersion?: number; hldVersion?: number; screenMapVersion?: number; designSystemVersion?: number };
  current: { prdVersion?: number; hldVersion?: number; screenMapVersion?: number; designSystemVersion?: number };
  stale: boolean;
  reason: string;
}

export interface FreshnessReport {
  projectId: string;
  computedAt: string;
  currentPrdVersion: number | null;
  currentHldVersion: number | null;
  currentScreenMapVersion: number | null;
  currentDesignSystemVersion: number | null;
  downstream: FreshnessEntry[];
  staleCount: number;
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

@Injectable()
export class ArtifactFreshnessService {
  private readonly logger = new Logger(ArtifactFreshnessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(projectId: string): Promise<FreshnessReport> {
    const computedAt = new Date().toISOString();

    const [latestPrd, latestHld, e2eFlows, latestMap, latestWf] = await Promise.all([
      this.prisma.baProjectPrd.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      }),
      this.prisma.baHld.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, sourceArtifactVersions: true },
      }),
      this.prisma.baE2eFlow.findMany({
        where: { projectId },
        select: { id: true, flowKey: true, flowName: true, sourceArtifactVersions: true },
      }),
      this.prisma.baScreenMap.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, sourceArtifactVersions: true },
      }),
      this.prisma.baWireframeSet.findFirst({
        where: { projectId, source: 'PIPELINE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, sourceArtifactVersions: true },
      }),
    ]);
    const latestDesign = await this.prisma.baDesignSystem.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, sourceArtifactVersions: true },
    });

    const currentPrdVersion = latestPrd?.version ?? null;
    const currentHldVersion = latestHld?.version ?? null;
    const currentScreenMapVersion = latestMap?.version ?? null;
    const currentDesignSystemVersion = latestDesign?.version ?? null;
    const downstream: FreshnessEntry[] = [];

    // ── Design System vs latest PRD ──
    if (latestDesign && currentPrdVersion != null) {
      const src = (latestDesign.sourceArtifactVersions as Record<string, unknown> | null) ?? {};
      const builtPrd = numOrUndef(src.prdVersion);
      const stale = builtPrd != null && builtPrd < currentPrdVersion;
      downstream.push({
        artifactType: 'DESIGN_SYSTEM',
        id: latestDesign.id,
        label: `Design System v${latestDesign.version}`,
        builtFrom: { prdVersion: builtPrd },
        current: { prdVersion: currentPrdVersion },
        stale,
        reason: stale
          ? `Built from PRD v${builtPrd}; current PRD is v${currentPrdVersion} — re-check tokens if the PRD changed scope.`
          : `Up to date with PRD v${currentPrdVersion}.`,
      });
    }

    // ── Screen Map vs latest PRD ──
    if (latestMap && currentPrdVersion != null) {
      const src = (latestMap.sourceArtifactVersions as Record<string, unknown> | null) ?? {};
      const builtPrd = numOrUndef(src.prdVersion);
      const stale = builtPrd == null || builtPrd < currentPrdVersion;
      downstream.push({
        artifactType: 'SCREEN_MAP',
        id: latestMap.id,
        label: `Screen Map v${latestMap.version}`,
        builtFrom: { prdVersion: builtPrd },
        current: { prdVersion: currentPrdVersion },
        stale,
        reason:
          builtPrd == null
            ? 'Unknown source PRD version — recommend regenerate.'
            : builtPrd < currentPrdVersion
              ? `Built from PRD v${builtPrd}; current PRD is v${currentPrdVersion}.`
              : `Up to date with PRD v${currentPrdVersion}.`,
      });
    }

    // ── PRD-sourced wireframes vs latest PRD + Screen Map ──
    if (latestWf) {
      const src = (latestWf.sourceArtifactVersions as Record<string, unknown> | null) ?? {};
      const builtPrd = numOrUndef(src.prdVersion);
      const builtMap = numOrUndef(src.screenMapVersion);
      const builtDs = numOrUndef(src.designSystemVersion);
      const stalePrd = currentPrdVersion != null && (builtPrd == null || builtPrd < currentPrdVersion);
      const staleMap =
        currentScreenMapVersion != null && (builtMap == null || builtMap < currentScreenMapVersion);
      const staleDs =
        currentDesignSystemVersion != null && (builtDs == null || builtDs < currentDesignSystemVersion);
      const stale = stalePrd || staleMap || staleDs;
      const reasons: string[] = [];
      if (stalePrd) {
        reasons.push(builtPrd == null ? 'unknown source PRD version' : `built from PRD v${builtPrd} (current v${currentPrdVersion})`);
      }
      if (staleMap) {
        reasons.push(builtMap == null ? 'unknown source Screen Map version' : `built from Screen Map v${builtMap} (current v${currentScreenMapVersion})`);
      }
      if (staleDs) {
        reasons.push(builtDs == null ? 'unknown source Design System version' : `built from Design System v${builtDs} (current v${currentDesignSystemVersion})`);
      }
      downstream.push({
        artifactType: 'WIREFRAME',
        id: latestWf.id,
        label: 'PRD-sourced wireframes',
        builtFrom: { prdVersion: builtPrd, screenMapVersion: builtMap, designSystemVersion: builtDs },
        current: {
          prdVersion: currentPrdVersion ?? undefined,
          screenMapVersion: currentScreenMapVersion ?? undefined,
          designSystemVersion: currentDesignSystemVersion ?? undefined,
        },
        stale,
        reason: stale ? `Stale — ${reasons.join('; ')}.` : 'Up to date.',
      });
    }

    // ── HLD vs latest PRD ──
    if (latestHld && currentPrdVersion != null) {
      const src = (latestHld.sourceArtifactVersions as Record<string, unknown> | null) ?? {};
      const builtPrd = numOrUndef(src.prdVersion);
      const stale = builtPrd == null || builtPrd < currentPrdVersion;
      downstream.push({
        artifactType: 'HLD',
        id: latestHld.id,
        label: `HLD v${latestHld.version}`,
        builtFrom: { prdVersion: builtPrd },
        current: { prdVersion: currentPrdVersion },
        stale,
        reason:
          builtPrd == null
            ? 'Unknown source PRD version — recommend regenerate.'
            : builtPrd < currentPrdVersion
              ? `Built from PRD v${builtPrd}; current PRD is v${currentPrdVersion}.`
              : `Up to date with PRD v${currentPrdVersion}.`,
      });
    }

    // ── E2E flows vs latest PRD + HLD ──
    for (const flow of e2eFlows) {
      const src = (flow.sourceArtifactVersions as Record<string, unknown> | null) ?? {};
      const builtPrd = numOrUndef(src.prdVersion);
      const builtHld = numOrUndef(src.hldVersion);
      const stalePrd = currentPrdVersion != null && (builtPrd == null || builtPrd < currentPrdVersion);
      const staleHld = currentHldVersion != null && (builtHld == null || builtHld < currentHldVersion);
      const stale = stalePrd || staleHld;
      const reasons: string[] = [];
      if (stalePrd) {
        reasons.push(
          builtPrd == null
            ? 'unknown source PRD version'
            : `built from PRD v${builtPrd} (current v${currentPrdVersion})`,
        );
      }
      if (staleHld) {
        reasons.push(
          builtHld == null
            ? 'unknown source HLD version'
            : `built from HLD v${builtHld} (current v${currentHldVersion})`,
        );
      }
      downstream.push({
        artifactType: 'E2E_FLOW',
        id: flow.id,
        label: flow.flowName || flow.flowKey,
        builtFrom: { prdVersion: builtPrd, hldVersion: builtHld },
        current: { prdVersion: currentPrdVersion ?? undefined, hldVersion: currentHldVersion ?? undefined },
        stale,
        reason: stale ? `Stale — ${reasons.join('; ')}.` : 'Up to date.',
      });
    }

    const report: FreshnessReport = {
      projectId,
      computedAt,
      currentPrdVersion,
      currentHldVersion,
      currentScreenMapVersion,
      currentDesignSystemVersion,
      downstream,
      staleCount: downstream.filter((d) => d.stale).length,
    };

    // Best-effort cache on the latest PRD (non-blocking).
    if (latestPrd) {
      this.prisma.baProjectPrd
        .update({
          where: { id: latestPrd.id },
          data: {
            metadata: {
              ...((await this.readMetadata(latestPrd.id)) ?? {}),
              freshness: report as unknown as Prisma.InputJsonValue,
            } as unknown as Prisma.InputJsonValue,
          },
        })
        .catch((e) => this.logger.warn(`freshness cache write failed: ${String(e)}`));
    }

    return report;
  }

  private async readMetadata(prdId: string): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.baProjectPrd.findUnique({
      where: { id: prdId },
      select: { metadata: true },
    });
    return (row?.metadata as Record<string, unknown> | null) ?? null;
  }
}
