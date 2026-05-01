import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod || !mod.projectId) return;
  const rtm = await prisma.baRtmRow.findMany({
    where: { projectId: mod.projectId, moduleId: 'MOD-05' },
    select: { featureId: true, featureName: true },
    orderBy: [{ featureId: 'asc' }],
  });
  console.log(`MOD-05 RTM rows: ${rtm.length}`);
  for (const r of rtm) console.log(`  ${r.featureId.padEnd(10)} ${r.featureName ?? ''}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
