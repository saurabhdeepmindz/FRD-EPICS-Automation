/**
 * Look up ST-US080-QA-01 + its expected file path. Diagnoses why the
 * "Generate file" button might not be doing anything for the user.
 *
 * Usage: npx ts-node scripts/_inspect-st-us080-qa-01.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const subtaskId = 'ST-US080-QA-01';
    const targetPath = 'test-cases/US080/TC-US080-QA-01.md';

    const st = await prisma.baSubTask.findFirst({
      where: { subtaskId },
      select: {
        id: true,
        subtaskId: true,
        subtaskName: true,
        team: true,
        moduleDbId: true,
        userStoryId: true,
        featureId: true,
        sourceFileName: true,
      },
    });
    console.log('SubTask row:');
    console.log(JSON.stringify(st, null, 2));

    if (!st) {
      console.log('SubTask not found — nothing more to inspect.');
      return;
    }

    const lld = await prisma.baArtifact.findFirst({
      where: { moduleDbId: st.moduleDbId, artifactType: 'LLD' },
      select: { id: true, artifactId: true, status: true },
    });
    console.log('\nLLD artifact for module:');
    console.log(JSON.stringify(lld, null, 2));

    if (!lld) return;

    const existing = await prisma.baPseudoFile.findFirst({
      where: { artifactDbId: lld.id, path: targetPath },
      select: { id: true, path: true, language: true, isHumanModified: true, aiContent: true },
    });
    console.log(`\nExisting pseudo-file at "${targetPath}":`);
    if (existing) {
      console.log({ ...existing, aiContent: `<${existing.aiContent.length} bytes>` });
    } else {
      console.log('(none — Generate file SHOULD work for this path)');
    }

    // Also list any pseudo-files this subtask already has (loose match on subtaskId in path)
    const related = await prisma.baPseudoFile.findMany({
      where: {
        artifactDbId: lld.id,
        OR: [
          { path: { contains: 'US080-QA-01' } },
          { path: { contains: 'us080-qa-01' } },
        ],
      },
      select: { id: true, path: true, language: true },
    });
    console.log(`\nOther US080-QA-01 pseudo-files (${related.length}):`);
    for (const r of related) console.log(`  - ${r.path} [${r.language}]`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
