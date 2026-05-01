import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) return;
  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-01-S' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec || !exec.handoffPacket) return;
  const p = exec.handoffPacket as unknown;
  console.log('typeof:', typeof p);
  console.log('isArray:', Array.isArray(p));
  if (Array.isArray(p)) {
    console.log('array length:', p.length);
    console.log('first item keys:', p[0] ? Object.keys(p[0]) : '(empty)');
    console.log('first item (truncated):', JSON.stringify(p[0]).slice(0, 600));
  } else {
    console.log('top keys:', Object.keys(p as Record<string, unknown>));
    const json = JSON.stringify(p);
    console.log('first 1500 chars of JSON:', json.slice(0, 1500));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
