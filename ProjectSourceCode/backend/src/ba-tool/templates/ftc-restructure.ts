/**
 * FTC canonical restructurer — same role as `frd-restructure.ts` but for
 * Functional Test Case artifacts.
 *
 * Goal: produce the deliverable shape the testing team reviews from the
 * editor tree. Concretely:
 *
 *   1. Keep the canonical text sections (Summary, Test Strategy, Test
 *      Environment, Master Data Setup, OWASP coverage matrices, Data
 *      Cleanup, Playwright Readiness, Traceability Summary, Open
 *      Questions, Applied Best-Practice Defaults) in a fixed order.
 *   2. DROP the AI-authored markdown dump sections that duplicate what's
 *      in the structured `BaTestCase` rows (`functional_test_cases`,
 *      `integration_test_cases`, `white_box_test_cases`,
 *      `test_cases_index`, `test_case_appendix`). These render as
 *      verbose key-value walls of text in the editor and are hidden
 *      there for the same reason.
 *   3. Append synthetic per-category sections (Functional / Integration
 *      / Security / UI / Data / Performance / Accessibility / API /
 *      White-Box) whose body is `## F-XX-YY` feature buckets containing
 *      `### TC-…` blocks built from `BaTestCase` rows. Empty categories
 *      are omitted.
 *
 * The existing extractInnerHeadings + renderMarkdown machinery picks up
 * the H2 feature headings and H3 TC headings and emits a 3-level nested
 * TOC in HTML/PDF — same shape as the editor tree.
 *
 * No-op for non-FTC artifacts so callers can wrap unconditionally.
 */

import type { BaArtifactDoc, BaSectionLite } from './artifact-html';
import { buildFtcStructure, formatCategoryBody, type FtcCategoryGroup } from './ftc-structure';

/** AI-authored markdown sections we drop because BaTestCase carries the data. */
const FTC_HIDDEN_SECTION_KEYS = new Set([
  'test_cases_index',
  'functional_test_cases',
  'integration_test_cases',
  'white_box_test_cases',
  'test_case_appendix',
]);

/**
 * Canonical order for the kept text sections. Matches the editor tree's
 * `FTC_SECTION_ORDER` minus the dropped ones above. Sections not in this
 * list keep their original order at the tail (defensive against new
 * canonical sections added by the skill).
 */
const FTC_TEXT_SECTION_ORDER: readonly string[] = [
  'summary',
  'test_strategy',
  'test_environment',
  'master_data_setup',
  'owasp_web_coverage',
  'owasp_llm_coverage',
  'data_cleanup',
  'playwright_readiness',
  'traceability_summary',
  'open_questions_tbd',
  'applied_defaults',
  'ac_coverage_verification',
];

function makeSyntheticSection(
  id: string,
  sectionKey: string,
  sectionLabel: string,
  content: string,
  source: BaSectionLite | undefined,
  displayOrder: number,
): BaSectionLite {
  const now = new Date();
  return {
    id,
    sectionKey,
    sectionLabel,
    content,
    editedContent: null,
    isHumanModified: source?.isHumanModified ?? false,
    aiGenerated: source?.aiGenerated ?? true,
    displayOrder,
    createdAt: source?.createdAt ?? now,
    updatedAt: source?.updatedAt ?? now,
  };
}

/**
 * Restructure an FTC doc into the canonical shape. Returns the input
 * unchanged when `artifactType !== 'FTC'` so callers can wrap
 * unconditionally.
 *
 * Degraded-input handling: when `doc.testCases` is missing or empty the
 * synthetic per-category sections are skipped. The kept text sections
 * still render so the export never empties out from a single bad assumption.
 */
export function restructureFtcDoc(doc: BaArtifactDoc): BaArtifactDoc {
  if (doc.artifactType !== 'FTC') return doc;

  const sourceSections = [...doc.sections].sort((a, b) => a.displayOrder - b.displayOrder);

  // Pick a representative section for synthetic sections' timestamps —
  // mirrors the FRD restructurer's "newest" heuristic.
  const newest = sourceSections.reduce<BaSectionLite | undefined>((best, s) => {
    if (!best) return s;
    return new Date(s.updatedAt ?? 0).getTime() > new Date(best.updatedAt ?? 0).getTime() ? s : best;
  }, undefined);

  // Phase 1 — keep the text sections in canonical order, dropping hidden
  // ones. Sections not in the canonical order land at the tail in their
  // original order.
  const orderIndex = (key: string): number => {
    const i = FTC_TEXT_SECTION_ORDER.indexOf(key);
    return i === -1 ? FTC_TEXT_SECTION_ORDER.length : i;
  };
  const keptText = sourceSections
    .filter((s) => !FTC_HIDDEN_SECTION_KEYS.has(s.sectionKey))
    .filter((s) => {
      const body = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
      return body && body.trim();
    })
    .sort((a, b) => {
      const ai = orderIndex(a.sectionKey);
      const bi = orderIndex(b.sectionKey);
      if (ai !== bi) return ai - bi;
      return a.displayOrder - b.displayOrder;
    });

  // Phase 2 — synthesize per-category sections from BaTestCase data.
  const structure: FtcCategoryGroup[] = doc.testCases && doc.testCases.length > 0
    ? buildFtcStructure(doc.testCases, doc.frdFeatureNames ?? {})
    : [];

  // Phase 3 — assemble the new sections array. Kept text first (so
  // Summary / Test Strategy / etc. appear before any TC dump), then the
  // synthetic category sections in CATEGORY_ORDER.
  const newSections: BaSectionLite[] = [];
  let order = 0;

  for (const s of keptText) {
    newSections.push({ ...s, displayOrder: order++ });
  }

  for (const group of structure) {
    const body = formatCategoryBody(group);
    if (!body.trim()) continue;
    newSections.push(
      makeSyntheticSection(
        `ftc-${group.key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}-${doc.artifactId}`,
        `ftc_${group.key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        `${group.label} (${group.count})`,
        body,
        newest,
        order++,
      ),
    );
  }

  return {
    ...doc,
    sections: newSections,
  };
}
