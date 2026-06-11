import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type BaWireframeChange,
  BaWireframeChangeStatus,
  BaWireframeChangeSource,
  BaWireframeChangeActivityType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { WireframeContextService } from './wireframe-context.service';
import { WireframeEditService } from './wireframe-edit.service';
import { WireframeChangeEventsService } from './wireframe-change-events.service';

export interface StagedChangeItem {
  description: string;
  targetScreens?: string[];
  scopeAll?: boolean;
  changeKind?: string; // SCREEN | ALL | DESIGN_SYSTEM | QUESTION
  calloutRef?: string | null;
  targetKind?: string; // LOFI | HIFI
  priority?: string;
  phase?: string; // NOW | LATER
  rationale?: string;
}

export interface ChangeBatchMeta {
  requestedBy?: string | null;
  source?: string | null; // CUSTOMER | INTERNAL
  requestedOn?: string | null;
  importId?: string | null;
  threadId?: string | null;
  sourceMessageId?: string | null;
}

/**
 * v12 · Track WC-07/16 — the wireframe change register: create from confirmed
 * staging, apply (AI edit → before/after → live status via SSE), accept/revert,
 * comment/reopen, run-all, and export (CSV/MD + CHANGELOG).
 */
@Injectable()
export class WireframeChangeService {
  private readonly logger = new Logger(WireframeChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly edit: WireframeEditService,
    private readonly events: WireframeChangeEventsService,
    private readonly folders: ProjectFolderService,
    private readonly context: WireframeContextService,
  ) {}

  async createChanges(
    projectId: string,
    items: StagedChangeItem[],
    meta: ChangeBatchMeta,
  ): Promise<BaWireframeChange[]> {
    const base = await this.prisma.baWireframeChange.count({ where: { projectId } });
    const source = (meta.source === 'CUSTOMER' ? 'CUSTOMER' : 'INTERNAL') as BaWireframeChangeSource;
    const created: BaWireframeChange[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const change = await this.prisma.baWireframeChange.create({
        data: {
          projectId,
          threadId: meta.threadId ?? null,
          sourceMessageId: meta.sourceMessageId ?? null,
          importId: meta.importId ?? null,
          changeCode: `WFC-${String(base + i + 1).padStart(3, '0')}`,
          description: it.description,
          targetKind: it.targetKind === 'LOFI' ? 'LOFI' : 'HIFI',
          targetScreens: it.targetScreens ?? [],
          scopeAll: !!it.scopeAll,
          changeKind: it.changeKind ?? 'SCREEN',
          calloutRef: it.calloutRef ?? null,
          requestedBy: meta.requestedBy ?? null,
          source,
          requestedOn: meta.requestedOn ? new Date(meta.requestedOn) : null,
          priority: it.priority ?? 'MEDIUM',
          status: (it.phase === 'LATER' ? 'DEFERRED' : 'PENDING') as BaWireframeChangeStatus,
        },
      });
      await this.activity(projectId, change.id, 'SUBMITTED', meta.requestedBy ?? 'system', null);
      await this.activity(projectId, change.id, 'EXTRACTED', 'copilot', it.rationale ?? null);
      created.push(change);
    }
    this.logger.log(`Created ${created.length} change(s) for ${projectId}`);
    return created;
  }

