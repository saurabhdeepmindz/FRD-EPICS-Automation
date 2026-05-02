/**
 * Compare per-feature attribute coverage between MOD-01 (F-01-01 reference)
 * and MOD-05. We want to know whether SKILL-04 emits the 9 canonical
 * attributes (Description, Screen Reference, Trigger, Pre-Conditions,
 * Post-Conditions, Business Rules, Validations, Integration Signals,
 * Acceptance Criteria) per feature in MOD-01 — and if so, why MOD-05
 * doesn't.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ATTR_PATTERNS: Record<string, RegExp> = {
  Description: /\b(Feature\s*)?Description\s*[:\-]/i,
  ScreenReference: /\bScreen\s*Reference\s*[:\-]/i,
  Trigger: /\bTrigger\s*[:\-]/i,
  PreConditions: /\bPre[-\s]*conditions?\s*[:\-]/i,
  PostConditions: /\bPost[-\s]*conditions?\s*[:\-]/i,
  BusinessRules: /\bBusiness\s*Rules?\s*[:\-]/i,
  Validations: /\bValidations?\s*[:\-]/i,
  IntegrationSignals: /\bIntegration\s*Signals?\s*[:\-]/i,
  AcceptanceCriteria: /\bAcceptance\s*Criteria\s*[:\-]/i,
};

function inspectFeatureBlocks(content: string, moduleId: string): void {
  // Find feature heading anchors and slice content into per-feature blocks.
  // Heading style: #### F-XX-XX or **F-XX-XX:** or | F-XX-XX | (table row).
  const headingRe = /(^|\n)\s*#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—\-*]+([^\n]+)/g;
  const blocks: { id: string; name: string; body: string }[] = [];
  const matches: { id: string; name: string; idx: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(content)) !== null) {
    matches.push({ id: m[2], name: m[3].replace(/\*+/g, '').trim(), idx: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : content.length;
    blocks.push({ id: matches[i].id, name: matches[i].name, body: content.slice(start, end) });
  }

  console.log(`\n=== ${moduleId} — heading-style feature blocks: ${blocks.length} ===`);
  if (blocks.length === 0) {
    console.log('  (no #### F-XX-XX style blocks found — features only in tables/inline)');
  }
  for (const b of blocks) {
    const present: string[] = [];
    const missing: string[] = [];
    for (const [attr, pat] of Object.entries(ATTR_PATTERNS)) {
      (pat.test(b.body) ? present : missing).push(attr);
    }
    console.log(`  ${b.id}: present=${present.length}/9  missing=[${missing.join(', ')}]`);
  }
}

async function inspectModule(moduleId: string): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) {
    console.log(`${moduleId}: not found`);
    return;
  }

  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) {
    console.log(`${moduleId}: FRD artifact not found`);
    return;
  }

  console.log(`\n────────── ${moduleId} (${mod.moduleName}) ──────────`);
  console.log(`FRD artifact id=${frd.id}  sections=${frd.sections.length}`);

  const fullContent = frd.sections.map((s) => s.content).join('\n\n');

  // Catalog feature ids
  const ids = new Set<string>();
  for (const m of fullContent.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) ids.add(m[0]);
  console.log(`Distinct feature IDs anywhere in content: ${ids.size} → ${[...ids].sort().join(', ')}`);

  // Per-section breakdown showing which sections likely hold per-feature blocks
  console.log(`\nSections with any of the 9 attribute labels (= candidate per-feature blocks):`);
  for (const s of frd.sections) {
    const hits: string[] = [];
    for (const [attr, pat] of Object.entries(ATTR_PATTERNS)) {
      if (pat.test(s.content)) hits.push(attr);
    }
    if (hits.length >= 3) {
      console.log(`  [${s.sectionKey}] len=${s.content.length}  attrs(${hits.length}/9)=${hits.join(', ')}`);
    }
  }

  inspectFeatureBlocks(fullContent, moduleId);
}

async function main(): Promise<void> {
  await inspectModule('MOD-01');
  await inspectModule('MOD-05');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
