/**
 * FTC structure builder — turns flat `BaTestCaseLite[]` into the
 * category → feature → test-case hierarchy the editor tree shows
 * (`7.1.12 Functional Test Cases → 7.1.12.1 F-05-01 → 7.1.12.1.1 TC-…`).
 *
 * Mirrors the synthetic groupings inside `frontend/components/ba-tool/
 * ArtifactTree.tsx` so PDF / DOCX / preview all read the same shape.
 *
 * Two phases:
 *   1. Bucket TCs by `category` (or White-Box if `scope === 'white_box'`).
 *      Categories outside CATEGORY_ORDER fall into 'Functional' so nothing
 *      is silently dropped.
 *   2. Within each bucket, sub-bucket by the first `linkedFeatureIds` entry.
 *      TCs with no feature link land in an `(Ungrouped)` bucket so they
 *      remain visible.
 */

import type { BaTestCaseLite } from './artifact-html';

export interface FtcFeatureBucket {
  /** Feature ID like "F-05-01" or `__ungrouped__` for orphan TCs. */
  featureId: string;
  /** Display label: "F-05-01 — Reset Password" or "(Ungrouped — no feature link)". */
  featureLabel: string;
  testCases: BaTestCaseLite[];
}

export interface FtcCategoryGroup {
  /** Internal key — e.g. 'Functional' / 'white_box'. */
  key: string;
  /** Section label rendered in the document — "Functional Test Cases" / "White-Box Test Cases". */
  label: string;
  /** Number of TCs across all feature buckets. */
  count: number;
  featureBuckets: FtcFeatureBucket[];
}

export const FTC_CATEGORY_ORDER: readonly string[] = [
  'Functional',
  'Integration',
  'Security',
  'UI',
  'Data',
  'Performance',
  'Accessibility',
  'API',
];

const UNGROUPED_FEATURE = '__ungrouped__';

/**
 * Build the canonical FTC tree from a flat list of test cases.
 *
 * `featureNames`: optional `featureId → human label` map (sourced from the
 * sibling FRD artifact). When omitted, feature buckets fall back to the
 * bare ID. Empty categories are dropped from the output.
 */
export function buildFtcStructure(
  testCases: BaTestCaseLite[],
  featureNames: Record<string, string> = {},
): FtcCategoryGroup[] {
  if (testCases.length === 0) return [];

  // Phase 1 — bucket by category. White-Box is its own bucket regardless of
  // category; everything else falls back to Functional when the category
  // isn't recognised so degraded AI output doesn't silently drop TCs.
  const byCategory = new Map<string, BaTestCaseLite[]>();
  const whiteBox: BaTestCaseLite[] = [];
  for (const tc of testCases) {
    if (tc.scope === 'white_box') {
      whiteBox.push(tc);
      continue;
    }
    const cat = tc.category && FTC_CATEGORY_ORDER.includes(tc.category) ? tc.category : 'Functional';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(tc);
  }

  const groups: FtcCategoryGroup[] = [];
  for (const cat of FTC_CATEGORY_ORDER) {
    const tcs = byCategory.get(cat);
    if (!tcs || tcs.length === 0) continue;
    groups.push({
      key: cat,
      label: `${cat} Test Cases`,
      count: tcs.length,
      featureBuckets: bucketByFeature(tcs, featureNames),
    });
  }
  if (whiteBox.length > 0) {
    groups.push({
      key: 'white_box',
      label: 'White-Box Test Cases',
      count: whiteBox.length,
      featureBuckets: bucketByFeature(whiteBox, featureNames),
    });
  }
  return groups;
}

/**
 * Phase 2 — sub-bucket a category's TCs by the first linked feature ID.
 * Sort feature buckets by ID using locale + numeric so `F-05-09 < F-05-10`;
 * the `(Ungrouped)` bucket sinks to the end. Within each bucket, TCs keep
 * their incoming order (which the loader already sorts by `testCaseId`).
 */
function bucketByFeature(
  tcs: BaTestCaseLite[],
  featureNames: Record<string, string>,
): FtcFeatureBucket[] {
  const buckets = new Map<string, BaTestCaseLite[]>();
  for (const tc of tcs) {
    const fid = tc.linkedFeatureIds[0] ?? UNGROUPED_FEATURE;
    if (!buckets.has(fid)) buckets.set(fid, []);
    buckets.get(fid)!.push(tc);
  }
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === UNGROUPED_FEATURE) return 1;
    if (b === UNGROUPED_FEATURE) return -1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
  return sortedKeys.map((fid) => ({
    featureId: fid,
    featureLabel: fid === UNGROUPED_FEATURE
      ? '(Ungrouped — no feature link)'
      : featureNames[fid]
        ? `${fid} — ${featureNames[fid]}`
        : fid,
    testCases: buckets.get(fid) ?? [],
  }));
}

