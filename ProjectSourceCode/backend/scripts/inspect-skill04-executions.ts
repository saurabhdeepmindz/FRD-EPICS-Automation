import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`module ${targetModuleId} not found`);
    process.exit(1);
  }

  const execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-04' },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`SKILL-04 executions for ${targetModuleId} (newest first):`);
  for (const e of execs) {
    const doc = e.humanDocument ?? '';
    const usMatches = Array.from(new Set(doc.match(/US-\d{3,}/g) ?? []))
      .sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10));
    console.log(
      `  ${e.id}  status=${e.status}  createdAt=${e.createdAt.toISOString()}  docLen=${doc.length}  storyCount=${usMatches.length}  range=${usMatches[0] ?? '—'}..${usMatches[usMatches.length - 1] ?? '—'}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
