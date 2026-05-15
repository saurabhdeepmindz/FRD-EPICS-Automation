/** Find which source row produces the leading misordered subtask. */
import { PrismaClient } from '@prisma/client';

const SUBTASK_ID_RE = /\bST-(US\d{3,})-([A-Z]{2,4})-(\d{2,})\b/;

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  const st = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod!.id, artifactType: 'SUBTASK' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log(`Total sections: ${st!.sections.length}`);

  // Find any source row whose label doesn't carry ST-USNNN-TEAM-NN but
  // whose body's first 8 lines DO mention ST-US066 (or any ST- not
  // matching its own label).
  for (const s of st!.sections) {
    const labelMatch = SUBTASK_ID_RE.exec(s.sectionLabel);
    const content = (s.isHumanModified && s.editedContent ? s.editedContent : s.content) ?? '';
    const firstLines = content.split(/\r?\n/).slice(0, 8).join(' ');
    const bodyMatch = SUBTASK_ID_RE.exec(firstLines);
    if (!labelMatch && bodyMatch) {
      console.log(`\n[!] Row labelled "${s.sectionLabel.slice(0, 80)}" — first body match: ST-${bodyMatch[1]}-${bodyMatch[2]}-${bodyMatch[3]}`);
      console.log(`    first 200 chars of body: ${content.slice(0, 200).replace(/\n/g, ' / ')}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
