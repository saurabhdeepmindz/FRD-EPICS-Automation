import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CANONICAL_LABELS = [
  'SubTask ID',
  'SubTask Name',
  'SubTask Type',
  'Description',
  'Pre-requisites',
  'Source File Name',
  'Class Name',
  'Class Description',
  'Method Name',
  'Method Description',
  'Arguments',
  'Return Type',
  'Validations',
  'Algorithm',
  'Integration Points',
  'Error Handling',
  'Database Operations',
  'Technical Notes',
  'Traceability Header',
  'Project Structure Definition',
  'Sequence Diagram Inputs',
  'End-to-End Integration Flow',
  'Test Case IDs',
  'Acceptance Criteria',
  'Testing Notes',
];

async function main() {
  const sectionKey = process.argv[2];
  if (!sectionKey) {
    console.error('usage: ts-node scripts/verify-canonical-sections.ts <sectionKey>');
    process.exit(1);
  }

  const s = await prisma.baArtifactSection.findFirst({ where: { sectionKey } });
  if (!s) {
    console.log(`section ${sectionKey} not found`);
    return;
  }

  // Extract every "#### Section N — Label" heading from the body
  const re = /^#### Section (\d+)\s*[—\-:]\s*(.+?)\s*(?:\*\*|$)/gm;
  const found: Array<{ num: number; label: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.content)) !== null) {
    found.push({ num: parseInt(m[1], 10), label: m[2].trim() });
  }

  console.log(`Section: ${s.sectionLabel}`);
  console.log(`Found ${found.length} numbered Section headings`);
  console.log();

  let allMatch = true;
  for (let i = 0; i < CANONICAL_LABELS.length; i++) {
    const expectNum = i + 1;
    const expectLabel = CANONICAL_LABELS[i];
    const got = found.find((f) => f.num === expectNum);
    const ok = got && got.label.toLowerCase() === expectLabel.toLowerCase();
    const marker = ok ? '✓' : '✗';
    const gotStr = got ? `(got: "${got.label}")` : '(MISSING)';
    if (!ok) allMatch = false;
    console.log(`  ${marker} Section ${expectNum} — ${expectLabel}  ${ok ? '' : gotStr}`);
  }

  console.log();
  console.log(allMatch ? '✅ ALL 25 canonical labels match' : '❌ SOME LABELS DO NOT MATCH CANONICAL');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
