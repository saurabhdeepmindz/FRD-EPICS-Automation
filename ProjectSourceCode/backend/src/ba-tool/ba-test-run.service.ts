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

export interface BulkCreateTestRunPayload {
  testCaseIds: string[];
  /** Same shared status + metadata applied to every TC in the list. No defect. */
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  notes?: string | null;
  executor?: string | null;
  environment?: string | null;
  sprintId?: string | null;
  executedAt?: string | null;
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

  /**
   * Record the same run payload against many test cases at once. Used by the
   * FTC artifact view's "Run selected" multi-select action — typical flow is
   * a tester marking 20 pre-release smoke TCs as PASS in one keystroke.
   *
   * Defects are intentionally NOT supported here: bulk FAIL is the common
   * case for a blocked environment (infra outage, fixture missing), which
   * shouldn't spawn one noisy defect per TC. Testers open defects
   * individually via the per-TC history panel when they actually have a bug
   * to file.
   */
  async bulkCreateRuns(payload: BulkCreateTestRunPayload) {
    if (!Array.isArray(payload.testCaseIds) || payload.testCaseIds.length === 0) {
      throw new BadRequestException('testCaseIds must be a non-empty array');
    }
    if (payload.testCaseIds.length > 200) {
      throw new BadRequestException('Cannot bulk-run more than 200 test cases at once');
    }
    const status = payload.status?.toUpperCase();
    if (!status || !VALID_STATUS.has(status)) {
      throw new BadRequestException(`Invalid status: ${payload.status}`);
    }
    const executedAt = payload.executedAt ? new Date(payload.executedAt) : new Date();
    if (isNaN(executedAt.getTime())) {
      throw new BadRequestException('Invalid executedAt timestamp');
    }

    // Unique IDs only — silently dedupe to avoid creating duplicate runs when
    // the UI sends the same TC twice (paranoia, cheap to enforce server-side).
    const uniqueIds = Array.from(new Set(payload.testCaseIds.filter(Boolean)));

    // Validate all IDs exist first so we either run for all or for none of
    // the invalid ones; keeps the "created count" honest.
    const existing = await this.prisma.baTestCase.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const existingSet = new Set(existing.map((t) => t.id));
    const validIds = uniqueIds.filter((id) => existingSet.has(id));
    const missingIds = uniqueIds.filter((id) => !existingSet.has(id));

    const created: Array<{ testCaseId: string; runId: string }> = [];

    // Each TC's run + denormalization pair is a small transaction. One TC
    // failing shouldn't block the rest.
    for (const id of validIds) {
      try {
        const run = await this.prisma.baTestRun.create({
          data: {
            testCaseId: id,
            status,
            notes: payload.notes?.trim() || null,
            executor: payload.executor?.trim() || null,
            environment: payload.environment?.trim() || null,
            sprintId: payload.sprintId?.trim() || null,
            executedAt,
          },
        });
        await this.prisma.baTestCase.update({
          where: { id },
          data: {
            executionStatus: status,
            latestRunId: run.id,
            lastRunAt: executedAt,
            lastRunBy: payload.executor?.trim() || null,
          },
        });
        created.push({ testCaseId: id, runId: run.id });
      } catch (err) {
        this.logger.warn(`bulkCreateRuns: failed for TC ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      requested: uniqueIds.length,
      created: created.length,
      missingCount: missingIds.length,
      missingIds,
      runs: created,
    };
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
