/**
 * One-shot cleanup: delete the FTC artifact + execution + dependent rows
 * for a given module so SKILL-07-FTC can be re-run from a clean state.
 *
 * Usage:
 *   npx ts-node scripts/delete-ftc-artifact.ts --module MOD-04
 *   npx ts-node scripts/delete-ftc-artifact.ts --module MOD-04 --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';
  const apply = args.includes('--apply');

  console.log('──────────────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY-RUN (no changes)'}`);
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) { console.error(`module ${targetModuleId} not found`); process.exit(1); }

  const artifacts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'FTC' },
    include: {
      _count: { select: { sections: true, testCases: true, acCoverage: true } },
    },
  });

  const execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-07-FTC' },
  });

  console.log(`FTC artifacts: ${artifacts.length}`);
  for (const a of artifacts) {
    console.log(
      `  ${a.id}  ${a.artifactId}  status=${a.status}  sections=${a._count.sections}  testCases=${a._count.testCases}  acCoverage=${a._count.acCoverage}`,
    );
  }
  console.log(`SKILL-07-FTC executions: ${execs.length}`);
  for (const e of execs) {
    console.log(`  ${e.id}  status=${e.status}  createdAt=${e.createdAt.toISOString()}`);
  }

  if (!apply) {
    console.log('\nDRY-RUN — re-run with --apply to delete.');
    return;
  }

  for (const a of artifacts) {
    await prisma.$transaction(async (tx) => {
      await tx.baAcCoverage.deleteMany({ where: { artifactDbId: a.id } });
      await tx.baTestCase.deleteMany({ where: { artifactDbId: a.id } });
      await tx.baArtifactSection.deleteMany({ where: { artifactId: a.id } });
      await tx.baArtifact.delete({ where: { id: a.id } });
    });
    console.log(`✓ deleted artifact ${a.id}`);
  }
  for (const e of execs) {
    await prisma.baSkillExecution.delete({ where: { id: e.id } });
    console.log(`✓ deleted execution ${e.id}`);
  }
  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
