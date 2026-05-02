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
