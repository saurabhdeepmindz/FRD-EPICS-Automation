/**
 * Simulate the frontend frd-parser on a given module's FRD content and
 * print which of the 9 attributes the parser successfully extracted vs
 * which came back empty. We need this to know whether the user sees only
 * 3 of 9 attributes because of a parser bug (multi-line bullets) or a
 * content bug (markdown didn't have them).
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

const FIELD_DEFS: { name: string; labels: string[] }[] = [
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

function extractFeatureBlocks(content: string): { id: string; block: string }[] {
  const re = /(#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—\-*]+[^\n]*\n[\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|## |---\s*\n\s*##|$)/gi;
  const blocks: { id: string; block: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) blocks.push({ id: m[2], block: m[1] });
  return blocks;
}

async function inspectModule(moduleId: string): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) return;
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) return;
  const fullContent = frd.sections.map((s) => s.content).join('\n\n');
  const blocks = extractFeatureBlocks(fullContent);

  console.log(`\n────────── ${moduleId} — extractField simulation ──────────`);
  console.log(`Feature blocks found: ${blocks.length}\n`);
  console.log(`Per-feature: which fields the renderer would actually show (non-empty):`);
  for (const b of blocks.slice(0, 5)) {
    const populated: string[] = [];
    const empty: string[] = [];
    for (const def of FIELD_DEFS) {
      const v = extractField(b.block, def.labels);
      (v ? populated : empty).push(def.name);
    }
    console.log(`  ${b.id}: shown=${populated.length}/9 [${populated.join(', ')}]  empty=[${empty.join(', ')}]`);
  }
  if (blocks.length > 5) console.log(`  ... and ${blocks.length - 5} more features (same pattern)`);
}

async function main(): Promise<void> {
  await inspectModule('MOD-01');
  await inspectModule('MOD-05');
}
main().catch(console.error).finally(() => prisma.$disconnect());
