/**
 * MOD-06 Path B Phase 4 cleanup — wipe the current EPIC artifact and
 * SKILL-02-S execution records so the hardened SKILL-02-S can produce
 * a fresh canonical 17-section output. Resets module status from
 * EPICS_COMPLETE back to FRD_COMPLETE so the SKILL-02-S prerequisite
 * is satisfied cleanly.
 *
 * Preserves: SCREEN_ANALYSIS, FRD artifacts, RTM rows (still seeded
 * with feature/epic linkage from prior run; will be overwritten by
 * the new SKILL-02-S RTM extension).
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const mod = await p.baModule.findFirst({ where: { moduleId: 'MOD-06' } });
  if (!mod) return;
  console.log(`MOD-06 (${mod.id}) status before: ${mod.moduleStatus}`);

  // Delete EPIC artifact + sections
  const epics = await p.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'EPIC' },
    include: { _count: { select: { sections: true } } },
  });
  for (const e of epics) {
    const ds = await p.baArtifactSection.deleteMany({ where: { artifactId: e.id } });
    console.log(`  EPIC ${e.id}: deleted ${ds.count} sections`);
  }
  if (epics.length > 0) {
    const da = await p.baArtifact.deleteMany({ where: { moduleDbId: mod.id, artifactType: 'EPIC' } });
    console.log(`  Deleted ${da.count} EPIC artifact(s)`);
  }

  // Delete SKILL-02-S executions (new run will create a fresh one)
  const dexec = await p.baSkillExecution.deleteMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-02-S' },
  });
  console.log(`  Deleted ${dexec.count} SKILL-02-S execution record(s)`);

  // Clear epicId/epicName from RTM rows so the new run repopulates cleanly
  if (mod.projectId) {
    const drtm = await p.baRtmRow.updateMany({
      where: { projectId: mod.projectId, moduleId: 'MOD-06' },
      data: { epicId: null, epicName: null },
    });
    console.log(`  Cleared epicId on ${drtm.count} RTM rows`);
  }

  // Reset module status
  await p.baModule.update({
    where: { id: mod.id },
    data: { moduleStatus: 'FRD_COMPLETE', processedAt: null },
  });
  console.log(`  Reset module status: ${mod.moduleStatus} → FRD_COMPLETE`);

  // Verify
  const after = await p.baModule.findUnique({ where: { id: mod.id } });
  const remainingEpics = await p.baArtifact.count({ where: { moduleDbId: mod.id, artifactType: 'EPIC' } });
  const remainingExecs = await p.baSkillExecution.count({ where: { moduleDbId: mod.id, skillName: 'SKILL-02-S' } });
  console.log(`\nFinal:`);
  console.log(`  module status: ${after?.moduleStatus}`);
  console.log(`  EPIC artifacts remaining: ${remainingEpics}`);
  console.log(`  SKILL-02-S executions remaining: ${remainingExecs}`);
}
main().catch(console.error).finally(() => p.$disconnect());
