/**
 * Audit MOD-06 (Order Document) — confirm whether the current state
 * matches MOD-04/MOD-05's canonical post-fix shape.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SKILL_ORDER = ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04', 'SKILL-05', 'SKILL-06-LLD', 'SKILL-07-FTC'] as const;
const ARTIFACT_TYPES = ['SCREEN_ANALYSIS', 'FRD', 'EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC'] as const;

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({
    where: { moduleId: 'MOD-06' },
    include: { project: true },
  });
  if (!mod) {
    console.log('MOD-06 not found in any project.');
    return;
  }
  console.log(`Module: ${mod.moduleId} — ${mod.moduleName}`);
  console.log(`Project: ${mod.project?.name ?? '(none)'}  (id=${mod.projectId})`);
  console.log(`Status: ${mod.moduleStatus}\n`);

  console.log('── Skill executions (latest per skill) ──');
  for (const skill of SKILL_ORDER) {
    const exec = await prisma.baSkillExecution.findFirst({
      where: { moduleDbId: mod.id, skillName: skill },
      orderBy: { createdAt: 'desc' },
    });
    if (!exec) {
      console.log(`  ${skill.padEnd(15)} (no execution)`);
      continue;
    }
    console.log(`  ${skill.padEnd(15)} ${exec.status.padEnd(18)} created=${exec.createdAt.toISOString()}`);
  }

  console.log('\n── Artifacts (latest per type) ──');
  for (const type of ARTIFACT_TYPES) {
    const art = await prisma.baArtifact.findFirst({
      where: { moduleDbId: mod.id, artifactType: type as never },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sections: true } } },
    });
    if (!art) {
      console.log(`  ${type.padEnd(18)} (no artifact)`);
      continue;
    }
    console.log(`  ${type.padEnd(18)} status=${art.status.padEnd(12)} sections=${art._count.sections}`);
  }

  // BaSubTask state
  const totalSt = await prisma.baSubTask.count({ where: { moduleDbId: mod.id } });
  const stWithFeat = await prisma.baSubTask.count({ where: { moduleDbId: mod.id, NOT: { featureId: null } } });
  const stWithStory = await prisma.baSubTask.count({ where: { moduleDbId: mod.id, NOT: { userStoryId: null } } });
  console.log(`\n── BaSubTask records ──`);
  console.log(`  Total: ${totalSt}  withFeatureId: ${stWithFeat}  withUserStoryId: ${stWithStory}`);

  // RTM
  if (mod.projectId) {
    const rtm = await prisma.baRtmRow.findMany({
      where: { projectId: mod.projectId, moduleId: 'MOD-06' },
    });
    console.log(`\n── RTM rows (${rtm.length} total) ──`);
    console.log(`  epic-linked:    ${rtm.filter((r) => r.epicId).length}/${rtm.length}`);
    console.log(`  story-linked:   ${rtm.filter((r) => r.storyId).length}/${rtm.length}`);
    console.log(`  subtask-linked: ${rtm.filter((r) => r.subtaskId).length}/${rtm.length}`);
  }

  // FRD shape
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (frd) {
    const fullContent = frd.sections.map((s) => s.content).join('\n\n');
    const distinctIds = new Set<string>();
    for (const m of fullContent.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) distinctIds.add(m[0]);
    const headingBlocks = (fullContent.match(/^#{1,4}\s+\*?\*?\s*F-\d+-\d+\s*[:\s—\-*]/gm) ?? []).length;
    console.log(`\n── FRD shape ──`);
    console.log(`  Distinct feature IDs: ${distinctIds.size}`);
    console.log(`  #### F-XX-XX heading blocks: ${headingBlocks}`);
    console.log(`  Section keys (first 8):`);
    for (const s of frd.sections.slice(0, 8)) {
      console.log(`    [${s.sectionKey}]  len=${s.content.length}`);
    }
  }

  // SubTask shape
  const sub = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (sub) {
    const fullContent = sub.sections.map((s) => s.content).join('\n\n');
    const stIds = new Set((fullContent.match(/\bST-US\d+-(?:FE|BE|IN|QA)-\d+\b/g) ?? []));
    console.log(`\n── SubTask shape ──`);
    console.log(`  Sections: ${sub.sections.length}  content len: ${fullContent.length}`);
    console.log(`  Distinct ST-USNNN-TEAM-NN ids: ${stIds.size}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
