/**
 * Read-only audit for a given module: lists every artifact (and SubTask
 * rollup) so we can confirm a module's pipeline is intact before running
 * the export pilot against it. Pure read — no writes, no AI calls.
 *
 * Run:
 *   npx ts-node scripts/_audit-mod-artifacts.ts MOD-05
 *   npx ts-node scripts/_audit-mod-artifacts.ts MOD-04
 */
import { PrismaClient } from '@prisma/client';

async function auditOne(prisma: PrismaClient, moduleId: string): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`\n${moduleId}: NOT FOUND`); return; }

  console.log(`\n══ ${moduleId} — ${mod.moduleName} ══`);
  console.log(`   moduleDbId=${mod.id}`);
  console.log(`   moduleStatus=${mod.moduleStatus}`);
  console.log(`   projectId=${mod.projectId}`);

  // Project metadata that drives the export cover page.
  const project = mod.projectId
    ? await prisma.baProject.findUnique({
        where: { id: mod.projectId },
        select: { name: true, projectCode: true, productName: true, clientName: true, submittedBy: true, clientLogo: true },
      })
    : null;
  console.log(`   project: ${project?.projectCode ?? '—'} / productName=${project?.productName ?? '—'} / client=${project?.clientName ?? '—'} / submittedBy=${project?.submittedBy ?? '—'} / logo=${project?.clientLogo ? 'yes' : 'no'}`);

  // Screens.
  const screens = await prisma.baScreen.findMany({
    where: { moduleDbId: mod.id },
    select: { screenId: true, fileData: true },
    orderBy: { displayOrder: 'asc' },
  });
  const screensWithData = screens.filter((s) => !!s.fileData?.trim()).length;
  console.log(`   screens: ${screens.length} total, ${screensWithData} with fileData`);

  // Artifacts.
  const wantedTypes = ['SCREEN_ANALYSIS', 'FRD', 'EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC'];
  console.log(`\n   Artifacts:`);
  console.log(`   ${'type'.padEnd(16)} ${'artifactId'.padEnd(22)} ${'status'.padEnd(20)} ${'sections'.padEnd(9)} dbId`);
  for (const t of wantedTypes) {
    const arts = await prisma.baArtifact.findMany({
      where: { moduleDbId: mod.id, artifactType: t as never },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sections: true } } },
    });
    if (arts.length === 0) {
      console.log(`   ${t.padEnd(16)} ${'(none)'.padEnd(22)} ${'—'.padEnd(20)} ${'—'.padEnd(9)} —`);
      continue;
    }
    // Show the newest first (this is what the export endpoint serves) plus a
    // count of any duplicates that exist behind it.
    const head = arts[0];
    const dupTag = arts.length > 1 ? ` (+${arts.length - 1} older)` : '';
    console.log(`   ${t.padEnd(16)} ${(head.artifactId + dupTag).padEnd(22)} ${head.status.padEnd(20)} ${String(head._count.sections).padEnd(9)} ${head.id}`);
  }

  // Rollups that live outside BaArtifactSection.
  const stCount = await prisma.baSubTask.count({ where: { moduleDbId: mod.id } });
  const tcArtifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' as never },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const tcCount = tcArtifact ? await prisma.baTestCase.count({ where: { artifactDbId: tcArtifact.id } }) : 0;
  const rtmCount = mod.projectId
    ? await prisma.baRtmRow.count({ where: { projectId: mod.projectId, moduleId } })
    : 0;
  console.log(`\n   Rollups: BaSubTask rows=${stCount} · BaTestCase rows=${tcCount} · BaRtmRow rows=${rtmCount}`);

  // Skill execution status — what the cascade considers "approved".
  const skills = ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04', 'SKILL-05', 'SKILL-06-LLD', 'SKILL-07-FTC'];
  console.log(`\n   Latest skill executions:`);
  for (const sk of skills) {
    const exec = await prisma.baSkillExecution.findFirst({
      where: { moduleDbId: mod.id, skillName: sk },
      orderBy: { createdAt: 'desc' },
      select: { status: true, createdAt: true },
    });
    const tag = exec ? `${exec.status.padEnd(20)} ${exec.createdAt.toISOString().slice(0, 16)}` : '(no execution)';
    console.log(`   ${sk.padEnd(14)} ${tag}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ['MOD-05', 'MOD-04'];
  const prisma = new PrismaClient();
  for (const m of targets) {
    await auditOne(prisma, m);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
