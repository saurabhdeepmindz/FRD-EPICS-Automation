import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const moduleId = process.argv[2] || 'MOD-04';
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.error('module not found'); return; }
  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-07-FTC' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec) { console.log('no FTC execution'); return; }
  console.log(exec.humanDocument ?? '(empty humanDocument)');
}
main().catch(console.error).finally(() => prisma.$disconnect());
