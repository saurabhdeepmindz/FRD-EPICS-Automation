/**
 * One-shot cleanup: delete the broken SUBTASK artifact(s) for a given module.
 *
 * The SKILL-05 per-story loop (now reverted) produced SUBTASK artifacts with
 * thousands of fragmented BaArtifactSection rows (one per template field
 * instead of one body per subtask). This script removes those so SKILL-05 can
 * be re-run cleanly.
 *
 * Usage:
 *   npx ts-node scripts/delete-broken-subtask-artifact.ts --module MOD-04
 *   npx ts-node scripts/delete-broken-subtask-artifact.ts --module MOD-04 --apply
 *
 * Without --apply, runs in dry-run mode and only prints what it would delete.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId =
    moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';
  const apply = args.includes('--apply');

  console.log('──────────────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY-RUN (no changes)'}`);
  console.log('──────────────────────────────────────────────\n');

  const modules = await prisma.baModule.findMany({
    where: { moduleId: targetModuleId },
    select: { id: true, moduleId: true, moduleName: true, projectId: true },
  });

  if (modules.length === 0) {
    console.error(`No module found with moduleId = ${targetModuleId}`);
    process.exit(1);
  }

  if (modules.length > 1) {
    console.log(`Found ${modules.length} modules with moduleId = ${targetModuleId}:`);
    modules.forEach((m) =>
      console.log(`  ${m.id}  ${m.moduleName}  project=${m.projectId}`),
    );
    console.log();
  }

  let totalToDelete = {
    artifacts: 0,
    artifactSections: 0,
    subtasks: 0,
    subtaskSections: 0,
  };

  for (const mod of modules) {
    console.log(`── Module ${mod.moduleId} (${mod.id}) ──`);

    const artifacts = await prisma.baArtifact.findMany({
      where: {
        moduleDbId: mod.id,
        artifactType: 'SUBTASK',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sections: true, subtasks: true } },
      },
    });

    if (artifacts.length === 0) {
      console.log('  no SUBTASK artifacts found');
      continue;
    }

    for (const art of artifacts) {
      console.log(
        `  ${art.id}  status=${art.status}  createdAt=${art.createdAt.toISOString()}  sections=${art._count.sections}  subtasks=${art._count.subtasks}`,
      );
    }

    const draftArtifacts = artifacts.filter((a) => a.status === 'DRAFT');
    const approvedCount = artifacts.length - draftArtifacts.length;

    if (approvedCount > 0) {
      console.log(
        `\n  ${approvedCount} APPROVED SUBTASK artifact(s) will be KEPT untouched.`,
      );
    }

    if (draftArtifacts.length === 0) {
      console.log('  no DRAFT SUBTASK artifacts to delete\n');
      continue;
    }

    console.log(
      `\n  Will delete ${draftArtifacts.length} DRAFT SUBTASK artifact(s) for ${mod.moduleId}:`,
    );

    for (const art of draftArtifacts) {
      const subtasksForArtifact = await prisma.baSubTask.findMany({
        where: { artifactDbId: art.id },
        select: { id: true },
      });

      const subtaskSectionCount =
        subtasksForArtifact.length > 0
          ? await prisma.baSubTaskSection.count({
              where: {
                subtaskDbId: { in: subtasksForArtifact.map((s) => s.id) },
              },
            })
          : 0;

      console.log(
        `    - ${art.id}: ${art._count.sections} artifact-sections + ${subtasksForArtifact.length} subtasks + ${subtaskSectionCount} subtask-sections`,
      );

      totalToDelete.artifacts += 1;
      totalToDelete.artifactSections += art._count.sections;
      totalToDelete.subtasks += subtasksForArtifact.length;
      totalToDelete.subtaskSections += subtaskSectionCount;

      if (apply) {
        await prisma.$transaction(async (tx) => {
          if (subtasksForArtifact.length > 0) {
            await tx.baSubTaskSection.deleteMany({
              where: {
                subtaskDbId: { in: subtasksForArtifact.map((s) => s.id) },
              },
            });
            await tx.baSubTask.deleteMany({
              where: { artifactDbId: art.id },
            });
          }
          await tx.baArtifact.delete({ where: { id: art.id } });
        });
        console.log(`    ✓ deleted`);
      }
    }
    console.log();
  }

  console.log('──────────────────────────────────────────────');
  console.log('Totals:');
  console.log(`  BaArtifact rows:         ${totalToDelete.artifacts}`);
  console.log(`  BaArtifactSection rows:  ${totalToDelete.artifactSections}`);
  console.log(`  BaSubTask rows:          ${totalToDelete.subtasks}`);
  console.log(`  BaSubTaskSection rows:   ${totalToDelete.subtaskSections}`);
  console.log(`  Mode: ${apply ? 'APPLIED' : 'DRY-RUN — re-run with --apply to actually delete'}`);
  console.log('──────────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
