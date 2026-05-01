/**
 * Re-seed BaRtmRow rows from a module's latest APPROVED-or-AWAITING SKILL-01-S
 * humanDocument using the patched parseFrdFeatures (which now walks
 * markdown table catalogs as well as heading-form features).
 *
 * Used to backfill MOD-05's RTM after the parser fix landed; safe to run
 * against any module whose FRD predates the fix or otherwise has fewer
 * RTM rows than features.
 *
 * The script bootstraps the Nest application context so it can call the
 * exact same private `seedRtmFromFrd` path the live orchestrator uses
 * after a SKILL-01-S run — there is no parser duplication.
 *
 * Usage:
 *   npx ts-node scripts/backfill-rtm-from-frd.ts                # MOD-05 dry-run
 *   npx ts-node scripts/backfill-rtm-from-frd.ts --apply        # MOD-05 apply
 *   npx ts-node scripts/backfill-rtm-from-frd.ts --module MOD-06 --apply
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface Args {
  moduleId: string;
  apply: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const moduleFlag = argv.indexOf('--module');
  const moduleId = moduleFlag >= 0 ? argv[moduleFlag + 1] : 'MOD-05';
  return { moduleId, apply: argv.includes('--apply') };
}

async function main(): Promise<void> {
  const { moduleId: targetModuleId, apply } = parseArgs();
  Logger.overrideLogger(['error', 'warn', 'log']);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const orchestrator = app.get(BaSkillOrchestratorService);

  console.log('──────────────────────────────────────────────');
  console.log(`Target module:   ${targetModuleId}`);
  console.log(`Mode:            ${apply ? 'APPLY (will upsert RTM rows)' : 'DRY-RUN'}`);
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod || !mod.projectId) {
    console.error(`Module ${targetModuleId} not found or has no projectId`);
    await app.close();
    process.exit(1);
  }

  // Pull the latest SKILL-01-S humanDocument. We accept AWAITING_REVIEW
  // along with APPROVED so a backfill works on a module whose new FRD
  // has not yet been approved by the architect.
  const exec = await prisma.baSkillExecution.findFirst({
    where: {
      moduleDbId: mod.id,
      skillName: 'SKILL-01-S',
      status: { in: ['APPROVED', 'AWAITING_REVIEW', 'COMPLETED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec || !exec.humanDocument) {
    console.error(`No usable SKILL-01-S execution for ${targetModuleId}`);
    await app.close();
    process.exit(1);
  }
  console.log(`Using SKILL-01-S exec: ${exec.id}`);
  console.log(`  status: ${exec.status}, docLen: ${exec.humanDocument.length}\n`);

  const before = await prisma.baRtmRow.findMany({
    where: { projectId: mod.projectId, moduleId: mod.moduleId },
    select: { featureId: true },
  });
  console.log(`RTM rows BEFORE: ${before.length}  [${before.map((r) => r.featureId).sort().join(', ')}]\n`);

  // Use the orchestrator's own parser. The class field is private; access
  // through a typed cast so we exercise the real production code.
  const orch = orchestrator as unknown as {
    parseFrdFeatures(md: string): Array<{ featureId: string; featureName: string; status: string; priority: string; screenRef: string }>;
    seedRtmFromFrd(modDbId: string, projectId: string, md: string): Promise<void>;
  };
  const parsed = orch.parseFrdFeatures(exec.humanDocument);
  console.log(`Parser found ${parsed.length} feature(s) in this FRD:`);
  for (const f of parsed) {
    console.log(`  ${f.featureId.padEnd(10)} ${(f.featureName || '').slice(0, 50).padEnd(52)} ${f.status.padEnd(20)} ${f.priority.padEnd(8)} ${f.screenRef}`);
  }
  console.log('');

  if (!apply) {
    const newOnes = parsed.filter((f) => !before.some((b) => b.featureId === f.featureId));
    console.log(`DRY-RUN — would upsert ${parsed.length} feature row(s); ${newOnes.length} new (${newOnes.map((f) => f.featureId).join(', ') || 'none'}).`);
    await app.close();
    return;
  }

  // The orchestrator's seedRtmFromFrd is the same code path live SKILL-01-S
  // runs use — it upserts existing rows and creates new ones for any
  // feature ids that don't have an RTM row yet.
  await orch.seedRtmFromFrd(mod.id, mod.projectId, exec.humanDocument);

  const after = await prisma.baRtmRow.findMany({
    where: { projectId: mod.projectId, moduleId: mod.moduleId },
    select: { featureId: true, featureName: true, screenRef: true },
    orderBy: [{ featureId: 'asc' }],
  });
  console.log(`RTM rows AFTER:  ${after.length}`);
  for (const r of after) {
    console.log(`  ${r.featureId.padEnd(10)} ${(r.featureName ?? '').slice(0, 50).padEnd(52)} screens=${r.screenRef ?? ''}`);
  }
  const added = after.length - before.length;
  console.log(`\nNew rows added: ${added}`);

  await app.close();
}

main().catch((err) => {
  console.error('\n✗', err);
  process.exit(1);
});
