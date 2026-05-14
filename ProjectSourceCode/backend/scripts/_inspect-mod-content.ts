/** Throwaway: inspect a module's FRD + FTC content shape for data gaps. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleArg = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId: moduleArg } });
  if (!mod) { console.log(`${moduleArg} not found`); await prisma.$disconnect(); return; }

  // FRD content
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log(`\n══ ${moduleArg} — FRD content shape ══`);
  if (!frd) { console.log('no FRD'); }
  else {
    console.log(`sections: ${frd.sections.length}`);
    for (const s of frd.sections) {
      const body = s.editedContent || s.content || '';
      const featureCount = (body.match(/^#{2,4}\s+F-\d+-\d+/gm) ?? []).length;
      const screenRefs = (body.match(/Screen\s+Reference/gi) ?? []).length;
      const notApplicable = (body.match(/not\s+applicable/gi) ?? []).length;
      const stripped = s.sectionLabel.padEnd(50).slice(0, 50);
      console.log(`  [${stripped}] len=${body.length} features=${featureCount} screenRefs=${screenRefs} 'not applicable'=${notApplicable}`);
    }
    // Show first feature's body so we can see why fields show "Not applicable"
    const featureSec = frd.sections.find((s) => /feature/i.test(s.sectionLabel));
    if (featureSec) {
      const body = featureSec.editedContent || featureSec.content || '';
      const firstFeatureIdx = body.search(/^#{2,4}\s+F-\d+-\d+/m);
      if (firstFeatureIdx >= 0) {
        console.log(`\n  --- first feature block (~30 lines from offset ${firstFeatureIdx}) ---`);
        const slice = body.slice(firstFeatureIdx).split(/\r?\n/).slice(0, 30).join('\n');
        console.log(slice);
      }
    }
  }

  // FTC content
  const ftc = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log(`\n══ ${moduleArg} — FTC content shape ══`);
  if (!ftc) { console.log('no FTC'); }
  else {
    console.log(`sections: ${ftc.sections.length}`);
    let total = 0;
    for (const s of ftc.sections) {
      const body = s.editedContent || s.content || '';
      const screenRefs = (body.match(/(SCR-\d+|Screen\s+Reference)/gi) ?? []).length;
      total += screenRefs;
      console.log(`  [${s.sectionLabel.padEnd(50).slice(0, 50)}] len=${body.length} SCR-NN/screen-ref matches=${screenRefs}`);
    }
    console.log(`  TOTAL FTC screen-ref tokens: ${total}`);
    // BaTestCase model has no linkedScreens column — per-TC screens are
    // derived via linkedFeatureIds → sibling FRD feature → Screen Reference
    // (see ba-artifact-export.service.ts loadFtcExtras).
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
