import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const moduleId = process.argv[2] || 'MOD-04';
  const storyId = process.argv[3] || 'US-052';

  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.error(`module ${moduleId} not found`); process.exit(1); }

  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-04', status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec || !exec.humanDocument) {
    console.log('No approved SKILL-04 execution');
    return;
  }

  const doc = exec.humanDocument;

  // Find the storyId heading and capture until the next storyId heading
  const startRe = new RegExp(`(?:^|\\n)([#]{1,4}.*?\\b${storyId}\\b[^\\n]*)`, 'g');
  const startMatch = startRe.exec(doc);
  if (!startMatch) { console.log(`${storyId} heading not found in doc`); return; }
  const start = startMatch.index;

  // Find next US-NNN heading after this one (different story)
  const nextRe = /\n[#]{1,4}\s*[^\n]*US-\d{3,}[^\n]*/g;
  nextRe.lastIndex = start + startMatch[0].length;
  const nextMatch = nextRe.exec(doc);
  const end = nextMatch ? nextMatch.index : Math.min(start + 4000, doc.length);

  const slice = doc.slice(start, end);
  console.log(`── ${storyId} block (first 800 chars) ──`);
  console.log(slice.slice(0, 800));
  console.log();
  console.log('── Status / TBD references in this block ──');
  console.log('CONFIRMED-PARTIAL count:', (slice.match(/CONFIRMED-PARTIAL/gi) ?? []).length);
  console.log('CONFIRMED (not -PARTIAL) count:', (slice.match(/CONFIRMED(?!-PARTIAL)/gi) ?? []).length);
  console.log('TBD-NNN refs:', Array.from(new Set(slice.match(/TBD-\d{3,}/g) ?? [])).join(', ') || 'none');
}

main().catch(console.error).finally(() => prisma.$disconnect());
