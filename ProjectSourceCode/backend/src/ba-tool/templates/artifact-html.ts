/**
 * Generic HTML renderer for BA Tool artifacts (FRD, EPIC, User Story, SubTask).
 * Produces a self-contained HTML document with:
 *   - Cover page (project productName / client / submittedBy / date / status)
 *   - Nested Table of Contents (mirrors the preview tree depth: section →
 *     subsection → feature)
 *   - Sections (with per-feature inline screen thumbnails when feature
 *     headings carry a `Screen Reference: SCR-NN` line)
 *   - Document History (derived from section timestamps)
 *   - Revision appendix
 *
 * Styling is consumed from `./artifact-style.ts` so the DOCX side and this
 * template stay visually aligned (single source of truth for tokens).
 *
 * Design note: BA artifacts don't yet have a dedicated audit-log table, so the
 * "Document History" is a best-effort reconstruction from each section's
 * createdAt / updatedAt timestamps and isHumanModified flags. When a full
 * `BaArtifactAuditLog` model is added, this template can be extended to
 * consume it — the shape mirrors `PrdAuditLog` deliberately.
 */
import { buildArtifactCss, statusKindFor } from './artifact-style';
import { shouldOmitFromExport } from './artifact-internal-filter';
import { restructureEpicDoc } from './epic-restructure';
import { restructureFrdDoc } from './frd-restructure';
import { restructureFtcDoc } from './ftc-restructure';
import { restructureSubtaskDoc } from './subtask-restructure';
import { restructureUserStoryDoc } from './user-story-restructure';

export interface BaSectionLite {
  id: string;
  sectionKey: string;
  sectionLabel: string;
  content: string;
  editedContent: string | null;
  isHumanModified: boolean;
  aiGenerated: boolean;
  displayOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Subset of `BaTestCase` carried into the export pipeline. The FTC pilot
 * uses these to build the per-category / per-feature / per-TC structure
 * that mirrors the editor tree. Only the fields the renderers consume are
 * included so the loader can avoid pulling fields that bloat the payload
 * (e.g. supportingDocs binary refs).
 */
export interface BaTestCaseLite {
  id: string;
  testCaseId: string;          // human-readable: TC-001, Neg_TC-005
  title: string;
  category: string | null;     // Functional | Integration | Security | UI | Data | Performance | Accessibility | API | null
  scope: string;               // black_box | white_box
  testKind: string;            // positive | negative | edge
  priority: string | null;     // P0 | P1 | P2
  isIntegrationTest: boolean;
  owaspCategory: string | null;
  scenarioGroup: string | null;
  testData: string | null;
  e2eFlow: string | null;
  preconditions: string | null;
  steps: string;
  expected: string;
  postValidation: string | null;
  sqlSetup: string | null;
  sqlVerify: string | null;
  playwrightHint: string | null;
  developerHints: string | null;
  parentTestCaseId: string | null;
  linkedFeatureIds: string[];
  linkedEpicIds: string[];
  linkedStoryIds: string[];
  linkedSubtaskIds: string[];
  isHumanModified: boolean;
}

export interface BaArtifactDoc {
  artifactId: string;         // e.g. FRD-MOD-01
  artifactType: string;       // FRD | EPIC | USER_STORY | SUBTASK | SCREEN_ANALYSIS | FTC | LLD
  status: string;             // DRAFT | CONFIRMED | APPROVED | CONFIRMED_PARTIAL
  createdAt: string | Date;
  updatedAt: string | Date;
  sections: BaSectionLite[];
  module: {
    moduleId: string;
    moduleName: string;
    packageName: string;
    screens?: Array<{ screenId: string; screenTitle: string; screenType: string | null; fileData: string }>;
  };
  project: {
    name: string;
    projectCode: string;
    productName: string | null;
    clientName: string | null;
    submittedBy: string | null;
    clientLogo: string | null;
  };
  /**
   * Populated only for FTC artifacts. Each test case carries its full body
   * (steps, expected, preconditions, etc.) so the renderer can emit a
   * complete per-TC card without making additional DB queries.
   */
  testCases?: BaTestCaseLite[];
  /**
   * Populated only for FTC artifacts when the same module also has an FRD.
   * Maps `F-XX-YY` to its human-readable feature name so the FTC TOC can
   * render `F-05-01 — Reset Password` instead of the bare ID.
   */
  frdFeatureNames?: Record<string, string>;
  /**
   * Populated only for FTC artifacts when the same module also has an FRD.
   * Maps `F-XX-YY` to the screen IDs (`SCR-NN`) that feature references
   * via its FRD `Screen Reference:` line. Drives Gap A — per-TC inline
   * screen cards: each TC's `linkedFeatureIds[0]` resolves to a feature,
   * which resolves to one or more screens, which the renderer splices in
   * directly under the TC heading.
   */
  frdFeatureScreenRefs?: Record<string, string[]>;
}

// v4: LLD artifacts are distinct from the other types — they carry their own
// pseudo-file appendix and should be labelled "Low-Level Design" on the cover.
const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  FRD: 'Functional Requirements Document',
  EPIC: 'EPIC',
  USER_STORY: 'User Story',
  SUBTASK: 'SubTask',
  SCREEN_ANALYSIS: 'Screen Analysis',
  LLD: 'Low-Level Design',
};

