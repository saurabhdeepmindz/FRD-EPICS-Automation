import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) return;

  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-01-S' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec) return;

  const doc = exec.humanDocument || '';
  console.log(`Latest SKILL-01-S exec: ${exec.id}`);
  console.log(`  status: ${exec.status}, len: ${doc.length}\n`);

  // Find each feature heading line so we can see what shape parseFrdFeatures
  // is up against.
  const headingLines: string[] = [];
  for (const line of doc.split(/\r?\n/)) {
    if (/F-05-\d{2,}/.test(line) && /^#{1,6}|^\*\*|^\|/.test(line.trim())) {
      headingLines.push(line.trim());
    }
  }
  console.log(`Lines containing F-05-NN with heading/table/bold prefix: ${headingLines.length}`);
  for (const l of headingLines.slice(0, 30)) {
    console.log(`  ${l.slice(0, 110)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
