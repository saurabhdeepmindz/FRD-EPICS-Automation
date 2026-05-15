/** Show USER_STORY section structure for restructurer design. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const us = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'USER_STORY' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  if (!us) { console.log('no USER_STORY'); await prisma.$disconnect(); return; }
  console.log(`USER_STORY for ${moduleId}: ${us.sections.length} sections`);
  console.log('\nfirst 12 section labels + keys + lengths + inner headings:');
  for (const s of us.sections.slice(0, 12)) {
    const body = s.editedContent || s.content || '';
    const innerH = body.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l)).slice(0, 6);
    console.log(`\n[${s.sectionKey}] label="${s.sectionLabel}" len=${body.length}`);
    if (innerH.length > 0) {
      console.log(`  inner headings (first 6 of ${body.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l)).length}):`);
      for (const h of innerH) console.log(`    ${h}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
