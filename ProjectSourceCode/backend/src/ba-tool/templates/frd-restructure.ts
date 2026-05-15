/**
 * FRD canonical restructurer.
 *
 * Why this file exists: the editor (non-preview) tree shows a deterministic
 * hierarchy `Skill → Artifact (FRD-MOD-XX) → Feature (F-XX-YY)` parsed via
 * `parseFrdContent`. The HTML/PDF/DOCX exporters used to render whatever
 * sections + heading depths the LLM happened to emit, so the resulting TOC
 * was flat and inconsistent across surfaces. The user asked for a hardened
 * "fixed structure" — same shape in editor, preview, PDF, and Word.
 *
 * Strategy: rather than build parallel renderers, we restructure the
 * `BaArtifactDoc.sections[]` for FRD artifacts BEFORE handing them to the
 * generic HTML / DOCX templates. The output is one parent section
 * `<artifactId> — <moduleName>` whose body is a deterministic stream of
 * `## F-XX-YY: Name` blocks with consistent `**Screen Reference:** SCR-NN`
 * lines. The existing `extractInnerHeadings` + `injectFeatureScreens(Docx)`
 * machinery then produces a clean nested TOC and reliable per-feature
 * thumbnails — no duplicate render path required.
 *
 * Module-level deliverable sections (Business Rules, Validations,
 * TBD-Future Integration Registry, other deliverables) follow the parent
 * section as siblings so the reader still sees them, just in a stable
 * order. Internal/process sections (`Step N`, `Sign-Off`, etc.) are
 * dropped — they're skill-internal, not part of the FRD deliverable. This
 * matches `INTERNAL_SECTION_REGEX` in `FrdArtifactView.tsx`.
 */

import type { BaArtifactDoc, BaSectionLite } from './artifact-html';
import { parseFrdContent, type ParsedFeature } from './frd-parser';

const INTERNAL_SECTION_REGEX = /^(step\s*\d+|introduction|output\s*checklist|update\s*compact\s*module\s*index|validate\s*the\s*frd|obtain\s*customer\s*sign[\s-]?off|customer\s*sign[\s-]?off|sign[\s-]?off|definition\s*of\s*done)/i;

/**
 * Format one parsed feature as a deterministic markdown block. Heading depth
 * is fixed at H2 (`##`) so `extractInnerHeadings` normalises the shallowest
 * heading to TOC depth 2, putting every feature one level under the parent
 * artifact section. Field labels are bold + colon-suffixed because that's
 * what `injectFeatureScreens` matches against to splice in the SCR-NN
 * thumbnail (the regex is lenient — `**Label:**` and `Label:` both work —
 * but using the bold form keeps the rendered prose visually consistent
 * with `FrdArtifactView`).
 */
