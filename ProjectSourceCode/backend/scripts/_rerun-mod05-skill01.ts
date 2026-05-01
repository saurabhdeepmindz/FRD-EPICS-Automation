/**
 * Re-run SKILL-01-S (FRD generation) for MOD-05 to rebuild the feature
 * catalog. The first run only declared F-05-03 even though MOD-05 has 20
 * screens; the user has authorized this re-run after we confirmed the
 * FRD humanDocument was the upstream gap (not the EPIC's synthesis).
 *
 * Behaviour:
 *   - Bootstraps the Nest application context (no HTTP listener).
 *   - Triggers `executeSkill('SKILL-01-S')` — fire-and-forget on the
 *     orchestrator side; we poll the BaSkillExecution row for status.
 *   - Reports features extracted by the new run vs the previous run.
 *
 * Side effects:
 *   - Creates a NEW BaArtifact (FRD-MOD-05) — old one stays in the table
 *     but `findFirst({ orderBy: createdAt desc })` now returns the new one.
 *   - Upserts BaRtmRow records for any new features (existing rows refreshed
 *     in place; nothing deleted).
 *   - Module status returns to FRD_COMPLETE once the AI call finishes — a
 *     regression from STORIES_COMPLETE that the architect must approve to
 *     restart the downstream pipeline.
 *
 * Usage:
 *   npx ts-node scripts/_rerun-mod05-skill01.ts
 *   npx ts-node scripts/_rerun-mod05-skill01.ts --module MOD-06
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface Args {
  moduleId: string;
  pollIntervalMs: number;
  timeoutMs: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const moduleFlag = argv.indexOf('--module');
  const moduleId = moduleFlag >= 0 ? argv[moduleFlag + 1] : 'MOD-05';
  return {
    moduleId,
    pollIntervalMs: 5_000,
    timeoutMs: 6 * 60 * 1000, // 6 min — generous; SKILL-01-S typically 60-120 s
  };
}

function uniqFeatures(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) ids.add(m[0]);
  return [...ids].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

async function main(): Promise<void> {
  const { moduleId: targetModuleId, pollIntervalMs, timeoutMs } = parseArgs();

  Logger.overrideLogger(['error', 'warn', 'log']);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const orchestrator = app.get(BaSkillOrchestratorService);

  console.log('──────────────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`Module ${targetModuleId} not found`);
    await app.close();
    process.exit(1);
  }

  // Snapshot the BEFORE state for comparison.
  const beforeFrd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
  });
  let beforeFeatures: string[] = [];
  if (beforeFrd) {
    const beforeSections = await prisma.baArtifactSection.findMany({
      where: { artifactId: beforeFrd.id },
      select: { content: true },
    });
    beforeFeatures = uniqFeatures(beforeSections.map((s) => s.content || '').join('\n'));
  }
  console.log(`BEFORE — FRD artifact: ${beforeFrd?.artifactId ?? '(none)'}`);
  console.log(`BEFORE — Features in FRD: ${beforeFeatures.length}  [${beforeFeatures.join(', ') || '(none)'}]`);
  console.log(`BEFORE — Module status: ${mod.moduleStatus}\n`);

  // Trigger the run. The orchestrator returns the executionId immediately
  // and runs the AI call in the background.
  console.log(`Triggering SKILL-01-S for ${targetModuleId} ...`);
  const executionId = await orchestrator.executeSkill(mod.id, 'SKILL-01-S');
  console.log(`  executionId: ${executionId}\n`);

  // Poll for completion. AWAITING_REVIEW = AI returned and artifact written;
  // COMPLETED = post-hooks done; FAILED = AI/parser failure.
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.baSkillExecution.findUnique({ where: { id: executionId } });
    if (!row) {
      console.error(`Execution ${executionId} disappeared`);
      break;
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    const line = `  [${elapsed.padStart(3, ' ')}s] status=${row.status}  docLen=${(row.humanDocument || '').length}`;
    if (line !== last) {
      console.log(line);
      last = line;
    }
    if (row.status === 'AWAITING_REVIEW' || row.status === 'COMPLETED' || row.status === 'APPROVED') {
      break;
    }
    if (row.status === 'FAILED') {
      console.error(`\nExecution failed: ${row.errorMessage ?? '(no message)'}`);
      await app.close();
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Snapshot the AFTER state.
  const finalRow = await prisma.baSkillExecution.findUnique({ where: { id: executionId } });
  const afterDoc = finalRow?.humanDocument || '';
  const afterFeatures = uniqFeatures(afterDoc);

  console.log('\n──────────────────────────────────────────────');
  console.log('AFTER');
  console.log('──────────────────────────────────────────────');
  console.log(`Execution status:        ${finalRow?.status}`);
  console.log(`humanDocument size:      ${afterDoc.length} chars`);
  console.log(`Features in new FRD:     ${afterFeatures.length}`);
  console.log(`  ${afterFeatures.join(', ') || '(none)'}\n`);

  // Latest artifact + RTM state.
  const afterFrd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Latest FRD artifact:     ${afterFrd?.artifactId} (${afterFrd?.id})`);
  console.log(`                         created ${afterFrd?.createdAt.toISOString()}`);

  const rtm = mod.projectId
    ? await prisma.baRtmRow.findMany({
        where: { projectId: mod.projectId, moduleId: mod.moduleId },
        select: { featureId: true, featureName: true, screenRef: true },
        orderBy: [{ featureId: 'asc' }],
      })
    : [];
  console.log(`\nRTM rows after run: ${rtm.length}`);
  for (const r of rtm) {
    console.log(`  ${r.featureId.padEnd(10)} ${(r.featureName ?? '').slice(0, 60).padEnd(62)} screens=${r.screenRef ?? ''}`);
  }

  // Diff vs the BEFORE state.
  const added = afterFeatures.filter((f) => !beforeFeatures.includes(f));
  const removed = beforeFeatures.filter((f) => !afterFeatures.includes(f));
  console.log(`\nFeature delta:`);
  console.log(`  Added:   ${added.join(', ') || '(none)'}`);
  console.log(`  Removed: ${removed.join(', ') || '(none)'}`);

  const updatedMod = await prisma.baModule.findUnique({ where: { id: mod.id } });
  console.log(`\nModule status now: ${updatedMod?.moduleStatus}  (architect must approve in the UI to restart downstream skills)`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
