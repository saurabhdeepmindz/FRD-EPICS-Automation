/**
 * EPIC canonical restructurer.
 *
 * Why this file exists: the EPIC artifact is stored as a single monolithic
 * `BaArtifactSection` (label "Introduction") whose body contains the entire
 * 17-section EPIC deliverable as `#### Heading` markdown blocks. The
 * preview component parses this body on the fly; the export pipeline used
 * to render it as one big "Introduction" section with all the canonical
 * headings buried inside as H6 (`level + 2`) — making the TOC unusable
 * and the visual hierarchy wrong.
 *
 * Strategy: split the monolithic body on `^####` headings and emit one
 * `BaSectionLite` per canonical section so:
 *   - the rendered TOC shows section labels at top level,
 *   - each canonical section gets its own anchor for navigation,
 *   - the structure is identical across editor / preview / PDF / DOCX,
 *   - future LLM drift can't bury the canonical sections.
 *
 * The SKILL-02-S post-emission validator (`validateSkill02SOutput`) already
 * enforces canonical-shape AT GENERATION TIME. This restructurer is the
 * AT RENDER TIME safety net — defense in depth.
 *
 * Mirrors the pattern in `frd-restructure.ts` and `ftc-restructure.ts`.
 */

import type { BaArtifactDoc, BaSectionLite } from './artifact-html';

/**
 * Build a synthetic `BaSectionLite` carrying the given content + label.
 * Identical helper signature to the FRD/FTC restructurers so the pattern
 * stays consistent across the three artifact types.
 */
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
 * Convert a `#### Heading Text` markdown line into:
 *   - sectionLabel: "Heading Text" (used as the rendered H2 label)
 *   - sectionKey:   "section_1_epic_name" (lowercase + underscore for slug stability)
 */
function buildSectionKey(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[—–-]/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

/**
 * Split monolithic EPIC body on `^####` headings. Each split becomes a
 * canonical section. Heading lines themselves are stripped from the
 * content (the BaSectionLite's `sectionLabel` carries the heading text).
 *
 * Behaviour for content BEFORE the first `####` heading: emitted as
 * "preamble" if non-trivial (rare — most LLM outputs begin with the
 * EPIC Header heading immediately).
 */
function splitMonolithicBody(body: string): Array<{ headingText: string; bodyContent: string }> {
  const headingRe = /^####\s+(.+)$/;
  const lines = body.split(/\r?\n/);
  const result: Array<{ headingText: string; bodyContent: string }> = [];
  let current: { headingText: string; bodyLines: string[] } | null = null;

  for (const raw of lines) {
    const m = headingRe.exec(raw);
    if (m) {
      if (current) {
        result.push({ headingText: current.headingText, bodyContent: trimEdges(current.bodyLines.join('\n')) });
      }
      current = { headingText: m[1].trim(), bodyLines: [] };
      continue;
    }
    if (current) {
      current.bodyLines.push(raw);
    }
    // content before the first heading is discarded — EPIC body always
    // begins with the first heading in practice.
  }
  if (current) {
    result.push({ headingText: current.headingText, bodyContent: trimEdges(current.bodyLines.join('\n')) });
  }
  return result;
}

/** Trim leading/trailing blank lines + any trailing `---` separator the
 *  LLM emits between sections. */
function trimEdges(s: string): string {
  return s
    .replace(/^\s*[\r\n]+/, '')
    .replace(/[\r\n]+\s*$/, '')
    .replace(/\n+---\s*$/, '')
    .replace(/^\s*---\n+/, '')
    .trim();
}

/**
 * Restructure an EPIC doc into the canonical shape. Returns the input
 * unchanged when `artifactType !== 'EPIC'` so callers can wrap
 * unconditionally.
 *
 * Degraded-input handling: if the monolithic body produces no `####`
 * splits (LLM emitted a different structure), the original sections are
 * returned so the export still shows whatever content exists. We don't
 * want a parser miss to silently empty the deliverable.
 */
export function restructureEpicDoc(doc: BaArtifactDoc): BaArtifactDoc {
  if (doc.artifactType !== 'EPIC') return doc;

  const sourceSections = [...doc.sections].sort((a, b) => a.displayOrder - b.displayOrder);
  if (sourceSections.length === 0) return doc;

  // EPIC is stored as ONE monolithic section. We use whichever single
  // section carries substantive content; if multiple sections happen to
  // exist (legacy state), concatenate them in displayOrder.
  const monolithicBody = sourceSections
    .map((s) => (s.isHumanModified && s.editedContent ? s.editedContent : s.content) ?? '')
    .filter((b) => b.trim().length > 0)
    .join('\n\n');

  if (!monolithicBody.trim()) return doc;

  const splits = splitMonolithicBody(monolithicBody);
  if (splits.length === 0) return doc; // graceful fallback — no #### headings found

  // Use the newest source section for the synthetic sections' timestamps
  // so Document History reflects reality.
  const newest = sourceSections.reduce<BaSectionLite | undefined>((best, s) => {
    const t = new Date(s.updatedAt ?? 0).getTime();
    if (!best) return s;
    return t > new Date(best.updatedAt ?? 0).getTime() ? s : best;
  }, undefined);

  const newSections: BaSectionLite[] = splits.map((sp, idx) => makeSyntheticSection(
    `epic-canonical-${idx}-${doc.artifactId}`,
    `epic_${buildSectionKey(sp.headingText) || `section_${idx}`}`,
    sp.headingText,
    sp.bodyContent,
    newest,
    idx,
  ));

  return {
    ...doc,
    sections: newSections,
  };
}
