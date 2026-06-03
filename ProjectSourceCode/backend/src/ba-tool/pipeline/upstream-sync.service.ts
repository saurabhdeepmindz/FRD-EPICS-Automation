import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';

export interface UpstreamSyncView {
  id: string;
  moduleDbId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  trigger: string;
  filePath: string | null;
  summary: string;
  proposedLld: string | null;
  proposedSubtask: unknown;
  changelogEntry: string | null;
  rtmRow: unknown;
  resolvedNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

/**
 * P-04/P-05 + Track J — downstream→upstream auto-draft + approval.
 *
 * After a /dev run, `detectDynamicFiles` finds files written that aren't in the
 * module's LLD/sub-tasks, records each as a dynamic `BaCodeTask`, and stages a
 * PENDING `BaUpstreamSync` draft (LLD note + sub-task + CHANGELOG + RTM). Nothing
 * is applied upstream until a human `approve()`s — matching the chosen
 * "auto-draft, human approves" policy.
 */
@Injectable()
export class UpstreamSyncService {
  private readonly logger = new Logger(UpstreamSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  /** P-04 — detect dynamic files from a run's changed-file list; stage drafts. */
  async detectDynamicFiles(
    projectId: string,
    moduleDbId: string,
    runId: string,
    filesChanged: string[],
  ): Promise<number> {
    if (!filesChanged?.length) return 0;

    const module = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      select: { moduleId: true },
    });
    if (!module) return 0;

    const [tasks, pseudo] = await Promise.all([
      this.prisma.baCodeTask.findMany({
        where: { moduleDbId },
        select: { pseudoFileRefs: true, targetFiles: true },
      }),
      this.prisma.baPseudoFile.findMany({
        where: { artifact: { moduleDbId } },
        select: { path: true },
      }),
    ]);

    const known = new Set<string>();
    for (const t of tasks) for (const f of [...t.pseudoFileRefs, ...t.targetFiles]) known.add(baseName(f));
    for (const p of pseudo) known.add(baseName(p.path));

    const seen = new Set<string>();
    let created = 0;

    for (const raw of filesChanged) {
      const b = baseName(raw);
      if (!b || seen.has(b)) continue;
      seen.add(b);
      if (known.has(b)) continue; // expected file — not dynamic

      // Skip if a pending draft for this file already exists.
      const existing = await this.prisma.baUpstreamSync.findFirst({
        where: { moduleDbId, filePath: raw, status: 'PENDING' },
        select: { id: true },
      });
      if (existing) continue;

      const taskKey = `DYN-${b}`.slice(0, 60);
      await this.prisma.baCodeTask.upsert({
        where: { moduleDbId_taskKey: { moduleDbId, taskKey } },
        update: { targetFiles: [raw], status: 'COMPLETED', isDynamic: true, runId, completedAt: new Date() },
        create: {
          moduleDbId, projectId, sequence: 9000 + created, taskKey,
          title: `Dynamic file: ${b}`,
          description: 'Created by /dev outside the planned LLD/sub-tasks.',
          subtaskRefs: [], pseudoFileRefs: [], targetFiles: [raw],
          isDynamic: true, status: 'COMPLETED', runId, completedAt: new Date(),
        },
      });

      await this.prisma.baUpstreamSync.create({
        data: {
          moduleDbId, projectId, status: 'PENDING', trigger: 'DYNAMIC_FILE', filePath: raw,
          triggeredByRunId: runId,
          summary:
            `"${b}" was created by /dev but is not in the LLD / sub-tasks. ` +
            `Approve to add it upstream (LLD pseudo-file + sub-task + CHANGELOG + RTM row).`,
          proposedLld: `Add a pseudo-file entry for \`${raw}\` to ${module.moduleId}'s LLD.`,
          proposedSubtask: {
            subtaskId: `ST-DYN-${b}`.slice(0, 60),
            subtaskName: `Implement ${b}`,
            subtaskType: 'Code',
            sourceFileName: b,
          },
          changelogEntry: `Dynamic file \`${raw}\` added during code-gen for ${module.moduleId}.`,
          rtmRow: { sourceFile: raw, origin: 'DYNAMIC_FILE', moduleId: module.moduleId },
        },
      });
      created++;
    }

    if (created) this.logger.log(`Staged ${created} upstream draft(s) for module ${module.moduleId}`);
    return created;
  }

