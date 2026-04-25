/**
 * Generic HTML renderer for BA Tool artifacts (FRD, EPIC, User Story, SubTask).
 * Produces a self-contained HTML document with:
 *   - Cover page (project productName / client / submittedBy / date / status)
 *   - Table of Contents
 *   - Sections
 *   - Document History (derived from section timestamps)
 *   - Revision appendix
 *
 * Design note: BA artifacts don't yet have a dedicated audit-log table, so the
 * "Document History" is a best-effort reconstruction from each section's
 * createdAt / updatedAt timestamps and isHumanModified flags. When a full
 * `BaArtifactAuditLog` model is added, this template can be extended to
 * consume it — the shape mirrors `PrdAuditLog` deliberately.
 */

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

export interface BaArtifactDoc {
  artifactId: string;         // e.g. FRD-MOD-01
  artifactType: string;       // FRD | EPIC | USER_STORY | SUBTASK | SCREEN_ANALYSIS
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

// ─── Minimal markdown → HTML renderer ───────────────────────────────────────
// Handles headings, lists, tables (pipe-syntax), code fences, bold/italic/inline
// code, horizontal rules, blockquotes and paragraphs. No external deps.

function renderMarkdown(md: string): string {
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
      out.push(`<h${level + 2}>${renderInline(hMatch[2])}</h${level + 2}>`);
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
  const flush = (): void => {
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

// ─── Top-level renderer ─────────────────────────────────────────────────────

export function generateBaArtifactHtml(doc: BaArtifactDoc): string {
  const typeLabel = ARTIFACT_TYPE_LABELS[doc.artifactType] ?? doc.artifactType;
  const productName = doc.project.productName || doc.project.name;
  const sections = [...doc.sections].sort((a, b) => a.displayOrder - b.displayOrder);

  const toc = sections
    .map(
      (s, idx) =>
        `<li><a href="#sec-${slug(s.sectionKey || s.sectionLabel || String(idx))}">${idx + 1}. ${esc(s.sectionLabel || s.sectionKey)}</a></li>`,
    )
    .join('');

  const sectionHtml = sections
    .map((s, idx) => {
      const content = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
      const badges: string[] = [];
      if (s.aiGenerated && !s.isHumanModified) badges.push('<span class="badge badge-ai">AI</span>');
      if (s.isHumanModified) badges.push('<span class="badge badge-edited">Edited</span>');
      return `<section id="sec-${slug(s.sectionKey || s.sectionLabel || String(idx))}" class="doc-section">
        <h2>${idx + 1}. ${esc(s.sectionLabel || s.sectionKey)} ${badges.join(' ')}</h2>
        <div class="section-body">${renderMarkdown(content || '')}</div>
      </section>`;
    })
    .join('\n');

  // Document history: one row per section showing last update + AI/Human flag
  const historyRows = sections
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
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.55; margin: 0; padding: 0; }
  .container { max-width: 900px; margin: 0 auto; padding: 24px 32px; }
  .cover { min-height: 900px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 80px 40px; page-break-after: always; }
  .cover .eyebrow { letter-spacing: 0.18em; color: #64748b; font-size: 10pt; text-transform: uppercase; margin-bottom: 18px; }
  .cover h1 { font-size: 26pt; margin: 0 0 8px; color: #0f172a; font-weight: 700; }
  .cover .divider { width: 72px; height: 3px; background: #f97316; margin: 18px auto 28px; }
  .cover dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 24px; margin-top: 32px; text-align: left; font-size: 11pt; }
  .cover dt { color: #64748b; font-weight: 500; }
  .cover dd { margin: 0; color: #0f172a; font-weight: 500; }
  .history { page-break-after: always; padding: 40px 0 60px; }
  .history h2 { font-size: 18pt; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 10pt; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; }
  .toc { page-break-after: always; padding: 40px 0; }
  .toc h2 { font-size: 18pt; margin: 0 0 14px; }
  .toc ol { list-style: none; padding-left: 0; }
  .toc li { padding: 4px 0; border-bottom: 1px dotted #e2e8f0; }
  .toc a { color: #0f172a; text-decoration: none; }
  .doc-section { margin: 28px 0; page-break-inside: avoid; }
  .doc-section h2 { font-size: 14pt; color: #0f172a; margin: 0 0 10px; border-bottom: 2px solid #f97316; padding-bottom: 6px; }
  .doc-section h3 { font-size: 12pt; color: #1e293b; margin: 18px 0 8px; }
  .doc-section h4 { font-size: 11pt; color: #1e293b; margin: 12px 0 6px; font-weight: 600; }
  .section-body p { margin: 6px 0; }
  .section-body ul, .section-body ol { margin: 6px 0; padding-left: 22px; }
  .section-body li { margin: 3px 0; }
  .md-table { font-size: 9.5pt; }
  .md-table th { background: #f1f5f9; }
  .md-table tr:nth-child(even) td { background: #fafbfc; }
  .badge { display: inline-block; font-size: 8pt; padding: 2px 6px; border-radius: 10px; margin-left: 6px; vertical-align: middle; font-weight: 500; }
  .badge-ai { background: #dbeafe; color: #1d4ed8; }
  .badge-edited { background: #fef3c7; color: #b45309; }
  .tbd { background: #fef3c7; color: #92400e; padding: 0 3px; border-radius: 3px; }
  .idref { background: #ede9fe; color: #5b21b6; padding: 0 3px; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 9.5pt; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 9.5pt; }
  pre.code { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: 9.5pt; }
  pre.code code { background: none; padding: 0; }
  blockquote { margin: 10px 0; padding: 8px 14px; border-left: 3px solid #cbd5e1; color: #475569; background: #f8fafc; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
  a { color: #2563eb; }
  .status-chip { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9pt; font-weight: 500; }
  .status-draft { background: #f1f5f9; color: #475569; }
  .status-confirmed { background: #dbeafe; color: #1d4ed8; }
  .status-approved { background: #dcfce7; color: #166534; }
  .status-partial { background: #fef3c7; color: #b45309; }
  .mermaid { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 12px 0; overflow-x: auto; text-align: center; }
  .mermaid svg { max-width: 100%; height: auto; }
  .kv-block { margin: 10px 0 16px; }
  .kv-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 600; margin-bottom: 4px; }
  .kv-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .kv-table th.kv-key { width: 30%; background: #f8fafc; font-weight: 600; text-align: left; vertical-align: top; padding: 6px 10px; border: 1px solid #e2e8f0; }
  .kv-table td.kv-val { padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  .kv-table tr:nth-child(even) td.kv-val { background: #fafbfc; }
  .tree-block { margin: 10px 0 16px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .tree-block .tree-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 600; padding: 6px 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .tree-block pre { margin: 0; padding: 10px 12px; background: #fafbfc; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 9pt; white-space: pre; overflow-x: auto; }
</style>
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
      <dt>Status:</dt><dd><span class="status-chip status-${statusClass(doc.status)}">${esc(doc.status.replace(/_/g, ' '))}</span></dd>
    </dl>
  </div>

  <!-- Document History -->
  <div class="history">
    <h2>Document History</h2>
    ${historyRows
      ? `<table><thead><tr><th>Date</th><th>Section</th><th>Action</th><th>By</th></tr></thead><tbody>${historyRows}</tbody></table>`
      : '<p><em>No edits or AI generations recorded.</em></p>'}
  </div>

  <!-- Table of Contents -->
  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>${toc}</ol>
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
  // Only include screens for artifacts where they're visually relevant
  const wanted = doc.artifactType === 'EPIC' || doc.artifactType === 'USER_STORY' || doc.artifactType === 'SUBTASK' || doc.artifactType === 'FRD';
  if (!wanted || allScreens.length === 0) return '';

  // Filter to ONLY screens this artifact references in its section content
  const referenced = new Set<string>();
  for (const s of doc.sections) {
    const text = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
    for (const m of (text || '').matchAll(/\bSCR-\d+\b/g)) referenced.add(m[0]);
  }
  const screens = allScreens.filter((s) => referenced.has(s.screenId));
  if (screens.length === 0) return '';

  const tiles = screens.map((s) => `
    <div class="screen-tile">
      <div class="screen-img"><img src="${esc(s.fileData)}" alt="${esc(s.screenTitle)}"/></div>
      <div class="screen-meta">
        <span class="screen-id">${esc(s.screenId)}</span>
        ${s.screenType ? `<span class="screen-type">${esc(s.screenType)}</span>` : ''}
        <div class="screen-title">${esc(s.screenTitle)}</div>
      </div>
    </div>`).join('');
  return `
  <div class="screens">
    <h2>Referenced Screens <span class="count">(${screens.length} of ${allScreens.length})</span></h2>
    <div class="screen-grid">${tiles}</div>
  </div>
  <style>
    .screens { page-break-inside: avoid; padding: 30px 0 10px; }
    .screens h2 { font-size: 14pt; border-bottom: 2px solid #f97316; padding-bottom: 6px; margin-bottom: 14px; }
    .screens h2 .count { font-size: 9pt; color: #94a3b8; font-weight: normal; margin-left: 6px; }
    .screen-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .screen-tile { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #fff; page-break-inside: avoid; }
    .screen-img { background: #f8fafc; height: 220px; display: flex; align-items: center; justify-content: center; }
    .screen-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .screen-meta { padding: 8px 10px; border-top: 1px solid #e2e8f0; }
    .screen-meta .screen-id { display: inline-block; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 9pt; background: #ede9fe; color: #5b21b6; padding: 1px 6px; border-radius: 3px; }
    .screen-meta .screen-type { font-size: 9pt; color: #64748b; margin-left: 6px; }
    .screen-title { font-size: 10pt; color: #0f172a; font-weight: 500; margin-top: 4px; }
  </style>`;
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('approved')) return 'approved';
  if (s.includes('partial')) return 'partial';
  if (s.includes('confirmed')) return 'confirmed';
  return 'draft';
}
