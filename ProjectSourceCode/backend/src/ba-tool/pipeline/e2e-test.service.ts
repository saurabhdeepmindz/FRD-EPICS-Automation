import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TestRunnerService, type TestRunView } from './test-runner.service';

export interface E2eStepCoverage {
  stepId: string;
  sequenceNum: number;
  moduleId: string | null;
  totalCases: number;
  uiCases: number; // Playwright-hinted (UI layer)
  dbCases: number; // sqlSetup/sqlVerify (DB layer)
  whiteBoxCases: number;
  covered: boolean;
}

export interface E2eTestPlan {
  flowId: string;
  flowKey: string;
  flowName: string;
  spannedModuleIds: string[];
  steps: E2eStepCoverage[];
  totalCases: number;
  coveredSteps: number;
  gapSteps: number;
}

export interface E2eRunResult {
  moduleId: string | null;
  moduleDbId: string;
  run: TestRunView;
}

/**
 * R-P6 — composes a cross-module E2E test plan from the module FTC cases that
 * cover each flow step (read-only — no bulk writes to real test cases), and
 * executes the journey by reusing the Track-Q FTC runner per spanned module.
 *
 * Layered assertions per the E2E Key Components already live on `BaTestCase`:
 * UI (`playwrightHint`), API (`steps`/`expected`), DB (`sqlSetup`/`sqlVerify`),
 * cross-cutting (`postValidation`). This service surfaces + orders them by the
 * journey's steps and reports coverage gaps.
 */
@Injectable()
export class E2eTestService {
  private readonly logger = new Logger(E2eTestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly testRunner: TestRunnerService,
  ) {}

  async composeTestPlan(projectId: string, flowId: string): Promise<E2eTestPlan> {
    const flow = await this.prisma.baE2eFlow.findFirst({
      where: { id: flowId, projectId },
      include: { steps: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!flow) throw new NotFoundException(`E2E flow ${flowId} not found`);

    const moduleDbIds = [...new Set(flow.steps.map((s) => s.moduleDbId).filter((x): x is string => Boolean(x)))];
    const [moduleCode, cases] = await Promise.all([
      this.prisma.baModule
        .findMany({ where: { id: { in: moduleDbIds } }, select: { id: true, moduleId: true } })
        .then((ms) => new Map(ms.map((m) => [m.id, m.moduleId]))),
      this.prisma.baTestCase.findMany({
        where: { artifact: { moduleDbId: { in: moduleDbIds } } },
        select: { scope: true, playwrightHint: true, sqlSetup: true, sqlVerify: true, artifact: { select: { moduleDbId: true } } },
      }),
    ]);

    // Per-module coverage counts.
    const perModule = new Map<string, { total: number; ui: number; db: number; wb: number }>();
    for (const c of cases) {
      const mid = c.artifact.moduleDbId;
      const agg = perModule.get(mid) ?? { total: 0, ui: 0, db: 0, wb: 0 };
      agg.total++;
      if (c.playwrightHint) agg.ui++;
      if (c.sqlSetup || c.sqlVerify) agg.db++;
      if (c.scope === 'white_box') agg.wb++;
      perModule.set(mid, agg);
    }

    const steps: E2eStepCoverage[] = flow.steps.map((s) => {
      const agg = s.moduleDbId ? perModule.get(s.moduleDbId) : undefined;
      return {
        stepId: s.stepId,
        sequenceNum: s.sequenceNum,
        moduleId: s.moduleDbId ? moduleCode.get(s.moduleDbId) ?? null : null,
        totalCases: agg?.total ?? 0,
        uiCases: agg?.ui ?? 0,
        dbCases: agg?.db ?? 0,
        whiteBoxCases: agg?.wb ?? 0,
        covered: (agg?.total ?? 0) > 0,
      };
    });

    const coveredSteps = steps.filter((s) => s.covered).length;
    return {
      flowId,
      flowKey: flow.flowKey,
      flowName: flow.flowName,
      spannedModuleIds: flow.spannedModuleIds,
      steps,
      totalCases: cases.length,
      coveredSteps,
      gapSteps: steps.length - coveredSteps,
    };
  }

  /** Execute the journey: run the FTC suite for each spanned module (reuses Track Q). */
  async runE2eTests(projectId: string, flowId: string): Promise<E2eRunResult[]> {
    const flow = await this.prisma.baE2eFlow.findFirst({
      where: { id: flowId, projectId },
      include: { steps: { select: { moduleDbId: true } } },
    });
    if (!flow) throw new NotFoundException(`E2E flow ${flowId} not found`);

    const moduleDbIds = [...new Set(flow.steps.map((s) => s.moduleDbId).filter((x): x is string => Boolean(x)))];
    const moduleCode = new Map(
      (await this.prisma.baModule.findMany({ where: { id: { in: moduleDbIds } }, select: { id: true, moduleId: true } }))
        .map((m) => [m.id, m.moduleId]),
    );

    const results: E2eRunResult[] = [];
    for (const moduleDbId of moduleDbIds) {
      const run = await this.testRunner.runFtcTests(projectId, moduleDbId);
      results.push({ moduleDbId, moduleId: moduleCode.get(moduleDbId) ?? null, run });
    }
    this.logger.log(`Ran E2E tests for flow ${flow.flowKey} across ${results.length} module(s)`);
    return results;
  }
}
