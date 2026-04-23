import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AC Coverage Verifier — two entry points:
 *
 *   1. Populated at generation time by `BaFtcParserService.parseAndStore`
 *      reading the skill's §13 AC Coverage Verification section.
 *
 *   2. Re-runnable on demand via `analyze(artifactId)` — extracts ACs from
 *      upstream EPIC / User Story / SubTask artifacts for the same module,
 *      extracts TC summaries from the FTC artifact, and asks the Python AI
 *      to produce a fresh coverage map. Stored with source=POST_GEN_CHECK.
 */

interface AcInput {
  acSource: string;
  acSourceType: 'EPIC' | 'USER_STORY' | 'SUBTASK' | 'FEATURE';
  acText: string;
  sourceRef: string;
}

interface TcInput {
  testCaseId: string;
  title: string;
  category: string | null;
  scope: string;
  steps: string;
  expected: string;
  postValidation: string;
  linkedStoryIds: string[];
  linkedSubtaskIds: string[];
  linkedFeatureIds: string[];
}

interface AiCoverageResult {
  acSource: string;
  status: 'COVERED' | 'PARTIAL' | 'UNCOVERED';
  coveringTcRefs: string[];
  rationale: string;
}

@Injectable()
export class BaAcCoverageService {
  private readonly logger = new Logger(BaAcCoverageService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:5000';
  }

  async listForArtifact(ftcArtifactDbId: string) {
    const rows = await this.prisma.baAcCoverage.findMany({
      where: { artifactDbId: ftcArtifactDbId },
      orderBy: [{ acSourceType: 'asc' }, { acSource: 'asc' }],
    });
    const covered = rows.filter((r) => r.status === 'COVERED').length;
    const partial = rows.filter((r) => r.status === 'PARTIAL').length;
    const uncovered = rows.filter((r) => r.status === 'UNCOVERED').length;
    return {
      rows,
      summary: { covered, partial, uncovered, total: rows.length },
    };
  }

  /**
   * Standalone re-analysis: extract ACs from upstream artifacts + TC summaries
   * from this FTC, ask the Python AI for a coverage map, replace any existing
   * POST_GEN_CHECK rows (keeping AI_SKILL rows untouched as the original audit).
   */
  async analyze(ftcArtifactDbId: string) {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: ftcArtifactDbId },
      include: {
        module: { include: { artifacts: { include: { sections: true } } } },
        testCases: true,
      },
    });
    if (!artifact) throw new NotFoundException(`FTC artifact ${ftcArtifactDbId} not found`);
    if (artifact.artifactType !== 'FTC') {
      throw new NotFoundException(`Artifact ${ftcArtifactDbId} is not an FTC artifact`);
    }

    const acs = this.extractUpstreamAcs(artifact.module.artifacts);
    if (acs.length === 0) {
      this.logger.warn(`analyze: no upstream ACs found for artifact ${ftcArtifactDbId}`);
      return { rows: [], summary: { covered: 0, partial: 0, uncovered: 0, total: 0 }, model: null };
    }

    const tcs: TcInput[] = artifact.testCases.map((tc) => ({
      testCaseId: tc.testCaseId,
      title: tc.title,
      category: tc.category,
      scope: tc.scope,
      steps: tc.steps ?? '',
      expected: tc.expected ?? '',
      postValidation: tc.postValidation ?? '',
      linkedStoryIds: tc.linkedStoryIds,
      linkedSubtaskIds: tc.linkedSubtaskIds,
      linkedFeatureIds: tc.linkedFeatureIds,
    }));

    let aiResults: AiCoverageResult[] = [];
    let model: string | null = null;
    try {
      const { data } = await axios.post<{ results: AiCoverageResult[]; model: string; summary: Record<string, number> }>(
        `${this.aiServiceUrl}/ba/ac-coverage-check`,
        { acs, tcs },
        { timeout: 120_000 },
      );
      aiResults = data.results ?? [];
      model = data.model;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      throw new NotFoundException(`AC coverage check failed: ${msg}`);
    }

    // Replace POST_GEN_CHECK rows only. AI_SKILL rows from the original
    // generation stay as an audit trail.
    await this.prisma.baAcCoverage.deleteMany({
      where: { artifactDbId: ftcArtifactDbId, source: 'POST_GEN_CHECK' },
    });

    const tcRefToDbId = new Map(artifact.testCases.map((tc) => [tc.testCaseId, tc.id]));
    const acByRef = new Map(acs.map((ac) => [ac.acSource, ac]));

    for (const r of aiResults) {
      const ac = acByRef.get(r.acSource);
      if (!ac) continue;
      const coveringTcIds = r.coveringTcRefs
        .map((ref) => tcRefToDbId.get(ref))
        .filter((x): x is string => !!x);
      await this.prisma.baAcCoverage.create({
        data: {
          artifactDbId: ftcArtifactDbId,
          acSource: ac.acSource,
          acSourceType: ac.acSourceType,
          acText: ac.acText,
          coveringTcIds,
          coveringTcRefs: r.coveringTcRefs,
          status: r.status,
          rationale: r.rationale,
          source: 'POST_GEN_CHECK',
        },
      });
    }

    return { ...(await this.listForArtifact(ftcArtifactDbId)), model };
  }

  // ─── Upstream AC extraction ─────────────────────────────────────────────

  /**
   * Best-effort extraction of acceptance criteria from EPIC / User Story /
   * SubTask artifacts' markdown sections. Looks for "Acceptance Criteria"
   * / "Definition of Done" section labels and splits into numbered bullets.
   * Tolerant — produces the best-effort list; uncovered ACs in the result
   * are meaningful signal even if the regex missed some.
   */
  private extractUpstreamAcs(
    artifacts: Array<{ artifactType: string; artifactId: string; sections: Array<{ sectionLabel: string; content: string }> }>,
  ): AcInput[] {
    const acs: AcInput[] = [];
    for (const a of artifacts) {
      const sourceType = this.mapArtifactType(a.artifactType);
      if (!sourceType) continue;
      for (const section of a.sections) {
        const label = section.sectionLabel.toLowerCase();
        const isAc = /acceptance criter/i.test(label);
        const isDod = /definition of done|done criteria/i.test(label);
        if (!isAc && !isDod) continue;
        const prefix = isAc ? 'AC' : 'DOD';

        const bullets = this.splitBullets(section.content);
        bullets.forEach((bullet, idx) => {
          acs.push({
            acSource: `${a.artifactId}-${prefix}-${idx + 1}`,
            acSourceType: sourceType,
            acText: bullet.slice(0, 500),
            sourceRef: a.artifactId,
          });
        });
      }
    }
    return acs;
  }

  private mapArtifactType(type: string): AcInput['acSourceType'] | null {
    switch (type) {
      case 'EPIC': return 'EPIC';
      case 'USER_STORY': return 'USER_STORY';
      case 'SUBTASK': return 'SUBTASK';
      case 'FRD': return 'FEATURE';
      default: return null;
    }
  }

  /** Split section content into individual bullets (markdown list items or numbered lines). */
  private splitBullets(content: string): string[] {
    const lines = content.split('\n');
    const bullets: string[] = [];
    let buf: string[] = [];
    const flush = () => {
      const joined = buf.join(' ').trim();
      if (joined.length >= 8) bullets.push(joined);
      buf = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      const bulletMatch = trimmed.match(/^(?:[-*+]|\d+[.)])\s+(.*)/);
      if (bulletMatch) {
        flush();
        buf.push(bulletMatch[1]);
      } else if (buf.length > 0) {
        buf.push(trimmed);
      }
    }
    flush();
    return bullets;
  }
}
