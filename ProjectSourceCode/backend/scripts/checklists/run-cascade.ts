/**
 * End-to-end cascade harness with pre/post checklists.
 *
 * For each skill in the cascade:
 *   1. Run PRE_CHECKS — if any fail, HALT (don't trigger the AI).
 *   2. POST to /api/ba/modules/:id/execute/<skill> to start the run.
 *   3. Poll status until AWAITING_REVIEW or FAILED.
 *   4. Run POST_CHECKS.
 *      - If post-checks pass and skill is the manualApproveSkill →
 *        report and STOP, waiting for the operator to approve.
 *      - Otherwise auto-approve via /api/ba/executions/:id/approve.
 *   5. Continue to the next skill.
 *
 * Usage:
 *   npx ts-node scripts/checklists/run-cascade.ts \
 *     --moduleDbId=<uuid> \
 *     --skills=SKILL-01-S,SKILL-02-S,SKILL-04,SKILL-05 \
 *     [--manualApprove=SKILL-01-S] \
 *     [--validateExports=FRD,EPIC,USER_STORY,SUBTASK]
 *
 * If you omit --manualApprove, every skill auto-approves on a green
 * post-check. The MOD-06 rebuild uses --manualApprove=SKILL-01-S
 * because the FRD is the foundation everything else cascades from.
 *
 * --validateExports runs the export-artifact.ts pre/post checklist (PDF +
 * DOCX) for each named artifact type after all skills approve. Pure
 * read-side validation — useful to confirm puppeteer is healthy and the
 * cover page / TOC / sections render correctly before sharing artifacts
 * with stakeholders.
 */
import { PrismaClient } from '@prisma/client';
import { runChecks, formatChecklist, ChecklistOutcome, CheckContext, SKILL_TO_ARTIFACT } from './lib';
import * as skill01s from './skill-01-s';
import * as skill02s from './skill-02-s';
import * as skill04 from './skill-04';
import * as skill05 from './skill-05';
import * as exportArtifact from './export-artifact';

interface SkillSpec {
  name: string;
  pre: typeof skill01s.PRE_CHECKS;
  post: typeof skill01s.POST_CHECKS;
}

const SKILL_REGISTRY: Record<string, SkillSpec> = {
  'SKILL-01-S': { name: 'SKILL-01-S', pre: skill01s.PRE_CHECKS, post: skill01s.POST_CHECKS },
  'SKILL-02-S': { name: 'SKILL-02-S', pre: skill02s.PRE_CHECKS, post: skill02s.POST_CHECKS },
  'SKILL-04':   { name: 'SKILL-04',   pre: skill04.PRE_CHECKS,   post: skill04.POST_CHECKS },
  'SKILL-05':   { name: 'SKILL-05',   pre: skill05.PRE_CHECKS,   post: skill05.POST_CHECKS },
};

interface CascadeArgs {
  moduleDbId: string;
  skills: string[];
  manualApprove?: string;
  apiBase: string;
  // Comma-separated list of artifact types to validate as PDF + DOCX exports
  // after the cascade completes — e.g. --validateExports=FRD,EPIC,USER_STORY.
  // Each one runs the export-artifact.ts pre/post checklist.
  validateExports: string[];
}

