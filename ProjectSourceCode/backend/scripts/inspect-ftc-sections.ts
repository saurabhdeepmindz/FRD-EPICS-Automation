import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const moduleId = process.argv[2] || 'MOD-04';
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.error('module not found'); return; }
  const artifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' },
    orderBy: { createdAt: 'desc' },
  });
  if (!artifact) { console.log('no FTC artifact'); return; }
  const sections = await prisma.baArtifactSection.findMany({
    where: { artifactId: artifact.id },
    orderBy: { createdAt: 'asc' },
    select: { sectionKey: true, sectionLabel: true, content: true },
  });
  console.log(`Artifact: ${artifact.artifactId}`);
  console.log(`Total sections: ${sections.length}\n`);
  for (const s of sections) {
    const len = s.content?.length ?? 0;
    console.log(`  [${s.sectionKey}] "${s.sectionLabel}"  contentLen=${len}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
