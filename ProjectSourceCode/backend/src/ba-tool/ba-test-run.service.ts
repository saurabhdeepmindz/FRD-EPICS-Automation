import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTestRunPayload {
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  notes?: string | null;
  executor?: string | null;
  durationSec?: number | null;
  environment?: string | null;
  sprintId?: string | null;
  /** ISO timestamp. Defaults to now when omitted. */
  executedAt?: string | null;
  /** Optional: open a defect from this run in the same request. */
  defect?: {
    title: string;
    description?: string | null;
    severity?: 'P0' | 'P1' | 'P2' | 'P3' | null;
    externalRef?: string | null;
    reproductionSteps?: string | null;
    reportedBy?: string | null;
  } | null;
}

const VALID_STATUS = new Set(['PASS', 'FAIL', 'BLOCKED', 'SKIPPED']);

/**
 * Phase 2a: test-run recording. Each run is an immutable (except soft-delete)
 * row in `ba_test_runs`. Creating a run denormalizes `status` + `latestRunId`
 * onto `BaTestCase` so RTM queries stay fast, and optionally opens a defect
 * when the caller passes one in the same request (typical FAIL flow).
 */
@Injectable()
export class BaTestRunService {
  private readonly logger = new Logger(BaTestRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRun(testCaseId: string, payload: CreateTestRunPayload) {
    const tc = await this.prisma.baTestCase.findUnique({ where: { id: testCaseId } });
    if (!tc) throw new NotFoundException(`Test case ${testCaseId} not found`);

    const status = payload.status?.toUpperCase();
    if (!status || !VALID_STATUS.has(status)) {
      throw new BadRequestException(`Invalid status: ${payload.status}`);
    }

    const executedAt = payload.executedAt ? new Date(payload.executedAt) : new Date();
    if (isNaN(executedAt.getTime())) {
      throw new BadRequestException('Invalid executedAt timestamp');
    }

    const run = await this.prisma.baTestRun.create({
      data: {
        testCaseId,
        status,
        notes: payload.notes?.trim() || null,
        executor: payload.executor?.trim() || null,
        durationSec: payload.durationSec ?? null,
        environment: payload.environment?.trim() || null,
        sprintId: payload.sprintId?.trim() || null,
        executedAt,
      },
    });

    // Denormalize latest status + run id onto the TC. This is the cached
    // value every other surface (RTM, FTC tree, accordion header pill)
    // reads without joining ba_test_runs on every query.
    await this.prisma.baTestCase.update({
      where: { id: testCaseId },
      data: {
        executionStatus: status,
        latestRunId: run.id,
        lastRunAt: executedAt,
        lastRunBy: payload.executor?.trim() || null,
      },
    });

    // Optional defect creation in the same transaction.
    let defectId: string | null = null;
    if (payload.defect && payload.defect.title?.trim()) {
      const d = await this.prisma.baDefect.create({
        data: {
          testCaseId,
          firstSeenRunId: run.id,
          title: payload.defect.title.trim(),
          description: payload.defect.description?.trim() || null,
          severity: this.normalizeSeverity(payload.defect.severity),
          status: 'OPEN',
          externalRef: payload.defect.externalRef?.trim() || null,
          reproductionSteps: payload.defect.reproductionSteps?.trim() || null,
          environment: payload.environment?.trim() || null,
          reportedBy: payload.defect.reportedBy?.trim() || payload.executor?.trim() || null,
        },
      });
      defectId = d.id;

      // Denormalize the defect's human-readable ref onto the TC's defectIds
      // array. We prefer externalRef when present, fall back to the internal
      // uuid tail so something useful shows in the CSV column.
      const ref = payload.defect.externalRef?.trim() || d.id.slice(0, 8);
      const existing = tc.defectIds ?? [];
      if (!existing.includes(ref)) {
        await this.prisma.baTestCase.update({
          where: { id: testCaseId },
          data: { defectIds: [...existing, ref] },
        });
      }
    }

    return { run, defectId };
  }

  async listRunsForTestCase(testCaseId: string) {
    return this.prisma.baTestRun.findMany({
      where: { testCaseId, deletedAt: null },
      orderBy: { executedAt: 'desc' },
      include: {
        defects: {
          select: { id: true, title: true, severity: true, status: true, externalRef: true },
        },
      },
    });
  }

  async listRunsForArtifact(artifactDbId: string) {
    return this.prisma.baTestRun.findMany({
      where: { testCase: { artifactDbId }, deletedAt: null },
      orderBy: { executedAt: 'desc' },
      include: {
        testCase: { select: { id: true, testCaseId: true, title: true } },
        defects: { select: { id: true, title: true, severity: true, status: true } },
      },
    });
  }

  async softDeleteRun(runId: string) {
    const run = await this.prisma.baTestRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.deletedAt) return { alreadyDeleted: true };

    await this.prisma.baTestRun.update({
      where: { id: runId },
      data: { deletedAt: new Date() },
    });

    // If this was the TC's latest run, recompute from remaining non-deleted runs.
    const tc = await this.prisma.baTestCase.findUnique({ where: { id: run.testCaseId } });
    if (tc?.latestRunId === runId) {
      const latest = await this.prisma.baTestRun.findFirst({
        where: { testCaseId: run.testCaseId, deletedAt: null },
        orderBy: { executedAt: 'desc' },
      });
      await this.prisma.baTestCase.update({
        where: { id: run.testCaseId },
        data: {
          executionStatus: latest?.status ?? 'NOT_RUN',
          latestRunId: latest?.id ?? null,
          lastRunAt: latest?.executedAt ?? null,
          lastRunBy: latest?.executor ?? null,
        },
      });
    }
    return { deleted: runId };
  }

  private normalizeSeverity(s: string | null | undefined): string {
    const up = (s ?? 'P2').toUpperCase();
    return /^P[0-3]$/.test(up) ? up : 'P2';
  }
}
