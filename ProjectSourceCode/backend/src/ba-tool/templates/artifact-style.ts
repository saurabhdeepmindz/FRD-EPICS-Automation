/**
 * Shared design tokens for BA-Tool artifact exports (HTML/PDF + DOCX).
 *
 * Single source of truth for colors, typography, and spacing so the two
 * renderers (artifact-html.ts → puppeteer PDF, ba-artifact-export.service.ts
 * → docx library) stay visually aligned. When the in-app preview's design
 * shifts, only this file should change.
 *
 * The tokens are pure values (no HTML, no docx imports). Surface-specific
 * adapters convert them to:
 *   - CSS string (for the inline <style> block in the HTML template)
 *   - docx-friendly numbers/objects (RGB hex without #, half-point font sizes,
 *     twentieths-of-a-point spacing).
 */

// ─── Colors (RGB hex, no #, ready for both `color: #xxx` and docx) ──────

export const COLORS = {
  // Accent — page rule under section headers, divider, brand stroke.
  accent: 'F97316',
  // Body text — near-black, slightly cool to feel modern not stark.
  text: '0F172A',
  // Secondary text — labels, eyebrows, captions.
  muted: '64748B',
  // Surface backgrounds.
  surfaceCanvas: 'FFFFFF',
  surfaceMuted: 'F8FAFC',
  surfaceMutedAlt: 'FAFBFC',
  surfaceCode: 'F1F5F9',
  // Borders.
  border: 'E2E8F0',
  borderSoft: 'EEF2F7',
  // Status chips.
  statusDraftBg: 'F1F5F9', statusDraftFg: '475569',
  statusConfirmedBg: 'DBEAFE', statusConfirmedFg: '1D4ED8',
  statusApprovedBg: 'DCFCE7', statusApprovedFg: '166534',
  statusPartialBg: 'FEF3C7', statusPartialFg: 'B45309',
  // Inline pill highlights.
  idRefBg: 'EDE9FE', idRefFg: '5B21B6',
  tbdBg: 'FEF3C7', tbdFg: '92400E',
  // Badges.
  badgeAiBg: 'DBEAFE', badgeAiFg: '1D4ED8',
  badgeEditedBg: 'FEF3C7', badgeEditedFg: 'B45309',
} as const;

// ─── Typography (font families + size scale in points) ─────────────────

export const FONTS = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Calibri, Arial, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Courier New', monospace",
  // docx prefers a single explicit family; fallback chain doesn't apply.
  docxSans: 'Calibri',
  docxMono: 'Consolas',
} as const;

// Type scale in points (1pt = 1pt for HTML; docx uses half-points so
// multiply by 2 when feeding docx).
export const TYPE_SCALE = {
  coverEyebrow: 10,
  coverTitle: 26,
  coverDl: 11,
  sectionH1: 14,   // top-level section heading inside body (was h2 in HTML)
  sectionH2: 12,   // nested heading (markdown ## inside a section body)
  sectionH3: 11,   // markdown ### inside a section body
  body: 11,
  table: 9.5,
  caption: 9,
  code: 9.5,
} as const;

// ─── Spacing (twips for docx; px for HTML where needed) ─────────────────

export const SPACING = {
  // Page-level (HTML container max-width + padding).
  pageMaxWidthPx: 900,
  pagePaddingTopPx: 24,
  pagePaddingSidePx: 32,
  // Cover.
  coverPaddingTopPx: 80,
  coverDividerWidthPx: 72,
  coverDividerHeightPx: 3,
  // Sections.
  sectionGapPx: 28,
  sectionHeaderRulePx: 2,
  // Tables.
  tablePaddingPx: 8,
  // Screen tile (cover-grid layout).
  screenTileImgHeightPx: 220,
  screenTileImgHeightInline: 160, // smaller when inline-with-feature (item #2)
} as const;

// ─── Type aliases for adapters ──────────────────────────────────────────

export type StatusKind = 'draft' | 'confirmed' | 'approved' | 'partial';

export function statusKindFor(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s.includes('approved')) return 'approved';
  if (s.includes('partial')) return 'partial';
  if (s.includes('confirmed')) return 'confirmed';
  return 'draft';
}

// ─── HTML/CSS adapter ────────────────────────────────────────────────────

/**
 * Returns the inline <style> body for the HTML template. Centralises every
 * rule the existing template inlines so the docx side can stay in sync via
 * the same tokens.
 */
