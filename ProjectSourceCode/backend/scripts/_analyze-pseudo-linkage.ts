/** Analyze linkage between BaPseudoFile (LLD), BaSubTask, and BaTestCase
 *  for a module. Answers: can we group pseudo-files by feature / subtask
 *  at render time, and how reliable would that grouping be? */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`${moduleId} not found`); await prisma.$disconnect(); return; }

  const lld = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'LLD' as never },
    orderBy: { createdAt: 'desc' },
    include: { pseudoFiles: { orderBy: { path: 'asc' } } },
  });
  if (!lld) { console.log('no LLD'); await prisma.$disconnect(); return; }

  const subtasks = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    select: { subtaskId: true, sourceFileName: true, featureId: true, userStoryId: true, team: true },
  });

  const ftc = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' as never },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const tcs = ftc ? await prisma.baTestCase.findMany({
    where: { artifactDbId: ftc.id },
    select: { testCaseId: true, linkedPseudoFileIds: true, linkedSubtaskIds: true, linkedFeatureIds: true },
  }) : [];

  console.log(`\n=== ${moduleId} LLD pseudo-file linkage analysis ===`);
  console.log(`Pseudo-files: ${lld.pseudoFiles.length}`);
  console.log(`Subtasks: ${subtasks.length}`);
  console.log(`Test cases with linkedPseudoFileIds: ${tcs.filter((t) => t.linkedPseudoFileIds.length > 0).length} / ${tcs.length}`);

  // Strategy 1: by path-matching subtask.sourceFileName
  const stsBySourceFile = new Map<string, typeof subtasks[number][]>();
  for (const st of subtasks) {
    if (!st.sourceFileName) continue;
    const key = st.sourceFileName.toLowerCase();
    if (!stsBySourceFile.has(key)) stsBySourceFile.set(key, []);
    stsBySourceFile.get(key)!.push(st);
  }

  let matchedByPath = 0;
  let unmatchedByPath = 0;
  const matchByPathSample: Array<{ pf: string; matched: string[] }> = [];
  for (const pf of lld.pseudoFiles) {
    // Try a few path-matching heuristics:
    //  a) exact match on lowercased path
    //  b) basename (last segment) match
    //  c) substring match (pf.path ends with sourceFileName)
    const pfLower = pf.path.toLowerCase();
    const basename = pf.path.split('/').pop()?.toLowerCase() ?? '';
    let matched: typeof subtasks = [];
    for (const st of subtasks) {
      if (!st.sourceFileName) continue;
      const sfLower = st.sourceFileName.toLowerCase();
      if (sfLower === pfLower || pfLower.endsWith(sfLower) || sfLower.endsWith(basename)) {
        matched.push(st);
      }
    }
    if (matched.length > 0) {
      matchedByPath++;
      if (matchByPathSample.length < 5) matchByPathSample.push({ pf: pf.path, matched: matched.map((s) => `${s.subtaskId} (sf=${s.sourceFileName})`) });
    } else {
      unmatchedByPath++;
    }
  }
  console.log(`\n--- Strategy 1: match pseudo-file.path ↔ BaSubTask.sourceFileName ---`);
  console.log(`Matched: ${matchedByPath} / ${lld.pseudoFiles.length} pseudo-files`);
  console.log(`Unmatched: ${unmatchedByPath}`);
  console.log(`Sample matches:`);
  for (const s of matchByPathSample) {
    console.log(`  ${s.pf}`);
    for (const m of s.matched) console.log(`    → ${m}`);
  }

  // Strategy 2: BaTestCase.linkedPseudoFileIds reverse lookup
  const tcByPseudoId = new Map<string, Set<string>>();
  for (const tc of tcs) {
    for (const pfid of tc.linkedPseudoFileIds) {
      if (!tcByPseudoId.has(pfid)) tcByPseudoId.set(pfid, new Set());
      tcByPseudoId.get(pfid)!.add(tc.testCaseId);
    }
  }
  let matchedByTc = 0;
  for (const pf of lld.pseudoFiles) {
    if (tcByPseudoId.has(pf.id)) matchedByTc++;
  }
  console.log(`\n--- Strategy 2: BaTestCase.linkedPseudoFileIds → pseudo-file ---`);
  console.log(`Pseudo-files with at least one TC referencing them: ${matchedByTc} / ${lld.pseudoFiles.length}`);

  // Strategy 3: feature inference from path conventions (look for F-XX-YY in path)
  const featureInPath = lld.pseudoFiles.filter((pf) => /F-\d+-\d+/i.test(pf.path)).length;
  console.log(`\n--- Strategy 3: F-XX-YY token in pseudo-file path ---`);
  console.log(`Pseudo-files with F-XX-YY in path: ${featureInPath} / ${lld.pseudoFiles.length}`);

  // Strategy 4: directory bucket (frontend/backend/etc.)
  const dirBuckets = new Map<string, number>();
  for (const pf of lld.pseudoFiles) {
    const top = pf.path.split('/').slice(0, 3).join('/');
    dirBuckets.set(top, (dirBuckets.get(top) ?? 0) + 1);
  }
  console.log(`\n--- Strategy 4: top-3-segment directory buckets ---`);
  for (const [dir, count] of [...dirBuckets].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${dir}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
