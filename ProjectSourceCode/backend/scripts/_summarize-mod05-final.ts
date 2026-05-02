import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod || !mod.projectId) return;

  console.log(`Module: ${mod.moduleId} — ${mod.moduleName}`);
  console.log(`Status: ${mod.moduleStatus}\n`);

  const execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: { in: ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04'] } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Skill executions: ${execs.length}`);
  for (const e of execs) {
    console.log(`  ${e.createdAt.toISOString()}  ${e.skillName.padEnd(10)}  ${e.status.padEnd(20)}  docLen=${(e.humanDocument || '').length}`);
  }
  console.log('');

  // Most recent execution per skill
  const recents = new Map<string, typeof execs[number]>();
  for (const e of execs) recents.set(e.skillName, e);

  const epicExec = recents.get('SKILL-02-S');
  if (epicExec) {
    const epicIds = new Set<string>();
    for (const m of (epicExec.humanDocument || '').matchAll(/\bEPIC-[A-Z0-9-]+\b/g)) epicIds.add(m[0]);
    console.log(`Latest SKILL-02-S: ${epicIds.size} EPIC ids`);
    console.log(`  ${[...epicIds].sort().join(', ')}\n`);
  }

  const us = recents.get('SKILL-04');
  if (us) {
    const usIds = new Set<string>();
    for (const m of (us.humanDocument || '').matchAll(/\bUS-\d{3,}\b/g)) usIds.add(m[0]);
    console.log(`Latest SKILL-04: ${usIds.size} US ids`);
    const sorted = [...usIds].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
    console.log(`  Range: ${sorted[0]} → ${sorted[sorted.length - 1]}`);
    console.log(`  All: ${sorted.join(', ')}\n`);
  }

  // RTM by feature
  const rtm = await prisma.baRtmRow.findMany({
    where: { projectId: mod.projectId, moduleId: 'MOD-05' },
    orderBy: [{ featureId: 'asc' }],
  });
  console.log(`RTM coverage:`);
  console.log(`  Total feature rows:           ${rtm.length}`);
  console.log(`  With EPIC linked:             ${rtm.filter((r) => r.epicId).length}`);
  console.log(`  With story linked:            ${rtm.filter((r) => r.storyId).length}`);
  console.log(`  Stories per type:`);
  const byType = new Map<string, number>();
  for (const r of rtm) {
    if (r.storyType) byType.set(r.storyType, (byType.get(r.storyType) ?? 0) + 1);
  }
  for (const [k, v] of byType) console.log(`    ${k}: ${v}`);

  // USER_STORY artifact summary
  const usArtifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'USER_STORY' },
    orderBy: { createdAt: 'desc' },
  });
  if (usArtifact) {
    const sections = await prisma.baArtifactSection.findMany({
      where: { artifactId: usArtifact.id },
      select: { sectionKey: true, content: true },
    });
    const usIdsInArtifact = new Set<string>();
    for (const s of sections) {
      const blob = `${s.sectionKey}\n${s.content || ''}`;
      for (const m of blob.matchAll(/\bUS-\d{3,}\b/g)) usIdsInArtifact.add(m[0]);
    }
    console.log(`\nUSER_STORY artifact ${usArtifact.artifactId}:`);
    console.log(`  status:                   ${usArtifact.status}`);
    console.log(`  sections:                 ${sections.length}`);
    console.log(`  distinct US-NNN cited:    ${usIdsInArtifact.size}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
