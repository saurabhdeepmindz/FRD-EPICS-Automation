import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';

export type TestRunKind = 'DEV' | 'FTC';

export interface TestArtifacts {
  /** Absolute folder where this run's artifacts are saved (report, traces, …). */
  dir: string;
  /** Path to the HTML report (Playwright index.html), if produced. */
  report: string | null;
  /** Relative paths of the copied artifact files (capped). */
  files: string[];
}

export interface TestRunView {
  id: string;
  moduleDbId: string;
  kind: TestRunKind;
  framework: string;
  status: 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number | null;
  command: string | null;
  output: string | null;
  artifacts: TestArtifacts | null;
  reportPath: string | null;
  createdAt: Date;
}

interface RunOptions {
  command?: string;
  framework?: string;
  triggeredByRunId?: string;
}

const OUTPUT_CAP = 40_000; // chars of captured output we persist
const RUN_TIMEOUT_MS = 5 * 60_000;

/**
 * P-03 / Q-02 — executes a test command in `ProjectSourceCode/` and records the
 * result as a `BaCodeTestRun`. `kind` separates the two tiers:
 *   DEV — tests produced/run by /dev during code-gen (Stage 1)
 *   FTC — Playwright tests derived from the module's FTC cases (Stage 2)
 *
 * The command + framework are auto-detected from `ProjectSourceCode/package.json`
 * unless overridden. Output is captured, pass/fail parsed best-effort, and the
 * row updated. Generic by design so it works for any real generated project.
 */
@Injectable()
export class TestRunnerService {
  private readonly logger = new Logger(TestRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  async runDevTests(projectId: string, moduleDbId: string, opts: RunOptions = {}): Promise<TestRunView> {
    return this.run(projectId, moduleDbId, 'DEV', opts);
  }

  /** Q-02 — run the module's FTC-derived Playwright tests. */
  async runFtcTests(projectId: string, moduleDbId: string, opts: RunOptions = {}): Promise<TestRunView> {
    return this.run(projectId, moduleDbId, 'FTC', opts);
  }

  /**
   * Q-02 — FTC basis for the module: how many Functional Test Cases exist (and
   * how many carry Playwright automation hints), plus the configured test
   * frameworks. Lets the FTC panel show what the run is derived from even when
   * no runnable Playwright setup exists yet.
   */
  async getFtcSummary(
    projectId: string,
    moduleDbId: string,
  ): Promise<{ caseCount: number; playwrightCases: number; frameworks: string[] }> {
    const [caseCount, playwrightCases, ftcConfig] = await Promise.all([
      this.prisma.baTestCase.count({ where: { artifact: { moduleDbId } } }),
      this.prisma.baTestCase.count({
        where: { artifact: { moduleDbId }, playwrightHint: { not: null } },
      }),
      this.prisma.baFtcConfig.findUnique({
        where: { moduleDbId },
        select: { testingFrameworks: true },
      }),
    ]);
    return { caseCount, playwrightCases, frameworks: ftcConfig?.testingFrameworks ?? [] };
  }

  /** List a module's test runs, newest first; optionally filter by kind. */
  async listRuns(projectId: string, moduleDbId: string, kind?: TestRunKind): Promise<TestRunView[]> {
    const rows = await this.prisma.baCodeTestRun.findMany({
      where: { projectId, moduleDbId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toView);
  }

  async getRun(runId: string): Promise<TestRunView | null> {
    const row = await this.prisma.baCodeTestRun.findUnique({ where: { id: runId } });
    return row ? toView(row) : null;
  }

  // ── core ───────────────────────────────────────────────────────────────────

  async run(
    projectId: string,
    moduleDbId: string,
    kind: TestRunKind,
    opts: RunOptions = {},
  ): Promise<TestRunView> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const module = await this.prisma.baModule.findFirst({
      where: { id: moduleDbId, projectId },
      select: { id: true },
    });
    if (!module) throw new NotFoundException(`Module ${moduleDbId} not found in project ${projectId}`);

    const cwd = this.projectFolders.resolvePaths(project.name).sourceCode;
    const detected = await this.detect(cwd, kind);
    const framework = opts.framework ?? detected.framework;
    const command = opts.command ?? detected.command;

    const created = await this.prisma.baCodeTestRun.create({
      data: {
        moduleDbId,
        projectId,
        kind,
        framework,
        command: command ?? null,
        status: 'RUNNING',
        triggeredByRunId: opts.triggeredByRunId ?? null,
      },
    });

    if (!command) {
      const updated = await this.prisma.baCodeTestRun.update({
        where: { id: created.id },
        data: {
          status: 'ERROR',
          output:
            `No ${kind === 'FTC' ? 'Playwright' : 'test'} command detected in ProjectSourceCode/.\n` +
            `Add a runnable test setup (e.g. a package.json "test" script, or Playwright config) and re-run.`,
        },
      });
      return toView(updated);
    }

    const startedAt = Date.now();
    const { output, exitCode } = await execCommand(command, cwd, RUN_TIMEOUT_MS);
    const durationMs = Date.now() - startedAt;
    const parsed = parseTestOutput(output);
    const status: TestRunView['status'] =
      exitCode === 0 ? 'PASSED' : exitCode === -1 ? 'ERROR' : 'FAILED';

    // Persist Playwright/coverage output into a per-run artifacts folder.
    const artifacts = await this.collectArtifacts(project.name, cwd, kind, created.id);

    const updated = await this.prisma.baCodeTestRun.update({
      where: { id: created.id },
      data: {
        status,
        durationMs,
        total: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed,
        skipped: parsed.skipped,
        output: output.slice(-OUTPUT_CAP),
        artifacts: artifacts as unknown as Prisma.InputJsonValue,
        reportPath: artifacts.report,
      },
    });
    this.logger.log(
      `Test run ${created.id} (${kind}) → ${status} (${parsed.passed}/${parsed.total}); ${artifacts?.files.length ?? 0} artifact file(s)`,
    );
    return toView(updated);
  }

  /**
   * Copy a run's output dirs (Playwright report/results, coverage) from the
   * working dir into a per-run artifacts folder so history is preserved:
   *   ProjectArtifacts/11-TestRuns/{kind}/{runId}/
   * Returns the folder + report path + file list (always returns the intended
   * `dir` so the UI can show where outputs live, even when none were produced).
   */
  private async collectArtifacts(
    projectName: string,
    cwd: string,
    kind: TestRunKind,
    runId: string,
  ): Promise<TestArtifacts> {
    const artifactsRoot = this.projectFolders.resolvePaths(projectName).artifacts;
    const dir = path.join(artifactsRoot, '11-TestRuns', kind, runId);
    const candidates = ['playwright-report', 'test-results', 'coverage'];
    const files: string[] = [];
    let report: string | null = null;

    for (const c of candidates) {
      const src = path.join(cwd, c);
      try {
        const stat = await fs.stat(src);
        if (!stat.isDirectory()) continue;
        const dest = path.join(dir, c);
        await fs.cp(src, dest, { recursive: true });
        for (const f of await walkFiles(dest)) files.push(path.relative(dir, f));
        if (c === 'playwright-report') {
          const idx = path.join(dest, 'index.html');
          if (await exists(idx)) report = idx;
        }
      } catch {
        /* output dir absent — nothing to copy for this candidate */
      }
    }
    return { dir, report, files: files.slice(0, 200) };
  }

  /** Detect the test framework + command from ProjectSourceCode/package.json. */
  private async detect(cwd: string, kind: TestRunKind): Promise<{ framework: string; command: string | null }> {
    try {
      const pkgRaw = await fs.readFile(path.join(cwd, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgRaw) as {
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const scripts = pkg.scripts ?? {};

      if (kind === 'FTC') {
        // Prefer an explicit e2e/playwright script, else the playwright CLI.
        if (scripts['test:e2e']) return { framework: 'playwright', command: 'npm run test:e2e' };
        if (scripts['e2e']) return { framework: 'playwright', command: 'npm run e2e' };
        if (deps['@playwright/test'] || deps['playwright']) {
          return { framework: 'playwright', command: 'npx playwright test' };
        }
        return { framework: 'playwright', command: null };
      }

      // DEV unit tests.
      const framework = deps['vitest'] ? 'vitest' : deps['jest'] ? 'jest' : 'unknown';
      if (scripts['test']) return { framework: framework === 'unknown' ? 'npm' : framework, command: 'npm test' };
      if (deps['vitest']) return { framework: 'vitest', command: 'npx vitest run' };
      if (deps['jest']) return { framework: 'jest', command: 'npx jest' };
      return { framework: 'unknown', command: null };
    } catch {
      return { framework: kind === 'FTC' ? 'playwright' : 'unknown', command: null };
    }
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────

function execCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ output: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    let output = '';
    const append = (d: Buffer) => {
      output += d.toString();
      if (output.length > 400_000) output = output.slice(-400_000);
    };
    let child;
    try {
      child = spawn(command, { cwd, shell: true, windowsHide: true });
    } catch (err) {
      resolve({ output: `[spawn error] ${err instanceof Error ? err.message : String(err)}`, exitCode: -1 });
      return;
    }
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    const timer = setTimeout(() => {
      output += `\n[timed out after ${timeoutMs}ms]`;
      child.kill();
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ output, exitCode: code });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ output: `${output}\n[error] ${err.message}`, exitCode: -1 });
    });
  });
}

