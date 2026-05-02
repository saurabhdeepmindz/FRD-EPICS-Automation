/**
 * Shared helpers for skill-execution pre/post checklists.
 *
 * Each skill in scripts/checklists/skill-*.ts exports a list of pre-checks
 * (verify inputs are ready BEFORE running the skill) and post-checks
 * (verify outputs are correct AFTER the skill ran). Checks are pure
 * predicates over Prisma + the local API surface — no AI calls, no
 * Nest bootstrap. Designed to be re-runnable for any moduleDbId so the
 * same files cover every new module going forward.
 *
 * Wire-up plan (future): once these stabilise, the orchestrator's
 * runSkillAsync can call runChecks(PRE_CHECKS) before invoking the AI
 * and runChecks(POST_CHECKS) before marking AWAITING_REVIEW. For now
 * they're driven by the run-cascade.ts harness in this folder.
 */
import { PrismaClient } from '@prisma/client';

export interface CheckContext {
  prisma: PrismaClient;
  moduleDbId: string;
  apiBase: string;
}

export interface Check {
  name: string;
  run(ctx: CheckContext): Promise<{ ok: boolean; detail?: string }>;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ChecklistOutcome {
  results: CheckResult[];
  passed: number;
  total: number;
  allPassed: boolean;
}

export async function runChecks(checks: Check[], ctx: CheckContext): Promise<ChecklistOutcome> {
  const results: CheckResult[] = [];
  for (const c of checks) {
    try {
      const r = await c.run(ctx);
      results.push({ name: c.name, ok: r.ok, detail: r.detail });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      results.push({ name: c.name, ok: false, detail: `(threw) ${detail}` });
    }
  }
  const passed = results.filter((r) => r.ok).length;
  return { results, passed, total: results.length, allPassed: passed === results.length };
}

export function formatChecklist(label: string, outcome: ChecklistOutcome): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`══ ${label} ══`);
  for (const r of outcome.results) {
    const icon = r.ok ? '[PASS]' : '[FAIL]';
    lines.push(`  ${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  lines.push(`  → ${outcome.passed}/${outcome.total} passed${outcome.allPassed ? '' : ' (HALT)'}`);
  return lines.join('\n');
}

/** Convenience: count distinct regex matches across a string. */
export function distinctMatches(text: string, re: RegExp): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(re)) out.add(m[0]);
  return out;
}

/** Read a module + its latest skill execution + artifact in one shot. */
export async function loadModuleContext(prisma: PrismaClient, moduleDbId: string, skillName?: string) {
  const mod = await prisma.baModule.findUnique({
    where: { id: moduleDbId },
    include: { project: true, screens: true },
  });
  if (!mod) throw new Error(`Module ${moduleDbId} not found`);
  const latestExec = skillName
    ? await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName },
        orderBy: { createdAt: 'desc' },
      })
    : null;
  return { mod, latestExec };
}

/** Probe that the AI service health endpoint responds 200. */
export async function probeAiService(): Promise<{ ok: boolean; detail: string }> {
  const url = (process.env.AI_SERVICE_URL ?? 'http://localhost:5000').replace(/\/$/, '') + '/health';
  try {
    const res = await fetch(url);
    if (res.status === 200) return { ok: true, detail: '200 OK' };
    return { ok: false, detail: `status ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, detail: `unreachable (${msg})` };
  }
}

/** Probe that the backend health endpoint responds 200. */
export async function probeBackend(apiBase: string): Promise<{ ok: boolean; detail: string }> {
  const url = apiBase.replace(/\/$/, '') + '/api/health';
  try {
    const res = await fetch(url);
    if (res.status === 200) return { ok: true, detail: '200 OK' };
    return { ok: false, detail: `status ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, detail: `unreachable (${msg})` };
  }
}

/** Map of skill name → artifact type produced. Mirrors SKILL_ARTIFACT_MAP
 * in the orchestrator. Kept here so checklist scripts don't depend on
 * the orchestrator directly (no Nest bootstrap). */
export const SKILL_TO_ARTIFACT: Record<string, string> = {
  'SKILL-00': 'SCREEN_ANALYSIS',
  'SKILL-01-S': 'FRD',
  'SKILL-02-S': 'EPIC',
  'SKILL-04': 'USER_STORY',
  'SKILL-05': 'SUBTASK',
  'SKILL-06-LLD': 'LLD',
  'SKILL-07-FTC': 'FTC',
};

/**
 * Cross-skill module-hygiene check: verifies that every skill whose
 * latest execution is APPROVED for this module also has its artifact
 * present in the DB. Catches the "Phase A cleanup deleted artifacts
 * but left execution records APPROVED" scenario, which makes the UI
 * render misleading status badges (e.g. "User Stories — Approved" with
 * an old timestamp even though no USER_STORY artifact exists). Module-
 * level rather than skill-specific, so include it in every skill's
 * POST_CHECKS via spread.
 */
export const NO_ORPHAN_EXECUTIONS_CHECK: Check = {
  name: 'No orphaned skill executions (APPROVED exec without matching artifact)',
  async run({ prisma, moduleDbId }) {
    const orphans: string[] = [];
    for (const [skill, artType] of Object.entries(SKILL_TO_ARTIFACT)) {
      const exec = await prisma.baSkillExecution.findFirst({
        where: { moduleDbId, skillName: skill, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
      });
      if (!exec) continue;
      const art = await prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: artType as never },
        orderBy: { createdAt: 'desc' },
      });
      if (!art) orphans.push(`${skill} (exec ${exec.id.slice(0, 8)} APPROVED ${exec.createdAt.toISOString().slice(0, 10)} but no ${artType} artifact)`);
    }
    if (orphans.length === 0) return { ok: true, detail: 'all skill execs aligned with artifacts' };
    return { ok: false, detail: orphans.join('; ') };
  },
};
