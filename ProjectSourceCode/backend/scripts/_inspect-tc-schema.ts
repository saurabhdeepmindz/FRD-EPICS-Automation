/** Compare BaTestCase rows between MOD-04 and MOD-05 to find shape gaps. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  for (const moduleId of ['MOD-04', 'MOD-05']) {
    const mod = await prisma.baModule.findFirst({ where: { moduleId } });
    if (!mod) { console.log(`${moduleId}: missing`); continue; }
    const fa = await prisma.baArtifact.findFirst({
      where: { moduleDbId: mod.id, artifactType: 'FTC' as never },
      select: { id: true },
    });
    if (!fa) { console.log(`${moduleId}: no FTC`); continue; }
    const total = await prisma.baTestCase.count({ where: { artifactDbId: fa.id } });
    const sample = await prisma.baTestCase.findMany({
      where: { artifactDbId: fa.id },
      take: 1,
    });
    console.log(`\n=== ${moduleId} FTC : ${total} test cases ===`);
    if (sample.length > 0) {
      // Print all keys + their value types
      const tc = sample[0];
      console.log('Sample row keys:');
      for (const k of Object.keys(tc)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: unknown = (tc as any)[k];
        let summary: string;
        if (Array.isArray(v)) summary = `Array[${v.length}] = ${JSON.stringify(v).slice(0, 80)}`;
        else if (typeof v === 'string') summary = `String[${v.length}] = ${v.slice(0, 60).replace(/\n/g, '\\n')}`;
        else summary = `${typeof v} = ${JSON.stringify(v)?.slice(0, 60) ?? 'null'}`;
        console.log(`  ${k.padEnd(22)} ${summary}`);
      }
    }
    // BaTestCase has no `linkedScreens` field — per-TC screens flow from
    // linkedFeatureIds → sibling FRD feature → Screen Reference. Done in
    // ba-artifact-export.service.ts:loadFtcExtras.
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
