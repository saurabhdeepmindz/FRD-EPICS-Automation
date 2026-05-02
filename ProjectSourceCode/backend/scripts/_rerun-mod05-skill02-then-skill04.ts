/**
 * Drive the MOD-05 pipeline forward from the freshly re-run SKILL-01-S
 * (21-feature catalog) through SKILL-02-S (EPICs) and SKILL-04 (User
 * Stories). Each stage:
 *   1. Auto-approves the previous stage's execution so its handoffPacket
 *      is visible via the orchestrator's APPROVED-only filter.
 *   2. Fires the skill, polls until AWAITING_REVIEW, reports key counts.
 *
 * Pre-conditions:
 *   - AI service must be running on :5000.
 *   - MOD-05 SKILL-01-S latest exec must be AWAITING_REVIEW with the
 *     21-feature humanDocument (already in place from the prior chain).
 *
 * Usage:
 *   npx ts-node scripts/_rerun-mod05-skill02-then-skill04.ts
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

const POLL_MS = 5_000;
const TIMEOUT_MS = 25 * 60 * 1000; // 25 min — SKILL-04 per-feature loop × 21 features

function uniqIds(text: string, regex: RegExp): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(regex)) out.add(m[0]);
  return [...out].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

async function pollExecution(
  prisma: PrismaService,
  executionId: string,
  label: string,
  timeoutMs = TIMEOUT_MS,
): Promise<{ status: string; humanDocument: string; handoffPacket: unknown; errorMessage: string | null }> {
  const start = Date.now();
  let lastLine = '';
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.baSkillExecution.findUnique({ where: { id: executionId } });
    if (!row) throw new Error(`Execution ${executionId} disappeared`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(0).padStart(4, ' ');
    const line = `  [${elapsed}s] ${label} status=${row.status}  docLen=${(row.humanDocument || '').length}`;
    if (line !== lastLine) {
      console.log(line);
      lastLine = line;
    }
    if (row.status === 'FAILED') {
      throw new Error(`${label} failed: ${row.errorMessage ?? '(no message)'}`);
    }
    if (row.status === 'AWAITING_REVIEW' || row.status === 'COMPLETED' || row.status === 'APPROVED') {
      return {
        status: row.status,
        humanDocument: row.humanDocument || '',
        handoffPacket: row.handoffPacket,
        errorMessage: row.errorMessage,
      };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`${label} timed out after ${timeoutMs / 1000}s`);
}

async function approveLatest(
  prisma: PrismaService,
  orchestrator: BaSkillOrchestratorService,
  modDbId: string,
  skillName: string,
): Promise<void> {
  const latest = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: modDbId, skillName },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) {
    console.warn(`  no ${skillName} execution found to approve`);
    return;
  }
  if (latest.status === 'APPROVED') {
    console.log(`  ${skillName} ${latest.id} already APPROVED`);
    return;
  }
  await orchestrator.approveExecution(latest.id);
  console.log(`  approved ${skillName} ${latest.id}`);
}

async function main(): Promise<void> {
  Logger.overrideLogger(['error', 'warn', 'log']);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const orchestrator = app.get(BaSkillOrchestratorService);

  console.log('──────────────────────────────────────────────');
  console.log('Target: MOD-05 (Signup-Login)');
  console.log('Chain:  SKILL-02-S → SKILL-04');
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod || !mod.projectId) {
    console.error('MOD-05 not found');
    await app.close();
    process.exit(1);
  }
  console.log(`Current module status: ${mod.moduleStatus}\n`);

  // BEFORE snapshot
  const beforeRtm = await prisma.baRtmRow.findMany({
    where: { projectId: mod.projectId, moduleId: 'MOD-05' },
    select: { featureId: true, epicId: true, storyId: true },
    orderBy: [{ featureId: 'asc' }],
  });
  console.log(`BEFORE — RTM rows: ${beforeRtm.length}`);
  console.log(`  Features with EPIC linked:  ${beforeRtm.filter((r) => r.epicId).length}`);
  console.log(`  Features with story linked: ${beforeRtm.filter((r) => r.storyId).length}\n`);

  // ── Stage 0: Approve the freshly-run SKILL-01-S so SKILL-02-S sees it ──
  console.log('Approving latest SKILL-01-S so its handoff is visible to downstream context ...');
  await approveLatest(prisma, orchestrator, mod.id, 'SKILL-01-S');
  console.log('');

  // ── Stage 1: SKILL-02-S ────────────────────────────────────────────────
  console.log('Triggering SKILL-02-S (EPICs from FRD) ...');
  const exec02 = await orchestrator.executeSkill(mod.id, 'SKILL-02-S');
  console.log(`  executionId: ${exec02}\n`);
  const result02 = await pollExecution(prisma, exec02, 'SKILL-02-S', 8 * 60 * 1000);
  const epicIds = uniqIds(result02.humanDocument, /\bEPIC-[A-Z0-9-]+\b/g);
  const featureRefsInEpic = uniqIds(result02.humanDocument, /\bF-05-\d+\b/g);
  console.log(`\nSKILL-02-S done.`);
  console.log(`  status:                ${result02.status}`);
  console.log(`  humanDocLen:           ${result02.humanDocument.length}`);
  console.log(`  EPIC ids found:        ${epicIds.length}  [${epicIds.slice(0, 12).join(', ')}${epicIds.length > 12 ? `, … (${epicIds.length - 12} more)` : ''}]`);
  console.log(`  F-05 features cited:   ${featureRefsInEpic.length}`);

  console.log('\nApproving SKILL-02-S ...');
  await approveLatest(prisma, orchestrator, mod.id, 'SKILL-02-S');

  // ── Stage 2: SKILL-04 ──────────────────────────────────────────────────
  console.log('\nTriggering SKILL-04 (User Stories per feature) ...');
  const exec04 = await orchestrator.executeSkill(mod.id, 'SKILL-04');
  console.log(`  executionId: ${exec04}`);
  console.log(`  Expected wall time: ~10-15 min (per-feature loop × ${beforeRtm.length} features)\n`);
  const result04 = await pollExecution(prisma, exec04, 'SKILL-04');
  const usIds = uniqIds(result04.humanDocument, /\bUS-\d{3,}\b/g);
  console.log(`\nSKILL-04 done.`);
  console.log(`  status:                ${result04.status}`);
  console.log(`  humanDocLen:           ${result04.humanDocument.length}`);
  console.log(`  US ids generated:      ${usIds.length}`);
  console.log(`    ${usIds.slice(0, 30).join(', ')}${usIds.length > 30 ? `, … (${usIds.length - 30} more)` : ''}`);

  // ── Final state ──────────────────────────────────────────────────────
  const finalRtm = await prisma.baRtmRow.findMany({
    where: { projectId: mod.projectId, moduleId: 'MOD-05' },
    select: { featureId: true, featureName: true, epicId: true, storyId: true, storyName: true },
    orderBy: [{ featureId: 'asc' }],
  });
  console.log('\n──────────────────────────────────────────────');
  console.log('FINAL RTM STATE');
  console.log('──────────────────────────────────────────────');
  console.log(`Total rows:                  ${finalRtm.length}`);
  console.log(`Features with EPIC linked:   ${finalRtm.filter((r) => r.epicId).length}`);
  console.log(`Features with story linked:  ${finalRtm.filter((r) => r.storyId).length}\n`);
  for (const r of finalRtm) {
    console.log(`  ${r.featureId.padEnd(10)} ${(r.featureName ?? '').slice(0, 35).padEnd(37)} epic=${(r.epicId ?? '?').padEnd(15)} story=${r.storyId ?? '?'}`);
  }

  const finalUsArtifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'USER_STORY' },
    orderBy: { createdAt: 'desc' },
  });
  if (finalUsArtifact) {
    const sectionCount = await prisma.baArtifactSection.count({
      where: { artifactId: finalUsArtifact.id },
    });
    console.log(`\nUSER_STORY artifact: ${finalUsArtifact.artifactId} (${finalUsArtifact.id})`);
    console.log(`  status:   ${finalUsArtifact.status}`);
    console.log(`  sections: ${sectionCount}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error('\n✗', err);
  process.exit(1);
});
