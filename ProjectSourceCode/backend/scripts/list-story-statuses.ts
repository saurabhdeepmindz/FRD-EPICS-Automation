import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const moduleId = process.argv[2] || 'MOD-04';

  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.error(`module ${moduleId} not found`); process.exit(1); }

  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-04', status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec || !exec.humanDocument) {
    console.log('No approved SKILL-04 execution with humanDocument found');
    return;
  }

  const doc = exec.humanDocument;
  // Slice the doc into per-story blocks bounded by the next "User Story US-NNN"
  // heading. Old approach (fixed-width window around each US match) bled
  // status / TBD info from neighbouring stories into the previous one.
  const stories = new Map<string, { status: string; tbdRefs: string[] }>();
  const headingRe = /(?:^|\n)#{1,4}\s*[^\n]*\bUS-(\d{3,})\b[^\n]*/g;
  const headings: Array<{ usId: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(doc)) !== null) {
    const usId = `US-${m[1]}`;
    if (!headings.some((h) => h.usId === usId)) {
      headings.push({ usId, idx: m.index });
    }
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].idx;
    const end = i + 1 < headings.length ? headings[i + 1].idx : doc.length;
    const block = doc.slice(start, end);
    let status = 'CONFIRMED';
    if (/CONFIRMED-PARTIAL/i.test(block)) status = 'CONFIRMED-PARTIAL';
    else if (/\bPARTIAL\b/i.test(block)) status = 'PARTIAL';
    const tbdRefs = Array.from(new Set(block.match(/TBD-\d{3,}/g) ?? []));
    stories.set(headings[i].usId, { status, tbdRefs });
  }

  const sorted = Array.from(stories.entries()).sort((a, b) => {
    const na = parseInt(a[0].slice(3), 10);
    const nb = parseInt(b[0].slice(3), 10);
    return na - nb;
  });

  console.log(`SKILL-04 stories for ${moduleId}:`);
  console.log();
  console.log(`${'Story'.padEnd(8)} ${'Status'.padEnd(20)} TBD-Future refs`);
  console.log(`${'─'.repeat(8)} ${'─'.repeat(20)} ${'─'.repeat(40)}`);
  let confirmedCount = 0;
  let partialCount = 0;
  for (const [usId, info] of sorted) {
    if (info.status === 'CONFIRMED-PARTIAL' || info.status === 'PARTIAL') partialCount++;
    else confirmedCount++;
    const tbdStr = info.tbdRefs.length > 0 ? info.tbdRefs.join(', ') : '—';
    console.log(`${usId.padEnd(8)} ${info.status.padEnd(20)} ${tbdStr}`);
  }
  console.log();
  console.log(`Summary: ${confirmedCount} CONFIRMED, ${partialCount} CONFIRMED-PARTIAL`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
