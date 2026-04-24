import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSprintPayload {
  sprintCode: string;            // "v2.3" — unique per project
  name: string;
  goal?: string | null;
  startDate?: string | null;     // ISO
  endDate?: string | null;
  status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface UpdateSprintPayload {
  sprintCode?: string;
  name?: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

const VALID_STATUS = new Set(['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED']);

/**
 * v4.4 B1 — Sprint entity CRUD. Per-project sprints with unique sprintCode,
 * optional date window, status workflow. Does NOT yet wire TCs/runs to
 * `sprintDbId` — that happens in B2 (Sprint picker in Record Run dialog) and
 * B4 (filters across RTM/FTC views).
 */
@Injectable()
export class BaSprintService {
  private readonly logger = new Logger(BaSprintService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForProject(projectId: string) {
    const sprints = await this.prisma.baSprint.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });

    // Per-sprint usage counts via denormalized string `sprintId` + FK. Two
    // aggregates so the caller sees both the canonical (FK) and legacy
    // (string) usage — useful when showing migration readiness.
    const codes = sprints.map((s) => s.sprintCode);
    const [fkCounts, stringCounts] = await Promise.all([
      this.prisma.baTestRun.groupBy({
        by: ['sprintDbId'],
        where: { sprintDbId: { in: sprints.map((s) => s.id) }, deletedAt: null },
        _count: { _all: true },
      }),
      codes.length > 0
        ? this.prisma.baTestRun.groupBy({
            by: ['sprintId'],
            where: { sprintId: { in: codes }, deletedAt: null, sprintDbId: null },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ sprintId: string | null; _count: { _all: number } }>),
    ]);
    const fkMap = new Map(fkCounts.map((c) => [c.sprintDbId ?? '', c._count._all]));
    const strMap = new Map(stringCounts.map((c) => [c.sprintId ?? '', c._count._all]));

    return sprints.map((s) => ({
      ...s,
      runCount: fkMap.get(s.id) ?? 0,
      legacyRunCount: strMap.get(s.sprintCode) ?? 0,
    }));
  }

  async getById(sprintId: string) {
    const sprint = await this.prisma.baSprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);
    return sprint;
  }

  async createSprint(projectId: string, payload: CreateSprintPayload) {
    if (!payload.sprintCode?.trim()) throw new BadRequestException('sprintCode is required');
    if (!payload.name?.trim()) throw new BadRequestException('name is required');
    const status = payload.status ?? 'PLANNING';
    if (!VALID_STATUS.has(status)) throw new BadRequestException(`Invalid status: ${status}`);

    const dupe = await this.prisma.baSprint.findFirst({
      where: { projectId, sprintCode: payload.sprintCode.trim() },
      select: { id: true },
    });
    if (dupe) throw new BadRequestException(`Sprint code "${payload.sprintCode}" already exists in this project`);

    return this.prisma.baSprint.create({
      data: {
        projectId,
        sprintCode: payload.sprintCode.trim(),
        name: payload.name.trim(),
        goal: payload.goal?.trim() || null,
        startDate: this.parseDate(payload.startDate),
        endDate: this.parseDate(payload.endDate),
        status,
      },
    });
  }

  async updateSprint(sprintId: string, payload: UpdateSprintPayload) {
    const existing = await this.prisma.baSprint.findUnique({ where: { id: sprintId } });
    if (!existing) throw new NotFoundException(`Sprint ${sprintId} not found`);

    const data: Record<string, unknown> = {};
    if (payload.sprintCode !== undefined) {
      const code = payload.sprintCode.trim();
      if (!code) throw new BadRequestException('sprintCode cannot be empty');
      if (code !== existing.sprintCode) {
        const dupe = await this.prisma.baSprint.findFirst({
          where: { projectId: existing.projectId, sprintCode: code, NOT: { id: sprintId } },
          select: { id: true },
        });
        if (dupe) throw new BadRequestException(`Sprint code "${code}" already exists in this project`);
        data.sprintCode = code;
      }
    }
    if (payload.name !== undefined) {
      if (!payload.name.trim()) throw new BadRequestException('name cannot be empty');
      data.name = payload.name.trim();
    }
    if (payload.goal !== undefined) data.goal = payload.goal?.trim() || null;
    if (payload.startDate !== undefined) data.startDate = this.parseDate(payload.startDate);
    if (payload.endDate !== undefined) data.endDate = this.parseDate(payload.endDate);
    if (payload.status !== undefined) {
      if (!VALID_STATUS.has(payload.status)) throw new BadRequestException(`Invalid status: ${payload.status}`);
      data.status = payload.status;
    }

    return this.prisma.baSprint.update({ where: { id: sprintId }, data });
  }

  async deleteSprint(sprintId: string) {
    const existing = await this.prisma.baSprint.findUnique({ where: { id: sprintId } });
    if (!existing) throw new NotFoundException(`Sprint ${sprintId} not found`);

    // Block hard-delete if anything references the sprint. Safer than the
    // silent onDelete: SetNull cascade because the UI would otherwise lose
    // historical context without warning.
    const [tcCount, runCount] = await Promise.all([
      this.prisma.baTestCase.count({ where: { sprintDbId: sprintId } }),
      this.prisma.baTestRun.count({ where: { sprintDbId: sprintId } }),
    ]);
    if (tcCount > 0 || runCount > 0) {
      throw new BadRequestException(
        `Cannot delete sprint: ${runCount} run(s) and ${tcCount} TC(s) reference it. ` +
          `Move or clear those assignments first, or mark the sprint CANCELLED instead.`,
      );
    }
    await this.prisma.baSprint.delete({ where: { id: sprintId } });
    return { deleted: sprintId };
  }

  /**
   * Convenience for migrating legacy free-text sprintIds. For each distinct
   * string on BaTestRun.sprintId + BaTestCase.sprintId where the code doesn't
   * match an existing BaSprint, create a PLANNING sprint so a user can come
   * in and fill in name/dates after the fact. Non-destructive — never updates
   * existing rows.
   */
  async backfillFromLegacyStrings(projectId: string) {
    const existing = await this.prisma.baSprint.findMany({
      where: { projectId },
      select: { sprintCode: true },
    });
    const existingCodes = new Set(existing.map((s) => s.sprintCode));

    const [runCodes, tcCodes] = await Promise.all([
      this.prisma.baTestRun.findMany({
        where: { sprintId: { not: null }, testCase: { artifact: { module: { projectId } } } },
        select: { sprintId: true },
        distinct: ['sprintId'],
      }),
      this.prisma.baTestCase.findMany({
        where: { sprintId: { not: null }, artifact: { module: { projectId } } },
        select: { sprintId: true },
        distinct: ['sprintId'],
      }),
    ]);

    const legacy = Array.from(
      new Set(
        [...runCodes, ...tcCodes]
          .map((r) => r.sprintId?.trim())
          .filter((s): s is string => Boolean(s && s.length > 0)),
      ),
    );
    const toCreate = legacy.filter((code) => !existingCodes.has(code));

    const created: Array<{ id: string; sprintCode: string }> = [];
    for (const code of toCreate) {
      try {
        const row = await this.prisma.baSprint.create({
          data: {
            projectId,
            sprintCode: code,
            name: code,                  // user edits the friendly name later
            status: 'PLANNING',
          },
          select: { id: true, sprintCode: true },
        });
        created.push(row);
      } catch (err) {
        this.logger.warn(`backfill: could not create sprint "${code}": ${err instanceof Error ? err.message : err}`);
      }
    }
    return { found: legacy.length, created: created.length, sprints: created };
  }

  private parseDate(v: string | null | undefined): Date | null {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${v}`);
    return d;
  }

  /**
   * B3 — Sprint burndown.
   *
   * Scope = TCs whose `sprintDbId` FK points at this sprint. A TC is
   * "executed" for burndown purposes as of the date of its **first** run
   * within the sprint (subsequent re-runs don't change remaining work).
   *
   * The endpoint returns enough data for a simple SVG chart on the dashboard:
   *   - `days[]`   actual remaining-work line (one point per calendar day)
   *   - `ideal[]`  straight-line ideal from totalScope → 0
   *   - `totals`   breakdown by the TC's latest executionStatus (pass/fail/…)
   */
  async getSprintBurndown(sprintId: string) {
    const sprint = await this.prisma.baSprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);
    if (!sprint.startDate) {
      return {
        sprint,
        totalScope: 0,
        days: [],
        ideal: null,
        totals: { pass: 0, fail: 0, blocked: 0, skipped: 0, notRun: 0 },
        note: 'Sprint has no startDate — burndown not available until a start date is set.',
      };
    }

    const tcs = await this.prisma.baTestCase.findMany({
      where: { sprintDbId: sprintId },
      select: { id: true, executionStatus: true },
    });
    const totalScope = tcs.length;

    // Per-status roll-up using the denormalized "latest status" cache.
    const totals = { pass: 0, fail: 0, blocked: 0, skipped: 0, notRun: 0 };
    for (const tc of tcs) {
      switch (tc.executionStatus) {
        case 'PASS': totals.pass += 1; break;
        case 'FAIL': totals.fail += 1; break;
        case 'BLOCKED': totals.blocked += 1; break;
        case 'SKIPPED': totals.skipped += 1; break;
        default: totals.notRun += 1;
      }
    }

    if (totalScope === 0) {
      return {
        sprint,
        totalScope: 0,
        days: [],
        ideal: null,
        totals,
        note: 'No test cases are assigned to this sprint yet. Record a run on a TC with this sprint selected.',
      };
    }

    const runs = await this.prisma.baTestRun.findMany({
      where: { testCaseId: { in: tcs.map((t) => t.id) }, sprintDbId: sprintId, deletedAt: null },
      select: { testCaseId: true, executedAt: true },
      orderBy: { executedAt: 'asc' },
    });

    // First-run date per TC — that's when the TC becomes "tested" in burndown
    // terms. Subsequent re-runs don't move the needle.
    const firstRunByTc = new Map<string, Date>();
    for (const r of runs) {
      const existing = firstRunByTc.get(r.testCaseId);
      if (!existing || r.executedAt < existing) firstRunByTc.set(r.testCaseId, r.executedAt);
    }

    // Enumerate days from start to min(endDate, today). If endDate is absent
    // we stop at today so the chart is always bounded.
    const today = this.startOfDay(new Date());
    const chartEnd = sprint.endDate && sprint.endDate < today ? sprint.endDate : today;
    const days = this.enumerateDays(sprint.startDate, chartEnd);

    // Bucket first-run dates by ISO date string.
    const byDay = new Map<string, number>();
    for (const d of firstRunByTc.values()) {
      const key = this.isoDate(d);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    let cumulativeTested = 0;
    const actual = days.map((dayKey) => {
      cumulativeTested += byDay.get(dayKey) ?? 0;
      return { date: dayKey, remaining: Math.max(0, totalScope - cumulativeTested), tested: cumulativeTested };
    });

    // Ideal line — only plottable when the sprint has an endDate. Ideal
    // decreases linearly from totalScope (at start) to 0 (at end).
    let ideal: Array<{ date: string; remaining: number }> | null = null;
    if (sprint.endDate) {
      const totalDays = Math.max(
        1,
        Math.round((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86_400_000),
      );
      const idealDays = this.enumerateDays(sprint.startDate, sprint.endDate);
      ideal = idealDays.map((dayKey, i) => ({
        date: dayKey,
        remaining: Math.max(0, Math.round(totalScope * (1 - i / totalDays))),
      }));
    }

    return { sprint, totalScope, days: actual, ideal, totals };
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private enumerateDays(start: Date, end: Date): string[] {
    const out: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= stop) {
      out.push(this.isoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }
}
