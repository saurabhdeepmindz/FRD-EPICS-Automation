import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const moduleId = process.argv[2] || 'MOD-04';
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.error('module not found'); return; }

  const artifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' },
    orderBy: { createdAt: 'desc' },
  });
  if (!artifact) { console.log('no FTC artifact'); return; }

  const tcs = await prisma.baTestCase.findMany({
    where: { artifactDbId: artifact.id },
    orderBy: { testCaseId: 'asc' },
  });

  console.log(`FTC artifact: ${artifact.artifactId}`);
  console.log(`Total test cases: ${tcs.length}\n`);

  // Group by which story / scenario each TC mentions
  const byCategory = new Map<string, number>();
  const byScope = new Map<string, number>();
  const byKind = new Map<string, number>();
  for (const tc of tcs) {
    const cat = tc.category ?? '(none)';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    byScope.set(tc.scope, (byScope.get(tc.scope) ?? 0) + 1);
    byKind.set(tc.testKind, (byKind.get(tc.testKind) ?? 0) + 1);
  }

  console.log('By category:');
  for (const [k, v] of byCategory) console.log(`  ${k.padEnd(15)} ${v}`);
  console.log('\nBy scope:');
  for (const [k, v] of byScope) console.log(`  ${k.padEnd(15)} ${v}`);
  console.log('\nBy testKind:');
  for (const [k, v] of byKind) console.log(`  ${k.padEnd(15)} ${v}`);

  console.log('\nTC IDs + scenarioGroup (first 30):');
  for (const tc of tcs.slice(0, 30)) {
    console.log(`  ${tc.testCaseId.padEnd(20)}  ${(tc.scenarioGroup ?? '—').padEnd(35)}  ${tc.title?.slice(0, 60) ?? ''}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
