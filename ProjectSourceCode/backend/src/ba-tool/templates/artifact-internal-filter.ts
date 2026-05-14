/**
 * Shared filter for "internal-processing" artifact sections (Gap B).
 *
 * The frontend `FrdArtifactView.tsx` already filters these into a
 * collapsible group for in-app review, but the export pipeline (PDF /
 * DOCX) used to render them verbatim — leaking AI process steps,
 * checklists, and customer-sign-off text into customer deliverables.
 * This module is the single source of truth for what counts as
 * "internal" so the two surfaces stay in lockstep.
 *
 * Two predicates:
 *   - isInternalSection(label): matches a section LABEL against the
 *     internal-processing pattern set (Step N, Introduction, Output
 *     Checklist, Validate the FRD, Customer Sign-Off, Definition of
 *     Done, etc.).
 *   - isPreambleOnlySection(content): matches a section BODY that
 *     contains only a redundant title preamble (e.g. "**Functional
 *     Requirements Document (FRD) — Module Section**" + a horizontal
 *     rule). The cover page already carries the document title.
 *
 * Composite helper `shouldOmitFromExport` applies both plus an empty-
 * body check so callers don't have to repeat the logic.
 *
 * Kept here (not in artifact-style.ts) because it's about CONTENT
 * filtering, not visual styling — separate concerns.
 */

/**
 * Labels whose section is *process* (how the AI produced the artifact),
 * not *deliverable* (what the customer receives). The capture group
 * intentionally allows trailing text (e.g. "Step 8: Obtain Customer
 * Sign-Off ...") because LLM output frequently appends qualifiers.
 */
export const INTERNAL_SECTION_REGEX =
  /^(step\s*\d+|introduction|output\s*checklist|update\s*compact\s*module\s*index|validate\s*the\s*frd|obtain\s*customer\s*sign[\s-]?off|customer\s*sign[\s-]?off|sign[\s-]?off|definition\s*of\s*done)/i;

export function isInternalSection(label: string): boolean {
  return INTERNAL_SECTION_REGEX.test(label.trim());
}

/**
 * A section is "preamble-only" when its body carries no substantive
 * deliverable content — typically the LLM echoing the document title
 * before the real sections begin. Mirrors the frontend predicate so
 * both surfaces hide the same noise.
 *
 * Rule: section is preamble-only if (a) it's short (≤ 200 chars after
 * trim), and (b) the stripped residue contains no F-XX-XX / BR-NN /
 * AC-NN / EPIC- / US- / ST-US identifiers, but matches one of the
 * known title-preamble phrases.
 */
export function isPreambleOnlySection(content: string): boolean {
  const trimmed = (content ?? '').trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > 200) return false;
  const residue = trimmed
    .replace(/\*+/g, '')
    .replace(/^---+\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (residue.length === 0) return true;
  const hasIdentifier = /\b(?:F-\d+-\d+|BR-\d+|AC-\d+|EPIC-\d+|US-\d{3,}|ST-US\d+)\b/i.test(residue);
  if (hasIdentifier) return false;
  const lower = residue.toLowerCase();
  const PREAMBLE_PATTERNS = [
    'functional requirements document',
    'frd — module section',
    'frd module section',
    'module section',
    'document section',
  ];
  return PREAMBLE_PATTERNS.some((p) => lower.includes(p));
}

export interface SectionLikeForFilter {
  sectionKey: string;
  sectionLabel: string;
  content: string;
  editedContent: string | null;
  isHumanModified: boolean;
}

/**
 * Returns the body that the export pipeline would actually render —
 * `editedContent` if a human has edited the section, otherwise the
 * AI's original `content`. Keeps the section-selection logic and the
 * filter logic reading the same canonical body.
 */
export function effectiveBody(section: Readonly<SectionLikeForFilter>): string {
  return section.isHumanModified && section.editedContent
    ? section.editedContent
    : (section.content ?? '');
}

/**
 * Top-level predicate consumed by `generateBaArtifactHtml` and
 * `buildDocxFromDoc`. A section is OMITTED from exports when ANY of:
 *   - the body is empty/whitespace-only,
 *   - the label matches an internal-processing pattern,
 *   - the body is a redundant title preamble.
 *
 * Returning true means "drop this section". The export pipeline still
 * iterates over the unfiltered list when building things like the
 * Document History audit table (so process-step timestamps remain
 * visible for traceability without polluting the body).
 */
export function shouldOmitFromExport(section: Readonly<SectionLikeForFilter>): boolean {
  const label = section.sectionLabel || section.sectionKey || '';
  if (isInternalSection(label)) return true;
  const body = effectiveBody(section);
  if (!body.trim()) return true;
  if (isPreambleOnlySection(body)) return true;
  return false;
}
