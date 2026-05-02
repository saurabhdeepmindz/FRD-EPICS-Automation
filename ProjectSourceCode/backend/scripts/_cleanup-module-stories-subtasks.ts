/**
 * Generic module-USER_STORY + SUBTASK cleanup harness — wipes the
 * USER_STORY + SUBTASK artifacts, SKILL-04 + SKILL-05 execution
 * records, all BaSubTask + BaSubTaskSection records, and clears
 * RTM rows' storyId / subtaskId / pseudo-file links so the next
 * SKILL-04 run starts from a clean baseline. Resets module status
 * from APPROVED / SUBTASKS_COMPLETE / STORIES_COMPLETE back to
 * EPICS_COMPLETE so SKILL-04 prerequisites are met cleanly.
 *
 * Preserves: SCREEN_ANALYSIS, FRD, EPIC artifacts; RTM feature/epic
 * linkage (storyId/subtaskId fields cleared, not the rows).
 *
 * Usage: npx ts-node scripts/_cleanup-module-stories-subtasks.ts <MOD-NN>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const moduleId = process.argv[2];
  if (!moduleId || !/^MOD-\d+$/.test(moduleId)) {
    console.error('Usage: ts-node _cleanup-module-stories-subtasks.ts <MOD-NN>');
    process.exit(2);
  }

  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) {
    console.error(`${moduleId} not found`);
    process.exit(1);
  }
  console.log(`${moduleId} (${mod.id}) status before: ${mod.moduleStatus}`);

  // 1. Delete USER_STORY artifact + sections
  const usArts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'USER_STORY' },
    include: { _count: { select: { sections: true } } },
  });
  for (const a of usArts) {
    const ds = await prisma.baArtifactSection.deleteMany({ where: { artifactId: a.id } });
    console.log(`  USER_STORY ${a.id}: deleted ${ds.count} sections`);
  }
  if (usArts.length > 0) {
    const da = await prisma.baArtifact.deleteMany({ where: { moduleDbId: mod.id, artifactType: 'USER_STORY' } });
    console.log(`  Deleted ${da.count} USER_STORY artifact(s)`);
  }

  // 2. Delete SUBTASK artifact + sections
  const subArts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
  });
  for (const a of subArts) {
    const ds = await prisma.baArtifactSection.deleteMany({ where: { artifactId: a.id } });
    console.log(`  SUBTASK ${a.id}: deleted ${ds.count} sections`);
  }
  if (subArts.length > 0) {
    const da = await prisma.baArtifact.deleteMany({ where: { moduleDbId: mod.id, artifactType: 'SUBTASK' } });
    console.log(`  Deleted ${da.count} SUBTASK artifact(s)`);
  }

  // 3. Delete BaSubTask + BaSubTaskSection records
  const sts = await prisma.baSubTask.findMany({ where: { moduleDbId: mod.id }, select: { id: true } });
  if (sts.length > 0) {
    await prisma.baSubTaskSection.deleteMany({ where: { subtaskDbId: { in: sts.map((s) => s.id) } } });
    const dst = await prisma.baSubTask.deleteMany({ where: { moduleDbId: mod.id } });
    console.log(`  Deleted ${dst.count} BaSubTask records (+ their sections)`);
  }

  // 4. Delete SKILL-04 + SKILL-05 executions
  const dexec = await prisma.baSkillExecution.deleteMany({
    where: { moduleDbId: mod.id, skillName: { in: ['SKILL-04', 'SKILL-05'] } },
  });
  console.log(`  Deleted ${dexec.count} SKILL-04/05 execution record(s)`);

  // 5. Clear storyId/subtaskId/etc on RTM rows (epicId stays)
  if (mod.projectId) {
    const drtm = await prisma.baRtmRow.updateMany({
      where: { projectId: mod.projectId, moduleId },
      data: {
        storyId: null,
        storyName: null,
        storyType: null,
        storyStatus: null,
        subtaskId: null,
        subtaskTeam: null,
        primaryClass: null,
        sourceFile: null,
        methodName: null,
      },
    });
    console.log(`  Cleared story/subtask fields on ${drtm.count} RTM rows`);
  }

  // 6. Reset module status to EPICS_COMPLETE so SKILL-04 prereq is satisfied
  await prisma.baModule.update({
    where: { id: mod.id },
    data: { moduleStatus: 'EPICS_COMPLETE', approvedAt: null },
  });
  console.log(`  Reset module status: ${mod.moduleStatus} → EPICS_COMPLETE`);

  // Verify
  const after = await prisma.baModule.findUnique({ where: { id: mod.id } });
  const remUS = await prisma.baArtifact.count({ where: { moduleDbId: mod.id, artifactType: 'USER_STORY' } });
  const remSub = await prisma.baArtifact.count({ where: { moduleDbId: mod.id, artifactType: 'SUBTASK' } });
  const remSt = await prisma.baSubTask.count({ where: { moduleDbId: mod.id } });
  const remExec = await prisma.baSkillExecution.count({ where: { moduleDbId: mod.id, skillName: { in: ['SKILL-04', 'SKILL-05'] } } });
  console.log(`\nFinal:`);
  console.log(`  module status: ${after?.moduleStatus}`);
  console.log(`  USER_STORY artifacts: ${remUS}`);
  console.log(`  SUBTASK artifacts: ${remSub}`);
  console.log(`  BaSubTask records: ${remSt}`);
  console.log(`  SKILL-04/05 executions: ${remExec}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
