/**
 * Audit MOD-05's downstream skill execution + artifact state before
 * cascade regen. We need to know which artifacts are APPROVED (locked) vs
 * AWAITING_REVIEW vs FAILED — and which have user-modified content that
 * a regen would overwrite.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SKILL_ORDER = ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04', 'SKILL-05', 'SKILL-06-LLD', 'SKILL-07-FTC'] as const;
const ARTIFACT_TYPES = ['SCREEN_ANALYSIS', 'FRD', 'EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC'] as const;

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({
    where: { moduleId: 'MOD-05' },
    include: { project: true },
  });
  if (!mod) {
    console.log('MOD-05 not found');
    return;
  }
  console.log(`Module: ${mod.moduleId} — ${mod.moduleName}`);
  console.log(`Project: ${mod.project?.name ?? '(none)'}  (id=${mod.projectId})`);
  console.log(`Status: ${mod.moduleStatus}`);
  console.log(`Processed: ${mod.processedAt?.toISOString() ?? '(none)'}\n`);

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
    console.log(`  ${skill.padEnd(15)} ${exec.status.padEnd(18)} created=${exec.createdAt.toISOString()}  completed=${exec.completedAt?.toISOString() ?? '-'}`);
  }

  console.log('\n── Artifacts (latest per type) ──');
  for (const type of ARTIFACT_TYPES) {
    const art = await prisma.baArtifact.findFirst({
      where: { moduleDbId: mod.id, artifactType: type as never },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: {
          where: { isHumanModified: true },
          select: { sectionKey: true, sectionLabel: true, isLocked: true },
        },
      },
    });
    if (!art) {
      console.log(`  ${type.padEnd(18)} (no artifact)`);
      continue;
    }
    const humanEdits = art.sections.length;
    const lockedEdits = art.sections.filter((s) => s.isLocked).length;
    console.log(`  ${type.padEnd(18)} status=${art.status.padEnd(12)} humanEdited=${humanEdits} (${lockedEdits} locked) created=${art.createdAt.toISOString()}`);
    if (humanEdits > 0) {
      for (const s of art.sections.slice(0, 5)) {
        console.log(`      - ${s.sectionKey}${s.isLocked ? '  [LOCKED]' : ''}`);
      }
      if (humanEdits > 5) console.log(`      ... and ${humanEdits - 5} more`);
    }
  }

  console.log('\n── Downstream RTM state ──');
  if (mod.projectId) {
    const rtm = await prisma.baRtmRow.findMany({
      where: { projectId: mod.projectId, moduleId: 'MOD-05' },
      orderBy: { featureId: 'asc' },
    });
    console.log(`  RTM rows: ${rtm.length}`);
    const withEpic = rtm.filter((r) => r.epicId).length;
    const withStory = rtm.filter((r) => r.storyId).length;
    const withSubtask = rtm.filter((r) => r.subtaskId).length;
    const withLld = rtm.filter((r) => r.lldArtifactId).length;
    const withFtc = rtm.filter((r) => r.ftcArtifactId).length;
    console.log(`    epic-linked:    ${withEpic}/${rtm.length}`);
    console.log(`    story-linked:   ${withStory}/${rtm.length}`);
    console.log(`    subtask-linked: ${withSubtask}/${rtm.length}`);
    console.log(`    LLD-linked:     ${withLld}/${rtm.length}`);
    console.log(`    FTC-linked:     ${withFtc}/${rtm.length}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
