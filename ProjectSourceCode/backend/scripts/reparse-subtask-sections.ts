/**
 * One-shot data fix: walk a module's SUBTASK artifact's BaArtifactSection
 * rows and create matching BaSubTask records. Used when the original
 * SKILL-05 run produced section content but the structured BaSubTask
 * table was left empty (parser failed silently or pre-dates the table
 * being part of the persistence path).
 *
 * Section-key shape (the v2 SKILL-05 per-story output):
 *   st_us056_be_02_design_researchconversation_endpoint        → ST-US056-BE-02
 *   st_us074_qa_01_write_unit_tests                            → ST-US074-QA-01
 *
 * Decomposition-summary section (one per story) is skipped:
 *   subtask_decomposition_for_us_056_..._initiate_new_research_conversation
 *
 * Usage:
 *   npx ts-node scripts/reparse-subtask-sections.ts --module MOD-04
 *   npx ts-node scripts/reparse-subtask-sections.ts --module MOD-04 --apply
 */
import { PrismaClient, SubTaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface ParsedSubTask {
  subtaskId: string;
  subtaskName: string;
  team: string;
  userStoryId: string;
  featureId: string | null;
  className: string | null;
  methodName: string | null;
  sectionContent: string;
  sectionLabel: string;
}

/**
 * Extract subtaskId + userStoryId + team from a sectionKey of the form
 * `st_us056_be_02_<slug>`. Returns null when the key doesn't match the
 * SubTask-leaf pattern (e.g. it's a decomposition-summary section).
 */
function parseSectionKey(sectionKey: string): {
  subtaskId: string;
  userStoryId: string;
  team: string;
} | null {
  // Matches: st_us056_be_02_..., st_us074_qa_01_...
  const m = sectionKey.match(/^st_us(\d{3,})_(fe|be|in|qa)_(\d{1,3})/i);
  if (!m) return null;
  const usNum = m[1];
  const team = m[2].toUpperCase();
  const seq = m[3].padStart(2, '0');
  return {
    subtaskId: `ST-US${usNum}-${team}-${seq}`,
    userStoryId: `US-${usNum.padStart(3, '0')}`,
    team,
  };
}

/**
 * Extract subtaskName from the sectionLabel which looks like:
 *   "ST-US052-FE-01 — Design SearchPreviousChatsComponent UI with Search..."
 * The subtaskName is everything after the `—` separator. Falls back to
 * the full label when no separator is present.
 */
function parseSubtaskName(sectionLabel: string): string {
  const dashSplit = sectionLabel.split(/\s+—\s+/);
  if (dashSplit.length >= 2) return dashSplit.slice(1).join(' — ').trim();
  return sectionLabel.trim();
}

/**
 * Best-effort feature ID lookup. We scan the section content for
 * "F-NN-NN" patterns and pick the most-mentioned. The subtask
 * decomposition sections include the feature in their label / content.
 */
function extractFeatureId(content: string): string | null {
  const matches = content.match(/F-\d+-\d+/g);
  if (!matches || matches.length === 0) return null;
  // Pick the most common feature ID
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, v] of counts) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}

/**
 * Best-effort class / method extraction. Scans the section content for
 * common patterns like "Class: FooBar" or "Method: doThing()" or the
 * Section-7 / Section-9 headings used by the v2 skill template.
 */
