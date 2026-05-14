/**
 * USER_STORY canonical restructurer.
 *
 * Why this file exists: USER_STORY is stored as MANY `BaArtifactSection`
 * rows — typically one per story plus some grouping/header sections the
 * LLM emits as bookkeeping (`User Stories for F-XX-YY` separator markers,
 * `Coverage Summary`, etc.). Those bookkeeping rows have near-empty
 * bodies (~3 chars, just `---` or a stray label) and would render as
 * empty top-level sections in PDF/DOCX — polluting the TOC and confusing
 * the reader.
 *
 * Strategy: walk the source sections, identify each `US-NNN` story by
 * inspecting label + body, drop empty bookkeeping rows, sort by story ID
 * for stable order, and emit one canonical `BaSectionLite` per story.
 *
 * Defense-in-depth with the SKILL-04 post-emission validator
 * (`validateSkill04Output`), which enforces the 27-section canonical
 * structure inside each story's body AT GENERATION TIME. This file is
 * the AT RENDER TIME safety net — even if a future LLM run drifts in
 * shape, the renderer produces a clean per-story TOC.
 *
 * Mirrors the pattern in `frd-restructure.ts`, `ftc-restructure.ts`,
 * and `epic-restructure.ts`.
 */

import type { BaArtifactDoc, BaSectionLite } from './artifact-html';

const STORY_ID_RE = /\bUS-(\d{3,})\b/;
const FEATURE_REF_RE = /(?:FRD\s+Feature\s+Reference|Feature\s+Reference|Feature\s+ID)[^A-Za-z0-9]{0,40}(F-\d+-\d+)/i;
// Minimum body length for a section to be considered a real story rather
// than a placeholder/separator marker. Real stories are ~5-10 KB; the
// "User Stories for F-XX" markers are ~3 chars. 100 is a safe threshold
// that catches stub stories without burning real ones.
const MIN_STORY_BODY_CHARS = 100;

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
 * Try to recover a `US-NNN` story ID from a section's label or the first
 * few lines of its body. Returns null when no match — caller treats those
 * as non-story rows (Coverage Summary, feature-group separators, etc.).
 */
function extractStoryId(label: string, content: string): string | null {
  let m = STORY_ID_RE.exec(label);
  if (m) return `US-${m[1]}`;
  const firstLines = content.split(/\r?\n/).slice(0, 10).join(' ');
  m = STORY_ID_RE.exec(firstLines);
  if (m) return `US-${m[1]}`;
  return null;
}

/**
 * Try to recover the FRD feature this story implements. Scans the body
 * for "FRD Feature Reference" / "Feature Reference" / "Feature ID"
 * labels followed by F-XX-YY. Returns null when the LLM omitted the
 * reference (renderer falls back to "Unassigned").
 */
function extractFeatureId(content: string): string | null {
  const m = FEATURE_REF_RE.exec(content);
  return m ? m[1] : null;
}

/**
 * Build a stable section key for a story so the slug pipeline (used by
 * `extractInnerHeadings`) produces deterministic anchors across renders.
 */
function storyKey(storyId: string): string {
  return `user_story_${storyId.toLowerCase().replace(/-/g, '_')}`;
}

/**
 * Numeric sort by the digits in US-NNN. Falls back to string compare
 * when the regex misses (shouldn't happen — extractStoryId guarantees
 * the pattern).
 */
function compareStoryIds(a: string, b: string): number {
  const am = STORY_ID_RE.exec(a);
  const bm = STORY_ID_RE.exec(b);
  if (!am || !bm) return a.localeCompare(b);
  return parseInt(am[1], 10) - parseInt(bm[1], 10);
}

/**
 * Restructure a USER_STORY doc into the canonical shape. Returns the
 * input unchanged when `artifactType !== 'USER_STORY'`.
 *
 * Behaviour:
 *   - Drops sections without a recoverable US-NNN identifier (Coverage
 *     Summary, feature-group separators, etc.).
 *   - Drops sections whose body is below MIN_STORY_BODY_CHARS — those
 *     are the empty `User Stories for F-XX` marker rows.
 *   - Normalises each story's label to `US-NNN — <derived name>` so the
 *     TOC and Document History show a consistent shape.
 *   - Sorts by numeric story ID for stable cross-render output.
 *
 * Degraded-input handling: if zero stories are recovered (LLM emitted a
 * completely different structure), the original sections are returned so
 * the export still shows whatever content exists.
 */
export function restructureUserStoryDoc(doc: BaArtifactDoc): BaArtifactDoc {
  if (doc.artifactType !== 'USER_STORY') return doc;

  const source = [...doc.sections].sort((a, b) => a.displayOrder - b.displayOrder);
  if (source.length === 0) return doc;

  // Recover stories. Multiple source rows might map to the same US-NNN
  // (rare — usually a single row carries the full story body), in which
  // case we keep the longest body — it's the most complete version.
  const byStoryId = new Map<string, { content: string; source: BaSectionLite }>();
  const newest = source.reduce<BaSectionLite | undefined>((best, s) => {
    const t = new Date(s.updatedAt ?? 0).getTime();
    if (!best) return s;
    return t > new Date(best.updatedAt ?? 0).getTime() ? s : best;
  }, undefined);

  for (const s of source) {
    const content = (s.isHumanModified && s.editedContent ? s.editedContent : s.content) ?? '';
    if (content.length < MIN_STORY_BODY_CHARS) continue;
    const storyId = extractStoryId(s.sectionLabel, content);
    if (!storyId) continue;
    const existing = byStoryId.get(storyId);
    if (!existing || content.length > existing.content.length) {
      byStoryId.set(storyId, { content, source: s });
    }
  }

  if (byStoryId.size === 0) return doc;

  const sortedIds = Array.from(byStoryId.keys()).sort(compareStoryIds);

  const newSections: BaSectionLite[] = sortedIds.map((storyId, idx) => {
    const { content, source: src } = byStoryId.get(storyId)!;
    const featureId = extractFeatureId(content);
    const name = deriveStoryName(content);
    const label = name
      ? `${storyId} — ${name}`
      : (featureId ? `${storyId} (${featureId})` : storyId);
    return makeSyntheticSection(
      `user-story-canonical-${idx}-${doc.artifactId}`,
      storyKey(storyId),
      label,
      content,
      src,
      idx,
    );
  });

  // Attach a deterministic preamble section if a "Coverage Summary"
  // existed and is non-trivial — it provides a useful executive overview
  // at the top of the USER_STORY export.
  const coverage = source.find((s) => /coverage\s+summary/i.test(s.sectionLabel) && (s.content ?? '').trim().length > 50);
  if (coverage) {
    newSections.unshift(makeSyntheticSection(
      `user-story-coverage-${doc.artifactId}`,
      'coverage_summary',
      'Coverage Summary',
      (coverage.isHumanModified && coverage.editedContent ? coverage.editedContent : coverage.content) ?? '',
      newest,
      -1,
    ));
    // Renumber displayOrders so the coverage row lands at 0 and stories at 1..n.
    newSections.forEach((s, i) => { s.displayOrder = i; });
  }

  return {
    ...doc,
    sections: newSections,
  };
}

/**
 * Derive a story's display name from its body content. SKILL-04 emits
 * `#### 2. User Story Name` as the canonical name section; its first
 * non-empty line under that heading is the title.
 */
function deriveStoryName(content: string): string | null {
  const m = /####\s+2\.\s*User\s+Story\s+Name\s*\n+([^\n#]+)/i.exec(content);
  if (m) return m[1].trim().replace(/^[-*\s]+/, '').slice(0, 120);
  return null;
}
