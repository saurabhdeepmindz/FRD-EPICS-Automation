/**
 * Inspect a SUBTASK artifact's section keys, labels, and content lengths so we
 * can verify the AI output shape (one row per subtask vs. fragmented fields).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';

  const mod = await prisma.baModule.findFirst({
    where: { moduleId: targetModuleId },
  });
  if (!mod) {
    console.error(`No module ${targetModuleId}`);
    process.exit(1);
  }

  const artifacts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
    orderBy: { createdAt: 'desc' },
  });

  for (const art of artifacts) {
    console.log(
      `── ${art.id}  status=${art.status}  createdAt=${art.createdAt.toISOString()}  artifactId=${art.artifactId}`,
    );
    const sections = await prisma.baArtifactSection.findMany({
      where: { artifactId: art.id },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        sectionKey: true,
        sectionLabel: true,
        content: true,
      },
    });
    console.log(`  sections: ${sections.length}`);
    for (const s of sections) {
      const len = s.content?.length ?? 0;
      const preview = (s.content ?? '').slice(0, 100).replace(/\s+/g, ' ');
      console.log(
        `    [${s.sectionKey}] "${s.sectionLabel}"  contentLen=${len}  preview="${preview}..."`,
      );
    }
    const subtasks = await prisma.baSubTask.findMany({
      where: { artifactDbId: art.id },
      select: { subtaskId: true, subtaskName: true, team: true },
      take: 5,
    });
    console.log(`  baSubTask rows for this artifact: ${subtasks.length} (showing up to 5)`);
    subtasks.forEach((s) =>
      console.log(`    ${s.subtaskId}  ${s.team}  ${s.subtaskName.slice(0, 60)}`),
    );
    console.log();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
