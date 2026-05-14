/** Inspect why MOD-04 FTC isn't getting per-feature screen cards. */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }

  // FTC heading audit
  const ftc = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' as never },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  console.log(`=== ${moduleId} FTC body heading audit ===`);
  if (ftc) {
    for (const s of ftc.sections) {
      const body = s.content || '';
      const h2 = (body.match(/^##\s+F-\d+-\d+/gm) ?? []).length;
      const h3 = (body.match(/^###\s+F-\d+-\d+/gm) ?? []).length;
      const h4 = (body.match(/^####\s+F-\d+-\d+/gm) ?? []).length;
      if (h2 + h3 + h4 > 0) console.log(`  ${s.sectionLabel.padEnd(40)} h2=${h2} h3=${h3} h4=${h4}`);
    }
  }

  // FRD candidate ordering
  const frds = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'FRD' as never },
    orderBy: [{ status: 'desc' }, { approvedAt: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, artifactId: true, status: true, approvedAt: true, updatedAt: true, createdAt: true },
  });
  console.log(`\n=== FRD candidate order (as loadFtcExtras picks) ===`);
  for (const f of frds) {
    console.log(`  - ${f.artifactId} status=${f.status} approvedAt=${f.approvedAt?.toISOString().slice(0, 16) ?? 'null'} updatedAt=${f.updatedAt.toISOString().slice(0, 16)} created=${f.createdAt.toISOString().slice(0, 16)} ${f.id.slice(0, 8)}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
