/**
 * Compare MOD-04's (working) vs MOD-05's (broken) SubTask outputs to
 * understand exactly what the AI emitted in each case. We need to know
 * the shape mismatch before deciding the fix.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect(moduleId: string): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) return;
  const sub = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!sub) {
    console.log(`${moduleId}: no SUBTASK artifact`);
    return;
  }
  const fullContent = sub.sections.map((s) => s.content).join('\n\n');

  // Count canonical patterns expected by the SubTask parser
  const stIds = (fullContent.match(/\bST-US\d+-(?:FE|BE)-\d+\b/g) ?? []);
  const usGroups = (fullContent.match(/^##+\s.*?\bUS-\d+\b/gm) ?? []);
  const stHeadings = (fullContent.match(/^##+\s.*?\bST-US/gm) ?? []);
  const distinctStIds = new Set(stIds);

  console.log(`\n────────── ${moduleId} (${mod.moduleName}) ──────────`);
  console.log(`SUBTASK artifact: ${sub.id}  sections: ${sub.sections.length}  content len: ${fullContent.length}`);
  console.log(`Canonical pattern counts:`);
  console.log(`  ST-USnnn-FE/BE-NN occurrences:  ${stIds.length}`);
  console.log(`  Distinct ST-USnnn-FE/BE-NN ids: ${distinctStIds.size}`);
  console.log(`  Per-US group headings (## ... US-NNN): ${usGroups.length}`);
  console.log(`  Per-ST headings (## ... ST-US...): ${stHeadings.length}`);

  console.log(`\nSection inventory:`);
  for (const s of sub.sections) {
    const localIds = new Set((s.content.match(/\bST-US\d+-(?:FE|BE)-\d+\b/g) ?? []));
    console.log(`  [${s.sectionKey}] "${s.sectionLabel}"  len=${s.content.length}  ST-IDs=${localIds.size}`);
  }

  // First 500 chars to see what shape was actually emitted
  console.log(`\nFirst 600 chars of content:`);
  console.log(fullContent.slice(0, 600));
  console.log(`\n...`);

  // Persisted BaSubTask records
  const records = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    orderBy: { subtaskId: 'asc' },
    take: 5,
  });
  const total = await prisma.baSubTask.count({ where: { moduleDbId: mod.id } });
  console.log(`\nPersisted BaSubTask records for this module: ${total}`);
  for (const r of records) {
    console.log(`  ${r.subtaskId.padEnd(22)} ${r.subtaskName.slice(0, 60)}`);
  }
}

async function main(): Promise<void> {
  await inspect('MOD-04');
  await inspect('MOD-05');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
