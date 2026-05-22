/**
 * Approach Note HTML template — generates a self-contained, print-ready HTML
 * document from a specific BaApproachNoteVersion. Mirrors the BRD template
 * shape so styling stays consistent across Discovery artefacts.
 *
 * Used by:
 *   - GET /api/ba/projects/:projectId/discovery/approach-note/versions/:vid/preview
 *   - PdfService.generatePdfFromHtml() for download PDF
 *
 * Client edition mode (?edition=client) strips the "Changes since v(N-1)"
 * panel per skill 03 §10 worked example.
 */

import { renderMarkdown } from '../../templates/artifact-html';

interface AnDecision {
  question: string;
  decision: string;
}

interface AnOpenQuestion {
  number: number;
  question: string;
  default: string;
}

interface AnBrandTokens {
  primary: string;
  surface: string;
  cta: string;
  logo: string | null;
  productName: string;
}

// ─── §12 PRD-Readiness Bridge structured payload (skill 03 §12) ──────────

interface AnActor {
  role: string;
  type: string;
  description: string;
  permissions: string;
}

interface AnIntegration {
  name: string;
  type: string;
  purpose: string;
  criticality: string;
  phase: string;
}

interface AnCustomerJourney {
  name: string;
  primaryActor: string;
  trigger: string;
  steps: string[];
  successOutcome: string;
  failureModes: string[];
}

interface AnFunctionalLandscapeRow {
  module: string;
  purpose: string;
  frRefs: string[];
}

interface AnUiUxRequirements {
  interactionPatterns: string;
  accessibility: string;
  responsive: string;
  emptyErrorStates: string;
  microcopyTone: string;
  internationalization: string;
}

interface AnComplianceRow {
  standard: string;
  applicability: string;
  phase1Controls: string;
}

interface AnTestType {
  coverageTarget: string;
  tools: string;
  owner: string;
}

interface AnTestingRequirements {
  unit: AnTestType;
  integration: AnTestType;
  e2e: AnTestType;
  evalHarness: AnTestType;
  accessibility: AnTestType;
  performance: AnTestType;
  security: AnTestType;
}

interface AnReceivable {
  item: string;
  ownerClient: string;
  neededByWeek: number | null;
  blocking: boolean;
}

interface AnEnvironment {
  environment: string;
  purpose: string;
  phase1Hosting: string;
  phase2Hosting: string;
}

export interface AnPrdReadinessShape {
  actors: AnActor[];
  integrations: AnIntegration[];
  customerJourneys: AnCustomerJourney[];
  functionalLandscape: AnFunctionalLandscapeRow[];
  uiUxRequirements: AnUiUxRequirements;
  complianceRequirements: AnComplianceRow[];
  testingRequirements: AnTestingRequirements;
  keyDeliverables: string[];
  receivables: AnReceivable[];
  environmentList: AnEnvironment[];
  miscellaneous: string;
}

export interface AnHtmlInput {
  approachNoteId: string;
  versionId: string;
  versionNumber: number;
  status: string;
  changesSince: string | null;
  /** Map of section number ('1'..'12') → markdown body. */
  sections: Record<string, string>;
  brandTokens: AnBrandTokens | null;
  decisionsLocked: AnDecision[];
  openQuestions: AnOpenQuestion[];
  /** §12 PRD-Readiness Bridge — when present, renders structured tables under §12 in addition to markdown. */
  prdReadiness: AnPrdReadinessShape | null;
  meta: {
    audience?: string | null;
    productName?: string | null;
    model?: string | null;
    generatedAt?: string;
  } | null;
  generatedAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
  project: {
    name: string;
    projectCode: string;
    productName: string | null;
    clientName: string | null;
    submittedBy: string | null;
    clientLogo: string | null;
  };
  /** When true, strips the "Changes since" panel — for client-shareable export. */
  clientEdition?: boolean;
}

