/**
 * Run SKILL-07-FTC mode 3 (narrative pass only) for a module. Used to
 * fill the canonical narrative sections (summary, test_strategy, …,
 * traceability_summary) when the complete pipeline's mode-3 phase
 * failed (e.g. 502 / 429 mid-run) but modes 2 / 2b / 2c left a healthy
 * TC catalogue behind.
 *
 * Idempotent: mode 3 only writes section bodies (no TCs). Re-running
 * is safe.
 *
 * Usage:
 *   npx ts-node scripts/_run-skill-07-narrative.ts <MOD-NN>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const targetModuleId = process.argv[2];
  if (!targetModuleId) {
    console.error('Usage: ts-node _run-skill-07-narrative.ts <MOD-NN>');
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
  console.log(`[${startTs.toISOString().slice(11, 19)}] Firing SKILL-07-FTC narrative for ${targetModuleId} (${mod.id})`);

  const result = await orch.executeSkill07Narrative(mod.id);

  const endTs = new Date();
  const elapsedSec = Math.round((endTs.getTime() - startTs.getTime()) / 1000);
  console.log(`\n[${endTs.toISOString().slice(11, 19)}] Narrative finished in ${elapsedSec}s`);
  console.log(`  artifactId:    ${result.artifactId}`);
  console.log(`  sectionsAdded: ${result.sectionsAdded}`);
  console.log(`  skipped:       ${result.skipped}`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
