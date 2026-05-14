/** Compare all FRD versions for a module. Shows features + screen refs per version. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const arts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'FRD' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log(`Total ${moduleId} FRD artifacts: ${arts.length}`);
  for (const a of arts) {
    console.log(`\n--- ${a.artifactId} ${a.status} created ${a.createdAt.toISOString().slice(0, 16)} (${a.sections.length} sections) ---`);
    const body = a.sections.map((s) => s.content ?? '').join('\n');
    const featuresRaw = body.match(/^#{2,4}\s+(F-\d+-\d+)/gm) ?? [];
    const uniqFeatures = [...new Set(featuresRaw.map((f) => /F-\d+-\d+/.exec(f)![0]))];
    const screenRefs = (body.match(/Screen\s+Reference[\s*_:]*\s*(SCR-\d+)/gi) ?? []).length;
    const notApp = (body.match(/not\s+applicable/gi) ?? []).length;
    console.log(`  features (${uniqFeatures.length}): ${uniqFeatures.join(', ')}`);
    console.log(`  screen-refs: ${screenRefs}`);
    console.log(`  'not applicable' phrases: ${notApp}`);
    console.log(`  total body length: ${body.length}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