const SECTION_TITLES: Record<string, string> = {
  '1': 'Executive Verdict',
  '2': 'Feature / Model Palette',
  '3': 'Requirement-by-Requirement Fit',
  '4': 'Solution Architecture',
  '5': 'Model Routing Strategy',
  '6': 'Coverage Summary',
  '7': 'Decision Inputs vs Alternatives',
  '8': 'Decisions Locked & Open Questions',
  '9': 'Phase 1 (PoC) Scope',
  '10': 'Open Items for Next Version',
  '11': 'Phase 2 Roadmap',
  '12': 'PRD-Readiness Bridge',
};
const SECTION_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

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
    case 'REVIEW': return 'status-complete';
    case 'DRAFT':
    default: return 'status-draft';
  }
}

function renderBrandTokens(bt: AnBrandTokens | null): string {
  if (!bt) return '<p class="empty-note">No brand tokens captured.</p>';
  return `
    <div class="brand-tokens">
      <div class="bt-row"><span class="swatch" style="background:${esc(bt.primary)}"></span><span class="bt-hex">${esc(bt.primary)}</span><span class="bt-label">Primary</span></div>
      <div class="bt-row"><span class="swatch" style="background:${esc(bt.surface)}"></span><span class="bt-hex">${esc(bt.surface)}</span><span class="bt-label">Surface</span></div>
      <div class="bt-row"><span class="swatch" style="background:${esc(bt.cta)}"></span><span class="bt-hex">${esc(bt.cta)}</span><span class="bt-label">CTA</span></div>
      <div class="bt-row"><span class="bt-label">Product</span><span class="bt-hex">${esc(bt.productName)}</span></div>
    </div>`;
}

