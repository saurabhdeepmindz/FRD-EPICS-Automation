/**
 * Phase 5a — wipe MOD-05's broken SubTask state so the per-story append
 * mode can rebuild it cleanly. Deletes:
 *   - The broken SUBTASK BaArtifact (and its 15 overview-style sections)
 *   - The 6 stale BaSubTask records (and their sections) — they were
 *     persisted from an earlier run and reference US-051; the per-story
 *     loop will regenerate them properly in the rebuild
 *
 * Does NOT touch: SKILL-05 BaSkillExecution records (a fresh execution
 * row will be created by the next executeSkill('SKILL-05') call).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) {
    console.log('MOD-05 not found');
    return;
  }

  console.log(`MOD-05 (${mod.id}) — cleaning up SUBTASK state`);

  // 1. Find the SUBTASK artifact(s)
  const artifacts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
    include: { _count: { select: { sections: true } } },
  });
  console.log(`  Found ${artifacts.length} SUBTASK artifact(s):`);
  for (const a of artifacts) {
    console.log(`    ${a.id}  artifactId=${a.artifactId}  sections=${a._count.sections}`);
  }

  // 2. Delete artifact sections, then artifacts
  for (const a of artifacts) {
    const delSections = await prisma.baArtifactSection.deleteMany({
      where: { artifactId: a.id },
    });
    console.log(`  Deleted ${delSections.count} sections for artifact ${a.id}`);
  }
  const delArtifacts = await prisma.baArtifact.deleteMany({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
  });
  console.log(`  Deleted ${delArtifacts.count} SUBTASK artifact(s)`);

  // 3. Delete BaSubTaskSection rows then BaSubTask rows for this module
  const subtasks = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    select: { id: true, subtaskId: true },
  });
  console.log(`  Found ${subtasks.length} BaSubTask record(s):`);
  for (const s of subtasks) console.log(`    ${s.subtaskId}  (${s.id})`);

  if (subtasks.length > 0) {
    const subtaskIds = subtasks.map((s) => s.id);
    const delSecs = await prisma.baSubTaskSection.deleteMany({
      where: { subtaskDbId: { in: subtaskIds } },
    });
    console.log(`  Deleted ${delSecs.count} BaSubTaskSection rows`);
    const delSt = await prisma.baSubTask.deleteMany({
      where: { moduleDbId: mod.id },
    });
    console.log(`  Deleted ${delSt.count} BaSubTask records`);
  }

  // 4. Verify clean state
  const remainingArtifacts = await prisma.baArtifact.count({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
  });
  const remainingSubtasks = await prisma.baSubTask.count({
    where: { moduleDbId: mod.id },
  });
  console.log('\nFinal state:');
  console.log(`  SUBTASK artifacts remaining: ${remainingArtifacts}`);
  console.log(`  BaSubTask records remaining: ${remainingSubtasks}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