export function buildArtifactCss(): string {
  const C = COLORS;
  const T = TYPE_SCALE;
  const S = SPACING;
  const F = FONTS;
  // Helper: emit "#rrggbb" from a token value.
  const c = (t: string): string => `#${t}`;
  return `
  * { box-sizing: border-box; }
  body { font-family: ${F.sans}; color: ${c(C.text)}; font-size: ${T.body}pt; line-height: 1.55; margin: 0; padding: 0; }
  .container { max-width: ${S.pageMaxWidthPx}px; margin: 0 auto; padding: ${S.pagePaddingTopPx}px ${S.pagePaddingSidePx}px; }
  .cover { min-height: 900px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: ${S.coverPaddingTopPx}px 40px; page-break-after: always; }
  .cover .eyebrow { letter-spacing: 0.18em; color: ${c(C.muted)}; font-size: ${T.coverEyebrow}pt; text-transform: uppercase; margin-bottom: 18px; }
  .cover h1 { font-size: ${T.coverTitle}pt; margin: 0 0 8px; color: ${c(C.text)}; font-weight: 700; }
  .cover .divider { width: ${S.coverDividerWidthPx}px; height: ${S.coverDividerHeightPx}px; background: ${c(C.accent)}; margin: 18px auto 28px; }
  .cover dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 24px; margin-top: 32px; text-align: left; font-size: ${T.coverDl}pt; }
  .cover dt { color: ${c(C.muted)}; font-weight: 500; }
  .cover dd { margin: 0; color: ${c(C.text)}; font-weight: 500; }
  .history { page-break-after: always; padding: 40px 0 60px; }
  .history h2 { font-size: 18pt; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: ${T.table}pt; }
  th, td { border: 1px solid ${c(C.border)}; padding: ${S.tablePaddingPx}px 10px; text-align: left; vertical-align: top; }
  th { background: ${c(C.surfaceMuted)}; font-weight: 600; }
  .toc { page-break-after: always; padding: 40px 0; }
  .toc h2 { font-size: 18pt; margin: 0 0 14px; }
  .toc ol, .toc ul { list-style: none; padding-left: 0; margin: 0; }
  .toc li { padding: 4px 0; border-bottom: 1px dotted ${c(C.border)}; }
  .toc li.toc-child { border-bottom: none; padding: 2px 0 2px 18px; font-size: ${T.body - 0.5}pt; color: ${c(C.muted)}; }
  .toc li.toc-child a { color: ${c(C.text)}; }
  .toc li.toc-grandchild { border-bottom: none; padding: 2px 0 2px 36px; font-size: ${T.caption}pt; color: ${c(C.muted)}; }
  .toc li.toc-grandchild a { color: ${c(C.muted)}; }
  .toc a { color: ${c(C.text)}; text-decoration: none; }
  .doc-section { margin: ${S.sectionGapPx}px 0; page-break-inside: avoid; }
  .doc-section h2 { font-size: ${T.sectionH1}pt; color: ${c(C.text)}; margin: 0 0 10px; border-bottom: ${S.sectionHeaderRulePx}px solid ${c(C.accent)}; padding-bottom: 6px; }
  .doc-section h3 { font-size: ${T.sectionH2}pt; color: #1E293B; margin: 18px 0 8px; }
  .doc-section h4 { font-size: ${T.sectionH3}pt; color: #1E293B; margin: 12px 0 6px; font-weight: 600; }
  .section-body p { margin: 6px 0; }
  .section-body ul, .section-body ol { margin: 6px 0; padding-left: 22px; }
  .section-body li { margin: 3px 0; }
  .md-table { font-size: ${T.table}pt; }
  .md-table th { background: ${c(C.surfaceCode)}; }
  .md-table tr:nth-child(even) td { background: ${c(C.surfaceMutedAlt)}; }
  .badge { display: inline-block; font-size: 8pt; padding: 2px 6px; border-radius: 10px; margin-left: 6px; vertical-align: middle; font-weight: 500; }
  .badge-ai { background: ${c(C.badgeAiBg)}; color: ${c(C.badgeAiFg)}; }
  .badge-edited { background: ${c(C.badgeEditedBg)}; color: ${c(C.badgeEditedFg)}; }
  .tbd { background: ${c(C.tbdBg)}; color: ${c(C.tbdFg)}; padding: 0 3px; border-radius: 3px; }
  .idref { background: ${c(C.idRefBg)}; color: ${c(C.idRefFg)}; padding: 0 3px; border-radius: 3px; font-family: ${F.mono}; font-size: ${T.code}pt; }
  code { background: ${c(C.surfaceCode)}; padding: 1px 4px; border-radius: 3px; font-family: ${F.mono}; font-size: ${T.code}pt; }
  pre.code { background: ${c(C.surfaceMuted)}; border: 1px solid ${c(C.border)}; padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: ${T.code}pt; }
  pre.code code { background: none; padding: 0; }
  blockquote { margin: 10px 0; padding: 8px 14px; border-left: 3px solid #CBD5E1; color: #475569; background: ${c(C.surfaceMuted)}; }
  hr { border: none; border-top: 1px solid ${c(C.border)}; margin: 18px 0; }
  a { color: #2563EB; }
  .status-chip { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: ${T.caption}pt; font-weight: 500; }
  .status-draft { background: ${c(C.statusDraftBg)}; color: ${c(C.statusDraftFg)}; }
  .status-confirmed { background: ${c(C.statusConfirmedBg)}; color: ${c(C.statusConfirmedFg)}; }
  .status-approved { background: ${c(C.statusApprovedBg)}; color: ${c(C.statusApprovedFg)}; }
  .status-partial { background: ${c(C.statusPartialBg)}; color: ${c(C.statusPartialFg)}; }
  .mermaid { background: #FFFFFF; border: 1px solid ${c(C.border)}; border-radius: 6px; padding: 12px; margin: 12px 0; overflow-x: auto; text-align: center; }
  .mermaid svg { max-width: 100%; height: auto; }
  .kv-block { margin: 10px 0 16px; }
  .kv-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; color: ${c(C.muted)}; font-weight: 600; margin-bottom: 4px; }
  .kv-table { width: 100%; border-collapse: collapse; font-size: ${T.code}pt; }
  .kv-table th.kv-key { width: 30%; background: ${c(C.surfaceMuted)}; font-weight: 600; text-align: left; vertical-align: top; padding: 6px 10px; border: 1px solid ${c(C.border)}; }
  .kv-table td.kv-val { padding: 6px 10px; border: 1px solid ${c(C.border)}; vertical-align: top; }
  .kv-table tr:nth-child(even) td.kv-val { background: ${c(C.surfaceMutedAlt)}; }
  .tree-block { margin: 10px 0 16px; border: 1px solid ${c(C.border)}; border-radius: 6px; overflow: hidden; }
  .tree-block .tree-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; color: ${c(C.muted)}; font-weight: 600; padding: 6px 10px; background: ${c(C.surfaceMuted)}; border-bottom: 1px solid ${c(C.border)}; }
  .tree-block pre { margin: 0; padding: 10px 12px; background: ${c(C.surfaceMutedAlt)}; font-family: ${F.mono}; font-size: 9pt; white-space: pre; overflow-x: auto; }
  /* Item #2: per-feature inline screen thumbnail. Lives directly under
     the feature heading in the section body, not in the global catalog. */
  .feature-screen-inline { margin: 10px 0 18px; padding: 8px; border: 1px solid ${c(C.border)}; border-radius: 6px; background: ${c(C.surfaceMuted)}; page-break-inside: avoid; }
  .feature-screen-inline .fs-caption { font-family: ${F.mono}; font-size: ${T.caption}pt; color: ${c(C.idRefFg)}; background: ${c(C.idRefBg)}; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 6px; }
  .feature-screen-inline img { max-width: 100%; max-height: ${S.screenTileImgHeightInline}px; object-fit: contain; display: block; margin: 0 auto; }
  /* Cover-screens grid (kept as appendix, can be omitted via prop). */
  .screens { page-break-inside: avoid; padding: 30px 0 10px; }
  .screens h2 { font-size: ${T.sectionH1}pt; border-bottom: ${S.sectionHeaderRulePx}px solid ${c(C.accent)}; padding-bottom: 6px; margin-bottom: 14px; }
  .screens h2 .count { font-size: 9pt; color: #94A3B8; font-weight: normal; margin-left: 6px; }
  .screen-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .screen-tile { border: 1px solid ${c(C.border)}; border-radius: 6px; overflow: hidden; background: #FFFFFF; page-break-inside: avoid; }
  .screen-img { background: ${c(C.surfaceMuted)}; height: ${S.screenTileImgHeightPx}px; display: flex; align-items: center; justify-content: center; }
  .screen-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .screen-meta { padding: 8px 10px; border-top: 1px solid ${c(C.border)}; }
  .screen-meta .screen-id { display: inline-block; font-family: ${F.mono}; font-size: 9pt; background: ${c(C.idRefBg)}; color: ${c(C.idRefFg)}; padding: 1px 6px; border-radius: 3px; }
  .screen-meta .screen-type { font-size: 9pt; color: ${c(C.muted)}; margin-left: 6px; }
  .screen-title { font-size: 10pt; color: ${c(C.text)}; font-weight: 500; margin-top: 4px; }
`;
}