// ─── Utility helpers ─────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Append each screen's title next to bare `SCR-NN` references in a body of
 * text so customer-facing PDFs / Word docs read fluently without forcing
 * the reader to flip to the Screen Inventory. Idempotent: any `SCR-NN`
 * already followed by an em-dash, hyphen, colon, paren or bracket
 * (regardless of intervening whitespace) is left alone, so re-running this
 * over previously-enriched content does NOT double-stamp the title.
 *
 * Used by both the HTML/PDF render path and the DOCX render path (via
 * `BaArtifactExportService`) so the two outputs stay aligned.
 */
export function enrichScreenReferences(
  text: string,
  screens: Array<{ screenId: string; screenTitle: string }>,
): string {
  if (!text) return text;
  if (!screens || screens.length === 0) return text;
  const titleById = new Map<string, string>();
  for (const s of screens) titleById.set(s.screenId, s.screenTitle);

  return text.replace(/\bSCR-\d+\b/g, (match, offset: number, full: string) => {
    const tail = full.slice(offset + match.length, offset + match.length + 80);
    if (/^\s*[—\-:(\[]/.test(tail)) return match;
    const title = titleById.get(match);
    if (!title) return match;
    return `${match} — ${title}`;
  });
}

// ─── Minimal markdown → HTML renderer ───────────────────────────────────────
// Handles headings, lists, tables (pipe-syntax), code fences, bold/italic/inline
// code, horizontal rules, blockquotes and paragraphs. No external deps.
//
// `parentSlug` (optional): when provided, every emitted heading gets an
// `id="parentSlug__<heading-slug>"` attribute so the nested TOC can deep-link
// into specific sub-features. Pass an empty string to disable anchor IDs.

export function renderMarkdown(md: string, parentSlug = ''): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      out.push('<hr/>');
      i++; continue;
    }

    // C-style block comment /* ... */ — captured before the list-item rule
    // (`/^[-*]\s+/`) gets to chop the ` * Key: Value` lines into <li>s.
    // Treated as a Traceability-candidate; the renderKvGroups path takes
    // over below if it parses out as a Traceability KV block.
    if (/^\/\*/.test(trimmed)) {
      const buf: string[] = [line];
      const closesOnFirst = /\*\//.test(trimmed);
      i++;
      if (!closesOnFirst) {
        while (i < lines.length) {
          buf.push(lines[i]);
          const closes = /\*\//.test(lines[i]);
          i++;
          if (closes) break;
        }
      }
      const groups = extractKvGroupsFromLines(buf);
      if (groups && allRowsLookLikeTraceability(groups)) {
        out.push(renderKvGroups(groups, 'Traceability'));
        continue;
      }
      // Not a Traceability shape — fall back to preformatted so structure stays visible.
      out.push(`<pre class="code"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Code fence
    if (/^```/.test(trimmed)) {
      const lang = trimmed.slice(3).trim().toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      const body = buf.join('\n');
      const looksMermaid = lang === 'mermaid' || lang === 'uml'
        || /^(classDiagram|sequenceDiagram|erDiagram|flowchart|graph|stateDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|c4|requirementDiagram)\b/.test(body.trim());
      if (looksMermaid) {
        // Emit a <div class="mermaid"> — the mermaid CDN script will render it
        // client-side (browser) or inside Puppeteer (PDF) before capture.
        // The body is NOT HTML-escaped: Mermaid's parser reads the textContent
        // which automatically decodes HTML entities, but escaping breaks the
        // arrow operators (-->) in some Mermaid 11.x parser paths.
        out.push(`<div class="mermaid">${esc(body)}</div>`);
        continue;
      }
      // Traceability /* ... */ block wrapped in a code fence — split into
      // 2 KV tables (main metadata + TBD-Future Dependencies) so PDF/HTML
      // matches the DOCX renderer.
      const groups = extractKvGroupsFromLines(buf);
      if (groups && allRowsLookLikeTraceability(groups)) {
        out.push(renderKvGroups(groups, 'Traceability'));
        continue;
      }
      // Project Structure inside a fenced block (e.g. ```text\nProject
      // Structure:\n  ...```). The AI sometimes wraps Section 20 in a
      // fence to preserve indentation; treat the body as a paragraph
      // for KV-table + tree rendering.
      const psFenced = extractProjectStructureBlock(buf);
      if (psFenced) {
        const parts: string[] = [];
        if (psFenced.kv.length > 0) {
          parts.push(renderKvGroups([{ title: 'Project Structure', rows: psFenced.kv }], 'Project Structure'));
        }
        if (psFenced.treeLines.length > 0) {
          parts.push(`<div class="tree-block"><div class="tree-title">Directory Map</div><pre><code>${esc(psFenced.treeLines.join('\n'))}</code></pre></div>`);
        }
        if (psFenced.remainder.length > 0 && psFenced.remainder.some((r) => r.trim())) {
          parts.push(`<pre class="code"><code>${esc(psFenced.remainder.join('\n'))}</code></pre>`);
        }
        out.push(parts.join('\n'));
        continue;
      }
      out.push(`<pre class="code${lang ? ' lang-' + esc(lang) : ''}"><code>${esc(body)}</code></pre>`);
      continue;
    }

    // Table (pipe syntax: header | header \n --- | --- \n row | row ...)
    if (/^\|.+\|$/.test(trimmed) && i + 1 < lines.length && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(lines[i + 1].trim())) {
      const headerCells = splitRow(trimmed);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        rows.push(splitRow(lines[i].trim()));
        i++;
      }
      out.push(renderTable(headerCells, rows));
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const headingText = hMatch[2];
      const anchor = parentSlug ? ` id="${parentSlug}__${slug(headingText)}"` : '';
      out.push(`<h${level + 2}${anchor}>${renderInline(headingText)}</h${level + 2}>`);
      i++; continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Blank line
    if (trimmed === '') {
      i++; continue;
    }

    // Paragraph — collect until blank line or special. Preserve raw lines
    // (NOT trimmed) so detectors that depend on indentation (Project
    // Structure KV alignment, Directory Map tree art) still work.
    const paraRaw: string[] = [line];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || /^(#{1,6}\s|---+$|[-*]\s|\d+\.\s|\|.+\||```|>\s)/.test(t)) break;
      paraRaw.push(lines[i]);
      i++;
    }

    // Bare /* ... */ Traceability comment — emitted for FE SubTasks
    // without a surrounding ```text fence. Mirrors the non-preview
    // MarkdownRenderer paragraph-branch detection.
    if (/^\s*\/\*/.test(paraRaw[0]) && paraRaw.some((r) => /\*\//.test(r))) {
      const groups = extractKvGroupsFromLines(paraRaw);
      if (groups && allRowsLookLikeTraceability(groups)) {
        out.push(renderKvGroups(groups, 'Traceability'));
        continue;
      }
    }

    // Project Structure detection: "Project Structure:" + KV lines, optional
    // trailing "Directory Map:" tree art. Mirrors DOCX + non-preview.
    const ps = extractProjectStructureBlock(paraRaw);
    if (ps) {
      const parts: string[] = [];
      if (ps.kv.length > 0) {
        parts.push(renderKvGroups([{ title: 'Project Structure', rows: ps.kv }], 'Project Structure'));
      }
      if (ps.treeLines.length > 0) {
        parts.push(`<div class="tree-block"><div class="tree-title">Directory Map</div><pre><code>${esc(ps.treeLines.join('\n'))}</code></pre></div>`);
      }
      if (ps.remainder.length > 0 && ps.remainder.some((r) => r.trim())) {
        parts.push(`<p>${renderInline(ps.remainder.map((r) => r.trim()).filter(Boolean).join(' '))}</p>`);
      }
      out.push(parts.join('\n'));
      continue;
    }

    // Standalone "Directory Map:" paragraph
    if (/^\s*directory\s+map\s*:?\s*$/i.test(paraRaw[0])) {
      out.push(`<div class="tree-block"><div class="tree-title">Directory Map</div><pre><code>${esc(paraRaw.slice(1).join('\n'))}</code></pre></div>`);
      continue;
    }

    out.push(`<p>${renderInline(paraRaw.map((r) => r.trim()).join(' '))}</p>`);
  }

  return out.join('\n');
}

// ─── KV-group helpers (mirrors backend ba-artifact-export.service.ts) ───

function extractKvGroupsFromLines(
  rawLines: string[],
): Array<{ title: string | null; rows: Array<[string, string]> }> | null {
  const cleaned = rawLines.map((l) =>
    l
      .replace(/^\s*\/\*+/, '')
      .replace(/\*\/\s*$/, '')
      .replace(/^\s*\*\s?/, '')
      .replace(/\s+$/, ''),
  );
  const nonEmpty = cleaned.filter((l) => l.trim() && !/^=+$/.test(l.trim()));
  const kvLines = nonEmpty.filter((l) => /^[\w\s().\-/]+:\s*\S/.test(l));
  if (nonEmpty.length < 3 || kvLines.length / nonEmpty.length < 0.6) return null;

  const groups: Array<{ title: string | null; rows: Array<[string, string]> }> = [];
  let currentTitle: string | null = null;
  let currentRows: Array<[string, string]> = [];
  let seenTbdHeader = false;
  const flush = (): void => {
    // TBD-Future group with no KV rows → emit a placeholder row so the
    // PDF/HTML always shows two tables in Section 19. Matches DOCX +
    // non-preview behaviour.
    if (currentTitle === 'TBD-Future Dependencies' && currentRows.length === 0) {
      currentRows.push(['Status', 'None — this SubTask has no TBD-Future dependencies']);
    }
    if (currentRows.length > 0) {
      groups.push({ title: currentTitle, rows: currentRows });
    }
    currentTitle = null;
    currentRows = [];
  };

  for (const l of cleaned) {
    const t = l.trim();
    if (!t) continue;
    if (/^=+$/.test(t)) continue;
    if (/^TBD[-\s]Future\s+Dependencies\s*:?\s*$/i.test(t)) {
      flush();
      currentTitle = 'TBD-Future Dependencies';
      seenTbdHeader = true;
      continue;
    }
    const kv = /^([^:]+):\s*(.*)$/.exec(l);
    if (kv && kv[2].trim()) {
      currentRows.push([kv[1].trim(), kv[2].trim()]);
    } else if (!currentTitle && !/^\/\*|\*\/$/.test(t)) {
      currentTitle = t.replace(/^\/\*+/, '').replace(/\*\/$/, '').trim();
    }
  }
  flush();
  // AI omitted the literal "TBD-Future Dependencies:" header → append a
  // placeholder group so the second table is always present.
  if (!seenTbdHeader && groups.length > 0) {
    groups.push({
      title: 'TBD-Future Dependencies',
      rows: [['Status', 'None — this SubTask has no TBD-Future dependencies']],
    });
  }
  if (groups.length === 0) return null;
  return groups;
}

function allRowsLookLikeTraceability(
  groups: Array<{ rows: Array<[string, string]> }>,
): boolean {
  const keys = groups.flatMap((g) => g.rows.map(([k]) => k.toLowerCase()));
  let hits = 0;
  for (const k of ['module', 'feature', 'user story', 'epic', 'package', 'screen']) {
    if (keys.some((x) => x.startsWith(k))) hits++;
  }
  return hits >= 3;
}

function renderKvGroups(
  groups: Array<{ title: string | null; rows: Array<[string, string]> }>,
  fallbackTitle: string,
): string {
  return groups
    .map((g) => {
      const tbody = g.rows
        .map(([k, v]) => `<tr><th class="kv-key">${renderInline(k)}</th><td class="kv-val">${renderInline(v)}</td></tr>`)
        .join('');
      const title = g.title || fallbackTitle;
      return `<div class="kv-block"><div class="kv-title">${esc(title)}</div><table class="kv-table"><tbody>${tbody}</tbody></table></div>`;
    })
    .join('\n');
}

function extractProjectStructureBlock(
  lines: string[],
): { kv: Array<[string, string]>; treeLines: string[]; remainder: string[] } | null {
  if (lines.length === 0) return null;
  if (!/^\s*project\s+structure\s*:?\s*$/i.test(lines[0])) return null;

  const kv: Array<[string, string]> = [];
  let i = 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) {
      if (kv.length > 0) break;
      continue;
    }
    const m = /^\s*([A-Za-z][\w\s/().\-]+?)\s*:\s+(.+)$/.exec(l);
    if (m) {
      kv.push([m[1].trim(), m[2].trim()]);
      continue;
    }
    break;
  }
  if (kv.length < 2) return null;
  while (i < lines.length && !lines[i].trim()) i++;
  const treeLines: string[] = [];
  if (i < lines.length && /^\s*directory\s+map\s*:?\s*$/i.test(lines[i])) {
    i++;
    while (i < lines.length) {
      if (!lines[i].trim()) {
        if (treeLines.length === 0) break;
        treeLines.push('');
        i++;
        continue;
      }
      treeLines.push(lines[i]);
      i++;
    }
    while (treeLines.length > 0 && !treeLines[treeLines.length - 1].trim()) treeLines.pop();
  }
  return { kv, treeLines, remainder: lines.slice(i) };
}

