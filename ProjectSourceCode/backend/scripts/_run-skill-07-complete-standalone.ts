/**
 * Run SKILL-07-FTC complete pipeline (mode 2 → 2b → 2c → 3) inside a
 * standalone Node process via Nest's createApplicationContext. The
 * per-feature / per-category / per-feature-WB / narrative loops run
 * INSIDE this script's process — so the HTTP server's `nest --watch`
 * rebuilds cannot orphan it mid-flight.
 *
 * SKILL-07-FTC differs from SKILL-04 / 05 in that it does NOT write
 * BaSkillExecution rows. The orchestrator's per-mode methods write
 * directly to BaArtifact + BaTestCase. So we do not poll an exec id
 * here — instead we just await orch.executeSkill07Complete(...) which
 * returns the per-mode summary when all phases finish.
 *
 * Usage:
 *   npx ts-node scripts/_run-skill-07-complete-standalone.ts <MOD-NN>
 *
 * Example:
 *   npx ts-node scripts/_run-skill-07-complete-standalone.ts MOD-05
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const targetModuleId = process.argv[2];
  if (!targetModuleId) {
    console.error('Usage: ts-node _run-skill-07-complete-standalone.ts <MOD-NN>');
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const orch = app.get(BaSkillOrchestratorService);

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`${targetModuleId} not found`);
    await app.close();
    process.exit(1);
  }

  const startTs = new Date();
  console.log(`[${startTs.toISOString().slice(11, 19)}] Firing SKILL-07-FTC complete for ${targetModuleId} (${mod.id})`);

  const result = await orch.executeSkill07Complete(mod.id);

  const endTs = new Date();
  const elapsedSec = Math.round((endTs.getTime() - startTs.getTime()) / 1000);
  console.log(`\n[${endTs.toISOString().slice(11, 19)}] Complete pipeline finished in ${elapsedSec}s`);
  console.log(`  artifactId: ${result.artifactId}`);
  console.log(`  totalTcs:   ${result.totalTcs}`);
  console.log(`  per-feature: ${result.perFeature.length} entries`);
  for (const f of result.perFeature) {
    console.log(`    ${f.featureId}: tcsAdded=${f.tcsAdded} skipped=${f.skipped}`);
  }
  console.log(`  per-category: ${result.perCategory.length} entries`);
  for (const c of result.perCategory) {
    console.log(`    ${c.category}: tcsAdded=${c.tcsAdded} skipped=${c.skipped}`);
  }
  console.log(`  per-feature white-box: ${result.perFeatureWhiteBox.length} entries`);
  for (const f of result.perFeatureWhiteBox) {
    console.log(`    ${f.featureId}: tcsAdded=${f.tcsAdded} skipped=${f.skipped}`);
  }
  console.log(`  narrative: sectionsAdded=${result.narrative.sectionsAdded} skipped=${result.narrative.skipped}`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
