import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectFolderService } from '../project-folder.service';
import { ModuleReadinessService } from '../module-readiness.service';
import { ModuleContextService } from '../module-context.service';
import { UpstreamSyncService } from '../upstream-sync.service';
import { SkillRegistry } from './skill-registry.service';
import {
  AGENT_RUNNER,
  type AgentRunner,
  type AgentEvent,
  type AgentRunResult,
  type PermissionDecision,
} from './agent-runner.interface';

interface ActiveRun {
  runId: string;
  projectId: string;
  skillId: string;
  /** Module this run is scoped to (N-03) — undefined for legacy project-wide runs. */
  moduleDbId?: string;
  subject: ReplaySubject<AgentEvent>;
  /** Pending permission resolvers, keyed by requestId (K-04). */
  pending: Map<string, (d: PermissionDecision) => void>;
  status: 'running' | 'done' | 'error';
}

/**
 * K-03 + K-04 — orchestrates an agent run and bridges it to the browser:
 *  • `start()` kicks off the runner asynchronously; events flow into a ReplaySubject.
 *  • `stream()` exposes that as an Observable for the SSE endpoint.
 *  • permission requests pause the runner until the UI calls `resolvePermission()`.
 */
@Injectable()
export class RunManagerService {
  private readonly logger = new Logger(RunManagerService.name);
  private readonly runs = new Map<string, ActiveRun>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
    private readonly readiness: ModuleReadinessService,
    private readonly moduleContext: ModuleContextService,
    private readonly upstreamSync: UpstreamSyncService,
    private readonly skills: SkillRegistry,
    @Inject(AGENT_RUNNER) private readonly runner: AgentRunner,
  ) {}

  /**
   * Start a run; returns the runId immediately (runner executes in background).
   * When `moduleDbId` is supplied (N-03), the run is module-scoped: the module
   * must be code-gen-ready and the grounding context is narrowed to that module.
   * Without it, the legacy project-wide context is used (back-compat).
   */
  async start(
    projectId: string,
    skillId: string,
    subtask?: string,
    moduleDbId?: string,
  ): Promise<string> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const skill = await this.skills.load(skillId);
    if (skill.needsSubtask && !subtask?.trim()) {
      throw new BadRequestException(`Skill "${skillId}" needs a target subtask/task.`);
    }

    const paths = this.projectFolders.resolvePaths(project.name);

    // N-03 — module-scoped grounding, gated on readiness.
    let contextText: string;
    if (moduleDbId) {
      const readiness = await this.readiness.getModuleReadiness(projectId, moduleDbId);
      if (!readiness) {
        throw new NotFoundException(`Module ${moduleDbId} not found in project ${projectId}`);
      }
      if (!readiness.ready) {
        throw new BadRequestException(
          `Module ${readiness.moduleId} is not code-gen-ready — missing: ${readiness.missing.join(', ')}`,
        );
      }
      const ctx = await this.moduleContext.buildModuleContext(projectId, moduleDbId);
      contextText = ctx?.text ?? (await this.readContext(paths.context));
    } else {
      contextText = await this.readContext(paths.context);
    }

    const runId = randomUUID();
    const run: ActiveRun = {
      runId,
      projectId,
      skillId,
      moduleDbId,
      subject: new ReplaySubject<AgentEvent>(), // replays all events to late subscribers
      pending: new Map(),
      status: 'running',
    };
    this.runs.set(runId, run);

    // Fire-and-forget; events stream into the subject.
    void this.runner
      .run(
        {
          projectId,
          skillName: skillId,
          cwd: paths.sourceCode,
          skillPrompt: skill.body,
          contextText,
          extraInstruction: subtask?.trim() || undefined,
        },
        (e) => run.subject.next(e),
        (requestId, _tool, _detail) =>
          new Promise<PermissionDecision>((resolve) => {
            run.pending.set(requestId, resolve);
          }),
      )
      .then((result) => {
        run.status = result.ok ? 'done' : 'error';
        run.subject.complete();
      })
      .catch((err: unknown) => {
        run.status = 'error';
        run.subject.next({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        run.subject.complete();
      })
      .finally(() => {
        // Keep the record briefly so the SSE client can drain, then drop it.
        setTimeout(() => this.runs.delete(runId), 60_000);
      });

    this.logger.log(
      `Started run ${runId} (${skillId}${moduleDbId ? `, module ${moduleDbId}` : ', project-wide'}) for project ${projectId}`,
    );
    return runId;
  }

  /**
   * P-01 — start a task-aware `/dev` code run for a module. Executes the module's
   * code tasks (mode `all` = every PENDING/FAILED task in sequence; `single` = one
   * `taskKey`), flipping each `BaCodeTask` PENDING → RUNNING → COMPLETED/FAILED and
   * emitting `task` events live. Streams over the same `/run/:runId/stream` SSE.
   * Gated on module readiness (same as N-03).
   */
  async startCodeRun(
    projectId: string,
    moduleDbId: string,
    mode: 'all' | 'single',
    taskKey?: string,
  ): Promise<string> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const readiness = await this.readiness.getModuleReadiness(projectId, moduleDbId);
    if (!readiness) {
      throw new NotFoundException(`Module ${moduleDbId} not found in project ${projectId}`);
    }
    if (!readiness.ready) {
      throw new BadRequestException(
        `Module ${readiness.moduleId} is not code-gen-ready — missing: ${readiness.missing.join(', ')}`,
      );
    }

    // Resolve which tasks to run.
    let tasks;
    if (mode === 'single') {
      if (!taskKey) throw new BadRequestException('taskKey is required for a single-task run.');
      const t = await this.prisma.baCodeTask.findUnique({
        where: { moduleDbId_taskKey: { moduleDbId, taskKey } },
      });
      if (!t) throw new NotFoundException(`Task ${taskKey} not found for module ${readiness.moduleId}`);
      tasks = [t];
    } else {
      tasks = await this.prisma.baCodeTask.findMany({
        where: { moduleDbId, status: { in: ['PENDING', 'FAILED'] } },
        orderBy: { sequence: 'asc' },
      });
    }
    if (!tasks.length) {
      throw new BadRequestException(
        mode === 'all'
          ? 'No pending tasks to run — generate a plan first, or all tasks are already complete.'
          : 'Task is not runnable.',
      );
    }

    const skill = await this.skills.load('dev');
    const paths = this.projectFolders.resolvePaths(project.name);
    const ctx = await this.moduleContext.buildModuleContext(projectId, moduleDbId);
    const contextText = ctx?.text ?? (await this.readContext(paths.context));

    const runId = randomUUID();
    const run: ActiveRun = {
      runId,
      projectId,
      skillId: 'dev',
      moduleDbId,
      subject: new ReplaySubject<AgentEvent>(),
      pending: new Map(),
      status: 'running',
    };
    this.runs.set(runId, run);

    void this.executeCodeRun(run, skill.body, paths.sourceCode, contextText, tasks)
      .then(() => {
        run.status = 'done';
        run.subject.complete();
      })
      .catch((err: unknown) => {
        run.status = 'error';
        run.subject.next({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        run.subject.complete();
      })
      .finally(() => setTimeout(() => this.runs.delete(runId), 60_000));

    this.logger.log(
      `Started code run ${runId} (/dev, module ${readiness.moduleId}, ${mode}${taskKey ? ` ${taskKey}` : ''}) — ${tasks.length} task(s)`,
    );
    return runId;
  }

  /**
   * Execute the task list sequentially. Each task is one agent invocation scoped
   * to that task's subtask + pseudo/target files. Stops the run-all on the first
   * failure (later tasks may depend on it).
   */
  private async executeCodeRun(
    run: ActiveRun,
    skillBody: string,
    cwd: string,
    contextText: string,
    tasks: Array<{ id: string; taskKey: string; sequence: number; title: string; description: string | null; subtaskRefs: string[]; pseudoFileRefs: string[]; targetFiles: string[] }>,
  ): Promise<void> {
    run.subject.next({ type: 'start', runId: run.runId });

    const allChanged: string[] = [];
    let stoppedAt: { sequence: number; taskKey: string; summary: string } | null = null;
    let done = 0;
    for (const task of tasks) {
      await this.prisma.baCodeTask.update({
        where: { id: task.id },
        data: { status: 'RUNNING', startedAt: new Date(), runId: run.runId, errorMessage: null },
      });
      run.subject.next({ type: 'task', taskKey: task.taskKey, sequence: task.sequence, status: 'running', title: task.title });
      run.subject.next({ type: 'log', text: `▶ Task ${task.sequence} · ${task.taskKey} — ${task.title}` });

      let result: AgentRunResult;
      try {
        result = await this.runner.run(
          {
            projectId: run.projectId,
            skillName: 'dev',
            cwd,
            skillPrompt: skillBody,
            contextText,
            extraInstruction: buildTaskInstruction(task),
          },
          (e) => run.subject.next(e),
          (requestId) =>
            new Promise<PermissionDecision>((resolve) => {
              run.pending.set(requestId, resolve);
            }),
        );
      } catch (err) {
        result = { ok: false, summary: err instanceof Error ? err.message : String(err), filesChanged: [] };
      }

      allChanged.push(...result.filesChanged);

      if (result.ok) {
        await this.prisma.baCodeTask.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', completedAt: new Date(), generatedFiles: result.filesChanged },
        });
        run.subject.next({ type: 'task', taskKey: task.taskKey, sequence: task.sequence, status: 'completed' });
        done++;
      } else {
        await this.prisma.baCodeTask.update({
          where: { id: task.id },
          data: { status: 'FAILED', completedAt: new Date(), errorMessage: result.summary, generatedFiles: result.filesChanged },
        });
        run.subject.next({ type: 'task', taskKey: task.taskKey, sequence: task.sequence, status: 'failed', error: result.summary });
        stoppedAt = { sequence: task.sequence, taskKey: task.taskKey, summary: result.summary };
        break;
      }
    }

    // P-04 — detect files written outside the LLD/sub-tasks; stage upstream drafts.
    if (run.moduleDbId) {
      try {
        const drafts = await this.upstreamSync.detectDynamicFiles(
          run.projectId, run.moduleDbId, run.runId, allChanged,
        );
        if (drafts > 0) {
          run.subject.next({
            type: 'log',
            text: `⬆ ${drafts} dynamic file(s) detected → upstream drafts staged for your review.`,
          });
        }
      } catch (err) {
        this.logger.warn(`Dynamic-file detection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    run.subject.next(
      stoppedAt
        ? { type: 'result', ok: false, summary: `Stopped at task ${stoppedAt.sequence} (${stoppedAt.taskKey}): ${stoppedAt.summary}` }
        : { type: 'result', ok: true, summary: `Completed ${done} task(s).` },
    );
  }

  /** Observable of events for the SSE endpoint. */
  stream(runId: string): Observable<AgentEvent> {
    const run = this.runs.get(runId);
    if (!run) throw new NotFoundException(`Run ${runId} not found or already drained`);
    return run.subject.asObservable();
  }

  /** Resolve a pending permission request (K-04) from the UI. */
  resolvePermission(runId: string, requestId: string, decision: PermissionDecision): void {
    const run = this.runs.get(runId);
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    const resolver = run.pending.get(requestId);
    if (!resolver) throw new NotFoundException(`Permission ${requestId} not pending`);
    run.pending.delete(requestId);
    resolver(decision);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Concatenate the .context/ markdown files as the agent's grounding. */
  private async readContext(contextDir: string): Promise<string> {
    const files = [
      'REQUIREMENTS.md', 'HLD.md', 'RTM.md',
      'EPICS.md', 'USER_STORIES.md', 'SUBTASKS.md', 'LLD.md',
    ];
    let out = '';
    for (const f of files) {
      try {
        const content = await fs.readFile(path.join(contextDir, f), 'utf8');
        out += `\n\n===== ${f} =====\n${content}`;
      } catch {
        /* file absent — skip */
      }
    }
    return out.trim();
  }
}

/** Build the per-task instruction handed to /dev (P-01). */
function buildTaskInstruction(task: {
  taskKey: string;
  sequence: number;
  title: string;
  description: string | null;
  subtaskRefs: string[];
  pseudoFileRefs: string[];
  targetFiles: string[];
}): string {
  const subtasks = task.subtaskRefs.join(', ') || '(none)';
  const pseudo = task.pseudoFileRefs.join(', ') || '(none)';
  const targets = task.targetFiles.join(', ') || '(none)';
  return [
    `Implement code task ${task.taskKey} (sequence ${task.sequence}): "${task.title}".`,
    task.description ? task.description : '',
    ``,
    `This task realises sub-task(s): ${subtasks}.`,
    `Pseudo file(s) to implement: ${pseudo}.`,
    `Target source file(s): ${targets}.`,
    ``,
    `Steps:`,
    `1. Read the listed pseudo file(s) under the current directory to understand the intended structure.`,
    `2. Use §5 (Sub-Tasks) and §6 (LLD) in the grounding context for ${subtasks}.`,
    `3. Replace the pseudo code with a complete, working implementation in the target file(s).`,
    `4. Stay within THIS task's scope — do not implement other tasks.`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}
