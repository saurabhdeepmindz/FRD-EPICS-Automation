const SECTION_NAMES: Record<number, string> = {
  1: 'Overview / Objective',
  2: 'High-Level Scope',
  3: 'Out of Scope',
  4: 'Assumptions and Constraints',
  5: 'Actors / User Types',
  6: 'Functional Requirements',
  7: 'Integration Requirements',
  8: 'Customer Journeys / Flows',
  9: 'Functional Landscape',
  10: 'Non-Functional Requirements',
  11: 'Technology',
  12: 'DevOps and Observability',
  13: 'UI/UX Requirements',
  14: 'Branding Requirements',
  15: 'Compliance Requirements',
  16: 'Testing Requirements',
  17: 'Key Deliverables',
  18: 'Receivables',
  19: 'Environment',
  20: 'High-Level Timelines',
  21: 'Success Criteria',
  22: 'Miscellaneous Requirements',
};

interface FeatureObj {
  featureId: string;
  featureName: string;
  description: string;
  businessRule: string;
  acceptanceCriteria: string;
  priority: string;
}

interface ModuleInfo {
  key: string;
  moduleId: string;
  moduleName: string;
  moduleDescription: string;
  moduleBusinessRules: string;
  features: FeatureObj[];
}

export interface PrdData {
  prdCode: string;
  productName: string;
  version: string;
  status: string;
  author: string | null;
  clientName: string | null;
  submittedBy: string | null;
  clientLogo: string | null;
  createdAt: string | Date;
  sections: {
    sectionNumber: number;
    sectionName: string;
    content: Record<string, unknown>;
    status: string;
  }[];
}

export interface AuditEntry {
  id?: string;
  version: string;
  createdAt: string;
  sectionNumber: number;
  fieldKey: string;
  changeType: string;
  source: string;
  previousValue: string | null;
  newValue: string | null;
}

// ─── Utility helpers ───────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip [AI] prefix from values — PDF/DOCX always renders in black */
function stripAiPrefix(str: string): string {
  const trimmed = str.trimStart();
  if (trimmed.startsWith('[AI] ')) return trimmed.slice(5);
  if (trimmed.startsWith('[AI]')) return trimmed.slice(4).trimStart();
  return str;
}

function nl2br(str: string): string {
  return esc(stripAiPrefix(str)).replace(/\n/g, '<br>');
}

// ─── Module / Feature extraction ───────────────────────────────────────────

function extractModules(content: Record<string, unknown>): ModuleInfo[] {
  const keys = new Set<string>();
  for (const k of Object.keys(content)) {
    const m = k.match(/^(\d+\.\d+)_/);
    if (m) keys.add(m[1]);
  }
  return [...keys]
    .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]))
    .map((key) => ({
      key,
      moduleId: String(content[`${key}_moduleId`] ?? ''),
      moduleName: String(content[`${key}_moduleName`] ?? key),
      moduleDescription: String(content[`${key}_moduleDescription`] ?? ''),
      moduleBusinessRules: String(content[`${key}_moduleBusinessRules`] ?? ''),
      features: Array.isArray(content[`${key}_features`])
        ? (content[`${key}_features`] as FeatureObj[])
        : [],
    }));
}

// ─── Section renderers ─────────────────────────────────────────────────────

function renderSection6(content: Record<string, unknown>): string {
  const modules = extractModules(content);
  if (modules.length === 0) return '<p class="empty">No modules defined.</p>';

  return modules
    .map((mod) => {
      let html = `<div class="module" id="module-${mod.key}">`;
      html += `<h3>${esc(mod.key)} &mdash; ${esc(mod.moduleName)}</h3>`;
      if (mod.moduleId)
        html += `<p class="meta">Module ID: ${esc(mod.moduleId)}</p>`;
      if (mod.moduleDescription)
        html += `<div class="field"><h4>Module Description</h4><p>${nl2br(mod.moduleDescription)}</p></div>`;
      if (mod.moduleBusinessRules)
        html += `<div class="field"><h4>Module Business Rules</h4><p>${nl2br(mod.moduleBusinessRules)}</p></div>`;

      if (mod.features.length > 0) {
        for (const feat of mod.features) {
          html += `<div class="feature" id="feat-${esc(feat.featureId)}">`;
          html += `<h4 class="feat-heading">${esc(feat.featureId)} &mdash; ${esc(feat.featureName)}</h4>`;
          if (feat.description)
            html += `<div class="feat-field"><span class="feat-label">Description:</span> ${nl2br(feat.description)}</div>`;
          if (feat.businessRule)
            html += `<div class="feat-field"><span class="feat-label">Business Rule:</span> ${nl2br(feat.businessRule)}</div>`;
          if (feat.acceptanceCriteria)
            html += `<div class="feat-field"><span class="feat-label">Acceptance Criteria:</span> ${nl2br(feat.acceptanceCriteria)}</div>`;
          if (feat.priority)
            html += `<div class="feat-field"><span class="feat-label">Priority:</span> ${esc(feat.priority)}</div>`;
          html += `</div>`;
        }
      }
      html += `</div>`;
      return html;
    })
    .join('\n');
}

