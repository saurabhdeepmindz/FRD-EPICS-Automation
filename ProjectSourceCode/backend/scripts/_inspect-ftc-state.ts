/** Inspect what's actually in a module's FTC after generation. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-06';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const ftc = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!ftc) { console.log('no FTC'); await prisma.$disconnect(); return; }
  console.log(`FTC artifact: ${ftc.id} (status=${ftc.status}, ${ftc.sections.length} sections)`);
  for (const s of ftc.sections) {
    const body = s.editedContent || s.content || '';
    console.log(`  [${s.sectionKey}] ${s.sectionLabel} — len=${body.length}`);
  }
  const tcs = await prisma.baTestCase.findMany({
    where: { artifactDbId: ftc.id },
    select: {
      testCaseId: true, title: true, category: true, scope: true, testKind: true,
      linkedFeatureIds: true, linkedStoryIds: true, owaspCategory: true,
    },
  });
  console.log(`\nBaTestCase rows (${tcs.length}):`);
  for (const tc of tcs) {
    console.log(`  ${tc.testCaseId} | cat=${tc.category} | scope=${tc.scope} | kind=${tc.testKind} | features=${tc.linkedFeatureIds.join(',') || 'none'} | stories=${tc.linkedStoryIds.join(',') || 'none'} | owasp=${tc.owaspCategory ?? 'null'}`);
  }
  // Coverage gaps: which features have NO TCs?
  const allFeatures = new Set<string>();
  for (const r of await prisma.baRtmRow.findMany({ where: { projectId: mod.projectId!, moduleId }, select: { featureId: true } })) {
    if (r.featureId) allFeatures.add(r.featureId);
  }
  const covered = new Set<string>();
  for (const tc of tcs) for (const f of tc.linkedFeatureIds) covered.add(f);
  const missing = [...allFeatures].filter((f) => !covered.has(f));
  console.log(`\nFeature coverage: ${covered.size}/${allFeatures.size}`);
  if (missing.length > 0) console.log(`  Missing features: ${missing.join(', ')}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