// ─── DOCX adapter (helpers consumed by ba-artifact-export.service.ts) ───

/**
 * docx half-point sizes for each level of the type scale. The docx library
 * accepts font sizes in half-points (size: 22 → 11pt). Centralising this
 * here means the export service doesn't sprinkle magic numbers throughout
 * its paragraph builders.
 */
export const DOCX_FONT_HALF_PTS = {
  coverEyebrow: TYPE_SCALE.coverEyebrow * 2,
  coverTitle: TYPE_SCALE.coverTitle * 2,
  coverDl: TYPE_SCALE.coverDl * 2,
  sectionH1: TYPE_SCALE.sectionH1 * 2,
  sectionH2: TYPE_SCALE.sectionH2 * 2,
  sectionH3: TYPE_SCALE.sectionH3 * 2,
  body: TYPE_SCALE.body * 2,
  table: Math.round(TYPE_SCALE.table * 2),
  caption: TYPE_SCALE.caption * 2,
  code: Math.round(TYPE_SCALE.code * 2),
} as const;

/**
 * Returns the docx Styles config the export service should pass to
 * `new Document({ styles: ... })`. Centralising styles here gives Word
 * a single brand: same accent on all H1s, same monospace family for code,
 * same body font everywhere.
 *
 * The docx library accepts `default.document.run` for default body text
 * and per-style overrides for HEADING_1..6 + Quote/Code. Returning an
 * untyped object keeps this file dependency-free; the export service
 * casts to docx's IStylesOptions when assembling the Document.
 */
