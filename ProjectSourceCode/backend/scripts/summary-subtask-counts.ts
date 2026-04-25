import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.baArtifactSection.findMany({
    where: { artifact: { artifactId: 'SUBTASK-MOD-04' } },
    select: { sectionKey: true },
  });

  const byStory = new Map<string, number>();
  let decomp = 0, qaHeader = 0;
  for (const s of sections) {
    const m = /^(?:subtask_\d+_)?st_us(\d{3})_(be|fe|qa|in|int)/i.exec(s.sectionKey);
    if (m) {
      const us = 'US-' + m[1];
      const team = m[2].toUpperCase();
      const k = `${us}/${team === 'INT' ? 'IN' : team}`;
      byStory.set(k, (byStory.get(k) || 0) + 1);
    } else if (/^subtask_decomposition_for_us_/.test(s.sectionKey)) decomp++;
    else if (/^qa_subtasks_mandatory/.test(s.sectionKey)) qaHeader++;
  }

  console.log('Total sections:', sections.length);
  console.log('Decomposition group headers:', decomp);
  console.log('QA group headers:', qaHeader);
  console.log();

  const teams = ['FE', 'BE', 'IN', 'QA'];
  console.log('Story'.padEnd(8) + teams.map((t) => t.padStart(4)).join('') + '   Total');
  console.log('─'.repeat(8 + teams.length * 4 + 8));

  let grandTotal = 0;
  for (let n = 52; n <= 78; n++) {
    const us = 'US-0' + n;
    const cells = teams.map((t) => byStory.get(`${us}/${t}`) || 0);
    const total = cells.reduce((a, b) => a + b, 0);
    grandTotal += total;
    console.log(
      us.padEnd(8) +
        cells.map((c) => c.toString().padStart(4)).join('') +
        '   ' +
        total.toString().padStart(4),
    );
  }
  console.log('─'.repeat(8 + teams.length * 4 + 8));
  console.log('Total SubTask bodies:'.padEnd(8 + teams.length * 4) + '   ' + grandTotal);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
