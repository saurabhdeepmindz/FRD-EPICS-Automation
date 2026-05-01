import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) { console.error('MOD-05 not found'); return; }

  const execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-00' },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`SKILL-00 executions for MOD-05: ${execs.length}\n`);

  for (const e of execs) {
    const hp = e.handoffPacket as unknown;
    let screenCount = 0;
    let mentionedScrIds: string[] = [];
    if (hp) {
      const json = JSON.stringify(hp);
      const ids = new Set<string>();
      for (const m of json.matchAll(/\bSCR-\d+\b/g)) ids.add(m[0]);
      mentionedScrIds = [...ids].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      );
      // Try common shapes
      if (Array.isArray(hp)) {
        screenCount = hp.length;
      } else if (typeof hp === 'object' && hp !== null) {
        const obj = hp as Record<string, unknown>;
        const candidates = [obj.screens, obj.screenCards, obj.screenSummaryCards];
        for (const c of candidates) {
          if (Array.isArray(c)) {
            screenCount = c.length;
            break;
          }
        }
      }
    }
    console.log(`  ${e.id}`);
    console.log(`    status:        ${e.status}`);
    console.log(`    createdAt:     ${e.createdAt.toISOString()}`);
    console.log(`    docLen:        ${(e.humanDocument || '').length}`);
    console.log(`    handoffPresent:${hp ? 'yes' : 'no'}`);
    console.log(`    SCR ids in handoff: ${mentionedScrIds.length}  [${mentionedScrIds.slice(0, 25).join(', ')}${mentionedScrIds.length > 25 ? `, ... (${mentionedScrIds.length - 25} more)` : ''}]`);
    console.log(`    screen array length (if shaped): ${screenCount}`);
    console.log('');
  }

  // For comparison, MOD-04 (the working baseline)
  const mod4 = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-04' } });
  if (mod4) {
    const e4 = await prisma.baSkillExecution.findFirst({
      where: { moduleDbId: mod4.id, skillName: 'SKILL-00' },
      orderBy: { createdAt: 'desc' },
    });
    if (e4) {
      const json = JSON.stringify(e4.handoffPacket || {});
      const ids = new Set<string>();
      for (const m of json.matchAll(/\bSCR-\d+\b/g)) ids.add(m[0]);
      console.log(`MOD-04 (baseline) SKILL-00:`);
      console.log(`  SCR ids in handoff: ${ids.size}  [${[...ids].sort().join(', ')}]`);
      console.log(`  docLen: ${(e4.humanDocument || '').length}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