function splitRow(row: string): string[] {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function renderTable(headers: string[], rows: string[][]): string {
  const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table class="md-table">${thead}${tbody}</table>`;
}

function renderInline(text: string): string {
  let s = esc(text);
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // italic
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // highlight TBD-Future
  s = s.replace(/(TBD-Future[A-Za-z0-9-]*)/g, '<span class="tbd">$1</span>');
  // highlight IDs
  s = s.replace(/\b(F-\d+-\d+|EPIC-[A-Z0-9-]+|FR-[A-Z0-9-]+|US-[A-Z0-9-]+|ST-[A-Z0-9-]+|MOD-\d+|SCR-\d+)\b/g, '<span class="idref">$1</span>');
  return s;
}

// ─── Nested TOC + per-feature inline screens ────────────────────────────────

interface InnerHeading {
  text: string;
  slug: string;       // namespaced slug ready for an href
  // Normalised TOC depth: 2 = first inner level, 3 = second inner level.
  // Derived from the shallowest markdown heading depth seen in the section,
  // so a section emitting only `####` headings still renders its first
  // level as TOC depth 2 (immediately under the section's depth-1 entry).
  depth: 2 | 3;
}

/**
 * Pre-walk a section's markdown body to extract inner headings, normalising
 * their depth so the TOC indents look uniform regardless of which heading
 * level the LLM happened to pick.
 *
 * Headings inside fenced code blocks are skipped — they're code, not nav.
 */
function extractInnerHeadings(md: string, parentSlug: string): InnerHeading[] {
  const lines = md.split(/\r?\n/);
  let inFence = false;
  const collected: Array<{ text: string; rawLevel: number }> = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (/^```/.test(t)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(t);
    if (!m) continue;
    collected.push({ text: m[2].trim(), rawLevel: m[1].length });
  }
  if (collected.length === 0) return [];
  // Find the shallowest depth — that becomes "depth 2" in TOC.
  const minRaw = Math.min(...collected.map((c) => c.rawLevel));
  const seenSlugs = new Map<string, number>();
  return collected
    .map((c) => {
      const baseSlug = slug(c.text) || 'heading';
      const dupeIdx = (seenSlugs.get(baseSlug) ?? 0) + 1;
      seenSlugs.set(baseSlug, dupeIdx);
      const finalSlug = dupeIdx === 1 ? baseSlug : `${baseSlug}-${dupeIdx}`;
      const depth: 2 | 3 = c.rawLevel === minRaw ? 2 : 3;
      return { text: c.text, slug: `${parentSlug}__${finalSlug}`, depth };
    })
    // Cap to first 500 inner entries per section. Bumped from 50 for the
    // FTC pilot — the "Functional Test Cases" category alone can carry
    // ~90+ feature buckets and ~100+ TCs, far past the FRD-era assumption.
    // 500 is large enough for any real-world deliverable while still
    // protecting against runaway AI output.
    .slice(0, 500);
}

function buildNestedTocHtml(
  sections: Array<{ slug: string; label: string; idx: number; inner: InnerHeading[] }>,
): string {
  const lis: string[] = [];
  for (const s of sections) {
    lis.push(`<li><a href="#sec-${s.slug}">${s.idx + 1}. ${esc(s.label)}</a></li>`);
    for (const ih of s.inner) {
      const cls = ih.depth === 2 ? 'toc-child' : 'toc-grandchild';
      lis.push(`<li class="${cls}"><a href="#${ih.slug}">${esc(ih.text)}</a></li>`);
    }
  }
  return `<ul>${lis.join('')}</ul>`;
}

/**
 * After a section body is rendered to HTML, find feature headings of the
 * form `<hN>F-XX-YY: Title</hN>` and inject an inline screen thumbnail
 * directly after the heading. The thumbnail is resolved from the markdown
 * source's `Screen Reference: SCR-NN` line associated with that feature.
 *
 * This implements DEFERRED-IMPROVEMENTS.md item #2 (per-feature inline
 * screens). The standalone "Referenced Screens" appendix is kept at the
 * top of the doc so readers can still see the full screen catalog at a
 * glance — but the per-feature thumbnails make the body self-contained
 * for someone reading feature-by-feature.
 */
function injectFeatureScreens(
  html: string,
  rawMarkdown: string,
  parentSlug: string,
  screens: Array<{ screenId: string; screenTitle: string; fileData: string }>,
): string {
  if (!html || !rawMarkdown || screens.length === 0 || !parentSlug) return html;
  const screenById = new Map(screens.map((s) => [s.screenId, s]));

  // Walk the markdown source, and for every `^####? F-XX-YY: ...` heading
  // within ~60 lines find the associated `Screen Reference: SCR-NN` line.
  // The same slugifier renderMarkdown uses gives us the heading's anchor
  // id, so we can splice the thumbnail in by anchor — robust against
  // renderInline wrapping the F-XX-YY in a `<span class="idref">`.
  const lines = rawMarkdown.split(/\r?\n/);
  const anchorToScreenId = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const m = /^#{2,4}\s+(F-\d+-\d+):\s*(.*)$/i.exec(lines[i].trim());
    if (!m) continue;
    const headingText = `${m[1]}:${m[2] ? ` ${m[2]}` : ''}`;
    const anchor = `${parentSlug}__${slug(headingText) || 'heading'}`;
    const startDepth = (lines[i].match(/^#+/) ?? [''])[0].length;
    for (let j = i + 1; j < Math.min(lines.length, i + 60); j++) {
      const nextHash = /^(#{1,6})\s/.exec(lines[j].trim());
      if (nextHash && nextHash[1].length <= startDepth) break;
      // Tolerates markdown emphasis around the label:
      //   `Screen Reference: SCR-01`
      //   `**Screen Reference:** SCR-01`
      //   `_Screen Reference_: SCR-01`
      const sm = /Screen\s+Reference[\s*_:]*\s*(SCR-\d+)/i.exec(lines[j]);
      if (sm) {
        anchorToScreenId.set(anchor, sm[1].toUpperCase());
        break;
      }
    }
  }

  if (anchorToScreenId.size === 0) return html;

  // Insert the thumbnail right AFTER the closing `</hN>` for each anchor.
  // Matching by id makes us tolerant to whatever `renderInline` did to the
  // heading text (idref spans, `<strong>`, etc.).
  let result = html;
  for (const [anchor, screenId] of anchorToScreenId) {
    const screen = screenById.get(screenId);
    if (!screen) continue;
    const tile = `<div class="feature-screen-inline">
      <div class="fs-caption">${esc(screenId)} — ${esc(screen.screenTitle)}</div>
      <img src="${esc(screen.fileData)}" alt="${esc(screen.screenTitle)}"/>
    </div>`;
    // Anchor must match exactly. Escape regex meta characters in the slug.
    const reAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(<h[1-6][^>]*\\sid="${reAnchor}"[^>]*>[\\s\\S]*?<\\/h[1-6]>)`, 'i');
    result = result.replace(re, `$1${tile}`);
  }
  return result;
}

/**
 * FTC Gap A — splice a screen thumbnail under each `## F-XX-YY` feature
 * heading in a rendered FTC category section.
 *
 * Originally this fired per `### TC-…` heading (one tile per test case).
 * For a 156-TC module that meant ~150 inline base64 images in a single
 * HTML payload — Chrome (via Puppeteer) crashed with `TargetCloseError`
 * on the PDF render path because the input HTML hit the renderer's
 * memory ceiling. The screen card is the same for every TC in a feature
 * bucket (they all share `linkedFeatureIds[0]`), so attaching the card
 * to the parent feature heading once gives the testing team the same
 * information at ~3-4× lower image count and keeps the PDF render
 * within Chrome's memory envelope. Each TC reads in the context of its
 * parent feature heading, which already shows the screen.
 *
 * Falls through silently when:
 *   - the FTC artifact has no sibling FRD (no screenRefs map);
 *   - the section's markdown has no recognisable feature heading
 *     pattern (a degraded restructure shouldn't produce broken markup);
 *   - a referenced screen ID isn't present in `module.screens` (SCR-NN
 *     points at a screen that was never uploaded).
 */
function injectFtcFeatureScreens(
  html: string,
  rawMarkdown: string,
  parentSlug: string,
  featureScreenRefs: Record<string, string[]>,
  screens: Array<{ screenId: string; screenTitle: string; fileData: string }>,
): string {
  if (!html || !rawMarkdown || !parentSlug) return html;
  if (screens.length === 0) return html;
  if (Object.keys(featureScreenRefs).length === 0) return html;

  const screenById = new Map(screens.map((s) => [s.screenId, s] as const));

  // Walk the markdown source for `## F-XX-YY …` feature headings. The
  // anchor IDs use the same slugifier `renderMarkdown` produces, so the
  // regex match by `id="…"` is exact.
  const lines = rawMarkdown.split(/\r?\n/);
  const featAnchorToScreenIds = new Map<string, string[]>();
  for (const line of lines) {
    const trimmed = line.trim();
    const featMatch = /^##\s+(F-\d+-\d+)\b/i.exec(trimmed);
    if (!featMatch) continue;
    // After the `##` strip, recover the heading text the slugifier saw —
    // that's everything after the `## ` prefix on the same line.
    const headingText = trimmed.replace(/^##\s+/, '');
    const featureId = featMatch[1].toUpperCase();
    const screenIds = featureScreenRefs[featureId];
    if (!screenIds || screenIds.length === 0) continue;
    const featAnchor = `${parentSlug}__${slug(headingText) || 'heading'}`;
    featAnchorToScreenIds.set(featAnchor, screenIds);
  }
  if (featAnchorToScreenIds.size === 0) return html;

  let result = html;
  for (const [anchor, screenIds] of featAnchorToScreenIds) {
    const tiles = screenIds
      .map((sid) => {
        const screen = screenById.get(sid);
        if (!screen) return '';
        return `<div class="feature-screen-inline">
          <div class="fs-caption">${esc(screen.screenId)} — ${esc(screen.screenTitle)}</div>
          <img src="${esc(screen.fileData)}" alt="${esc(screen.screenTitle)}"/>
        </div>`;
      })
      .filter((t) => t.length > 0)
      .join('');
    if (!tiles) continue;
    const reAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(<h[1-6][^>]*\\sid="${reAnchor}"[^>]*>[\\s\\S]*?<\\/h[1-6]>)`, 'i');
    result = result.replace(re, `$1${tiles}`);
  }
  return result;
}

// ─── Top-level renderer ─────────────────────────────────────────────────────

export function generateBaArtifactHtml(input: BaArtifactDoc): string {
  // Pilot restructurers — chained but each is a no-op outside its own
  // artifact type, so the order is irrelevant. FRD: nest features under
  // `<artifactId> — <moduleName>`. FTC: drop AI markdown duplicates of the
  // structured TC data and append per-category synthetic sections so the
  // editor's three-level category → feature → TC tree shows up in the
  // exported TOC.
  const doc = restructureFtcDoc(
    restructureFrdDoc(
      restructureEpicDoc(
        restructureUserStoryDoc(
          restructureSubtaskDoc(input),
        ),
      ),
    ),
  );
  const typeLabel = ARTIFACT_TYPE_LABELS[doc.artifactType] ?? doc.artifactType;
  const productName = doc.project.productName || doc.project.name;
  // Filter internal-processing sections + preamble-only noise BEFORE TOC
  // and body rendering. Single shared predicate used by HTML/PDF and
  // DOCX builders so the two surfaces stay in lockstep. (Gap B fix.)
  // Pass the artifact type so the FRD-specific Step N / Output Checklist /
  // Sign-Off label regex doesn't strip legitimate EPIC content
  // (EPIC's monolithic body section is labelled "Introduction").
  const sections = [...doc.sections]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .filter((s) => !shouldOmitFromExport(s, doc.artifactType));

  // Customer-facing deliverables read better when bare SCR-NN references in
  // the section body carry the human screen title (e.g. `SCR-01 — Login`).
  // Enrichment is idempotent so manually-edited sections that already
  // include the title aren't double-stamped.
  const screensForEnrichment = doc.module.screens ?? [];

  // Pre-compute slugs + inner headings per section so the nested TOC and
  // the body anchor IDs stay in lockstep (same slug used for both).
  const enriched = sections.map((s, idx) => {
    const sectionSlug = slug(s.sectionKey || s.sectionLabel || String(idx));
    const rawContent = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
    const content = enrichScreenReferences(rawContent || '', screensForEnrichment);
    const inner = extractInnerHeadings(content || '', sectionSlug);
    return { section: s, idx, slug: sectionSlug, content: content || '', inner };
  });

  const tocHtml = buildNestedTocHtml(
    enriched.map((e) => ({
      slug: e.slug,
      label: e.section.sectionLabel || e.section.sectionKey,
      idx: e.idx,
      inner: e.inner,
    })),
  );

  // FTC Gap A — sibling-FRD feature → screen-IDs map. Empty for non-FTC
  // artifacts; `injectFtcTcScreens` no-ops in that case.
  const ftcFeatureScreenRefs = doc.frdFeatureScreenRefs ?? {};

  const sectionHtml = enriched
    .map(({ section: s, idx, slug: sectionSlug, content }) => {
      const badges: string[] = [];
      if (s.aiGenerated && !s.isHumanModified) badges.push('<span class="badge badge-ai">AI</span>');
      if (s.isHumanModified) badges.push('<span class="badge badge-edited">Edited</span>');
      const renderedBody = renderMarkdown(content, sectionSlug);
      let bodyWithScreens = injectFeatureScreens(renderedBody, content, sectionSlug, screensForEnrichment);
      // FTC synthetic category sections (sectionKey starts with `ftc_`)
      // get an inline screen card spliced under each `## F-XX-YY` feature
      // heading. Same screen applies to every TC inside the bucket, so
      // attaching it to the parent feature heading is both visually
      // sufficient and keeps the inline-image count tractable for the
      // Puppeteer-driven PDF renderer (per-TC produced ~150 inline images
      // and crashed Chrome with a memory error).
      if (doc.artifactType === 'FTC' && s.sectionKey.startsWith('ftc_')) {
        bodyWithScreens = injectFtcFeatureScreens(
          bodyWithScreens,
          content,
          sectionSlug,
          ftcFeatureScreenRefs,
          screensForEnrichment,
        );
      }
      return `<section id="sec-${sectionSlug}" class="doc-section">
        <h2>${idx + 1}. ${esc(s.sectionLabel || s.sectionKey)} ${badges.join(' ')}</h2>
        <div class="section-body">${bodyWithScreens}</div>
      </section>`;
    })
    .join('\n');

  // Document history: one row per section showing last update + AI/Human flag.
  // FRD pilot: source from the *original* sections so the history reflects
  // the audit trail of every authored section rather than the synthetic
  // canonical parent (which collapses every feature into one row).
  const historySectionsSource = input.sections.length > 0 ? input.sections : sections;
  const historyRows = historySectionsSource
    .filter((s) => s.isHumanModified || s.aiGenerated)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50)
    .map((s) => {
      const who = s.isHumanModified ? 'Human' : s.aiGenerated ? 'AI' : '—';
      const action = s.isHumanModified ? 'Edited' : 'Generated';
      return `<tr>
        <td>${formatDate(s.updatedAt)}</td>
        <td>${esc(s.sectionLabel)}</td>
        <td>${action}</td>
        <td>${who}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(doc.artifactId)} — ${esc(typeLabel)}</title>
<style>${buildArtifactCss()}</style>
<!-- Mermaid script for UML diagrams. Rendered client-side in the browser
     and also during PDF capture inside Puppeteer. Loaded from CDN for
     zero-config; falls back gracefully (fenced source block visible) if
     the CDN is unreachable. -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
  }
</script>
</head>
<body>
<div class="container">

  <!-- Cover Page -->
  <div class="cover">
    ${doc.project.clientLogo
      ? `<img src="${esc(doc.project.clientLogo)}" alt="Client Logo" style="max-height:80px;max-width:220px;object-fit:contain;margin-bottom:32px;"/>`
      : ''}
    <div class="eyebrow">${esc(typeLabel)}</div>
    <h1>${esc(doc.artifactId)}</h1>
    <div class="divider"></div>
    <dl>
      <dt>Product Name:</dt><dd>${esc(productName)}</dd>
      <dt>Project Code:</dt><dd>${esc(doc.project.projectCode)}</dd>
      <dt>Module:</dt><dd>${esc(doc.module.moduleId)} — ${esc(doc.module.moduleName)}</dd>
      <dt>Client Name:</dt><dd>${esc(doc.project.clientName ?? '—')}</dd>
      <dt>Submitted By:</dt><dd>${esc(doc.project.submittedBy ?? '—')}</dd>
      <dt>Date:</dt><dd>${formatDate(doc.updatedAt)}</dd>
      <dt>Status:</dt><dd><span class="status-chip status-${statusKindFor(doc.status)}">${esc(doc.status.replace(/_/g, ' '))}</span></dd>
    </dl>
  </div>

  <!-- Document History -->
  <div class="history">
    <h2>Document History</h2>
    ${historyRows
      ? `<table><thead><tr><th>Date</th><th>Section</th><th>Action</th><th>By</th></tr></thead><tbody>${historyRows}</tbody></table>`
      : '<p><em>No edits or AI generations recorded.</em></p>'}
  </div>

  <!-- Table of Contents (nested: section → inner heading → feature) -->
  <div class="toc">
    <h2>Table of Contents</h2>
    ${tocHtml}
  </div>

  ${renderScreensBlock(doc)}

  <!-- Sections -->
  ${sectionHtml}

</div>
</body>
</html>`;
}

function renderScreensBlock(doc: BaArtifactDoc): string {
  const allScreens = doc.module.screens ?? [];
  // Customer deliverables (PDF/DOCX of EPICs, User Stories, FTCs, FRDs,
  // SubTasks) include the screen catalog so the reader can match every
  // SCR-NN reference back to a real wireframe without leaving the doc.
  // LLD/SCREEN_ANALYSIS exports are technical/internal and skip the block.
  const wanted =
    doc.artifactType === 'EPIC'
    || doc.artifactType === 'USER_STORY'
    || doc.artifactType === 'SUBTASK'
    || doc.artifactType === 'FRD'
    || doc.artifactType === 'FTC';
  if (!wanted || allScreens.length === 0) return '';

  // Render every screen in the module, not just the ones cited in the
  // section body. The customer needs the full catalog as a navigation aid;
  // omitting non-cited screens produced gaps when reviewers wanted to
  // cross-check the source wireframes.
  const screens = allScreens;

  const tiles = screens.map((s) => `
    <div class="screen-tile">
      <div class="screen-img"><img src="${esc(s.fileData)}" alt="${esc(s.screenTitle)}"/></div>
      <div class="screen-meta">
        <span class="screen-id">${esc(s.screenId)}</span>
        ${s.screenType ? `<span class="screen-type">${esc(s.screenType)}</span>` : ''}
        <div class="screen-title">${esc(s.screenTitle)}</div>
      </div>
    </div>`).join('');
  // Cover-grid catalog of every screen (kept as appendix for full inventory).
  // CSS for .screens / .screen-tile / .screen-grid lives in artifact-style.ts
  // so this stays a pure markup function.
  return `
  <div class="screens">
    <h2>Referenced Screens <span class="count">(${screens.length})</span></h2>
    <div class="screen-grid">${tiles}</div>
  </div>`;
}
