/**
 * Dump the raw block + extractField output for MOD-05 F-05-02 to find
 * out why the UI is showing duplicate Business Rules / Validations /
 * Integration Signals / Acceptance Criteria sections.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractField(block: string, labels: string[]): string {
  const lines = block.split('\n');
  const lowerLabels = labels.map((l) => l.toLowerCase());
  const nextLabelRe = /^\s{0,1}[-*]\s+\*{1,2}[^*\n:]+(?::\*{1,2}|\*{1,2}\s*:)/;
  const headingRe = /^#{1,6}\s/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = line.replace(/^\s*[-*]*\s*/, '').replace(/\*{1,2}/g, '').trim();
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx < 1) continue;
    const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
    const lineValue = cleaned.substring(colonIdx + 1).trim();
    let matched = false;
    for (const target of lowerLabels) {
      if (lineLabel === target || lineLabel.includes(target) || target.includes(lineLabel)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;
    if (lineValue) return lineValue;
    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (nextLabelRe.test(next)) break;
      if (headingRe.test(next)) break;
      collected.push(next);
    }
    while (collected.length > 0 && !collected[0].trim()) collected.shift();
    while (collected.length > 0 && !collected[collected.length - 1].trim()) collected.pop();
    if (collected.length === 0) return '';
    const normalised = collected.map((l) => (l.startsWith('  ') ? l.slice(2) : l));
    return normalised.join('\n').trim();
  }
  return '';
}

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) return;
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) return;
  const fullContent = frd.sections.map((s) => s.content).join('\n\n');

  // Slice F-05-02 block (between #### F-05-02 and #### F-05-03)
  const re = /(#{1,4}\s+\*{0,2}F-05-02[:\s—\-*]+[^\n]*\n[\s\S]*?)(?=#{1,4}\s+\*{0,2}F-05-03|## |$)/i;
  const m = fullContent.match(re);
  const block = m ? m[1] : '';
  console.log('────────── RAW F-05-02 BLOCK ──────────');
  console.log(block);
  console.log('\n────────── EXTRACTED FIELDS ──────────');
  const fields: { name: string; labels: string[] }[] = [
    { name: 'description', labels: ['Feature Description', 'Description'] },
    { name: 'screenRef', labels: ['Screen Reference', 'Screen Ref', 'Screen'] },
    { name: 'trigger', labels: ['Trigger'] },
    { name: 'preConditions', labels: ['Pre-conditions', 'Pre-condition', 'Preconditions', 'Prerequisites'] },
    { name: 'postConditions', labels: ['Post-conditions', 'Post-condition', 'Postconditions'] },
    { name: 'businessRules', labels: ['Business Rules', 'Business Rule', 'Rules'] },
    { name: 'validations', labels: ['Validations', 'Validation'] },
    { name: 'integrationSignals', labels: ['Integration Signals', 'Integration', 'Integrations'] },
    { name: 'acceptanceCriteria', labels: ['Acceptance Criteria', 'Acceptance'] },
  ];
  for (const f of fields) {
    const v = extractField(block, f.labels);
    console.log(`\n--- ${f.name} ---`);
    console.log(v || '(empty)');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
