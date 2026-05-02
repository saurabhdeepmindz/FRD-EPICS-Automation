/**
 * MOD-06 Phase A cleanup — wipe broken FRD/EPIC/USER_STORY artifacts +
 * any RTM rows + any BaSubTask rows, then reset module status back to
 * ANALYSIS_COMPLETE so the cascade pre-checks for SKILL-01-S start
 * from a clean baseline. Preserves SCREEN_ANALYSIS (SKILL-00 output)
 * and the historical skill execution records.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-06' } });
  if (!mod) {
    console.log('MOD-06 not found');
    return;
  }
  console.log(`MOD-06 (${mod.id}) — Phase A cleanup`);
  console.log(`Current module status: ${mod.moduleStatus}`);

  // Delete broken FRD / EPIC / USER_STORY / SUBTASK artifact sections + artifacts
  const targetTypes = ['FRD', 'EPIC', 'USER_STORY', 'SUBTASK'] as const;
  for (const type of targetTypes) {
    const arts = await prisma.baArtifact.findMany({
      where: { moduleDbId: mod.id, artifactType: type },
      include: { _count: { select: { sections: true } } },
    });
    for (const a of arts) {
      const ds = await prisma.baArtifactSection.deleteMany({ where: { artifactId: a.id } });
      console.log(`  ${type}: deleted ${ds.count} sections from ${a.id}`);
    }
    if (arts.length > 0) {
      const da = await prisma.baArtifact.deleteMany({ where: { moduleDbId: mod.id, artifactType: type } });
      console.log(`  ${type}: deleted ${da.count} artifact(s)`);
    }
  }

  // Delete BaSubTask records and their sections (none expected for MOD-06 but defensive)
  const sts = await prisma.baSubTask.findMany({ where: { moduleDbId: mod.id }, select: { id: true } });
  if (sts.length > 0) {
    await prisma.baSubTaskSection.deleteMany({ where: { subtaskDbId: { in: sts.map((s) => s.id) } } });
    const dst = await prisma.baSubTask.deleteMany({ where: { moduleDbId: mod.id } });
    console.log(`  Deleted ${dst.count} BaSubTask records`);
  }

  // Delete any RTM rows for MOD-06 (will be re-seeded by SKILL-01-S post-processing)
  if (mod.projectId) {
    const drtm = await prisma.baRtmRow.deleteMany({ where: { projectId: mod.projectId, moduleId: 'MOD-06' } });
    console.log(`  Deleted ${drtm.count} RTM rows`);
  }

  // Reset module status to ANALYSIS_COMPLETE so SKILL-01-S prereq is met cleanly
  await prisma.baModule.update({
    where: { id: mod.id },
    data: { moduleStatus: 'ANALYSIS_COMPLETE', processedAt: null },
  });
  console.log(`  Reset module status: ${mod.moduleStatus} → ANALYSIS_COMPLETE`);

  // Verify
  const after = await prisma.baModule.findUnique({ where: { id: mod.id } });
  const remainingArtifacts = await prisma.baArtifact.count({
    where: { moduleDbId: mod.id, artifactType: { in: ['FRD', 'EPIC', 'USER_STORY', 'SUBTASK'] } },
  });
  const remainingScreenAnalysis = await prisma.baArtifact.count({
    where: { moduleDbId: mod.id, artifactType: 'SCREEN_ANALYSIS' },
  });
  console.log(`\nFinal:`);
  console.log(`  module status: ${after?.moduleStatus}`);
  console.log(`  FRD/EPIC/USER_STORY/SUBTASK artifacts remaining: ${remainingArtifacts}`);
  console.log(`  SCREEN_ANALYSIS preserved: ${remainingScreenAnalysis}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
