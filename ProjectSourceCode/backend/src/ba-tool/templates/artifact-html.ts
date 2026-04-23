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
        out.push(`<div class="mermaid">${esc(body)}</div>`);
      } else {
        out.push(`<pre class="code${lang ? ' lang-' + esc(lang) : ''}"><code>${esc(body)}</code></pre>`);
      }
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

    // Paragraph — collect until blank line or special
    const para: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || /^(#{1,6}\s|---+$|[-*]\s|\d+\.\s|\|.+\||```|>\s)/.test(t)) break;
      para.push(t);
      i++;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return out.join('\n');
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
