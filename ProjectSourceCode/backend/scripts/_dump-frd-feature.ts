/** Dump full body of one feature block from a module's latest FRD. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const featureId = process.argv[3] ?? 'F-04-01';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  if (!frd) { console.log('no FRD'); await prisma.$disconnect(); return; }
  const body = frd.sections.map((s) => s.editedContent || s.content || '').join('\n\n');
  const re = new RegExp(`^####\\s+${featureId.replace(/-/g, '-')}[:\\s]`, 'm');
  const start = body.search(re);
  if (start < 0) { console.log(`${featureId} not found`); await prisma.$disconnect(); return; }
  const nextHeading = body.slice(start + 1).search(/^#{1,4}\s+/m);
  const end = nextHeading < 0 ? body.length : start + 1 + nextHeading;
  console.log(`=== ${moduleId} FRD: ${featureId} block (${end - start} chars) ===\n`);
  console.log(body.slice(start, end));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