  async list(projectId: string, moduleDbId: string, onlyPending = false): Promise<UpstreamSyncView[]> {
    const rows = await this.prisma.baUpstreamSync.findMany({
      where: { projectId, moduleDbId, ...(onlyPending ? { status: 'PENDING' } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toView);
  }

  /** P-04 — apply the draft upstream (LLD + sub-task + CHANGELOG + RTM), then mark APPROVED. */
  async approve(syncId: string, note?: string): Promise<UpstreamSyncView> {
    const sync = await this.prisma.baUpstreamSync.findUnique({ where: { id: syncId } });
    if (!sync) throw new NotFoundException(`Upstream sync ${syncId} not found`);
    if (sync.status !== 'PENDING') throw new BadRequestException(`Draft already ${sync.status.toLowerCase()}`);

    const [project, module] = await Promise.all([
      this.prisma.baProject.findUnique({ where: { id: sync.projectId }, select: { name: true } }),
      this.prisma.baModule.findUnique({
        where: { id: sync.moduleDbId },
        select: { moduleId: true, moduleName: true, packageName: true },
      }),
    ]);
    if (!project || !module) throw new NotFoundException('Project or module missing for this draft');

    const nowIso = new Date().toISOString();

    // 1. CHANGELOG entry (newest-on-top, via the existing helper).
    await this.projectFolders
      .appendChangelog(project.name, {
        summary: sync.changelogEntry ?? sync.summary,
        affectedArtifacts: ['LLD', 'Sub-Tasks', 'RTM'],
        source: 'downstream→upstream sync (approved)',
        timestamp: nowIso,
      })
      .catch((err) => this.logger.warn(`CHANGELOG append failed: ${String(err)}`));

    // 2. LLD pseudo-file — so the module LLD now reflects the new file.
    if (sync.filePath) {
      const lld = await this.prisma.baArtifact.findFirst({
        where: { moduleDbId: sync.moduleDbId, artifactType: 'LLD' },
        select: { id: true },
      });
      if (lld) {
        await this.prisma.baPseudoFile.upsert({
          where: { artifactDbId_path: { artifactDbId: lld.id, path: sync.filePath } },
          update: {},
          create: {
            artifactDbId: lld.id,
            path: sync.filePath,
            language: guessLanguage(sync.filePath),
            aiContent: '// Added via downstream→upstream sync (dynamic file created by /dev).\n',
          },
        });
      }
    }

    // 3. Sub-task — draft entry so the work is tracked upstream.
    const proposed = sync.proposedSubtask as { subtaskId?: string; subtaskName?: string; subtaskType?: string; sourceFileName?: string } | null;
    if (proposed?.subtaskId) {
      await this.prisma.baSubTask.upsert({
        where: { moduleDbId_subtaskId: { moduleDbId: sync.moduleDbId, subtaskId: proposed.subtaskId } },
        update: {},
        create: {
          moduleDbId: sync.moduleDbId,
          subtaskId: proposed.subtaskId,
          subtaskName: proposed.subtaskName ?? proposed.subtaskId,
          subtaskType: proposed.subtaskType ?? 'Code',
          sourceFileName: proposed.sourceFileName ?? null,
          status: 'DRAFT',
          prerequisites: [],
        },
      });
    }

    // 4. RTM row — traceability for the new file (best-effort; many NOT-NULL cols).
    if (sync.filePath) {
      const b = baseName(sync.filePath);
      await this.prisma.baRtmRow
        .create({
          data: {
            projectId: sync.projectId,
            moduleId: module.moduleId,
            moduleName: module.moduleName,
            packageName: module.packageName,
            featureId: `DYN-${b}`.slice(0, 60),
            featureName: `Dynamic file ${b}`,
            featureStatus: 'Draft',
            priority: 'P2',
            screenRef: '',
            sourceFile: sync.filePath,
            subtaskId: proposed?.subtaskId ?? null,
            layer: guessLayer(sync.filePath),
          },
        })
        .catch((err) => this.logger.warn(`RTM row create failed: ${String(err)}`));
    }

    const updated = await this.prisma.baUpstreamSync.update({
      where: { id: syncId },
      data: { status: 'APPROVED', resolvedAt: new Date(), resolvedNote: note ?? null },
    });
    this.logger.log(`Approved upstream sync ${syncId} (${sync.filePath}) → applied to ${module.moduleId}`);
    return toView(updated);
  }

  async reject(syncId: string, note?: string): Promise<UpstreamSyncView> {
    const sync = await this.prisma.baUpstreamSync.findUnique({ where: { id: syncId }, select: { status: true } });
    if (!sync) throw new NotFoundException(`Upstream sync ${syncId} not found`);
    if (sync.status !== 'PENDING') throw new BadRequestException(`Draft already ${sync.status.toLowerCase()}`);
    const updated = await this.prisma.baUpstreamSync.update({
      where: { id: syncId },
      data: { status: 'REJECTED', resolvedAt: new Date(), resolvedNote: note ?? null },
    });
    return toView(updated);
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────

function baseName(p: string): string {
  return (p ?? '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
}

function guessLanguage(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    java: 'java', py: 'python', go: 'go', rb: 'ruby', cs: 'csharp',
    sql: 'sql', json: 'json', yml: 'yaml', yaml: 'yaml', html: 'html', css: 'css',
  };
  return map[ext] ?? 'text';
}

function guessLayer(p: string): string {
  const s = p.toLowerCase();
  if (/(test|spec)/.test(s)) return 'Testing';
  if (/(frontend|\bui\b|component|page|view)/.test(s)) return 'Frontend';
  if (/(repository|entity|migration|schema|\.sql)/.test(s)) return 'Database';
  if (/(integration|client|adapter|gateway)/.test(s)) return 'Integration';
  return 'Backend';
}

function toView(r: {
  id: string; moduleDbId: string; status: string; trigger: string; filePath: string | null;
  summary: string; proposedLld: string | null; proposedSubtask: unknown; changelogEntry: string | null;
  rtmRow: unknown; resolvedNote: string | null; createdAt: Date; resolvedAt: Date | null;
}): UpstreamSyncView {
  return {
    id: r.id,
    moduleDbId: r.moduleDbId,
    status: r.status as UpstreamSyncView['status'],
    trigger: r.trigger,
    filePath: r.filePath,
    summary: r.summary,
    proposedLld: r.proposedLld,
    proposedSubtask: r.proposedSubtask,
    changelogEntry: r.changelogEntry,
    rtmRow: r.rtmRow,
    resolvedNote: r.resolvedNote,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  };
}
