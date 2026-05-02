/**
 * Run a skill (SKILL-04, SKILL-05, etc.) inside a standalone Node process
 * via Nest's createApplicationContext. The async per-feature/per-story
 * loop runs INSIDE this script's process — so the HTTP server's
 * `nest --watch` rebuilds cannot orphan it mid-flight (the symptom we
 * hit on MOD-05 SKILL-04 attempts).
 *
 * The script:
 *  1. Boots the AppModule in this process
 *  2. Calls orchestrator.executeSkill(moduleDbId, skillName) — this kicks
 *     off runSkillAsync inside the SAME process as the script
 *  3. Polls the BaSkillExecution row every N seconds, printing progress
 *  4. Exits when status leaves RUNNING/PENDING (no app.close() until then,
 *     so the detached promise has time to complete)
 *
 * Usage:
 *   npx ts-node scripts/_run-skill-standalone.ts <MOD-NN> <SKILL-NAME> [pollSec=30] [maxIters=120]
 *
 * Examples:
 *   npx ts-node scripts/_run-skill-standalone.ts MOD-05 SKILL-04 30 60
 *   npx ts-node scripts/_run-skill-standalone.ts MOD-05 SKILL-05 60 120
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

type SkillName =
  | 'SKILL-00'
  | 'SKILL-01-S'
  | 'SKILL-02-S'
  | 'SKILL-04'
  | 'SKILL-05'
  | 'SKILL-06-LLD'
  | 'SKILL-07-FTC';

async function main(): Promise<void> {
  const targetModuleId = process.argv[2];
  const skillName = process.argv[3] as SkillName;
  const pollSec = parseInt(process.argv[4] ?? '30', 10);
  const maxIters = parseInt(process.argv[5] ?? '120', 10);
  if (!targetModuleId || !skillName) {
    console.error('Usage: ts-node _run-skill-standalone.ts <MOD-NN> <SKILL-NAME> [pollSec=30] [maxIters=120]');
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

  console.log(`[${new Date().toISOString().slice(11, 19)}] Firing ${skillName} for ${targetModuleId} (${mod.id})`);
  const execId = await orch.executeSkill(mod.id, skillName);
  console.log(`[${new Date().toISOString().slice(11, 19)}] Execution: ${execId}`);

  for (let i = 0; i < maxIters; i++) {
    await new Promise((r) => setTimeout(r, pollSec * 1000));
    const e = await prisma.baSkillExecution.findUnique({ where: { id: execId } });
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] iter ${i + 1} status=${e?.status} docLen=${e?.humanDocument?.length ?? 0}`);
    if (!e || (e.status !== 'RUNNING' && e.status !== 'PENDING')) {
      console.log(`\nFINAL: ${e?.status}`);
      if (e?.errorMessage) console.log(`ERR: ${e.errorMessage.slice(0, 500)}`);
      console.log(`humanDoc: ${e?.humanDocument?.length ?? 0} chars`);
      console.log(`completedAt: ${e?.completedAt?.toISOString()}`);
      break;
    }
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
