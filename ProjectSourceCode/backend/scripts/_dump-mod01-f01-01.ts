/**
 * Dump the raw markdown for F-01-01 from MOD-01's FRD artifact, then run
 * the same field-extraction the frontend parser uses, so we can see
 * exactly which of the 9 attributes are actually populated when the UI
 * renders the feature node.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractField(block: string, labels: string[]): string {
  const lines = block.split('\n');
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (const line of lines) {
    const cleaned = line.replace(/^\s*[-*]*\s*/, '').replace(/\*{1,2}/g, '').trim();
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx < 1) continue;
    const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
    const lineValue = cleaned.substring(colonIdx + 1).trim();
    if (!lineValue) continue;
    for (const target of lowerLabels) {
      if (lineLabel === target || lineLabel.includes(target) || target.includes(lineLabel)) {
        return lineValue;
      }
    }
  }
  return '';
}

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-01' } });
  if (!mod) return;
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) return;
  const fullContent = frd.sections.map((s) => s.content).join('\n\n');

  // Slice F-01-01 block
  const re = /(#{1,4}\s+\*{0,2}F-01-01[:\s—\-*]+[\s\S]*?)(?=#{1,4}\s+\*{0,2}F-01-0[2-9]|## |$)/i;
  const m = fullContent.match(re);
  const block = m ? m[1] : '';
  console.log('────────── RAW F-01-01 BLOCK (first 3000 chars) ──────────');
  console.log(block.slice(0, 3000));
  console.log('\n────────── EXTRACTED FIELDS (frontend extractField) ──────────');
  const fields: { name: string; labels: string[] }[] = [
    { name: 'description', labels: ['Feature Description', 'Description', 'feature description'] },
    { name: 'screenRef', labels: ['Screen Reference', 'Screen Ref', 'Screen', 'screen'] },
    { name: 'trigger', labels: ['Trigger', 'trigger'] },
    { name: 'preConditions', labels: ['Pre-conditions', 'Pre-condition', 'Preconditions', 'Prerequisites'] },
    { name: 'postConditions', labels: ['Post-conditions', 'Post-condition', 'Postconditions'] },
    { name: 'businessRules', labels: ['Business Rules', 'Business Rule', 'Rules'] },
    { name: 'validations', labels: ['Validations', 'Validation'] },
    { name: 'integrationSignals', labels: ['Integration Signals', 'Integration', 'Integrations'] },
    { name: 'acceptanceCriteria', labels: ['Acceptance Criteria', 'Acceptance'] },
  ];
  for (const f of fields) {
    const v = extractField(block, f.labels);
    console.log(`  ${f.name.padEnd(22)} ${v ? `"${v.slice(0, 100)}"` : '(empty)'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
