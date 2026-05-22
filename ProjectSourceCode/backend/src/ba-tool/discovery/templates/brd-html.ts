/**
 * BRD HTML template — generates a self-contained, print-ready HTML document
 * from a BaBrd record. Reuses the markdown renderer from the existing
 * BA Artifact template so the styling stays consistent across artefact types.
 *
 * Used by both:
 *   - GET /api/ba/projects/:projectId/discovery/brd/:brdId/preview   (inline)
 *   - PdfService.generatePdfFromHtml()                                (download PDF)
 */

import { renderMarkdown } from '../../templates/artifact-html';

export interface BrdHtmlInput {
  brdId: string;
  status: string;                      // DRAFT | COMPLETE | APPROVED
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Map of section number ('1'..'15') → markdown body. */
  sections: Record<string, string>;
  /** Structured FRs parsed from §6 (rendered as a real table). */
  frTable: { id: string; requirement: string; testable: boolean }[];
  /** Open items extracted into §15. */
  openItems: string[];
  meta: {
    audience?: string | null;
    productName?: string | null;
    model?: string | null;
    generatedAt?: string;
  } | null;
  project: {
    name: string;
    projectCode: string;
    productName: string | null;
    clientName: string | null;
    submittedBy: string | null;
    clientLogo: string | null;
  };
}

const SECTION_TITLES: Record<string, string> = {
  '1': 'Background',
  '2': 'Problem Statement',
  '3': 'Business Objectives',
  '4': 'Scope',
  '5': 'Stakeholders',
  '6': 'Functional Requirements',
  '7': 'Data Requirements',
  '8': 'Non-Functional Requirements',
  '9': 'Success Metrics',
  '10': 'Assumptions',
  '11': 'Constraints',
  '12': 'Risks & Mitigation',
  '13': 'High-Level Solution Architecture',
  '14': 'Next Steps',
  '15': 'Open Items',
};

const SECTION_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusClass(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED': return 'status-approved';
    case 'COMPLETE': return 'status-complete';
    case 'DRAFT':
    default: return 'status-draft';
  }
}

