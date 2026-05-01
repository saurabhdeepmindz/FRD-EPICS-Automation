/**
 * Side-by-side comparison of User Story generation between two modules.
 * Reports: number of screens, USER_STORY artifact existence, section keys
 * inside the artifact, count of distinct US-NNN ids referenced anywhere
 * in section content, and EPIC + RTM coverage so we can tell whether the
 * downstream pipeline saw what the user story doc claims.
 *
 * Usage:
 *   npx ts-node scripts/_compare-user-stories.ts --modules MOD-04,MOD-05
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ModuleSnapshot {
  moduleId: string;
  moduleName: string;
  projectId: string | null;
  screensCount: number;
  screensList: Array<{ screenId: string; screenTitle: string }>;
  epicArtifact: { artifactId: string; status: string; sectionsCount: number; usIdsInSections: string[]; createdAt: Date } | null;
  userStoryArtifact: { artifactId: string; status: string; sectionsCount: number; usIdsInSections: string[]; rawSectionKeys: string[]; sectionLengths: Array<{ key: string; len: number }>; createdAt: Date } | null;
  rtmRows: Array<{ featureId: string; storyId: string | null; epicId: string | null }>;
  skillExecutions: Array<{ skillName: string; status: string; createdAt: Date; humanDocLen: number }>;
}

async function snapshot(moduleId: string): Promise<ModuleSnapshot | null> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) return null;

  const screens = await prisma.baScreen.findMany({
    where: { moduleDbId: mod.id },
    orderBy: { displayOrder: 'asc' },
    select: { screenId: true, screenTitle: true },
  });

  const epic = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'EPIC' },
    orderBy: { createdAt: 'desc' },
  });
  const epicSections = epic
    ? await prisma.baArtifactSection.findMany({
        where: { artifactId: epic.id },
        select: { sectionKey: true, sectionLabel: true, content: true },
      })
    : [];
  const epicUsIds = new Set<string>();
  for (const s of epicSections) {
    for (const m of (s.content || '').matchAll(/\bUS-\d{3,}\b/g)) epicUsIds.add(m[0]);
  }

  const story = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'USER_STORY' },
    orderBy: { createdAt: 'desc' },
  });
  const storySections = story
    ? await prisma.baArtifactSection.findMany({
        where: { artifactId: story.id },
        orderBy: { createdAt: 'asc' },
        select: { sectionKey: true, sectionLabel: true, content: true },
      })
    : [];
  const storyUsIds = new Set<string>();
  for (const s of storySections) {
    for (const m of (`${s.sectionKey}\n${s.sectionLabel}\n${s.content || ''}`).matchAll(/\bUS-\d{3,}\b/g)) {
      storyUsIds.add(m[0]);
    }
  }

  const rtmRows = mod.projectId
    ? await prisma.baRtmRow.findMany({
        where: { projectId: mod.projectId, moduleId: mod.moduleId },
        select: { featureId: true, storyId: true, epicId: true },
        orderBy: [{ featureId: 'asc' }, { storyId: 'asc' }],
      })
    : [];

  const execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: { in: ['SKILL-04', 'SKILL-02-S', 'SKILL-01-S'] } },
    orderBy: { createdAt: 'asc' },
    select: { skillName: true, status: true, createdAt: true, humanDocument: true },
  });

  return {
    moduleId,
    moduleName: mod.moduleName,
    projectId: mod.projectId ?? null,
    screensCount: screens.length,
    screensList: screens,
    epicArtifact: epic ? {
      artifactId: epic.artifactId,
      status: epic.status,
      sectionsCount: epicSections.length,
      usIdsInSections: [...epicUsIds].sort(),
      createdAt: epic.createdAt,
    } : null,
    userStoryArtifact: story ? {
      artifactId: story.artifactId,
      status: story.status,
      sectionsCount: storySections.length,
      usIdsInSections: [...storyUsIds].sort(),
      rawSectionKeys: storySections.map((s) => s.sectionKey),
      sectionLengths: storySections.map((s) => ({ key: s.sectionKey, len: (s.content || '').length })),
      createdAt: story.createdAt,
    } : null,
    rtmRows,
    skillExecutions: execs.map((e) => ({
      skillName: e.skillName,
      status: e.status,
      createdAt: e.createdAt,
      humanDocLen: (e.humanDocument || '').length,
    })),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flagIdx = args.indexOf('--modules');
  const targetIds = flagIdx >= 0 ? args[flagIdx + 1].split(',') : ['MOD-04', 'MOD-05'];

  const snaps: ModuleSnapshot[] = [];
  for (const mid of targetIds) {
    const s = await snapshot(mid);
    if (!s) {
      console.error(`Module ${mid} not found`);
      continue;
    }
    snaps.push(s);
  }

  for (const s of snaps) {
    console.log(`\n============================================================`);
    console.log(`Module: ${s.moduleId} — ${s.moduleName}`);
    console.log(`============================================================`);
    console.log(`Project ID:        ${s.projectId ?? '(none)'}`);
    console.log(`Screens uploaded:  ${s.screensCount}`);
    for (const sc of s.screensList) {
      console.log(`  ${sc.screenId.padEnd(8)} ${sc.screenTitle}`);
    }
    console.log('');
    console.log(`Skill executions on this module:`);
    if (s.skillExecutions.length === 0) console.log(`  (none)`);
    for (const e of s.skillExecutions) {
      console.log(`  ${e.skillName.padEnd(10)} status=${e.status.padEnd(20)} docLen=${String(e.humanDocLen).padStart(7)} at=${e.createdAt.toISOString()}`);
    }
    console.log('');
    console.log(`EPIC artifact:     ${s.epicArtifact ? `${s.epicArtifact.artifactId} (${s.epicArtifact.status}) | ${s.epicArtifact.sectionsCount} section(s) | US ids referenced: ${s.epicArtifact.usIdsInSections.join(', ') || '(none)'}` : '(none)'}`);
    if (s.epicArtifact) console.log(`                   created ${s.epicArtifact.createdAt.toISOString()}`);
    console.log('');
    if (s.userStoryArtifact) {
      console.log(`USER_STORY artifact: ${s.userStoryArtifact.artifactId} (${s.userStoryArtifact.status})`);
      console.log(`                     created ${s.userStoryArtifact.createdAt.toISOString()}`);
      console.log(`Sections (${s.userStoryArtifact.sectionsCount}):`);
      for (const r of s.userStoryArtifact.sectionLengths) {
        console.log(`  ${r.key.padEnd(60)} len=${r.len}`);
      }
      console.log(`Distinct US-NNN ids in section content: ${s.userStoryArtifact.usIdsInSections.length}`);
      console.log(`  ${s.userStoryArtifact.usIdsInSections.join(', ') || '(none)'}`);
    } else {
      console.log(`USER_STORY artifact: (none)`);
    }
    console.log('');
    console.log(`RTM rows: ${s.rtmRows.length}`);
    const featureRtm = new Map<string, Set<string>>();
    for (const r of s.rtmRows) {
      const set = featureRtm.get(r.featureId) ?? new Set<string>();
      if (r.storyId) set.add(r.storyId);
      featureRtm.set(r.featureId, set);
    }
    for (const [feat, stories] of [...featureRtm].sort()) {
      console.log(`  ${feat.padEnd(10)} stories=${stories.size > 0 ? [...stories].sort().join(', ') : '(none)'}`);
    }
  }

  console.log('\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
