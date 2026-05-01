/**
 * Chain MOD-05 SKILL-00 (Screen Analysis) → SKILL-01-S (FRD) so the
 * upstream handoff packet for screens stops being a 1-of-20 stub. Each
 * stage polls its BaSkillExecution row until AWAITING_REVIEW (or FAILED
 * → bail). After SKILL-01-S completes the script prints the new feature
 * catalog so we can confirm the catalog actually broadened.
 *
 * Usage:
 *   npx ts-node scripts/_rerun-mod05-skill00-then-skill01.ts
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

const POLL_MS = 5_000;
const TIMEOUT_MS = 8 * 60 * 1000;

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
): Promise<{ status: string; humanDocument: string; handoffPacket: unknown; errorMessage: string | null }> {
  const start = Date.now();
  let lastLine = '';
  while (Date.now() - start < TIMEOUT_MS) {
    const row = await prisma.baSkillExecution.findUnique({ where: { id: executionId } });
    if (!row) throw new Error(`Execution ${executionId} disappeared`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(0).padStart(3, ' ');
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
  throw new Error(`${label} timed out after ${TIMEOUT_MS / 1000}s`);
}

async function main(): Promise<void> {
  Logger.overrideLogger(['error', 'warn', 'log']);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const orchestrator = app.get(BaSkillOrchestratorService);

  console.log('──────────────────────────────────────────────');
  console.log('Target: MOD-05 (Signup-Login)');
  console.log('Chain:  SKILL-00 → SKILL-01-S');
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) {
    console.error('MOD-05 not found');
    await app.close();
    process.exit(1);
  }

  // BEFORE snapshot — for the diff at the end
  const beforeSkill00 = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-00' },
    orderBy: { createdAt: 'desc' },
  });
  const beforeScrInHandoff = beforeSkill00
    ? uniqIds(JSON.stringify(beforeSkill00.handoffPacket || {}), /\bSCR-\d+\b/g)
    : [];
  console.log(`BEFORE — SKILL-00 handoff SCR ids: ${beforeScrInHandoff.length}  [${beforeScrInHandoff.join(', ') || '(none)'}]`);

  const beforeFrd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
  });
  let beforeFeatures: string[] = [];
  if (beforeFrd) {
    const ss = await prisma.baArtifactSection.findMany({
      where: { artifactId: beforeFrd.id }, select: { content: true },
    });
    beforeFeatures = uniqIds(ss.map((s) => s.content || '').join('\n'), /\bF-\d{2,}-\d{2,}\b/g);
  }
  console.log(`BEFORE — FRD features:             ${beforeFeatures.length}  [${beforeFeatures.join(', ') || '(none)'}]\n`);

  // ── Stage 1: SKILL-00 ────────────────────────────────────────────────
  console.log('Triggering SKILL-00 (Screen Analysis) ...');
  const exec00 = await orchestrator.executeSkill(mod.id, 'SKILL-00');
  console.log(`  executionId: ${exec00}\n`);
  const result00 = await pollExecution(prisma, exec00, 'SKILL-00');
  const after00ScrIds = uniqIds(JSON.stringify(result00.handoffPacket || {}), /\bSCR-\d+\b/g);
  console.log(`\nSKILL-00 done.`);
  console.log(`  status:                ${result00.status}`);
  console.log(`  humanDocLen:           ${result00.humanDocument.length}`);
  console.log(`  SCR ids in handoff:    ${after00ScrIds.length}  [${after00ScrIds.join(', ') || '(none)'}]`);

  if (after00ScrIds.length < 5) {
    console.error(`\nSKILL-00 still produced only ${after00ScrIds.length} screen(s) in the handoff. Aborting before SKILL-01-S — re-running it on a stub handoff would just repeat the original 1-feature failure.`);
    await app.close();
    process.exit(1);
  }

  // Auto-approve SKILL-00 so SKILL-01-S can re-read it from the
  // approved-execution lookup. The orchestrator's assembleSkill01SContext
  // calls `mod.skillExecutions.find(... skillName === 'SKILL-00')` against
  // the modules where: `skillExecutions: { where: { status: APPROVED } }`,
  // so without approval the new handoff would be ignored.
  console.log(`\nApproving SKILL-00 execution ${exec00} so the new handoff is picked up downstream ...`);
  try {
    await orchestrator.approveExecution(exec00);
    console.log('  approved.');
  } catch (err) {
    console.warn(`  approve failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // ── Stage 2: SKILL-01-S ──────────────────────────────────────────────
  console.log('\nTriggering SKILL-01-S (FRD) ...');
  const exec01 = await orchestrator.executeSkill(mod.id, 'SKILL-01-S');
  console.log(`  executionId: ${exec01}\n`);
  const result01 = await pollExecution(prisma, exec01, 'SKILL-01-S');
  const afterFeatures = uniqIds(result01.humanDocument, /\bF-\d{2,}-\d{2,}\b/g)
    .filter((fid) => fid.startsWith('F-05-'));
  console.log(`\nSKILL-01-S done.`);
  console.log(`  status:                ${result01.status}`);
  console.log(`  humanDocLen:           ${result01.humanDocument.length}`);
  console.log(`  Features (F-05-NN):    ${afterFeatures.length}  [${afterFeatures.join(', ') || '(none)'}]`);

  // Latest artifact + RTM after the chain
  const finalFrd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  Latest FRD artifact:   ${finalFrd?.artifactId} (${finalFrd?.id})`);

  const rtm = mod.projectId
    ? await prisma.baRtmRow.findMany({
        where: { projectId: mod.projectId, moduleId: 'MOD-05' },
        select: { featureId: true, featureName: true, screenRef: true },
        orderBy: [{ featureId: 'asc' }],
      })
    : [];
  console.log(`  RTM rows after chain:  ${rtm.length}`);
  for (const r of rtm) {
    console.log(`    ${r.featureId.padEnd(10)} ${(r.featureName ?? '').slice(0, 50).padEnd(52)} screens=${r.screenRef ?? ''}`);
  }

  // ── Diff ─────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────');
  console.log('DIFF — BEFORE vs AFTER');
  console.log('──────────────────────────────────────────────');
  console.log(`SKILL-00 handoff SCR ids: ${beforeScrInHandoff.length} → ${after00ScrIds.length}`);
  console.log(`FRD F-05-NN features:     ${beforeFeatures.filter((f) => f.startsWith('F-05-')).length} → ${afterFeatures.length}`);
  const addedFeatures = afterFeatures.filter((f) => !beforeFeatures.includes(f));
  console.log(`New features added:       [${addedFeatures.join(', ') || '(none)'}]`);

  await app.close();
}

main().catch((err) => {
  console.error('\n✗', err);
  process.exit(1);
});