function renderFrTable(frTable: BrdHtmlInput['frTable']): string {
  if (!frTable || frTable.length === 0) {
    return '<p class="empty-note">No structured FRs were parsed from this BRD.</p>';
  }
  const rows = frTable
    .map(
      (r) => `
      <tr>
        <td><code>${esc(r.id)}</code></td>
        <td>${esc(r.requirement)}</td>
        <td class="testable-cell">${r.testable ? '<span class="badge-pass">✓ testable</span>' : '<span class="badge-warn">⚠ review</span>'}</td>
      </tr>`,
    )
    .join('');
  return `
    <table class="fr-table">
      <thead><tr><th>ID</th><th>Requirement</th><th>Quality</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderOpenItemsList(items: string[]): string {
  if (!items || items.length === 0) return '<p class="empty-note">No open items.</p>';
  return `<ul class="open-items">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function renderToc(sections: Record<string, string>): string {
  const items = SECTION_ORDER.map((key) => {
    const filled = (sections[key] ?? '').trim().length > 30;
    return `<li><a href="#sec-${key}">§${key}. ${esc(SECTION_TITLES[key])}</a>${filled ? '' : ' <span class="toc-empty">(empty)</span>'}</li>`;
  }).join('');
  return `<nav class="toc"><h2>Contents</h2><ol>${items}</ol></nav>`;
}

function renderCover(input: BrdHtmlInput): string {
  const productName = input.project.productName ?? input.project.name ?? '—';
  const audience = input.meta?.audience ?? '—';
  const generated = formatDate(input.meta?.generatedAt ?? input.createdAt);
  const updated = formatDate(input.updatedAt);
  const logoBlock = input.project.clientLogo
    ? `<img class="cover-logo" src="${esc(input.project.clientLogo)}" alt="logo"/>`
    : '';
  return `
    <header class="cover">
      ${logoBlock}
      <div class="cover-eyebrow">Business Requirements Document</div>
      <h1 class="cover-title">${esc(productName)}</h1>
      <dl class="cover-meta">
        <dt>Project</dt><dd>${esc(input.project.name)} <span class="muted">· ${esc(input.project.projectCode)}</span></dd>
        ${input.project.clientName ? `<dt>Client</dt><dd>${esc(input.project.clientName)}</dd>` : ''}
        ${input.project.submittedBy ? `<dt>Submitted by</dt><dd>${esc(input.project.submittedBy)}</dd>` : ''}
        <dt>Audience</dt><dd>${esc(String(audience))}</dd>
        <dt>Status</dt><dd><span class="status-pill ${statusClass(input.status)}">${esc(input.status)}</span></dd>
        <dt>Generated</dt><dd>${esc(generated)}</dd>
        <dt>Last updated</dt><dd>${esc(updated)}</dd>
      </dl>
    </header>`;
}

export function generateBrdHtml(input: BrdHtmlInput): string {
  const cover = renderCover(input);
  const toc = renderToc(input.sections);

  const sectionHtml = SECTION_ORDER.map((key) => {
    const body = (input.sections[key] ?? '').trim();
    let extras = '';
    if (key === '6') {
      extras = `
        <div class="extras">
          <h3>Structured FR table</h3>
          ${renderFrTable(input.frTable)}
        </div>`;
    } else if (key === '15') {
      extras = `
        <div class="extras">
          <h3>Open items (parsed list)</h3>
          ${renderOpenItemsList(input.openItems)}
        </div>`;
    }
    const inner = body ? renderMarkdown(body) : '<p class="empty-note">— empty —</p>';
    return `
      <section id="sec-${key}" class="section">
        <h2 class="section-title">§${key}. ${esc(SECTION_TITLES[key])}</h2>
        <div class="section-body">${inner}</div>
        ${extras}
      </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BRD — ${esc(input.project.productName ?? input.project.name)}</title>
  <style>${BRD_CSS}</style>
</head>
<body>
  <main class="document">
    ${cover}
    ${toc}
    ${sectionHtml}
    <footer class="doc-footer">
      <p class="muted">BRD <code>${esc(input.brdId)}</code> · generated by ${esc(input.meta?.model ?? 'AI')}</p>
    </footer>
  </main>
</body>
</html>`;
}

const BRD_CSS = `
  :root {
    --ink: #1a1a1a;
    --muted: #71717a;
    --line: #e4e4e7;
    --accent: #2563eb;
    --bg: #fafafa;
    --warn: #d97706;
    --ok: #16a34a;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; color: var(--ink); font-family: "Segoe UI", -apple-system, sans-serif; font-size: 13px; line-height: 1.55; }
  .document { max-width: 880px; margin: 0 auto; padding: 36px 48px; }
  .muted { color: var(--muted); }
  .empty-note { color: var(--muted); font-style: italic; font-size: 12px; }

  /* Cover */
  .cover { border-bottom: 2px solid var(--ink); padding-bottom: 30px; margin-bottom: 28px; page-break-after: always; }
  .cover-logo { max-height: 60px; margin-bottom: 18px; }
  .cover-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); font-weight: 600; }
  .cover-title { font-size: 32px; margin: 8px 0 24px; font-weight: 700; }
  .cover-meta { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; font-size: 13px; }
  .cover-meta dt { color: var(--muted); font-weight: 600; }
  .cover-meta dd { margin: 0; }

  /* Status pill */
  .status-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
  .status-draft { background: #fef3c7; color: #92400e; }
  .status-complete { background: #dbeafe; color: #1e40af; }
  .status-approved { background: #dcfce7; color: #14532d; }

  /* TOC */
  .toc { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 20px 28px; margin-bottom: 32px; page-break-after: always; }
  .toc h2 { margin: 0 0 12px; font-size: 16px; }
  .toc ol { margin: 0; padding-left: 24px; }
  .toc li { padding: 3px 0; font-size: 13px; }
  .toc a { color: var(--accent); text-decoration: none; }
  .toc-empty { color: var(--muted); font-size: 11px; }

  /* Sections */
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section-title { font-size: 18px; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 0 0 12px; }
  .section-body { font-size: 13px; }
  .section-body h1, .section-body h2, .section-body h3 { font-size: 14px; margin: 14px 0 8px; }
  .section-body p { margin: 6px 0; }
  .section-body ul, .section-body ol { padding-left: 22px; margin: 6px 0; }
  .section-body table { border-collapse: collapse; margin: 10px 0; width: 100%; font-size: 12px; }
  .section-body th, .section-body td { border: 1px solid var(--line); padding: 5px 8px; vertical-align: top; }
  .section-body th { background: var(--bg); text-align: left; }
  .section-body code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-family: "Fira Code", monospace; font-size: 11.5px; }
  .section-body pre { background: #f1f5f9; padding: 10px 14px; border-radius: 4px; overflow: auto; font-size: 11.5px; }
  .section-body blockquote { border-left: 3px solid var(--line); padding: 0 12px; margin: 8px 0; color: var(--muted); }

  /* Extras (FR table + Open items) */
  .extras { margin-top: 16px; padding: 12px 16px; background: var(--bg); border: 1px dashed var(--line); border-radius: 4px; }
  .extras h3 { margin: 0 0 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .fr-table { border-collapse: collapse; width: 100%; font-size: 12px; }
  .fr-table th, .fr-table td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }
  .fr-table th { background: white; color: var(--muted); }
  .testable-cell { white-space: nowrap; }
  .badge-pass { color: var(--ok); font-weight: 600; }
  .badge-warn { color: var(--warn); font-weight: 600; }
  .open-items { margin: 0; padding-left: 22px; font-size: 12px; }

  .doc-footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 11px; }

  /* Print */
  @media print {
    .document { max-width: none; padding: 0; }
    .toc, .cover { page-break-after: always; }
    .section { page-break-inside: avoid; }
  }
`;
