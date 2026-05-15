/**
 * FTC structure builder — frontend mirror of `backend/src/ba-tool/templates/
 * ftc-structure.ts`. Used by the preview page to produce the same
 * category → feature → test-case hierarchy the editor tree shows
 * (`7.1.12 Functional Test Cases → 7.1.12.1 F-05-01 → 7.1.12.1.1 TC-…`).
 *
 * The two files are intentionally byte-equivalent in their core grouping
 * logic. When changing bucket / sort / formatter behaviour, update both
 * copies in lockstep so PDF / DOCX / preview keep producing the same
 * shape.
 */

import type { BaTestCase } from './ba-api';

export interface FtcFeatureBucket {
  featureId: string;             // 'F-05-01' or '__ungrouped__'
  featureLabel: string;          // 'F-05-01 — Reset Password' or '(Ungrouped)'
  testCases: BaTestCase[];
}

export interface FtcCategoryGroup {
  key: string;                   // 'Functional' | 'white_box' | …
  label: string;                 // 'Functional Test Cases' | 'White-Box Test Cases'
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

export function buildFtcStructure(
  testCases: BaTestCase[],
  featureNames: Record<string, string> = {},
): FtcCategoryGroup[] {
  if (testCases.length === 0) return [];

  const byCategory = new Map<string, BaTestCase[]>();
  const whiteBox: BaTestCase[] = [];
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

function bucketByFeature(
  tcs: BaTestCase[],
  featureNames: Record<string, string>,
): FtcFeatureBucket[] {
  const buckets = new Map<string, BaTestCase[]>();
  for (const tc of tcs) {
    const fid = tc.linkedFeatureIds?.[0] ?? UNGROUPED_FEATURE;
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
 * Format one TC's body (preconditions / steps / expected / etc.) as
 * markdown. The heading + meta line are rendered separately by the preview
 * `renderBody` so each TC becomes its own section card.
 */
export function formatTestCaseBodyMarkdown(tc: BaTestCase): string {
  const lines: string[] = [];

  // Compact metadata line — type, priority, integration, OWASP, scenario.
  const meta: string[] = [];
  meta.push(`**Type:** ${tc.testKind.charAt(0).toUpperCase()}${tc.testKind.slice(1)}`);
  if (tc.priority) meta.push(`**Priority:** ${tc.priority}`);
  if (tc.isIntegrationTest) meta.push('**Integration**');
  if (tc.owaspCategory) meta.push(`**OWASP:** ${tc.owaspCategory}`);
  if (tc.scenarioGroup) meta.push(`**Scenario:** ${tc.scenarioGroup}`);
  lines.push(meta.join(' · '));
  lines.push('');

  const trace: string[] = [];
  if (tc.linkedFeatureIds?.length > 0) trace.push(`**Feature:** ${tc.linkedFeatureIds.join(', ')}`);
  if (tc.linkedEpicIds?.length > 0) trace.push(`**EPIC:** ${tc.linkedEpicIds.join(', ')}`);
  if (tc.linkedStoryIds?.length > 0) trace.push(`**Story:** ${tc.linkedStoryIds.join(', ')}`);
  if (tc.linkedSubtaskIds?.length > 0) trace.push(`**SubTask:** ${tc.linkedSubtaskIds.join(', ')}`);
  if (trace.length > 0) {
    lines.push(trace.join(' · '));
    lines.push('');
  }

  if (tc.preconditions?.trim()) lines.push('**Pre-conditions:**', '', tc.preconditions.trim(), '');
  if (tc.testData?.trim()) lines.push('**Test Data:**', '', tc.testData.trim(), '');
  if (tc.e2eFlow?.trim()) lines.push(`**E2E Flow:** ${tc.e2eFlow.trim()}`, '');
  if (tc.steps?.trim()) lines.push('**Steps:**', '', tc.steps.trim(), '');
  if (tc.expected?.trim()) lines.push('**Expected:**', '', tc.expected.trim(), '');
  if (tc.postValidation?.trim()) lines.push('**Post-validation:**', '', tc.postValidation.trim(), '');
  if (tc.sqlSetup?.trim()) lines.push('**SQL Setup:**', '', '```sql', tc.sqlSetup.trim(), '```', '');
  if (tc.sqlVerify?.trim()) lines.push('**SQL Verify:**', '', '```sql', tc.sqlVerify.trim(), '```', '');
  if (tc.playwrightHint?.trim()) lines.push(`**Playwright Hint:** ${tc.playwrightHint.trim()}`, '');
  if (tc.developerHints?.trim()) lines.push(`**Developer Hints:** ${tc.developerHints.trim()}`, '');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
