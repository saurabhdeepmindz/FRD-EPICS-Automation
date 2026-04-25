import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const key = process.argv[2];
  const s = await prisma.baArtifactSection.findFirst({ where: { sectionKey: key } });
  if (!s) { console.log('not found'); return; }
  console.log(s.content);
}
main().catch(console.error).finally(() => prisma.$disconnect());