/** Best-effort parse of pass/fail counts across Playwright / Jest / Vitest output. */
function parseTestOutput(output: string): { total: number; passed: number; failed: number; skipped: number } {
  const num = (re: RegExp): number => {
    const m = output.match(re);
    return m ? parseInt(m[1], 10) : 0;
  };
  const passed = num(/(\d+)\s+passed/i);
  const failed = num(/(\d+)\s+failed/i);
  const skipped = num(/(\d+)\s+skipped/i);
  const totalReported = num(/(\d+)\s+total/i);
  const total = totalReported || passed + failed + skipped;
  return { total, passed, failed, skipped };
}

/** Recursively list files (not dirs) under a folder. */
async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkFiles(full)));
    else out.push(full);
  }
  return out;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function toView(r: {
  id: string; moduleDbId: string; kind: string; framework: string; status: string;
  total: number; passed: number; failed: number; skipped: number;
  durationMs: number | null; command: string | null; output: string | null;
  artifacts: unknown; reportPath: string | null; createdAt: Date;
}): TestRunView {
  return {
    id: r.id,
    moduleDbId: r.moduleDbId,
    kind: r.kind as TestRunKind,
    framework: r.framework,
    status: r.status as TestRunView['status'],
    total: r.total,
    passed: r.passed,
    failed: r.failed,
    skipped: r.skipped,
    durationMs: r.durationMs,
    command: r.command,
    output: r.output,
    artifacts: (r.artifacts as TestArtifacts | null) ?? null,
    reportPath: r.reportPath,
    createdAt: r.createdAt,
  };
}
