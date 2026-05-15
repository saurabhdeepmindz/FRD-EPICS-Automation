/** Dump full FRD body per section. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  if (!frd) { console.log('no FRD'); await prisma.$disconnect(); return; }

  for (const s of frd.sections) {
    const body = s.editedContent || s.content || '';
    console.log(`\n===== [${s.sectionLabel}] ${body.length} chars =====`);
    console.log(body.slice(0, 1500));
    if (body.length > 1500) console.log('...[truncated]');
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
