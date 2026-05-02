/**
 * Check for any RUNNING / PENDING / AWAITING_REVIEW SKILL-04 executions
 * for MOD-05. The UI shows "Executing User Stories..." after the cascade
 * already finished — need to know whether that's stale UI state or a
 * fresh execution that got kicked off.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) return;

  const all = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-04' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`Latest 5 SKILL-04 executions for MOD-05:`);
  for (const e of all) {
    console.log(`  ${e.id}  status=${e.status.padEnd(18)} created=${e.createdAt.toISOString()}  completed=${e.completedAt?.toISOString() ?? '-'}`);
  }

  const live = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, status: { in: ['PENDING', 'RUNNING'] } },
  });
  console.log(`\nLive (PENDING/RUNNING) executions for MOD-05: ${live.length}`);
  for (const e of live) {
    console.log(`  ${e.id}  ${e.skillName}  ${e.status}  created=${e.createdAt.toISOString()}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
