import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MAPPED_ARTIFACT_TYPES = ['EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC'] as const;
const SECTION_KEY = 'e2e_flow_mapping';
const SECTION_LABEL = 'E2E Flow Mapping';

interface FlowRef {
  flowId: string;
  flowKey: string;
  flowName: string;
  stepIds: string[];
}

export interface MappingResult {
  artifactsStamped: number;
  artifactSectionsRemoved: number;
  rtmRowsUpdated: number;
  modulesAffected: number;
}

/**
 * R-P4 — the reverse of R-P3. Stamps an `e2e_flow_mapping` `BaArtifactSection`
 * onto each EPIC/Story/Sub-Task/LLD/FTC artifact stating which E2E-flow steps it
 * participates in, and populates the additive `BaRtmRow.e2eFlowIds/e2eFlowStepRefs`
 * columns. Reuses the generic section table — no schema change. Idempotent:
 * recompute removes stale mappings and refreshes current ones.
 */
@Injectable()
export class E2eMappingService {
  private readonly logger = new Logger(E2eMappingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncArtifactMappings(projectId: string): Promise<MappingResult> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const flows = await this.prisma.baE2eFlow.findMany({
      where: { projectId },
      select: { id: true, flowKey: true, flowName: true, steps: { select: { stepId: true, moduleDbId: true } } },
    });

    // moduleDbId → the flows (+ steps) that touch it.
    const byModuleDb = new Map<string, Map<string, FlowRef>>();
    for (const f of flows) {
      for (const s of f.steps) {
        if (!s.moduleDbId) continue;
        const perModule = byModuleDb.get(s.moduleDbId) ?? new Map<string, FlowRef>();
        const ref = perModule.get(f.id) ?? { flowId: f.id, flowKey: f.flowKey, flowName: f.flowName, stepIds: [] };
        if (!ref.stepIds.includes(s.stepId)) ref.stepIds.push(s.stepId);
        perModule.set(f.id, ref);
        byModuleDb.set(s.moduleDbId, perModule);
      }
    }

    // All mappable artifacts in the project.
    const artifacts = await this.prisma.baArtifact.findMany({
      where: { module: { projectId }, artifactType: { in: [...MAPPED_ARTIFACT_TYPES] } },
      select: { id: true, moduleDbId: true, artifactType: true },
    });

    let artifactsStamped = 0;
    let artifactSectionsRemoved = 0;
    for (const a of artifacts) {
      const refs = byModuleDb.get(a.moduleDbId);
      const existing = await this.prisma.baArtifactSection.findFirst({
        where: { artifactId: a.id, sectionKey: SECTION_KEY },
        select: { id: true },
      });

      if (!refs || refs.size === 0) {
        if (existing) {
          await this.prisma.baArtifactSection.delete({ where: { id: existing.id } });
          artifactSectionsRemoved++;
        }
        continue;
      }

      const content = renderMapping(a.artifactType, [...refs.values()]);
      if (existing) {
        await this.prisma.baArtifactSection.update({
          where: { id: existing.id },
          data: { content, sectionLabel: SECTION_LABEL, aiGenerated: false },
        });
      } else {
        await this.prisma.baArtifactSection.create({
          data: { artifactId: a.id, sectionKey: SECTION_KEY, sectionLabel: SECTION_LABEL, aiGenerated: false, content },
        });
      }
      artifactsStamped++;
    }

    // RTM columns — map by module code (BaRtmRow.moduleId is "MOD-01").
    const modules = await this.prisma.baModule.findMany({
      where: { projectId },
      select: { id: true, moduleId: true },
    });
    const codeToFlows = new Map<string, FlowRef[]>();
    for (const m of modules) {
      const refs = byModuleDb.get(m.id);
      if (refs && refs.size) codeToFlows.set(m.moduleId, [...refs.values()]);
    }
    // Clear first so modules that dropped out of all flows get reset (idempotent).
    await this.prisma.baRtmRow.updateMany({
      where: { projectId },
      data: { e2eFlowIds: [], e2eFlowStepRefs: [] },
    });
    let rtmRowsUpdated = 0;
    for (const [moduleCode, refs] of codeToFlows.entries()) {
      const flowIds = refs.map((r) => r.flowId);
      const stepRefs = [...new Set(refs.flatMap((r) => r.stepIds))];
      const res = await this.prisma.baRtmRow.updateMany({
        where: { projectId, moduleId: moduleCode },
        data: { e2eFlowIds: flowIds, e2eFlowStepRefs: stepRefs },
      });
      rtmRowsUpdated += res.count;
    }

    this.logger.log(
      `E2E mappings synced for project ${projectId}: ${artifactsStamped} stamped, ${artifactSectionsRemoved} removed, ${rtmRowsUpdated} RTM rows`,
    );
    return {
      artifactsStamped,
      artifactSectionsRemoved,
      rtmRowsUpdated,
      modulesAffected: byModuleDb.size,
    };
  }
}

function renderMapping(artifactType: string, refs: FlowRef[]): string {
  const lines = [
    `This ${artifactType.replace('_', ' ').toLowerCase()} participates in the following end-to-end flow(s):`,
    ``,
    ...refs
      .sort((a, b) => a.flowKey.localeCompare(b.flowKey))
      .map((r) => `- **${r.flowKey}** — ${r.flowName} · steps: ${r.stepIds.sort().join(', ') || '(module-level)'}`),
  ];
  return lines.join('\n');
}