  async list(
    projectId: string,
    filters: { status?: string; source?: string },
  ): Promise<BaWireframeChange[]> {
    return this.prisma.baWireframeChange.findMany({
      where: {
        projectId,
        ...(filters.status ? { status: filters.status as BaWireframeChangeStatus } : {}),
        ...(filters.source ? { source: filters.source as BaWireframeChangeSource } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(changeId: string) {
    const change = await this.prisma.baWireframeChange.findUnique({
      where: { id: changeId },
      include: { activities: { orderBy: { createdAt: 'asc' } } },
    });
    if (!change) throw new NotFoundException(`Change ${changeId} not found`);
    return change;
  }

  /** Apply a change: run the AI edit on its target screen(s), flip status live. */
  async apply(changeId: string): Promise<BaWireframeChange> {
    const change = await this.requireChange(changeId);
    const kind = (change.targetKind === 'LOFI' ? 'LOFI' : 'HIFI') as 'LOFI' | 'HIFI';

    if (change.changeKind === 'QUESTION') {
      return this.finalize(change, 'NEEDS_REVIEW', [], 'Marked as a question — not an actionable edit.');
    }
    if (change.changeKind === 'DESIGN_SYSTEM') {
      return this.finalize(
        change, 'NEEDS_REVIEW', [],
        'Design-System change — update tokens in the Design System editor, then recolor screens.',
      );
    }

    await this.transition(change, 'IN_PROGRESS');

    let targets = change.targetScreens;
    if (change.scopeAll || change.changeKind === 'ALL' || targets.length === 0) {
      targets = (await this.context.screensFor(change.projectId, kind)).map((s) => s.slug);
    }

    const edited: string[] = [];
    let anyFail = false;
    let anyReview = false;
    for (const slug of targets) {
      try {
        const r = await this.edit.editScreen(change.projectId, slug, kind, change.description, []);
        edited.push(slug);
        if (!r.parityOk) anyReview = true;
      } catch (err) {
        anyFail = true;
        this.logger.error(`Edit failed for ${slug}: ${String(err)}`);
      }
    }
    const status: BaWireframeChangeStatus = anyFail ? 'FAILED' : anyReview ? 'NEEDS_REVIEW' : 'IMPLEMENTED';
    return this.finalize(change, status, edited, null);
  }

  async runAll(
    projectId: string,
    ids: string[] | undefined,
    stopOnFailure: boolean,
  ): Promise<{ ran: number; failed: number }> {
    const changes = ids?.length
      ? await this.prisma.baWireframeChange.findMany({ where: { projectId, id: { in: ids } } })
      : await this.prisma.baWireframeChange.findMany({
          where: { projectId, status: { in: ['PENDING', 'FAILED'] as BaWireframeChangeStatus[] } },
          orderBy: { createdAt: 'asc' },
        });
    let ran = 0;
    let failed = 0;
    for (const c of changes) {
      const res = await this.apply(c.id);
      ran += 1;
      if (res.status === 'FAILED') {
        failed += 1;
        if (stopOnFailure) break;
      }
    }
    return { ran, failed };
  }

  async accept(changeId: string): Promise<BaWireframeChange> {
    const change = await this.requireChange(changeId);
    const kind = (change.targetKind === 'LOFI' ? 'LOFI' : 'HIFI') as 'LOFI' | 'HIFI';
    for (const slug of this.editedSlugs(change)) {
      await this.edit.accept(change.projectId, slug, kind).catch((e) => this.logger.error(`accept ${slug}: ${e}`));
    }
    await this.activity(change.projectId, change.id, 'ACCEPTED', 'user', null);
    await this.changelog(change.projectId, `${change.changeCode} accepted: ${change.description}`);
    this.events.emitStatus(change.projectId, change.id, change.status);
    return change;
  }

  async revert(changeId: string): Promise<BaWireframeChange> {
    const change = await this.requireChange(changeId);
    const kind = (change.targetKind === 'LOFI' ? 'LOFI' : 'HIFI') as 'LOFI' | 'HIFI';
    for (const slug of this.editedSlugs(change)) {
      await this.edit.revert(change.projectId, slug, kind).catch((e) => this.logger.error(`revert ${slug}: ${e}`));
    }
    const updated = await this.prisma.baWireframeChange.update({
      where: { id: change.id },
      data: { status: 'REVERTED' as BaWireframeChangeStatus },
    });
    await this.activity(change.projectId, change.id, 'REVERTED', 'user', null);
    await this.changelog(change.projectId, `${change.changeCode} reverted: ${change.description}`);
    this.events.emitStatus(change.projectId, change.id, 'REVERTED');
    return updated;
  }

  async addComment(changeId: string, actor: string, message: string): Promise<void> {
    const change = await this.requireChange(changeId);
    await this.activity(change.projectId, change.id, 'COMMENT', actor || 'user', message);
  }

  async reopen(changeId: string): Promise<BaWireframeChange> {
    const change = await this.requireChange(changeId);
    const updated = await this.prisma.baWireframeChange.update({
      where: { id: change.id },
      data: { status: 'PENDING' as BaWireframeChangeStatus },
    });
    await this.activity(change.projectId, change.id, 'REOPENED', 'user', null);
    this.events.emitStatus(change.projectId, change.id, 'PENDING');
    return updated;
  }

  /** WC-16 — export the register to CSV + MD in the project artifact folder. */
  async exportRegister(projectId: string): Promise<{ count: number; csvPath?: string; mdPath?: string }> {
    const rows = await this.list(projectId, {});
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['changeCode', 'description', 'status', 'source', 'requestedBy', 'requestedOn', 'targetScreens', 'changeKind', 'priority', 'createdAt'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [r.changeCode, r.description, r.status, r.source, r.requestedBy ?? '', r.requestedOn?.toISOString().slice(0, 10) ?? '', r.targetScreens.join('; '), r.changeKind, r.priority, r.createdAt.toISOString()]
          .map(esc)
          .join(','),
      ),
    ].join('\n');

    const md = [
      `# Wireframe Change Register — ${project.name}`,
      '',
      '| Code | Description | Status | Source | Requestor | Requested on | Screens |',
      '|---|---|---|---|---|---|---|',
      ...rows.map((r) =>
        `| ${r.changeCode} | ${r.description.replace(/\|/g, '\\|')} | ${r.status} | ${r.source} | ${r.requestedBy ?? '—'} | ${r.requestedOn?.toISOString().slice(0, 10) ?? '—'} | ${r.targetScreens.join(', ') || (r.scopeAll ? 'ALL' : '—')} |`,
      ),
    ].join('\n');

    const csvPath = await this.folders.writeArtifactFile(project.name, '04-Wireframes-HiFi', 'change-register.csv', csv).catch(() => undefined);
    const mdPath = await this.folders.writeArtifactFile(project.name, '04-Wireframes-HiFi', 'change-register.md', md).catch(() => undefined);
    await this.changelog(projectId, `Exported wireframe change register (${rows.length} changes)`);
    return { count: rows.length, csvPath, mdPath };
  }

  /**
   * WC-17 — after wireframes are regenerated, mark previously-IMPLEMENTED changes
   * of that fidelity as NEEDS_REVIEW so the trail flags they may need re-applying.
   */
  async flagReapplyAfterRegen(projectId: string, kind: 'LOFI' | 'HIFI'): Promise<number> {
    const affected = await this.prisma.baWireframeChange.findMany({
      where: { projectId, targetKind: kind, status: 'IMPLEMENTED' as BaWireframeChangeStatus },
      select: { id: true, changeCode: true },
    });
    for (const c of affected) {
      await this.prisma.baWireframeChange.update({
        where: { id: c.id },
        data: { status: 'NEEDS_REVIEW' as BaWireframeChangeStatus },
      });
      await this.activity(projectId, c.id, 'NEEDS_REAPPLY', 'system', `Wireframes (${kind}) regenerated — re-apply may be needed.`);
    }
    if (affected.length) this.logger.log(`Flagged ${affected.length} change(s) for re-apply after ${kind} regen`);
    return affected.length;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async requireChange(changeId: string): Promise<BaWireframeChange> {
    const change = await this.prisma.baWireframeChange.findUnique({ where: { id: changeId } });
    if (!change) throw new NotFoundException(`Change ${changeId} not found`);
    return change;
  }

  private editedSlugs(change: BaWireframeChange): string[] {
    const after = (change.afterRef as { slugs?: string[] } | null) ?? null;
    return after?.slugs ?? change.targetScreens;
  }

  private async transition(change: BaWireframeChange, status: BaWireframeChangeStatus): Promise<void> {
    await this.prisma.baWireframeChange.update({ where: { id: change.id }, data: { status } });
    this.events.emitStatus(change.projectId, change.id, status);
    await this.activity(change.projectId, change.id, status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SUBMITTED', 'copilot', null);
  }

  private async finalize(
    change: BaWireframeChange,
    status: BaWireframeChangeStatus,
    editedSlugs: string[],
    note: string | null,
  ): Promise<BaWireframeChange> {
    const updated = await this.prisma.baWireframeChange.update({
      where: { id: change.id },
      data: {
        status,
        afterRef: { slugs: editedSlugs } as unknown as Prisma.InputJsonValue,
        appliedAt: new Date(),
      },
    });
    this.events.emitStatus(change.projectId, change.id, status);
    const actType: BaWireframeChangeActivityType =
      status === 'IMPLEMENTED' ? 'IMPLEMENTED' : status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS';
    await this.activity(change.projectId, change.id, actType, 'copilot', note);
    await this.changelog(change.projectId, `${change.changeCode} ${status}: ${change.description}`);
    return updated;
  }

  private async activity(
    projectId: string,
    changeId: string,
    type: BaWireframeChangeActivityType,
    actor: string,
    message: string | null,
  ): Promise<void> {
    await this.prisma.baWireframeChangeActivity.create({
      data: { changeId, type, actor, message },
    });
    this.events.emitActivity(projectId, changeId, type, actor, message);
  }

  private async changelog(projectId: string, summary: string): Promise<void> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) return;
    await this.folders
      .appendChangelog(project.name, { summary, source: 'wireframe copilot', timestamp: new Date().toISOString() })
      .catch(() => undefined);
  }
}