function parseArgs(): CascadeArgs {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = a.match(/^--([^=]+)=(.*)$/);
      return m ? [m[1], m[2]] : [a, ''];
    }),
  ) as Record<string, string>;
  if (!args.moduleDbId) throw new Error('--moduleDbId is required');
  if (!args.skills) throw new Error('--skills is required (comma-separated, e.g. SKILL-01-S,SKILL-02-S)');
  return {
    moduleDbId: args.moduleDbId,
    skills: args.skills.split(',').map((s) => s.trim()).filter(Boolean),
    manualApprove: args.manualApprove,
    apiBase: args.apiBase ?? 'http://localhost:4000',
    validateExports: (args.validateExports ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function ts(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

async function fireSkill(apiBase: string, moduleDbId: string, skill: string): Promise<string> {
  const res = await fetch(`${apiBase}/api/ba/modules/${moduleDbId}/execute/${skill}`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST execute/${skill} failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { executionId: string; status?: string };
  return json.executionId;
}

async function fetchExec(apiBase: string, moduleDbId: string, execId: string): Promise<{ status: string; errorMessage: string | null }> {
  const res = await fetch(`${apiBase}/api/ba/modules/${moduleDbId}/execution/${execId}`);
  if (!res.ok) throw new Error(`GET execution failed: ${res.status}`);
  const json = (await res.json()) as { status: string; errorMessage: string | null };
  return json;
}

async function approveExec(apiBase: string, execId: string): Promise<void> {
  const res = await fetch(`${apiBase}/api/ba/executions/${execId}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error(`approve failed: ${res.status} ${await res.text()}`);
}

async function pollUntilTerminal(apiBase: string, moduleDbId: string, execId: string, label: string): Promise<{ status: string; errorMessage: string | null }> {
  let last = 'UNKNOWN';
  while (true) {
    await new Promise((r) => setTimeout(r, 15_000));
    const cur = await fetchExec(apiBase, moduleDbId, execId);
    if (cur.status !== last) {
      console.log(`[${ts()}]   ${label} status: ${cur.status}`);
      last = cur.status;
    }
    if (cur.status === 'AWAITING_REVIEW' || cur.status === 'FAILED' || cur.status === 'APPROVED') {
      return cur;
    }
  }
}

async function validateArtifactExport(
  prisma: PrismaClient,
  apiBase: string,
  moduleDbId: string,
  artifactType: string,
): Promise<boolean> {
  // Resolve the artifact (or subtask) row so we can target the export
  // endpoint by its primary key. SUBTASK exports are per-row, not per-
  // artifact, so we fan out across all approved subtasks for the module.
  if (artifactType === 'SUBTASK') {
    const subtasks = await prisma.baSubTask.findMany({
      where: { moduleDbId },
      select: { id: true, subtaskId: true },
      orderBy: { subtaskId: 'asc' },
    });
    if (subtasks.length === 0) {
      console.log(`[${ts()}] no SubTasks for module — skipping export validation`);
      return true;
    }
    // Validate the first SubTask only as a smoke test — checking every row
    // would balloon the cascade. The first one exercises the same code
    // path; if it passes, the rest are very likely fine.
    const target = subtasks[0];
    console.log(`[${ts()}] validating SubTask export for ${target.subtaskId} (smoke test, 1/${subtasks.length})`);
    return runOneExportValidation(prisma, apiBase, { subtaskDbId: target.id, moduleDbId, label: `SUBTASK ${target.subtaskId}` });
  }

  const art = await prisma.baArtifact.findFirst({
    where: { moduleDbId, artifactType: artifactType as never },
    orderBy: { createdAt: 'desc' },
    select: { id: true, artifactId: true },
  });
  if (!art) {
    console.log(`[${ts()}] no ${artifactType} artifact for module — skipping export validation`);
    return true;
  }
  return runOneExportValidation(prisma, apiBase, { artifactDbId: art.id, moduleDbId, label: `${artifactType} ${art.artifactId}` });
}

async function runOneExportValidation(
  prisma: PrismaClient,
  apiBase: string,
  spec: { artifactDbId?: string; subtaskDbId?: string; moduleDbId: string; label: string },
): Promise<boolean> {
  let allGreen = true;
  for (const format of ['pdf', 'docx'] as const) {
    const ctx: exportArtifact.ExportCheckContext = {
      prisma,
      moduleDbId: spec.moduleDbId,
      apiBase,
      artifactDbId: spec.artifactDbId ?? '',
      subtaskDbId: spec.subtaskDbId,
      format,
    };

    console.log(`\n[${ts()}] ── EXPORT ${spec.label} as ${format.toUpperCase()} ──`);
    const pre = await runChecks(exportArtifact.PRE_CHECKS, ctx);
    console.log(formatChecklist(`EXPORT PRE-CHECKS (${format})`, pre));
    if (!pre.allPassed) {
      console.error(`[${ts()}] EXPORT pre-checks failed for ${spec.label} (${format}); skipping trigger.`);
      allGreen = false;
      continue;
    }

    // Trigger the export. Inline rather than re-implementing — keeps the
    // file-byte validation in sync with what the standalone runner does.
    const url = spec.subtaskDbId
      ? `${apiBase}/api/ba/subtasks/${spec.subtaskDbId}/export/${format}`
      : `${apiBase}/api/ba/artifacts/${spec.artifactDbId}/export/${format}`;
    const t0 = Date.now();
    let httpStatus = 0;
    let contentType: string | null = null;
    let bytes = Buffer.alloc(0);
    let filename = '';
    try {
      const res = await fetch(url);
      httpStatus = res.status;
      contentType = res.headers.get('content-type');
      bytes = Buffer.from(await res.arrayBuffer());
      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="?([^";]+)"?/.exec(cd);
      filename = m?.[1] ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error(`[${ts()}] EXPORT trigger failed for ${spec.label} (${format}): ${msg}`);
      allGreen = false;
      continue;
    }
    ctx.exportResult = { httpStatus, contentType, bytes, filename, durationMs: Date.now() - t0 };
    console.log(`[${ts()}]   → ${httpStatus} ${contentType ?? ''} (${(bytes.length / 1024).toFixed(1)} KB in ${ctx.exportResult.durationMs}ms)`);

    const post = await runChecks(exportArtifact.POST_CHECKS, ctx);
    console.log(formatChecklist(`EXPORT POST-CHECKS (${format})`, post));
    if (!post.allPassed) allGreen = false;
  }
  return allGreen;
}

async function main(): Promise<void> {
  const { moduleDbId, skills, manualApprove, apiBase, validateExports } = parseArgs();
  const prisma = new PrismaClient();
  const ctx: CheckContext = { prisma, moduleDbId, apiBase };

  console.log(`[${ts()}] ══ Cascade for module ${moduleDbId} ══`);
  console.log(`Skills: ${skills.join(' → ')}${manualApprove ? `  (manual approve: ${manualApprove})` : ''}`);

  for (const skillName of skills) {
    const spec = SKILL_REGISTRY[skillName];
    if (!spec) {
      console.error(`[${ts()}] HALT: unknown skill "${skillName}"`);
      await prisma.$disconnect();
      process.exit(1);
    }

    // Pre-checks
    console.log(`\n[${ts()}] ── ${spec.name} ──`);
    const pre = await runChecks(spec.pre, ctx);
    console.log(formatChecklist(`${spec.name} PRE-CHECKS`, pre));
    if (!pre.allPassed) {
      console.error(`\n[${ts()}] HALT — ${spec.name} pre-checks failed. Fix the failing items and re-run.`);
      await prisma.$disconnect();
      process.exit(1);
    }

    // Trigger
    console.log(`[${ts()}] firing ${spec.name}...`);
    const execId = await fireSkill(apiBase, moduleDbId, spec.name);
    console.log(`[${ts()}] execution ${execId}`);

    // Poll
    const terminal = await pollUntilTerminal(apiBase, moduleDbId, execId, spec.name);
    if (terminal.status === 'FAILED') {
      console.error(`[${ts()}] HALT — ${spec.name} FAILED:\n${terminal.errorMessage ?? '(no error message)'}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    // Post-checks
    const post = await runChecks(spec.post, ctx);
    console.log(formatChecklist(`${spec.name} POST-CHECKS`, post));
    if (!post.allPassed) {
      console.error(`\n[${ts()}] HALT — ${spec.name} post-checks failed. Investigate before approving.`);
      await prisma.$disconnect();
      process.exit(1);
    }

    // Approve (manual or auto)
    if (manualApprove === spec.name) {
      console.log(`\n[${ts()}] >>> MANUAL APPROVAL REQUIRED for ${spec.name} (execId=${execId})`);
      console.log(`>>> Eyeball the artifact in the UI, then approve via:`);
      console.log(`>>>   curl -X POST ${apiBase}/api/ba/executions/${execId}/approve`);
      console.log(`>>> Then re-run this cascade with --skills=<remaining,skills>`);
      await prisma.$disconnect();
      process.exit(0);
    }

    await approveExec(apiBase, execId);
    console.log(`[${ts()}] APPROVED ${spec.name} (auto)`);
  }

  console.log(`\n[${ts()}] ══ Cascade complete — all skills approved ══`);

  // Optional post-cascade phase: validate PDF + DOCX exports for each
  // requested artifact type. Failures here do not undo the approved
  // artifacts but signal that the export pipeline needs attention before
  // the docs are shared with stakeholders.
  if (validateExports.length > 0) {
    console.log(`\n[${ts()}] ══ Export validation: ${validateExports.join(', ')} ══`);
    let allExportsGreen = true;
    for (const artifactType of validateExports) {
      const known = Object.values(SKILL_TO_ARTIFACT) as string[];
      if (!known.includes(artifactType)) {
        console.error(`[${ts()}] unknown artifact type "${artifactType}" — known: ${known.join(', ')}`);
        allExportsGreen = false;
        continue;
      }
      const ok = await validateArtifactExport(prisma, apiBase, moduleDbId, artifactType);
      if (!ok) allExportsGreen = false;
    }
    if (!allExportsGreen) {
      console.error(`\n[${ts()}] ══ Export validation finished WITH FAILURES ══`);
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log(`\n[${ts()}] ══ Export validation: all green ══`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
