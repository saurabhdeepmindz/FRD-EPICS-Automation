/**
 * Inspect the new MOD-05 FRD's section breakdown to find why feature
 * content is duplicating in the UI. Suspect: an extra section (e.g.
 * a consolidated "Business Rules" or "Validations") also carries
 * per-feature BR-NN / VAL-NN entries, and FrdArtifactView renders
 * BOTH the per-feature card AND the consolidated section.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) return;
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { sectionKey: 'asc' } } },
  });
  if (!frd) return;

  console.log(`MOD-05 NEW FRD: artifact ${frd.id}\nsections: ${frd.sections.length}\n`);
  for (const s of frd.sections) {
    const featCount = (s.content.match(/\bF-\d{2,}-\d{2,}\b/g) ?? []).length;
    const brCount = (s.content.match(/\bBR-\d{2,}\b/g) ?? []).length;
    const acCount = (s.content.match(/\bAC-\d{2,}\b/g) ?? []).length;
    console.log(`[${s.sectionKey}] "${s.sectionLabel}"`);
    console.log(`   len=${s.content.length}  F-IDs=${featCount}  BR-IDs=${brCount}  AC-IDs=${acCount}`);
  }

  // Show how parseFrdContent would categorise each section.
  console.log('\nCategorisation by parseFrdContent:');
  for (const s of frd.sections) {
    const key = s.sectionKey.toLowerCase();
    let bucket = 'otherSections (rendered as CollapsibleSection if no F-IDs)';
    if (key.includes('business_rule') || key.includes('businessrule')) bucket = 'businessRules → rendered as CollapsibleSection';
    else if (key.includes('validation')) bucket = 'validations → rendered as CollapsibleSection';
    else if (key.includes('tbd') || key.includes('future') || key.includes('registry')) bucket = 'tbdFutureRegistry';
    else if (key.includes('module_overview') || key.includes('module_identification') || key.includes('purpose')) bucket = 'moduleDescription';
    else {
      const hasFeatureBlocks = /F-\d+-\d+/i.test(s.content);
      bucket = hasFeatureBlocks ? 'feature blocks → consumed by feature cards' : 'otherSections → rendered as CollapsibleSection';
    }
    console.log(`  ${s.sectionKey.padEnd(50)} → ${bucket}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
