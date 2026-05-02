/**
 * Inspect MOD-05 FRD artifact content + apply the frontend's Strategy-1
 * regex to see how many features the parser would extract.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) {
    console.log('mod not found');
    return;
  }

  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) {
    console.log('FRD artifact not found');
    return;
  }

  console.log(`FRD artifact: ${frd.id}`);
  console.log(`  sections: ${frd.sections.length}\n`);

  const fullContent = frd.sections.map((s) => s.content).join('\n\n');
  const ids = new Set<string>();
  for (const m of fullContent.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) ids.add(m[0]);
  console.log(`Distinct feature IDs across all FRD section content: ${ids.size}`);
  console.log(`  ${[...ids].sort().join(', ')}\n`);

  console.log('Per-section feature counts:');
  for (const s of frd.sections) {
    const localIds = new Set<string>();
    for (const m of s.content.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) localIds.add(m[0]);
    console.log(`  [${s.sectionKey}] "${s.sectionLabel}" len=${s.content.length} feats=${localIds.size}`);
  }

  // Apply frontend Strategy-1 regex
  const strategy1 = /#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|---\s*\n\s*#{1,4}\s+\*{0,2}F-|$)/gi;
  const parsed: { id: string; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = strategy1.exec(fullContent)) !== null) {
    parsed.push({ id: m[1], name: m[2].replace(/\*+/g, '').trim().slice(0, 70) });
  }
  console.log(`\nParser Strategy-1 matches: ${parsed.length}`);
  for (const p of parsed) console.log(`  ${p.id}: ${p.name}`);

  // Show every line that contains an F-XX-XX id (so we can see the actual format used)
  console.log('\nLines containing feature IDs (first 60):');
  const lines = fullContent.split('\n');
  let shown = 0;
  for (const line of lines) {
    if (/\bF-\d{2,}-\d{2,}\b/.test(line)) {
      console.log(`  ${line.slice(0, 140)}`);
      if (++shown >= 60) {
        console.log('  ...');
        break;
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
