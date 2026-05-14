/**
 * Targeted JSON snapshot of a single module's pipeline data. Faster
 * granular rollback than restoring the full pg_dump when only one
 * module's data changes.
 *
 * Writes to backups/db-backup/module-snapshots/<MOD>-<timestamp>.json
 * with BaArtifact + BaArtifactSection + BaSubTask + BaSubTaskSection +
 * BaTestCase + BaRtmRow + BaSkillExecution for the target module.
 *
 * Restore is manual — read the JSON, upsert rows back into Prisma — but
 * since this is a single-module footprint the restore script is trivial
 * to write when needed.
 *
 * Usage:
 *   npx ts-node scripts/_snapshot-module.ts MOD-04
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  const moduleId = process.argv[2];
  if (!moduleId) {
    console.error('Usage: ts-node _snapshot-module.ts <MOD-NN>');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) {
    console.error(`${moduleId} not found`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const artifacts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id },
    include: { sections: true },
  });
  const subtasks = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    include: { sections: true },
  });
  const testCases = await prisma.baTestCase.findMany({
    where: { artifactDbId: { in: artifacts.map((a) => a.id) } },
  });
  const rtmRows = mod.projectId
    ? await prisma.baRtmRow.findMany({ where: { projectId: mod.projectId, moduleId } })
    : [];
  const execs = await prisma.baSkillExecution.findMany({ where: { moduleDbId: mod.id } });

  const snapshot = {
    moduleId,
    moduleDbId: mod.id,
    moduleName: mod.moduleName,
    snapshotTakenAt: new Date().toISOString(),
    artifacts,
    subtasks,
    testCases,
    rtmRows,
    skillExecutions: execs,
    counts: {
      artifacts: artifacts.length,
      sectionsTotal: artifacts.reduce((sum, a) => sum + a.sections.length, 0),
      subtasks: subtasks.length,
      subtaskSectionsTotal: subtasks.reduce((sum, s) => sum + s.sections.length, 0),
      testCases: testCases.length,
      rtmRows: rtmRows.length,
      skillExecutions: execs.length,
    },
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.resolve(__dirname, '..', '..', '..', 'backups', 'db-backup', 'module-snapshots');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${moduleId}-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2));

  console.log(`Snapshot written: ${outFile}`);
  console.log(`  artifacts=${snapshot.counts.artifacts} sections=${snapshot.counts.sectionsTotal}`);
  console.log(`  subtasks=${snapshot.counts.subtasks} subtaskSections=${snapshot.counts.subtaskSectionsTotal}`);
  console.log(`  testCases=${snapshot.counts.testCases} rtmRows=${snapshot.counts.rtmRows} skillExecutions=${snapshot.counts.skillExecutions}`);
  console.log(`  size: ${(fs.statSync(outFile).size / 1024).toFixed(1)} KB`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
