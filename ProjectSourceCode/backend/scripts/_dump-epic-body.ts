/** Show EPIC body's heading structure for restructurer design. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const ep = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'EPIC' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!ep || ep.sections.length === 0) { console.log('no EPIC'); await prisma.$disconnect(); return; }
  const s = ep.sections[0];
  const body = s.editedContent || s.content || '';
  console.log(`section "${s.sectionLabel}" body len: ${body.length}`);
  console.log('\nheadings:');
  const headings = body.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l));
  for (const h of headings) console.log(`  ${h}`);
  console.log('\nfirst 800 chars of body:');
  console.log(body.slice(0, 800));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
