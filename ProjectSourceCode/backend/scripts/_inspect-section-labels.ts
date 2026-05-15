/** Inspect section labels per artifact type. Surface anything that would
 *  match the internal-section regex so we can catch over-filtering. */
import { PrismaClient } from '@prisma/client';

const INTERNAL_RE =
  /^(step\s*\d+|introduction|output\s*checklist|update\s*compact\s*module\s*index|validate\s*the\s*frd|obtain\s*customer\s*sign[\s-]?off|customer\s*sign[\s-]?off|sign[\s-]?off|definition\s*of\s*done)/i;

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const targets = ['MOD-04', 'MOD-05'];
  const types = ['FRD', 'EPIC', 'USER_STORY', 'SUBTASK', 'FTC', 'LLD'];
  for (const moduleId of targets) {
    const mod = await prisma.baModule.findFirst({ where: { moduleId } });
    if (!mod) continue;
    for (const t of types) {
      const a = await prisma.baArtifact.findFirst({
        where: { moduleDbId: mod.id, artifactType: t as never },
        orderBy: { createdAt: 'desc' },
        include: { sections: { orderBy: { createdAt: 'asc' } } },
      });
      if (!a) continue;
      const filtered: string[] = [];
      const kept: string[] = [];
      for (const s of a.sections) {
        if (INTERNAL_RE.test(s.sectionLabel.trim())) filtered.push(s.sectionLabel);
        else kept.push(s.sectionLabel);
      }
      if (filtered.length === 0 && t !== 'FRD') continue;
      console.log(`\n${moduleId} ${t}: ${a.sections.length} sections (${filtered.length} match internal regex)`);
      for (const l of filtered) console.log(`   FILTERED  ${l}`);
      if (filtered.length > 0 && kept.length > 0) {
        console.log(`   kept (${kept.length}): ${kept.slice(0, 5).join(' | ')}${kept.length > 5 ? ' ...' : ''}`);
      }
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
