import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const E2E_STAGES = ['EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC', 'WTC'] as const;
export type E2eStage = (typeof E2E_STAGES)[number];

export interface StepGap {
  stepId: string;
  moduleId: string | null;
  /** stage → true when that stage has been elaborated for this step. */
  filled: Record<E2eStage, boolean>;
}

export interface ElaborationResult {
  flowId: string;
  stage: E2eStage;
  stepsElaborated: number;
  gaps: StepGap[]; // every step's per-stage fill status (so the UI can render the matrix)
}

/**
 * R-P3 — downstream elaboration. For a given stage, walks each flow step and
 * records (into `BaE2eFlowStep.elaborationByStage[stage]`) which artifacts of
 * that stage exist for the step's module — modules, features, classes/methods,
 * DB entities, tests. An empty slot is the **surfaced design gap**.
 *
 * Purely additive + read-only on existing artifacts: it never modifies EPIC /
 * Story / Sub-Task / LLD / FTC generation — it only writes onto flow steps. The
 * write is immutable per stage (read prior JSON → new copy → write).
 */
@Injectable()
export class E2eElaborationService {
  private readonly logger = new Logger(E2eElaborationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async elaborate(projectId: string, flowId: string, stage: E2eStage): Promise<ElaborationResult> {
    if (!E2E_STAGES.includes(stage)) throw new BadRequestException(`Unknown stage "${stage}"`);
    const flow = await this.prisma.baE2eFlow.findFirst({
      where: { id: flowId, projectId },
      include: { steps: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!flow) throw new NotFoundException(`E2E flow ${flowId} not found`);

    // Cache the module lookups we'll need.
    const moduleDbIds = [...new Set(flow.steps.map((s) => s.moduleDbId).filter((x): x is string => Boolean(x)))];
    const moduleMeta = new Map(
      (await this.prisma.baModule.findMany({ where: { id: { in: moduleDbIds } }, select: { id: true, moduleId: true } }))
        .map((m) => [m.id, m.moduleId]),
    );

    let stepsElaborated = 0;
    for (const step of flow.steps) {
      if (!step.moduleDbId) continue; // pure decision/join nodes carry no module elaboration
      const content = await this.buildStageContent(step.moduleDbId, moduleMeta.get(step.moduleDbId) ?? null, stage);
      if (!content) continue;

      const prior = (step.elaborationByStage as Record<string, unknown>) ?? {};
      const next = { ...prior, [stage]: content }; // immutable per-stage merge
      await this.prisma.baE2eFlowStep.update({
        where: { id: step.id },
        data: { elaborationByStage: next as Prisma.InputJsonValue },
      });
      stepsElaborated++;
    }

    this.logger.log(`Elaborated stage ${stage} for flow ${flow.flowKey}: ${stepsElaborated} step(s)`);
    return { flowId, stage, stepsElaborated, gaps: await this.gapReport(projectId, flowId) };
  }

  /** Per-step × per-stage fill matrix (drives the UI gap view). */
  async gapReport(projectId: string, flowId: string): Promise<StepGap[]> {
    const flow = await this.prisma.baE2eFlow.findFirst({
      where: { id: flowId, projectId },
      include: { steps: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!flow) throw new NotFoundException(`E2E flow ${flowId} not found`);

    const moduleDbIds = [...new Set(flow.steps.map((s) => s.moduleDbId).filter((x): x is string => Boolean(x)))];
    const moduleMeta = new Map(
      (await this.prisma.baModule.findMany({ where: { id: { in: moduleDbIds } }, select: { id: true, moduleId: true } }))
        .map((m) => [m.id, m.moduleId]),
    );

    return flow.steps.map((s) => {
      const elab = (s.elaborationByStage as Record<string, unknown>) ?? {};
      const filled = Object.fromEntries(
        E2E_STAGES.map((st) => [st, isFilled(elab[st])]),
      ) as Record<E2eStage, boolean>;
      return { stepId: s.stepId, moduleId: s.moduleDbId ? moduleMeta.get(s.moduleDbId) ?? null : null, filled };
    });
  }

  // ── stage content builders (read-only on existing artifacts) ──────────────

  private async buildStageContent(
    moduleDbId: string,
    moduleId: string | null,
    stage: E2eStage,
  ): Promise<Record<string, unknown> | null> {
    switch (stage) {
      case 'EPIC':
      case 'USER_STORY': {
        const type = stage === 'EPIC' ? 'EPIC' : 'USER_STORY';
        const arts = await this.prisma.baArtifact.findMany({
          where: { moduleDbId, artifactType: type },
          select: { artifactId: true },
        });
        if (!arts.length) return null;
        return { module: moduleId, refs: arts.map((a) => a.artifactId), count: arts.length };
      }
      case 'SUBTASK': {
        const subs = await this.prisma.baSubTask.findMany({
          where: { moduleDbId },
          select: { subtaskId: true, subtaskName: true, sourceFileName: true, className: true, methodName: true },
          take: 200,
        });
        if (!subs.length) return null;
        return {
          module: moduleId,
          count: subs.length,
          subtasks: subs.map((s) => ({
            subtaskId: s.subtaskId,
            name: s.subtaskName,
            sourceFile: s.sourceFileName,
            classMethod: [s.className, s.methodName].filter(Boolean).join('.') || null,
          })),
        };
      }
      case 'LLD': {
        const files = await this.prisma.baPseudoFile.findMany({
          where: { artifact: { moduleDbId } },
          select: { path: true, language: true },
          take: 300,
        });
        if (!files.length) return null;
        return { module: moduleId, count: files.length, files: files.map((f) => f.path) };
      }
      case 'FTC':
      case 'WTC': {
        const scope = stage === 'WTC' ? 'white_box' : 'black_box';
        const cases = await this.prisma.baTestCase.findMany({
          where: { artifact: { moduleDbId }, scope },
          select: { testCaseId: true, title: true },
          take: 300,
        });
        if (!cases.length) return null;
        return { module: moduleId, count: cases.length, testCases: cases.map((c) => c.testCaseId) };
      }
      default:
        return null;
    }
  }
}

function isFilled(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.count === 'number') return o.count > 0;
  return Object.keys(o).length > 0;
}
