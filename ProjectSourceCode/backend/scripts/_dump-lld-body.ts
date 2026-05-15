/** Inspect LLD section structure for restructurer design. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const lld = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'LLD' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } }, pseudoFiles: true },
  });
  if (!lld) { console.log('no LLD'); await prisma.$disconnect(); return; }
  console.log(`LLD for ${moduleId}: ${lld.artifactId} (${lld.sections.length} sections, ${lld.pseudoFiles.length} pseudo-files)`);
  console.log('\nSection labels + body lengths + first inner heading:');
  for (const s of lld.sections) {
    const body = s.editedContent || s.content || '';
    const innerH = body.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l));
    const firstH = innerH.slice(0, 3).join(' | ');
    console.log(`  [${s.sectionKey.padEnd(40).slice(0, 40)}] ${s.sectionLabel.padEnd(48).slice(0, 48)} len=${body.length} innerH=${innerH.length}`);
    if (firstH) console.log(`    first inner H: ${firstH.slice(0, 200)}`);
  }
  console.log(`\nPseudo-files (${lld.pseudoFiles.length}):`);
  for (const f of lld.pseudoFiles.slice(0, 6)) {
    console.log(`  ${f.path.padEnd(60).slice(0, 60)} lang=${f.language} aiLen=${f.aiContent.length} edited=${f.isHumanModified}`);
  }
  if (lld.pseudoFiles.length > 6) console.log(`  ... +${lld.pseudoFiles.length - 6} more`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