function formatFeatureBlock(f: ParsedFeature): string {
  const lines: string[] = [];
  lines.push(`## ${f.featureId}: ${f.featureName}`);
  lines.push('');
  if (f.description) {
    lines.push(`**Description:** ${f.description}`);
    lines.push('');
  }
  if (f.screenRef) {
    // The Screen Reference line is what `injectFeatureScreens(Docx)`
    // looks for. Keeping it on its own paragraph (with the bold label)
    // makes the regex match unambiguous and the rendered prose readable.
    lines.push(`**Screen Reference:** ${f.screenRef}`);
    lines.push('');
  }
  if (f.priority) {
    lines.push(`**Priority:** ${f.priority}`);
    lines.push('');
  }
  if (f.status) {
    lines.push(`**Status:** ${f.status}`);
    lines.push('');
  }
  if (f.trigger) {
    lines.push(`**Trigger:** ${f.trigger}`);
    lines.push('');
  }
  if (f.preConditions) {
    lines.push(`**Pre-conditions:**`);
    lines.push('');
    lines.push(f.preConditions);
    lines.push('');
  }
  if (f.postConditions) {
    lines.push(`**Post-conditions:**`);
    lines.push('');
    lines.push(f.postConditions);
    lines.push('');
  }
  if (f.businessRules) {
    lines.push(`**Business Rules:**`);
    lines.push('');
    lines.push(f.businessRules);
    lines.push('');
  }
  if (f.validations) {
    lines.push(`**Validations:**`);
    lines.push('');
    lines.push(f.validations);
    lines.push('');
  }
  if (f.integrationSignals) {
    lines.push(`**Integration Signals:**`);
    lines.push('');
    lines.push(f.integrationSignals);
    lines.push('');
  }
  if (f.acceptanceCriteria) {
    lines.push(`**Acceptance Criteria:**`);
    lines.push('');
    lines.push(f.acceptanceCriteria);
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Build a synthetic `BaSectionLite` carrying the given content + label.
 * Timestamps are inherited from a representative source section so the
 * Document History block doesn't lose its "last updated" signal.
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
 * Restructure an FRD doc into the canonical shape described in the file
 * header. Idempotent for non-FRD docs: returns the input unchanged when
 * `artifactType !== 'FRD'` so callers can wrap unconditionally.
 *
 * Behaviour when no features parse out (degraded LLM output): returns the
 * original sections so the export still shows whatever the AI produced,
 * just without the canonical structure. We don't want a corner-case
 * parser miss to silently empty the deliverable.
 */
export function restructureFrdDoc(doc: BaArtifactDoc): BaArtifactDoc {
  if (doc.artifactType !== 'FRD') return doc;

  const sourceSections = [...doc.sections].sort((a, b) => a.displayOrder - b.displayOrder);
  const parsed = parseFrdContent(
    sourceSections.map((s) => ({
      sectionKey: s.sectionKey,
      sectionLabel: s.sectionLabel,
      content: s.isHumanModified && s.editedContent ? s.editedContent : s.content,
    })),
  );

  if (parsed.features.length === 0) return doc;

  // Pick a representative source section for the parent's timestamps —
  // prefer the most recently updated section so "last edit" reflects
  // reality.
  const newest = sourceSections.reduce<BaSectionLite | undefined>((best, s) => {
    const t = new Date(s.updatedAt ?? 0).getTime();
    if (!best) return s;
    return t > new Date(best.updatedAt ?? 0).getTime() ? s : best;
  }, undefined);

  // Parent section: one heading per feature, deterministic field order.
  const parentLabel = parsed.moduleName
    ? `${doc.artifactId} — ${parsed.moduleName}`
    : doc.artifactId;

  const featureBody = parsed.features.map(formatFeatureBlock).join('\n---\n\n');

  const newSections: BaSectionLite[] = [
    makeSyntheticSection(
      `frd-canonical-${doc.artifactId}`,
      'frd_features',
      parentLabel,
      featureBody,
      newest,
      0,
    ),
  ];

  // Module-level deliverable sections — appended in a stable order so the
  // TOC reads the same every time. Skip empty bodies so we don't emit
  // bare headings.
  let order = 1;
  if (parsed.businessRules?.trim()) {
    newSections.push(
      makeSyntheticSection(
        `frd-business-rules-${doc.artifactId}`,
        'business_rules',
        'Business Rules',
        parsed.businessRules,
        newest,
        order++,
      ),
    );
  }
  if (parsed.validations?.trim()) {
    newSections.push(
      makeSyntheticSection(
        `frd-validations-${doc.artifactId}`,
        'validations',
        'Validations',
        parsed.validations,
        newest,
        order++,
      ),
    );
  }
  if (parsed.tbdFutureRegistry?.trim()) {
    newSections.push(
      makeSyntheticSection(
        `frd-tbd-${doc.artifactId}`,
        'tbd_future_integration_registry',
        'TBD-Future Integration Registry',
        parsed.tbdFutureRegistry,
        newest,
        order++,
      ),
    );
  }

  // Other deliverable sections — keep in source order, skip internal /
  // process sections. Skipped: any section whose label matches the
  // INTERNAL_SECTION_REGEX (Step N, Sign-Off, etc.). Those belong to the
  // skill's authoring process, not the FRD deliverable.
  for (const other of parsed.otherSections) {
    if (!other.content?.trim()) continue;
    if (INTERNAL_SECTION_REGEX.test(other.label.trim())) continue;
    newSections.push(
      makeSyntheticSection(
        `frd-other-${order}-${doc.artifactId}`,
        `other_${order}`,
        other.label,
        other.content,
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
