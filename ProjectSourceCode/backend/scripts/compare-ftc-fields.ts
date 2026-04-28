import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIELDS: Array<keyof Awaited<ReturnType<typeof prisma.baTestCase.findFirst>> & string> = [
  'title',
  'scope',
  'testKind',
  'category',
  'priority',
  'owaspCategory',
  'scenarioGroup',
  'linkedFeatureIds',
  'linkedEpicIds',
  'linkedStoryIds',
  'linkedSubtaskIds',
  'linkedPseudoFileIds',
  'linkedLldArtifactId',
  'tags',
  'supportingDocs',
  'defectIds',
  'testData',
  'e2eFlow',
  'preconditions',
  'steps',
  'expected',
  'postValidation',
  'sqlSetup',
  'sqlVerify',
  'playwrightHint',
  'developerHints',
] as never;

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

async function moduleStats(moduleId: string) {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) return null;
  const artifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' },
    orderBy: { createdAt: 'desc' },
  });
  if (!artifact) return null;
  const tcs = await prisma.baTestCase.findMany({
    where: { artifactDbId: artifact.id },
  });
  const total = tcs.length;
  const populated: Record<string, number> = {};
  for (const f of FIELDS) {
    populated[f] = tcs.filter((tc) => !isEmpty((tc as Record<string, unknown>)[f])).length;
  }
  return { total, populated, sampleTc: tcs[0], allTcs: tcs };
}

async function main() {
  const a = await moduleStats('MOD-01');
  const b = await moduleStats('MOD-04');
  if (!a || !b) {
    console.error('one of MOD-01 / MOD-04 has no FTC artifact');
    return;
  }

  console.log('FIELD POPULATION COMPARISON');
  console.log(`MOD-01 test cases: ${a.total}`);
  console.log(`MOD-04 test cases: ${b.total}\n`);

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad('field', 25), pad('MOD-01 (filled/total)', 26), pad('MOD-04 (filled/total)', 26), 'gap');
  console.log('-'.repeat(90));
  for (const f of FIELDS) {
    const ap = a.populated[f];
    const bp = b.populated[f];
    const apct = a.total ? Math.round((ap / a.total) * 100) : 0;
    const bpct = b.total ? Math.round((bp / b.total) * 100) : 0;
    const gap = apct - bpct;
    const flag = gap >= 30 ? ' <<' : gap >= 10 ? ' <' : '';
    console.log(
      pad(f, 25),
      pad(`${ap}/${a.total} (${apct}%)`, 26),
      pad(`${bp}/${b.total} (${bpct}%)`, 26),
      `${gap > 0 ? '+' : ''}${gap}%${flag}`,
    );
  }

  console.log('\n\nSAMPLE MOD-01 TC (first):');
  console.log(JSON.stringify(a.sampleTc, null, 2)?.slice(0, 3500));
  console.log('\n\nSAMPLE MOD-04 TC (first):');
  console.log(JSON.stringify(b.sampleTc, null, 2)?.slice(0, 3500));
}

main().catch(console.error).finally(() => prisma.$disconnect());
