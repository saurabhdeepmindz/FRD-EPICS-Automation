/** Per-feature attribute audit for a module's latest FRD. Confirms each
 *  F-NN-XX has full content (no 'Not applicable' placeholders). */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  if (!frd) { console.log('no FRD'); await prisma.$disconnect(); return; }
  const body = frd.sections.map((s) => s.editedContent || s.content || '').join('\n\n');

  console.log(`\n=== ${moduleId} latest FRD: per-feature attribute audit ===`);
  console.log(`artifact: ${frd.id} (status=${frd.status}, created ${frd.createdAt.toISOString().slice(0, 16)})`);
  console.log(`total body: ${body.length} chars across ${frd.sections.length} section(s)`);

  const featureRegex = /^####\s+(F-\d+-\d+)[:\s]/gm;
  const matches = [...body.matchAll(featureRegex)];
  console.log(`\nfeatures detected: ${matches.length}`);

  const ATTRS = [
    'Description', 'Screen Reference', 'Trigger',
    'Pre-Condition', 'Post-Condition',
    'Business Rule', 'Validation', 'Integration', 'Acceptance',
  ];

  let allGood = true;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const featureBlock = body.slice(start, end);
    const present: string[] = [];
    const missing: string[] = [];
    const placeholder: string[] = [];
    for (const a of ATTRS) {
      const labelRe = new RegExp(a.replace(/\s/g, '\\s*'), 'i');
      const found = labelRe.test(featureBlock);
      if (!found) { missing.push(a); continue; }
      const placeholderRe = new RegExp(
        a.replace(/\s/g, '\\s*') + '[\\s*_:]+[\\s\\S]{0,80}?(not\\s*applicable|n/a|tbd|—\\s*$)',
        'i',
      );
      if (placeholderRe.test(featureBlock)) placeholder.push(a);
      present.push(a);
    }
    const ok = missing.length === 0 && placeholder.length === 0;
    if (!ok) allGood = false;
    console.log(`\n${m[1]}  ${ok ? '✅' : '❌'}  present=${present.length}/${ATTRS.length} missing=${missing.length} placeholder=${placeholder.length}`);
    if (missing.length > 0) console.log(`  missing: ${missing.join(', ')}`);
    if (placeholder.length > 0) console.log(`  placeholder/N-A:  ${placeholder.join(', ')}`);
  }
  console.log(`\n=== overall: ${allGood ? '✅ all features fully populated' : '❌ some features incomplete'} ===`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