/**
 * Format one test case as a deterministic markdown block. The H3 heading
 * carries the bare `testCaseId: title` so `extractInnerHeadings` picks it
 * up as TOC depth-3 entry under its feature heading. Field labels match
 * the editor's `TestCaseBody` so a reader sees the same shape on screen
 * and on paper.
 *
 * Empty fields are omitted to keep the body compact — the testing team
 * reviews ~150 TCs at a time and noise hurts.
 */
export function formatTestCaseBlock(tc: BaTestCaseLite): string {
  const lines: string[] = [];
  lines.push(`### ${tc.testCaseId}: ${tc.title}`);
  lines.push('');

  // Compact metadata line — type, priority, scenario.
  const meta: string[] = [];
  meta.push(`**Type:** ${tc.testKind.charAt(0).toUpperCase()}${tc.testKind.slice(1)}`);
  if (tc.priority) meta.push(`**Priority:** ${tc.priority}`);
  if (tc.isIntegrationTest) meta.push('**Integration**');
  if (tc.owaspCategory) meta.push(`**OWASP:** ${tc.owaspCategory}`);
  if (tc.scenarioGroup) meta.push(`**Scenario:** ${tc.scenarioGroup}`);
  lines.push(meta.join(' · '));
  lines.push('');

  // Traceability line — comma-separated linked artefact IDs.
  const trace: string[] = [];
  if (tc.linkedFeatureIds.length > 0) trace.push(`**Feature:** ${tc.linkedFeatureIds.join(', ')}`);
  if (tc.linkedEpicIds.length > 0) trace.push(`**EPIC:** ${tc.linkedEpicIds.join(', ')}`);
  if (tc.linkedStoryIds.length > 0) trace.push(`**Story:** ${tc.linkedStoryIds.join(', ')}`);
  if (tc.linkedSubtaskIds.length > 0) trace.push(`**SubTask:** ${tc.linkedSubtaskIds.join(', ')}`);
  if (trace.length > 0) {
    lines.push(trace.join(' · '));
    lines.push('');
  }

  if (tc.preconditions?.trim()) {
    lines.push('**Pre-conditions:**');
    lines.push('');
    lines.push(tc.preconditions.trim());
    lines.push('');
  }
  if (tc.testData?.trim()) {
    lines.push('**Test Data:**');
    lines.push('');
    lines.push(tc.testData.trim());
    lines.push('');
  }
  if (tc.e2eFlow?.trim()) {
    lines.push(`**E2E Flow:** ${tc.e2eFlow.trim()}`);
    lines.push('');
  }
  if (tc.steps?.trim()) {
    lines.push('**Steps:**');
    lines.push('');
    lines.push(tc.steps.trim());
    lines.push('');
  }
  if (tc.expected?.trim()) {
    lines.push('**Expected:**');
    lines.push('');
    lines.push(tc.expected.trim());
    lines.push('');
  }
  if (tc.postValidation?.trim()) {
    lines.push('**Post-validation:**');
    lines.push('');
    lines.push(tc.postValidation.trim());
    lines.push('');
  }
  if (tc.sqlSetup?.trim() || tc.sqlVerify?.trim()) {
    if (tc.sqlSetup?.trim()) {
      lines.push('**SQL Setup:**');
      lines.push('');
      lines.push('```sql');
      lines.push(tc.sqlSetup.trim());
      lines.push('```');
      lines.push('');
    }
    if (tc.sqlVerify?.trim()) {
      lines.push('**SQL Verify:**');
      lines.push('');
      lines.push('```sql');
      lines.push(tc.sqlVerify.trim());
      lines.push('```');
      lines.push('');
    }
  }
  if (tc.playwrightHint?.trim()) {
    lines.push(`**Playwright Hint:** ${tc.playwrightHint.trim()}`);
    lines.push('');
  }
  if (tc.developerHints?.trim()) {
    lines.push(`**Developer Hints:** ${tc.developerHints.trim()}`);
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

/**
 * Format an entire category group's body markdown. Uses H2 for feature
 * buckets and H3 for individual TCs so the renderer's depth normaliser
 * lands feature buckets at TOC depth 2 and TCs at depth 3 — matching the
 * editor tree's three-level nesting.
 */
export function formatCategoryBody(group: FtcCategoryGroup): string {
  const out: string[] = [];
  for (const fb of group.featureBuckets) {
    out.push(`## ${fb.featureLabel}`);
    out.push('');
    for (const tc of fb.testCases) {
      out.push(formatTestCaseBlock(tc));
      out.push('');
      out.push('---');
      out.push('');
    }
    // Drop the trailing rule before the next feature.
    while (out.length > 0 && (out[out.length - 1] === '---' || out[out.length - 1] === '')) {
      out.pop();
    }
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