function renderDecisions(decisions: AnDecision[]): string {
  if (!decisions || decisions.length === 0) return '<p class="empty-note">No decisions captured yet.</p>';
  const rows = decisions
    .map((d) => `<tr><td class="d-q">${esc(d.question)}</td><td>${esc(d.decision)}</td></tr>`)
    .join('');
  return `<table class="decisions-table"><thead><tr><th>Question</th><th>Decision</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderOpenQuestions(questions: AnOpenQuestion[]): string {
  if (!questions || questions.length === 0) return '<p class="empty-note">All open questions resolved.</p>';
  const items = questions
    .map((q) => `<li><strong>${esc(q.question)}</strong>${q.default ? ` <span class="muted">— default: <em>${esc(q.default)}</em></span>` : ''}</li>`)
    .join('');
  return `<ol class="open-questions">${items}</ol>`;
}

// ─── §12 PRD-Readiness Bridge rendering ─────────────────────────────────
// Each subsection renders as a self-contained block so the export looks
// proper even when the markdown body is sparse. PDF + DOCX inherit the
// same structure via the AnHtmlInput → an-html → puppeteer pipeline.

function renderPrdReadiness(p: AnPrdReadinessShape): string {
  return `
    <div class="extras prd-bridge">
      <h3>12.1 Actors / User Types (${p.actors.length})</h3>
      ${p.actors.length === 0 ? '<p class="empty-note">No actors defined.</p>' : `
        <table class="bridge-table">
          <thead><tr><th>Role</th><th>Type</th><th>Description</th><th>Permissions</th></tr></thead>
          <tbody>${p.actors.map((a) => `<tr><td>${esc(a.role)}</td><td>${esc(a.type)}</td><td>${esc(a.description)}</td><td>${esc(a.permissions)}</td></tr>`).join('')}</tbody>
        </table>`}

      <h3>12.2 Integration Requirements (${p.integrations.length})</h3>
      ${p.integrations.length === 0 ? '<p class="empty-note">No integrations.</p>' : `
        <table class="bridge-table">
          <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Criticality</th><th>Phase</th></tr></thead>
          <tbody>${p.integrations.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.purpose)}</td><td>${esc(i.criticality)}</td><td>${esc(i.phase)}</td></tr>`).join('')}</tbody>
        </table>`}

      <h3>12.3 Customer Journeys / Flows (${p.customerJourneys.length})</h3>
      ${p.customerJourneys.length === 0 ? '<p class="empty-note">No customer journeys.</p>' : p.customerJourneys.map((j) => `
        <div class="journey-card">
          <div class="journey-name"><strong>${esc(j.name)}</strong> <span class="muted">· primary: ${esc(j.primaryActor)}</span></div>
          <div class="journey-meta"><strong>Trigger:</strong> ${esc(j.trigger)}</div>
          <div class="journey-meta"><strong>Steps:</strong></div>
          <ol>${j.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          <div class="journey-meta"><strong>Success:</strong> ${esc(j.successOutcome)}</div>
          ${j.failureModes.length > 0 ? `<div class="journey-meta"><strong>Failure modes:</strong> ${j.failureModes.map(esc).join('; ')}</div>` : ''}
        </div>`).join('')}

      <h3>12.4 Functional Landscape (${p.functionalLandscape.length})</h3>
      ${p.functionalLandscape.length === 0 ? '<p class="empty-note">No modules.</p>' : `
        <table class="bridge-table">
          <thead><tr><th>Module</th><th>Purpose</th><th>FR refs</th></tr></thead>
          <tbody>${p.functionalLandscape.map((m) => `<tr><td>${esc(m.module)}</td><td>${esc(m.purpose)}</td><td><code>${m.frRefs.map(esc).join(', ')}</code></td></tr>`).join('')}</tbody>
        </table>`}

      <h3>12.5 UI/UX Requirements</h3>
      <table class="bridge-table">
        <tbody>
          <tr><td><strong>Interaction patterns</strong></td><td>${esc(p.uiUxRequirements.interactionPatterns)}</td></tr>
          <tr><td><strong>Accessibility</strong></td><td>${esc(p.uiUxRequirements.accessibility)}</td></tr>
          <tr><td><strong>Responsive</strong></td><td>${esc(p.uiUxRequirements.responsive)}</td></tr>
          <tr><td><strong>Empty / error states</strong></td><td>${esc(p.uiUxRequirements.emptyErrorStates)}</td></tr>
          <tr><td><strong>Microcopy tone</strong></td><td>${esc(p.uiUxRequirements.microcopyTone)}</td></tr>
          <tr><td><strong>Internationalization</strong></td><td>${esc(p.uiUxRequirements.internationalization)}</td></tr>
        </tbody>
      </table>

      <h3>12.6 Compliance Requirements (Phase 1) (${p.complianceRequirements.length})</h3>
      ${p.complianceRequirements.length === 0 ? '<p class="empty-note">No compliance items in scope.</p>' : `
        <table class="bridge-table">
          <thead><tr><th>Standard</th><th>Applicability</th><th>Phase 1 controls</th></tr></thead>
          <tbody>${p.complianceRequirements.map((c) => `<tr><td>${esc(c.standard)}</td><td>${esc(c.applicability)}</td><td>${esc(c.phase1Controls)}</td></tr>`).join('')}</tbody>
        </table>`}

      <h3>12.7 Testing Requirements</h3>
      <table class="bridge-table">
        <thead><tr><th>Test type</th><th>Coverage target</th><th>Tools</th><th>Owner</th></tr></thead>
        <tbody>
          ${[
            { label: 'Unit', t: p.testingRequirements.unit },
            { label: 'Integration', t: p.testingRequirements.integration },
            { label: 'E2E', t: p.testingRequirements.e2e },
            { label: 'Eval harness (LLM)', t: p.testingRequirements.evalHarness },
            { label: 'Accessibility', t: p.testingRequirements.accessibility },
            { label: 'Performance', t: p.testingRequirements.performance },
            { label: 'Security', t: p.testingRequirements.security },
          ]
            .map(
              ({ label, t }) =>
                `<tr><td><strong>${esc(label)}</strong></td><td>${esc(t.coverageTarget)}</td><td>${esc(t.tools)}</td><td>${esc(t.owner)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h3>12.8 Key Deliverables (${p.keyDeliverables.length})</h3>
      ${p.keyDeliverables.length === 0 ? '<p class="empty-note">No deliverables listed.</p>' : `<ul>${p.keyDeliverables.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`}

      <h3>12.9 Receivables (${p.receivables.length})</h3>
      ${p.receivables.length === 0 ? '<p class="empty-note">No client-side receivables.</p>' : `
        <table class="bridge-table">
          <thead><tr><th>Item</th><th>Owner (client)</th><th>Needed by week</th><th>Blocking?</th></tr></thead>
          <tbody>${p.receivables.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.ownerClient)}</td><td>${r.neededByWeek == null ? '—' : `Week ${r.neededByWeek}`}</td><td>${r.blocking ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody>
        </table>`}

      <h3>12.10 Environment list (${p.environmentList.length})</h3>
      ${p.environmentList.length === 0 ? '<p class="empty-note">No environments listed.</p>' : `
        <table class="bridge-table">
          <thead><tr><th>Env</th><th>Purpose</th><th>Phase 1 hosting</th><th>Phase 2 hosting</th></tr></thead>
          <tbody>${p.environmentList.map((e) => `<tr><td><code>${esc(e.environment)}</code></td><td>${esc(e.purpose)}</td><td>${esc(e.phase1Hosting)}</td><td>${esc(e.phase2Hosting)}</td></tr>`).join('')}</tbody>
        </table>`}

      ${p.miscellaneous ? `<h3>12.11 Miscellaneous</h3><p>${esc(p.miscellaneous).replace(/\n/g, '<br/>')}</p>` : ''}
    </div>`;
}

function renderToc(sections: Record<string, string>): string {
  const items = SECTION_ORDER.map((key) => {
    const filled = (sections[key] ?? '').trim().length > 30;
    return `<li><a href="#sec-${key}">§${key}. ${esc(SECTION_TITLES[key])}</a>${filled ? '' : ' <span class="toc-empty">(empty)</span>'}</li>`;
  }).join('');
  return `<nav class="toc"><h2>Contents</h2><ol>${items}</ol></nav>`;
}

function renderCover(input: AnHtmlInput): string {
  const productName =
    input.brandTokens?.productName ??
    input.project.productName ??
    input.project.name ??
    '—';
  const audience = input.meta?.audience ?? '—';
  const generated = formatDate(input.meta?.generatedAt ?? input.generatedAt);
  const updated = formatDate(input.updatedAt);
  const editionBadge = input.clientEdition
    ? '<span class="edition-pill">Client edition</span>'
    : '<span class="edition-pill internal">Internal edition</span>';
  const logoBlock = input.project.clientLogo
    ? `<img class="cover-logo" src="${esc(input.project.clientLogo)}" alt="logo"/>`
    : '';

  return `
    <header class="cover">
      ${logoBlock}
      <div class="cover-eyebrow">Approach Note · v${input.versionNumber} ${editionBadge}</div>
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

export function generateAnHtml(input: AnHtmlInput): string {
  const cover = renderCover(input);
  const toc = renderToc(input.sections);

  const showChangesSince = !input.clientEdition && input.changesSince && input.versionNumber > 1;
  const changesPanel = showChangesSince
    ? `<section class="changes-since">
         <h2>Changes since v${input.versionNumber - 1}</h2>
         <pre>${esc(input.changesSince ?? '')}</pre>
       </section>`
    : '';

  const sectionHtml = SECTION_ORDER.map((key) => {
    const body = (input.sections[key] ?? '').trim();
    let extras = '';
    if (key === '3') {
      extras = `
        <div class="extras">
          <h3>Brand tokens (cascades to lo-fi + hi-fi)</h3>
          ${renderBrandTokens(input.brandTokens)}
        </div>`;
    } else if (key === '8') {
      extras = `
        <div class="extras">
          <h3>Decisions Locked (${input.decisionsLocked.length})</h3>
          ${renderDecisions(input.decisionsLocked)}
          <h3 style="margin-top:14px">Open questions (${input.openQuestions.length})</h3>
          ${renderOpenQuestions(input.openQuestions)}
        </div>`;
    } else if (key === '12' && input.prdReadiness) {
      extras = renderPrdReadiness(input.prdReadiness);
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
  <title>Approach Note v${input.versionNumber} — ${esc(input.brandTokens?.productName ?? input.project.productName ?? input.project.name)}</title>
  <style>${AN_CSS}</style>
</head>
<body>
  <main class="document">
    ${cover}
    ${toc}
    ${changesPanel}
    ${sectionHtml}
    <footer class="doc-footer">
      <p class="muted">AN <code>${esc(input.approachNoteId)}</code> · version <code>${esc(input.versionId)}</code> · generated by ${esc(input.meta?.model ?? 'AI')}</p>
    </footer>
  </main>
</body>
</html>`;
}

const AN_CSS = `
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

  /* Status / edition pills */
  .status-pill, .edition-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
  .status-draft { background: #fef3c7; color: #92400e; }
  .status-complete { background: #dbeafe; color: #1e40af; }
  .status-approved { background: #dcfce7; color: #14532d; }
  .edition-pill { background: #fee2e2; color: #991b1b; margin-left: 6px; }
  .edition-pill.internal { background: #e0e7ff; color: #3730a3; }

  /* TOC */
  .toc { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 20px 28px; margin-bottom: 32px; page-break-after: always; }
  .toc h2 { margin: 0 0 12px; font-size: 16px; }
  .toc ol { margin: 0; padding-left: 24px; }
  .toc li { padding: 3px 0; font-size: 13px; }
  .toc a { color: var(--accent); text-decoration: none; }
  .toc-empty { color: var(--muted); font-size: 11px; }

  /* Changes since */
  .changes-since { background: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #f97316; border-radius: 4px; padding: 14px 18px; margin-bottom: 28px; }
  .changes-since h2 { margin: 0 0 8px; font-size: 14px; color: #9a3412; }
  .changes-since pre { white-space: pre-wrap; margin: 0; font-family: inherit; font-size: 12px; }

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

  /* Extras (brand tokens, decisions, open questions) */
  .extras { margin-top: 16px; padding: 12px 16px; background: var(--bg); border: 1px dashed var(--line); border-radius: 4px; }
  .extras h3 { margin: 0 0 8px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }

  .brand-tokens { display: flex; gap: 14px; flex-wrap: wrap; }
  .bt-row { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
  .swatch { display: inline-block; width: 18px; height: 18px; border-radius: 3px; border: 1px solid #ccc; }
  .bt-hex { font-family: "Fira Code", monospace; }
  .bt-label { color: var(--muted); }

  .decisions-table { border-collapse: collapse; width: 100%; font-size: 12px; }
  .decisions-table th, .decisions-table td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
  .decisions-table th { background: white; color: var(--muted); }
  .d-q { width: 35%; color: var(--muted); }

  .open-questions { margin: 0; padding-left: 22px; font-size: 12px; }
  .open-questions li { margin: 4px 0; }

  .doc-footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 11px; }

  /* §12 PRD-Readiness Bridge */
  .prd-bridge h3 { margin-top: 18px; font-size: 13px; color: var(--ink); }
  .bridge-table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 6px; }
  .bridge-table th, .bridge-table td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
  .bridge-table th { background: white; color: var(--muted); font-weight: 600; }
  .journey-card { border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin-top: 6px; background: white; }
  .journey-name { font-size: 13px; }
  .journey-meta { font-size: 12px; margin-top: 4px; }
  .journey-card ol { margin: 4px 0 4px 18px; font-size: 12px; }

  /* Print */
  @media print {
    .document { max-width: none; padding: 0; }
    .toc, .cover { page-break-after: always; }
    .section { page-break-inside: avoid; }
  }
`;
