/** Inspect what's actually in MOD-04's database/migration pseudo-files. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  const lld = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod!.id, artifactType: 'LLD' as never },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!lld) { console.log('no LLD'); await prisma.$disconnect(); return; }
  const files = await prisma.baPseudoFile.findMany({
    where: { artifactDbId: lld.id, path: { contains: 'database' } },
    orderBy: { path: 'asc' },
  });
  console.log(`Found ${files.length} database/migration pseudo-files for ${moduleId}:\n`);
  for (const f of files.slice(0, 4)) {
    console.log(`--- ${f.path} (lang=${f.language}, ${f.aiContent.length} chars) ---`);
    console.log(f.aiContent.slice(0, 500));
    console.log();
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