export function buildDocxStyles(): {
  default: {
    document: {
      run: { font: string; size: number; color: string };
      paragraph: { spacing: { line: number; before: number; after: number } };
    };
  };
  paragraphStyles: Array<{
    id: string;
    name: string;
    run: { font?: string; size?: number; bold?: boolean; color?: string };
    paragraph?: { spacing?: { before?: number; after?: number }; border?: unknown };
  }>;
} {
  const F = FONTS.docxSans;
  const M = FONTS.docxMono;
  const C = COLORS;
  return {
    default: {
      document: {
        run: { font: F, size: DOCX_FONT_HALF_PTS.body, color: C.text },
        // line: 276 = 1.15 line height (twips per line, where single = 240).
        paragraph: { spacing: { line: 276, before: 0, after: 120 } },
      },
    },
    paragraphStyles: [
      {
        id: 'Title', name: 'Title',
        run: { font: F, size: DOCX_FONT_HALF_PTS.coverTitle, bold: true, color: C.text },
        paragraph: { spacing: { before: 0, after: 120 } },
      },
      {
        id: 'Heading1', name: 'heading 1',
        run: { font: F, size: DOCX_FONT_HALF_PTS.sectionH1, bold: true, color: C.text },
        paragraph: { spacing: { before: 280, after: 120 } },
      },
      {
        id: 'Heading2', name: 'heading 2',
        run: { font: F, size: DOCX_FONT_HALF_PTS.sectionH2, bold: true, color: '1E293B' },
        paragraph: { spacing: { before: 240, after: 80 } },
      },
      {
        id: 'Heading3', name: 'heading 3',
        run: { font: F, size: DOCX_FONT_HALF_PTS.sectionH3, bold: true, color: '1E293B' },
        paragraph: { spacing: { before: 200, after: 60 } },
      },
      {
        id: 'Caption', name: 'caption',
        run: { font: F, size: DOCX_FONT_HALF_PTS.caption, color: C.muted },
        paragraph: { spacing: { before: 60, after: 60 } },
      },
      {
        id: 'Code', name: 'code',
        run: { font: M, size: DOCX_FONT_HALF_PTS.code, color: C.text },
        paragraph: { spacing: { before: 60, after: 60 } },
      },
    ],
  };
}

/**
 * Standard padding (twentieths of a point) used in DOCX table cells.
 * 1 point = 20 twips, so 100 twips = 5 points padding.
 */
export const DOCX_TABLE_CELL_PADDING_TWIPS = 100;

/**
 * Cover-page accent rule width (in twips). Renders as a thin shaded paragraph
 * border under the title. 60 twips ≈ 3pt → mirrors the HTML 3px divider.
 */
export const DOCX_DIVIDER_HEIGHT_TWIPS = 60;
