/** Show SUBTASK data shape for restructurer design. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }

  const st = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log(`SUBTASK artifact: ${st ? st.sections.length : 0} BaArtifactSection rows`);
  if (st) {
    console.log('\nfirst 10 section labels (with body lengths):');
    for (const s of st.sections.slice(0, 10)) {
      const body = s.editedContent || s.content || '';
      console.log(`  [${s.sectionKey.padEnd(40)}] ${s.sectionLabel.padEnd(40)} len=${body.length}`);
    }
  }

  const subs = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    take: 5,
    orderBy: { subtaskId: 'asc' },
    include: { sections: { orderBy: { sectionNumber: 'asc' } } },
  });
  console.log(`\nBaSubTask sample (first 5 of ${await prisma.baSubTask.count({ where: { moduleDbId: mod.id } })}):`);
  for (const t of subs) {
    console.log(`\n  ${t.subtaskId} | name="${t.subtaskName}" | team=${t.team} | userStory=${t.userStoryId} | feature=${t.featureId}`);
    console.log(`    BaSubTaskSection rows: ${t.sections.length}`);
    if (t.sections.length > 0) {
      console.log(`    sections: ${t.sections.slice(0, 5).map((s) => `${s.sectionNumber}.${s.sectionLabel}`).join(' | ')}...`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