function extractClassMethod(content: string): { className: string | null; methodName: string | null } {
  // Look for "Section 7 — Class Name" / "Section 9 — Method Name" blocks
  const classMatch = content.match(/(?:Section\s*7\s*[—-]\s*Class\s*Name|Class\s*(?:Name)?\s*[:\s]\s*)\s*\n?([A-Za-z][A-Za-z0-9_]*)/i);
  const methodMatch = content.match(/(?:Section\s*9\s*[—-]\s*Method\s*Name|Method\s*(?:Name)?\s*[:\s]\s*)\s*\n?([A-Za-z][A-Za-z0-9_]*)/i);
  return {
    className: classMatch ? classMatch[1] : null,
    methodName: methodMatch ? methodMatch[1] : null,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';
  const apply = args.includes('--apply');

  console.log('──────────────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log(`Mode: ${apply ? 'APPLY (will create rows)' : 'DRY-RUN (no changes)'}`);
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`Module ${targetModuleId} not found`);
    process.exit(1);
  }
  const subtaskArtifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
    orderBy: { createdAt: 'desc' },
  });
  if (!subtaskArtifact) {
    console.error(`No SUBTASK artifact for ${targetModuleId}`);
    process.exit(1);
  }
  console.log(`SUBTASK artifact: ${subtaskArtifact.artifactId} (${subtaskArtifact.id})\n`);

  const existingRows = await prisma.baSubTask.count({
    where: { artifactDbId: subtaskArtifact.id },
  });
  console.log(`Existing BaSubTask rows on artifact: ${existingRows}\n`);

  // Pull all sections, then keep only the leaf-subtask sections (skip
  // the decomposition-summary sections which have a different key shape).
  const sections = await prisma.baArtifactSection.findMany({
    where: { artifactId: subtaskArtifact.id },
    select: { sectionKey: true, sectionLabel: true, content: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Total sections on artifact: ${sections.length}`);

  const parsed: ParsedSubTask[] = [];
  for (const s of sections) {
    const ids = parseSectionKey(s.sectionKey);
    if (!ids) continue;
    const subtaskName = parseSubtaskName(s.sectionLabel);
    const featureId = extractFeatureId(`${s.sectionLabel}\n${s.content ?? ''}`);
    const { className, methodName } = extractClassMethod(s.content ?? '');
    parsed.push({
      subtaskId: ids.subtaskId,
      subtaskName,
      team: ids.team,
      userStoryId: ids.userStoryId,
      featureId,
      className,
      methodName,
      sectionContent: s.content ?? '',
      sectionLabel: s.sectionLabel,
    });
  }
  console.log(`Parsed leaf-subtask sections: ${parsed.length}\n`);

  // Sample preview
  console.log('Sample (first 5 parsed):');
  for (const p of parsed.slice(0, 5)) {
    console.log(`  ${p.subtaskId.padEnd(22)} story=${p.userStoryId} team=${p.team} feat=${p.featureId ?? '?'} class=${p.className ?? '?'} method=${p.methodName ?? '?'}`);
    console.log(`    name: ${p.subtaskName.slice(0, 70)}`);
  }

  // By story breakdown
  console.log('\nBy user story:');
  const byStory = new Map<string, number>();
  for (const p of parsed) byStory.set(p.userStoryId, (byStory.get(p.userStoryId) ?? 0) + 1);
  for (const [us, n] of [...byStory].sort()) {
    console.log(`  ${us}: ${n} subtask(s)`);
  }

  if (!apply) {
    console.log(`\nDRY-RUN — re-run with --apply to insert ${parsed.length} BaSubTask row(s).`);
    return;
  }

  // Apply phase — insert rows. Skip already-existing (idempotent).
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of parsed) {
    try {
      const existing = await prisma.baSubTask.findUnique({
        where: { moduleDbId_subtaskId: { moduleDbId: mod.id, subtaskId: p.subtaskId } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.baSubTask.create({
        data: {
          moduleDbId: mod.id,
          artifactDbId: subtaskArtifact.id,
          subtaskId: p.subtaskId,
          subtaskName: p.subtaskName,
          team: p.team,
          userStoryId: p.userStoryId,
          featureId: p.featureId,
          moduleId: targetModuleId,
          className: p.className,
          methodName: p.methodName,
          status: SubTaskStatus.DRAFT,
          prerequisites: [],
          tbdFutureRefs: [],
        },
      });
      created++;
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${p.subtaskId}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  console.log(`\nCreated: ${created}`);
  console.log(`Skipped (already existed): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log('Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
