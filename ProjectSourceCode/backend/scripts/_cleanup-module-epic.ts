/**
 * Generic module-EPIC cleanup harness — wipes the current EPIC artifact
 * and SKILL-02-S execution records for a given moduleId so the hardened
 * SKILL-02-S can produce a fresh canonical 17-section output. Resets
 * module status from EPICS_COMPLETE back to FRD_COMPLETE so the
 * SKILL-02-S prerequisite is satisfied cleanly.
 *
 * Preserves: SCREEN_ANALYSIS, FRD artifacts, USER_STORY, SUBTASK, BaSubTask
 * records, RTM rows (epicId/epicName cleared, rest of linkage preserved).
 *
 * Usage: npx ts-node scripts/_cleanup-module-epic.ts <MOD-NN>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const moduleId = process.argv[2];
  if (!moduleId || !/^MOD-\d+$/.test(moduleId)) {
    console.error('Usage: ts-node _cleanup-module-epic.ts <MOD-NN>');
    process.exit(2);
  }

  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) {
    console.error(`${moduleId} not found`);
    process.exit(1);
  }
  console.log(`${moduleId} (${mod.id}) status before: ${mod.moduleStatus}`);

  // Delete EPIC artifact + sections
  const epics = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'EPIC' },
    include: { _count: { select: { sections: true } } },
  });
  for (const e of epics) {
    const ds = await prisma.baArtifactSection.deleteMany({ where: { artifactId: e.id } });
    console.log(`  EPIC ${e.id}: deleted ${ds.count} sections`);
  }
  if (epics.length > 0) {
    const da = await prisma.baArtifact.deleteMany({ where: { moduleDbId: mod.id, artifactType: 'EPIC' } });
    console.log(`  Deleted ${da.count} EPIC artifact(s)`);
  }

  // Delete SKILL-02-S executions
  const dexec = await prisma.baSkillExecution.deleteMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-02-S' },
  });
  console.log(`  Deleted ${dexec.count} SKILL-02-S execution record(s)`);

  // Clear epicId/epicName from RTM rows
  if (mod.projectId) {
    const drtm = await prisma.baRtmRow.updateMany({
      where: { projectId: mod.projectId, moduleId },
      data: { epicId: null, epicName: null },
    });
    console.log(`  Cleared epicId on ${drtm.count} RTM rows`);
  }

  // Reset module status to FRD_COMPLETE so SKILL-02-S prereq is met cleanly.
  // We do NOT touch the downstream skill statuses; downstream artifacts
  // (USER_STORY, SUBTASK) and BaSkillExecution records stay untouched —
  // re-running SKILL-02-S only replaces the EPIC artifact.
  await prisma.baModule.update({
    where: { id: mod.id },
    data: { moduleStatus: 'FRD_COMPLETE' },
  });
  console.log(`  Reset module status: ${mod.moduleStatus} → FRD_COMPLETE`);

  // Verify
  const after = await prisma.baModule.findUnique({ where: { id: mod.id } });
  const remainingEpics = await prisma.baArtifact.count({ where: { moduleDbId: mod.id, artifactType: 'EPIC' } });
  const remainingExecs = await prisma.baSkillExecution.count({ where: { moduleDbId: mod.id, skillName: 'SKILL-02-S' } });
  console.log(`\nFinal:`);
  console.log(`  module status: ${after?.moduleStatus}`);
  console.log(`  EPIC artifacts remaining: ${remainingEpics}`);
  console.log(`  SKILL-02-S executions remaining: ${remainingExecs}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