function renderStandard(content: Record<string, unknown>): string {
  const entries = Object.entries(content).filter(
    ([k, v]) =>
      !k.endsWith('_features') &&
      typeof v !== 'object' &&
      String(v ?? '').trim() !== '',
  );
  if (entries.length === 0)
    return '<div class="incomplete-banner"><p class="incomplete-text">Incomplete — This section has no content yet.</p><p class="incomplete-hint">Please fill this section in the editor before finalising the PRD.</p></div>';

  return entries
    .map(([key, value]) => {
      const label = key
        .replace(/^\d+\.\d+_/, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      return `<div class="field"><h4>${esc(label)}</h4><p>${nl2br(String(value))}</p></div>`;
    })
    .join('\n');
}

function isSectionEmpty(s: PrdData['sections'][0]): boolean {
  const content = s.content as Record<string, unknown>;
  if (s.sectionNumber === 6) {
    return !Object.keys(content).some((k) => k.match(/^\d+\.\d+_moduleName$/));
  }
  const entries = Object.entries(content).filter(
    ([k, v]) =>
      !k.endsWith('_features') &&
      typeof v !== 'object' &&
      String(v ?? '').trim() !== '',
  );
  return entries.length === 0;
}

// ─── Document History (page 2): grouped by version ─────────────────────────

function buildDocumentHistory(history: AuditEntry[]): string {
  if (history.length === 0)
    return '<p class="empty">No changes recorded yet.</p>';

  // Group by version, keep latest date per version
  const versionMap = new Map<
    string,
    { date: string; descriptions: string[] }
  >();
  for (const e of history) {
    const existing = versionMap.get(e.version);
    const sName =
      e.sectionNumber === 0
        ? 'PRD'
        : `Section ${e.sectionNumber} (${SECTION_NAMES[e.sectionNumber] ?? ''})`;
    const field = e.fieldKey
      .replace(/^\d+\.\d+_/, '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^_/, '')
      .trim();
    const desc = `${e.changeType.replace('_', ' ')} — ${sName}: ${field}`;

    if (!existing) {
      versionMap.set(e.version, {
        date: e.createdAt,
        descriptions: [desc],
      });
    } else {
      existing.descriptions.push(desc);
      if (new Date(e.createdAt) > new Date(existing.date)) {
        existing.date = e.createdAt;
      }
    }
  }

  // Sort by version
  const sorted = [...versionMap.entries()].sort((a, b) => {
    const [aMaj, aMin] = a[0].split('.').map(Number);
    const [bMaj, bMin] = b[0].split('.').map(Number);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  });

  let html = `<table class="doc-history-table">`;
  html += `<thead><tr>
    <th style="width:80px">Version</th>
    <th style="width:120px">Date</th>
    <th>Description of Changes</th>
  </tr></thead><tbody>`;

  for (const [ver, info] of sorted) {
    const date = new Date(info.date).toLocaleDateString();
    const descList = info.descriptions.slice(0, 5);
    const more =
      info.descriptions.length > 5
        ? ` (+${info.descriptions.length - 5} more)`
        : '';
    html += `<tr>
      <td class="mono">${esc(ver)}</td>
      <td class="nowrap">${date}</td>
      <td><a href="#appendix-revision-history">${descList.map((d) => esc(d)).join('; ')}${more}</a></td>
    </tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

// ─── TOC builder ───────────────────────────────────────────────────────────

function buildToc(sections: PrdData['sections']): string {
  const s6 = sections.find((s) => s.sectionNumber === 6);
  const modules = s6
    ? extractModules(s6.content as Record<string, unknown>)
    : [];

  const incompleteCount = sections.filter((s) => isSectionEmpty(s)).length;
  let html = '';
  if (incompleteCount > 0) {
    html += `<p class="incomplete-count">${incompleteCount} section${incompleteCount > 1 ? 's' : ''} incomplete</p>`;
  }
  html += '<ul class="toc-list">';
  for (const s of sections) {
    const empty = isSectionEmpty(s);
    const cls = empty ? ' class="toc-incomplete"' : '';
    const badge = empty
      ? ' <span class="toc-badge">Incomplete</span>'
      : '';
    html += `<li${cls}><a href="#section-${s.sectionNumber}">${s.sectionNumber}. ${esc(SECTION_NAMES[s.sectionNumber] ?? s.sectionName)}</a>${badge}`;

    if (s.sectionNumber === 6 && modules.length > 0) {
      html += '<ul class="toc-modules">';
      for (const mod of modules) {
        html += `<li><a href="#module-${mod.key}">${esc(mod.key)} ${esc(mod.moduleName)}</a>`;
        if (mod.features.length > 0) {
          html += '<ul class="toc-features">';
          for (const feat of mod.features) {
            html += `<li><a href="#feat-${esc(feat.featureId)}">${esc(feat.featureId)} &mdash; ${esc(feat.featureName)}</a></li>`;
          }
          html += '</ul>';
        }
        html += '</li>';
      }
      html += '</ul>';
    }
    html += '</li>';
  }
  html += '</ul>';
  html += `<div class="toc-appendix"><a href="#appendix-revision-history">Appendix &mdash; Revision History</a></div>`;
  return html;
}

// ─── Appendix: full revision history ───────────────────────────────────────

function renderRevisionHistory(history: AuditEntry[]): string {
  if (history.length === 0)
    return '<p class="empty">No changes recorded yet.</p>';

  let html = `<table class="history-table">`;
  html += `<thead><tr>
    <th>Version</th><th>Date</th><th>Section</th><th>Field</th><th>Change Type</th><th>Source</th><th>Summary</th>
  </tr></thead><tbody>`;

  for (const e of history) {
    const sName =
      e.sectionNumber === 0
        ? 'PRD'
        : `${e.sectionNumber}. ${SECTION_NAMES[e.sectionNumber] ?? ''}`;
    const field =
      e.fieldKey
        .replace(/^\d+\.\d+_/, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^_/, '')
        .trim() || e.fieldKey;
    const summary = e.previousValue
      ? `Changed: "${esc((e.previousValue ?? '').substring(0, 40))}..." &rarr; "${esc((e.newValue ?? '').substring(0, 40))}..."`
      : esc((e.newValue ?? '').substring(0, 80));
    const date = new Date(e.createdAt).toLocaleString();
    const typeCls =
      e.changeType === 'CREATED'
        ? 'type-created'
        : e.changeType === 'AI_GENERATED'
          ? 'type-ai'
          : e.changeType === 'AI_MODIFIED'
            ? 'type-ai-mod'
            : 'type-modified';

    html += `<tr>
      <td class="mono">${esc(e.version)}</td>
      <td class="nowrap">${date}</td>
      <td>${esc(sName)}</td>
      <td class="mono">${esc(field)}</td>
      <td><span class="${typeCls}">${esc(e.changeType.replace('_', ' '))}</span></td>
      <td>${esc(e.source)}</td>
      <td class="summary">${summary}</td>
    </tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

// ─── Main export function ──────────────────────────────────────────────────

export function generatePrdHtml(prd: PrdData, history?: unknown[]): string {
  const historyEntries = (history ?? []) as AuditEntry[];

  // Compute latest revision date and version from history
  const latestEntry = historyEntries.length > 0 ? historyEntries[0] : null;
  const revisionDate = latestEntry
    ? new Date(latestEntry.createdAt).toLocaleDateString()
    : prd.createdAt instanceof Date
      ? prd.createdAt.toLocaleDateString()
      : new Date(prd.createdAt).toLocaleDateString();
  const revisionNumber = latestEntry ? latestEntry.version : prd.version;

  const toc = buildToc(prd.sections);
  const docHistory = buildDocumentHistory(historyEntries);

  const sectionBlocks = prd.sections
    .map((s) => {
      const content = s.content as Record<string, unknown>;
      const body =
        s.sectionNumber === 6
          ? renderSection6(content)
          : renderStandard(content);
      const empty = isSectionEmpty(s);
      const headingClass = empty
        ? 'section-heading incomplete-heading'
        : 'section-heading';
      const badge = empty
        ? ' <span class="section-badge-incomplete">Incomplete</span>'
        : '';
      return `<div class="section" id="section-${s.sectionNumber}">
        <h2 class="${headingClass}">${s.sectionNumber}. ${esc(SECTION_NAMES[s.sectionNumber] ?? s.sectionName)}${badge}</h2>
        ${body}
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(prd.productName)} &mdash; PRD</title>
  <style>
    /* ─── Base ─────────────────────────────────────────────── */
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 0; color: #1a1a2e; line-height: 1.6; }

    /* ─── Header / Footer (shown via Puppeteer headerTemplate / footerTemplate) ─── */
    /* For HTML preview fallback: */
    .page-header { text-align: center; font-size: 10px; color: #94a3b8; padding: 8px 40px; border-bottom: 1px solid #e2e8f0; }
    .page-footer { text-align: center; font-size: 9px; color: #94a3b8; padding: 8px 40px; border-top: 1px solid #e2e8f0; }

    /* ─── Cover Page ──────────────────────────────────────── */
    .cover-page {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 90vh; text-align: center; padding: 60px 40px;
      page-break-after: always;
    }
    .cover-logo { max-height: 80px; max-width: 200px; margin-bottom: 40px; object-fit: contain; }
    .cover-title { font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: #64748b; margin-bottom: 16px; font-weight: 600; }
    .cover-product { font-size: 32px; font-weight: 700; color: #1e293b; margin-bottom: 32px; line-height: 1.2; }
    .cover-divider { width: 80px; height: 3px; background: #ea580c; margin: 0 auto 32px auto; border-radius: 2px; }
    .cover-meta-table { margin: 0 auto; border-collapse: collapse; }
    .cover-meta-table td { padding: 6px 16px; font-size: 14px; }
    .cover-meta-label { color: #64748b; font-weight: 600; text-align: right; }
    .cover-meta-value { color: #1e293b; text-align: left; }

    /* ─── Document History (page 2) ───────────────────────── */
    .doc-history-page { padding: 40px; page-break-after: always; }
    .doc-history-page h2 { font-size: 20px; color: #1e293b; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .doc-history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .doc-history-table th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    .doc-history-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .doc-history-table tr:nth-child(even) td { background: #fafbfc; }
    .doc-history-table a { color: #2563eb; text-decoration: none; font-size: 12px; }
    .doc-history-table a:hover { text-decoration: underline; }

    /* ─── TOC (page 3) ────────────────────────────────────── */
    .toc-page { padding: 40px; page-break-after: always; }
    .toc-page h2 { font-size: 20px; color: #1e293b; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .toc-list { list-style: none; padding: 0; margin: 0; }
    .toc-list > li { padding: 3px 0; }
    .toc-list > li > a { font-size: 14px; font-weight: 600; color: #1e293b; text-decoration: none; }
    .toc-list > li > a:hover { color: #ea580c; }
    .toc-modules { list-style: none; padding-left: 20px; margin: 2px 0; }
    .toc-modules > li { padding: 2px 0; }
    .toc-modules > li > a { font-size: 13px; color: #475569; text-decoration: none; }
    .toc-modules > li > a:hover { color: #ea580c; }
    .toc-features { list-style: none; padding-left: 18px; margin: 1px 0; }
    .toc-features > li { padding: 1px 0; }
    .toc-features > li > a { font-size: 11px; font-family: monospace; color: #64748b; text-decoration: none; }
    .toc-features > li > a:hover { color: #ea580c; }

    /* ─── Content sections ────────────────────────────────── */
    .content-area { padding: 20px 40px; }
    .section { margin-bottom: 30px; }
    .section h2 { font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #1e293b; }
    .field { margin: 10px 0; }
    .field h4 { font-size: 12px; color: #64748b; margin: 0 0 3px 0; text-transform: capitalize; }
    .field p { margin: 0; font-size: 13px; white-space: pre-wrap; }
    .empty { color: #94a3b8; font-style: italic; font-size: 12px; }

    /* Modules */
    .module { margin: 16px 0 24px 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; page-break-inside: avoid; }
    .module h3 { font-size: 15px; color: #1e293b; margin: 0 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .module .meta { font-size: 11px; color: #64748b; margin-bottom: 6px; }

    /* Features */
    .feature { margin: 10px 0 10px 8px; padding: 10px 12px; border-left: 3px solid #ea580c; background: #fff; border-radius: 0 4px 4px 0; }
    .feat-heading { font-size: 13px; font-weight: 600; color: #ea580c; margin: 0 0 6px 0; }
    .feat-field { font-size: 12px; margin: 4px 0; }
    .feat-label { font-weight: 600; color: #64748b; }

    /* Incomplete indicators */
    .incomplete-count { font-size: 12px; color: #dc2626; margin-bottom: 8px; font-weight: 600; }
    .toc-incomplete > a { color: #dc2626 !important; }
    .toc-badge { font-size: 10px; background: #fef2f2; color: #dc2626; padding: 1px 6px; border-radius: 8px; margin-left: 6px; font-weight: 600; }
    .incomplete-heading { color: #dc2626 !important; border-bottom-color: #fecaca !important; }
    .section-badge-incomplete { font-size: 11px; background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 10px; margin-left: 8px; font-weight: 600; vertical-align: middle; }
    .incomplete-banner { border: 1px solid #fecaca; background: #fef2f2; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
    .incomplete-text { color: #dc2626; font-size: 13px; font-weight: 600; margin: 0; }
    .incomplete-hint { color: #f87171; font-size: 11px; margin: 4px 0 0 0; }
    .toc-appendix { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .toc-appendix a { font-size: 14px; font-weight: 600; color: #475569; text-decoration: none; }
    .toc-appendix a:hover { color: #ea580c; }

    /* ─── Appendix history table ──────────────────────────── */
    .history-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
    .history-table th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    .history-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .history-table tr:hover td { background: #f8fafc; }
    .history-table .mono, .doc-history-table .mono { font-family: monospace; font-size: 11px; }
    .history-table .nowrap, .doc-history-table .nowrap { white-space: nowrap; }
    .history-table .summary { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
    .type-created { background: #dcfce7; color: #166534; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
    .type-modified { background: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
    .type-ai { background: #f3e8ff; color: #7c3aed; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
    .type-ai-mod { background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }

    @media print {
      .cover-page { min-height: 100vh; }
      .page-header, .page-footer { display: none; } /* Puppeteer handles header/footer */
      .module { page-break-inside: avoid; }
      .feature { page-break-inside: avoid; }
      .history-table { font-size: 9px; }
    }
  </style>
</head>
<body>
  <!-- ═══ PAGE 1: COVER PAGE ═══ -->
  <div class="cover-page">
    ${prd.clientLogo ? `<img src="${prd.clientLogo}" alt="Client Logo" class="cover-logo" />` : ''}
    <div class="cover-title">Product Requirements Document</div>
    <div class="cover-product">PRD for ${esc(prd.productName)}</div>
    <div class="cover-divider"></div>
    <table class="cover-meta-table">
      <tr><td class="cover-meta-label">PRD Code:</td><td class="cover-meta-value">${esc(prd.prdCode)}</td></tr>
      ${prd.clientName ? `<tr><td class="cover-meta-label">Client Name:</td><td class="cover-meta-value">${esc(prd.clientName)}</td></tr>` : ''}
      ${prd.submittedBy ? `<tr><td class="cover-meta-label">Submitted By:</td><td class="cover-meta-value">${esc(prd.submittedBy)}</td></tr>` : ''}
      ${prd.author ? `<tr><td class="cover-meta-label">Author:</td><td class="cover-meta-value">${esc(prd.author)}</td></tr>` : ''}
      <tr><td class="cover-meta-label">Date:</td><td class="cover-meta-value">${revisionDate}</td></tr>
      <tr><td class="cover-meta-label">Revision:</td><td class="cover-meta-value">${esc(revisionNumber)}</td></tr>
      <tr><td class="cover-meta-label">Status:</td><td class="cover-meta-value">${esc(prd.status)}</td></tr>
    </table>
  </div>

  <!-- ═══ PAGE 2: DOCUMENT HISTORY ═══ -->
  <div class="doc-history-page">
    <div class="page-header">Product Requirements Document</div>
    <h2>Document History</h2>
    ${docHistory}
  </div>

  <!-- ═══ PAGE 3: TABLE OF CONTENTS ═══ -->
  <div class="toc-page">
    <div class="page-header">Product Requirements Document</div>
    <h2>Table of Contents</h2>
    ${toc}
  </div>

  <!-- ═══ CONTENT SECTIONS ═══ -->
  <div class="content-area">
    ${sectionBlocks}
  </div>

  <!-- ═══ APPENDIX: REVISION HISTORY ═══ -->
  <div class="content-area" id="appendix-revision-history" style="page-break-before:always;">
    <h2 class="section-heading">Appendix &mdash; Revision History</h2>
    ${renderRevisionHistory(historyEntries)}
  </div>
</body>
</html>`;
}
