import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CodeTaskView {
  id: string;
  moduleDbId: string;
  sequence: number;
  taskKey: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  subtaskRefs: string[];
  pseudoFileRefs: string[];
  targetFiles: string[];
  isDynamic: boolean;
  runId: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface SubtaskRow {
  subtaskId: string;
  subtaskName: string;
  subtaskType: string | null;
  team: string | null;
  userStoryId: string | null;
  prerequisites: string[];
  sourceFileName: string | null;
  className: string | null;
  methodName: string | null;
}

/**
 * O-02 — builds (and re-syncs) a module's `/prd` task plan.
 *
 * The plan is derived **deterministically** from the module's sub-tasks: their
 * `prerequisites` graph gives the authoritative execution order (topologically
 * sorted), and `sourceFileName` links each task to the scaffolded pseudo files.
 * One `BaCodeTask` per sub-task, sequenced. Re-planning is idempotent and
 * preserves the status of tasks already executed.
 */
@Injectable()
export class CodeTaskPlannerService {
  private readonly logger = new Logger(CodeTaskPlannerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Generate / refresh the task plan for a module. Returns the ordered tasks. */
  async generatePlan(projectId: string, moduleDbId: string): Promise<CodeTaskView[]> {
    const module = await this.prisma.baModule.findFirst({
      where: { id: moduleDbId, projectId },
      select: { id: true, moduleId: true },
    });
    if (!module) {
      throw new NotFoundException(`Module ${moduleDbId} not found in project ${projectId}`);
    }

    const running = await this.prisma.baCodeTask.count({
      where: { moduleDbId, status: 'RUNNING' },
    });
    if (running > 0) {
      throw new BadRequestException(
        'A task is currently running for this module — wait for it to finish before re-planning.',
      );
    }

    const [subtasks, pseudoFiles] = await Promise.all([
      this.prisma.baSubTask.findMany({
        where: { moduleDbId },
        select: {
          subtaskId: true, subtaskName: true, subtaskType: true, team: true,
          userStoryId: true, prerequisites: true,
          sourceFileName: true, className: true, methodName: true,
        },
      }),
      this.prisma.baPseudoFile.findMany({
        where: { artifact: { moduleDbId } },
        select: { path: true },
      }),
    ]);

    if (!subtasks.length) {
      throw new BadRequestException(
        `Module ${module.moduleId} has no sub-tasks — generate Sub-Tasks (and LLD) before planning code tasks.`,
      );
    }

    const ordered = topoSortSubtasks(subtasks);
    const pseudoPaths = pseudoFiles.map((p) => p.path);

    // Build the desired plan (taskKey is stable per module + sequence position).
    const planned = ordered.map((st, i) => {
      const seq = i + 1;
      const targetFiles = st.sourceFileName ? [st.sourceFileName] : [];
      const pseudoFileRefs = st.sourceFileName
        ? pseudoPaths.filter((p) => matchesFile(p, st.sourceFileName as string))
        : [];
      return {
        taskKey: `TASK-${module.moduleId}-${String(seq).padStart(3, '0')}`,
        sequence: seq,
        title: st.subtaskName,
        description: describeSubtask(st),
        subtaskRefs: [st.subtaskId],
        pseudoFileRefs,
        targetFiles,
      };
    });

    // Idempotent sync: upsert planned tasks (preserving status of existing ones),
    // delete tasks no longer in the plan.
    const existing = await this.prisma.baCodeTask.findMany({
      where: { moduleDbId },
      select: { taskKey: true },
    });
    const plannedKeys = new Set(planned.map((p) => p.taskKey));
    const toDelete = existing.filter((e) => !plannedKeys.has(e.taskKey)).map((e) => e.taskKey);

    await this.prisma.$transaction([
      ...(toDelete.length
        ? [this.prisma.baCodeTask.deleteMany({ where: { moduleDbId, taskKey: { in: toDelete } } })]
        : []),
      ...planned.map((p) =>
        this.prisma.baCodeTask.upsert({
          where: { moduleDbId_taskKey: { moduleDbId, taskKey: p.taskKey } },
          // On re-plan: refresh ordering + linkage, keep execution status untouched.
          update: {
            sequence: p.sequence,
            title: p.title,
            description: p.description,
            subtaskRefs: p.subtaskRefs,
            pseudoFileRefs: p.pseudoFileRefs,
            targetFiles: p.targetFiles,
          },
          create: {
            moduleDbId,
            projectId,
            sequence: p.sequence,
            taskKey: p.taskKey,
            title: p.title,
            description: p.description,
            subtaskRefs: p.subtaskRefs,
            pseudoFileRefs: p.pseudoFileRefs,
            targetFiles: p.targetFiles,
          },
        }),
      ),
    ]);

    this.logger.log(
      `Planned ${planned.length} code task(s) for ${module.moduleId} (${toDelete.length} stale removed)`,
    );
    return this.listTasks(projectId, moduleDbId);
  }

  /** O-03 — list a module's tasks in execution order. */
  async listTasks(projectId: string, moduleDbId: string): Promise<CodeTaskView[]> {
    const rows = await this.prisma.baCodeTask.findMany({
      where: { moduleDbId, projectId },
      orderBy: { sequence: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      moduleDbId: r.moduleDbId,
      sequence: r.sequence,
      taskKey: r.taskKey,
      title: r.title,
      description: r.description,
      status: r.status,
      subtaskRefs: r.subtaskRefs,
      pseudoFileRefs: r.pseudoFileRefs,
      targetFiles: r.targetFiles,
      isDynamic: r.isDynamic,
      runId: r.runId,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }));
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────

/**
 * Topological sort of sub-tasks by their `prerequisites` graph (Kahn's algorithm).
 * Deterministic: ties broken by `subtaskId`. Prerequisites pointing outside this
 * module's set are ignored. Any leftover cycle is appended in `subtaskId` order so
 * planning never silently drops tasks.
 */
function topoSortSubtasks(subtasks: SubtaskRow[]): SubtaskRow[] {
  const byId = new Map(subtasks.map((s) => [s.subtaskId, s]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const s of subtasks) {
    indegree.set(s.subtaskId, 0);
    dependents.set(s.subtaskId, []);
  }
  for (const s of subtasks) {
    for (const pre of s.prerequisites ?? []) {
      if (!byId.has(pre)) continue; // external/unknown prerequisite — ignore
      indegree.set(s.subtaskId, (indegree.get(s.subtaskId) ?? 0) + 1);
      dependents.get(pre)!.push(s.subtaskId);
    }
  }

  const ready = [...indegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id)
    .sort();
  const out: SubtaskRow[] = [];
  const seen = new Set<string>();

  while (ready.length) {
    ready.sort(); // keep deterministic ordering as nodes are released
    const id = ready.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(byId.get(id)!);
    for (const dep of dependents.get(id) ?? []) {
      indegree.set(dep, (indegree.get(dep) ?? 0) - 1);
      if ((indegree.get(dep) ?? 0) === 0) ready.push(dep);
    }
  }

  // Cycle remnants (if any) — append deterministically rather than drop.
  if (out.length < subtasks.length) {
    for (const s of [...subtasks].sort((a, b) => a.subtaskId.localeCompare(b.subtaskId))) {
      if (!seen.has(s.subtaskId)) out.push(s);
    }
  }
  return out;
}

/**
 * Link a scaffolded pseudo-file path to a sub-task's declared source file.
 * Matches on a real segment boundary — basename equality, or the full relative
 * file path preceded by a `/` — so `SlaBreachAlert.java` does NOT match
 * `ExternalSlaBreachAlert.java`.
 */
function matchesFile(pseudoPath: string, sourceFileName: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  const path = norm(pseudoPath);
  const file = norm(sourceFileName);
  const fileBase = file.split('/').pop() ?? file;
  const pathBase = path.split('/').pop() ?? path;
  return pathBase === fileBase || path === file || path.endsWith('/' + file);
}

function describeSubtask(st: SubtaskRow): string {
  const bits: string[] = [];
  if (st.subtaskType) bits.push(st.subtaskType);
  if (st.team) bits.push(st.team);
  const tag = bits.length ? `[${bits.join(' · ')}] ` : '';
  const story = st.userStoryId ? `Story ${st.userStoryId}. ` : '';
  const cm = [st.className, st.methodName].filter(Boolean).join('.');
  const target = cm ? `Implements ${cm}` : st.sourceFileName ? `Implements ${st.sourceFileName}` : '';
  return `${tag}${story}${target}`.trim() || st.subtaskName;
}
