/**
 * HLD → HTML template (Sprint v10, HE-04).
 *
 * Mirrors `prd-html.ts`: a single HTML string consumed by BOTH Puppeteer (PDF)
 * and html-to-docx (DOCX), and reused for the in-app canonical Preview so all
 * three outputs match. Architecture diagrams are emitted as Mermaid that renders
 * to SVG under Puppeteer (pastel per-layer fills injected server-side); in DOCX
 * the diagram source appears as a labelled code block (html-to-docx runs no JS).
 */

/** The 17 HLD section keys → human names (must match HldService / frontend). */
const HLD_SECTION_NAMES: Record<string, string> = {
  documentControl: 'Document Control',
  executiveSummary: 'Executive Summary',
  systemView: '50,000-ft System View',
  technicalLayersView: 'Layered Technical View',
  componentView: 'Detailed Component View',
  architectureStyleView: 'Architecture Style & Patterns View',
  deploymentView: 'Deployment View',
  architectureStyleDecision: 'Architecture Style Decision',
  technologyStack: 'Technology Stack',
  designPatterns: 'Design Patterns Catalogue',
  authDesign: 'Auth & Security Design',
  aiLayer: 'AI Layer Architecture',
  integrations: 'Integration Architecture',
  multiTenancy: 'Multi-Tenancy & Data Isolation',
  nfr: 'Non-Functional Requirements',
  prdCoverage: 'PRD → HLD Coverage Checklist',
  projectStructure: 'Project Structure',
};
const HLD_SECTION_ORDER = Object.keys(HLD_SECTION_NAMES);

const DIAGRAM_LABELS: Record<string, string> = {
  systemView: '50,000-ft System View',
  technicalLayers: 'Layered Technical View',
  componentView: 'Component View',
  architectureStyle: 'Architecture Style (Actor → Frontend → Backend → Data)',
  deployment: 'Deployment Topology',
};

export interface HldHtmlData {
  productName: string;
  version: number;
  status: string;
  createdAt: string | Date;
  sections: Record<string, unknown>;
  mermaidDiagrams: Record<string, string>;
  /** 50k-ft band model — canonical §3 representation (replaces legacy layer text). */
  systemView?: unknown;
}

/** Legacy free-text §3 fields superseded by the band model; hidden when it exists. */
const SYSTEM_VIEW_LEGACY_FIELDS = new Set(['layers', 'phasing', 'externalSystems']);

// ─── Pastel diagram palette (mirrors the Design System / frontend defaults) ───

type Layer = 'frontend' | 'backend' | 'calcEngine' | 'shared' | 'db' | 'config';
const PALETTE: Record<Layer | 'node', { fill: string; border: string; text: string }> = {
  frontend: { fill: '#ECEBFB', border: '#B9B0EC', text: '#4F46B5' },
  backend: { fill: '#E3F5EC', border: '#A6DCC4', text: '#2F8A60' },
  calcEngine: { fill: '#FBEEDC', border: '#EAC893', text: '#B97A2B' },
  shared: { fill: '#FBE7E4', border: '#ECB2AB', text: '#B24A3C' },
  db: { fill: '#E8F1FB', border: '#ABCAE9', text: '#2F62A6' },
  config: { fill: '#F1F0EC', border: '#D2CFC8', text: '#5C574F' },
  node: { fill: '#F4F3FB', border: '#C9C3E6', text: '#3A3550' },
};

function layerForNode(text: string): Layer {
  const s = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  if (has('postgres', 'redis', 's3', 'gcs', 'database', 'sql', 'mongo', 'bucket', 'cache', 'datastore', 'storage', 'warehouse', 'persistence', 'data')) return 'db';
  if (has('calc', 'engine', 'python', 'fastapi', 'pandas', ' ai', 'ai ', 'ml ', 'worker', 'inference', 'model')) return 'calcEngine';
  if (has('cdn', 'gateway', 'load balancer', 'web app', 'webapp', 'admin portal', 'frontend', 'browser', ' ui', 'next', 'portal', 'client', 'mobile', 'presentation', 'users', 'actor', 'access')) return 'frontend';
  if (has('log', 'monitor', 'sentry', 'observability', 'metrics', 'config', 'terraform', 'docker', 'ci/cd', 'devops', 'grafana', 'prometheus', 'platform', 'infra')) return 'config';
  if (has('shared', 'package', 'library', 'sdk', 'common')) return 'shared';
  return 'backend';
}

/** Inject pastel classDef + per-node class assignments into a Mermaid graph. */
function applyDiagramPalette(src: string): string {
  const ids = new Map<string, string>();
  const re = /([A-Za-z0-9_]+)\s*(?:\[([^\]]*)\]|\(\(([^)]*)\)\)|\(([^)]*)\)|\{([^}]*)\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const id = m[1];
    const label = m[2] ?? m[3] ?? m[4] ?? m[5] ?? id;
    if (!ids.has(id)) ids.set(id, label || id);
  }
  if (!ids.size) return src;
  const byLayer: Record<string, string[]> = {};
  ids.forEach((label, id) => {
    const L = layerForNode(`${label} ${id}`);
    (byLayer[L] ??= []).push(id);
  });
  let out = `${src.trimEnd()}\n`;
  for (const L of Object.keys(byLayer) as Layer[]) {
    const c = PALETTE[L];
    out += `classDef ${L} fill:${c.fill},stroke:${c.border},color:${c.text},stroke-width:1px;\n`;
    out += `class ${byLayer[L].join(',')} ${L};\n`;
  }
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** PDF/DOCX always render in black — drop the [AI] authoring prefix. */
function stripAiPrefix(str: string): string {
  const t = str.trimStart();
  if (t.startsWith('[AI] ')) return t.slice(5);
  if (t.startsWith('[AI]')) return t.slice(4).trimStart();
  return str;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Recursively render a section field value (string / number / array / object). */
function renderValue(value: unknown): string {
  if (value == null || value === '') return '<span class="empty">—</span>';
  if (typeof value === 'string') return `<span>${esc(stripAiPrefix(value)).replace(/\n/g, '<br>')}</span>`;
  if (typeof value === 'number' || typeof value === 'boolean') return `<span>${esc(String(value))}</span>`;
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="empty">—</span>';
    return `<ul class="vlist">${value.map((v) => `<li>${renderValue(v)}</li>`).join('')}</ul>`;
  }
  // object
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '<span class="empty">—</span>';
  return `<dl class="vobj">${entries
    .map(([k, v]) => `<dt>${esc(humanizeKey(k))}</dt><dd>${renderValue(v)}</dd>`)
    .join('')}</dl>`;
}

function renderSectionBody(body: unknown, omitKeys?: Set<string>): string {
  if (body == null) return '<p class="empty">Not generated.</p>';
  if (typeof body !== 'object') return `<p>${renderValue(body)}</p>`;
  const entries = Object.entries(body as Record<string, unknown>).filter(([k]) => !omitKeys?.has(k));
  if (!entries.length) return '';
  return `<dl class="fields">${entries
    .map(([k, v]) => `<div class="field"><dt>${esc(humanizeKey(k))}</dt><dd>${renderValue(v)}</dd></div>`)
    .join('')}</dl>`;
}

// ─── 50k-ft System View band model → HTML (canonical §3 representation) ───────

type SvBand = { name?: string; subtitle?: string; phase?: number; thirdParty?: boolean };

function svList(items?: string[]): string {
  return items?.length
    ? `<ul class="vlist">${items.map((x) => `<li>${esc(String(x))}</li>`).join('')}</ul>`
    : '<span class="empty">—</span>';
}

function svModules(mods?: SvBand[]): string {
  if (!mods?.length) return '<span class="empty">—</span>';
  return `<ul class="vlist">${mods
    .map((m) => {
      const tags = [
        m.thirdParty ? '3rd-party' : '',
        m.phase && m.phase > 1 ? `Phase ${m.phase}` : '',
      ]
        .filter(Boolean)
        .map((t) => ` <em>[${esc(t)}]</em>`)
        .join('');
      const sub = m.subtitle ? ` — ${esc(m.subtitle)}` : '';
      return `<li>${esc(m.name ?? '')}${sub}${tags}</li>`;
    })
    .join('')}</ul>`;
}

function renderSystemViewBands(model: Record<string, unknown>): string {
  const m = model as {
    actors?: string[]; channels?: string[]; coreInfra?: string[];
    functionalModules?: SvBand[]; rbac?: { title?: string; subtitle?: string };
    integrationModules?: SvBand[]; externalGroups?: { title?: string; items?: string[] }[];
    aiLayer?: { capabilities?: string[]; rag?: { title?: string; subtitle?: string }; llmProviders?: string[] };
    layerNotes?: Record<string, string>; gatewayNote?: string; gaps?: string[];
  };
  const ln = m.layerNotes ?? {};
  const band = (title: string, inner: string) =>
    `<div class="sv-band"><h3 class="sv-band-title">${esc(title)}</h3>${inner}</div>`;

  const actorsLine = m.actors?.length
    ? `<p class="sv-sub"><strong>Actors:</strong> ${m.actors.map((a) => esc(a)).join(' · ')}</p>`
    : '';
  const rbac = m.rbac?.title
    ? `<p class="sv-sub"><strong>${esc(m.rbac.title)}</strong>${m.rbac.subtitle ? ` — ${esc(m.rbac.subtitle)}` : ''}</p>`
    : '';
  const external = m.externalGroups?.length
    ? `<dl class="vobj">${m.externalGroups
        .map((g) => `<dt>${esc(g.title ?? '')}</dt><dd>${esc((g.items ?? []).join(' · '))}</dd>`)
        .join('')}</dl>`
    : '<span class="empty">—</span>';
  const hasAi =
    !!m.aiLayer &&
    ((m.aiLayer.capabilities?.length ?? 0) > 0 || !!m.aiLayer.rag?.title || (m.aiLayer.llmProviders?.length ?? 0) > 0);
  const ai = hasAi
    ? `${m.aiLayer?.capabilities?.length ? `<p class="sv-sub"><strong>Capabilities:</strong> ${m.aiLayer.capabilities.map((c) => esc(c)).join(' · ')}</p>` : ''}
       ${m.aiLayer?.rag?.title ? `<p class="sv-sub"><strong>RAG:</strong> ${esc(m.aiLayer.rag.title)}${m.aiLayer.rag.subtitle ? ` — ${esc(m.aiLayer.rag.subtitle)}` : ''}</p>` : ''}
       ${m.aiLayer?.llmProviders?.length ? `<p class="sv-sub"><strong>LLM providers:</strong> ${m.aiLayer.llmProviders.map((p) => esc(p)).join(' · ')}</p>` : ''}`
    : '<span class="empty">No AI layer in scope.</span>';

  const gaps = m.gaps?.length
    ? `<div class="sv-gaps"><h3 class="sv-band-title">Gaps &amp; assumptions</h3>${svList(m.gaps)}</div>`
    : '';

  // §3.1-style reference table: Layer | What it represents | Where it gets unpacked.
  const tableRows: [string, string | undefined, string][] = [
    ['Access layer', ln.access, '§4 Layered Technical View · §6 Architecture Style & Patterns View'],
    ['Core infrastructure', ln.coreInfra, '§9 Technology Stack · §13 Integration Architecture'],
    ['Core functional modules', ln.functionalModules, '§5 Detailed Component View · §10 Design Patterns Catalogue'],
    ['Integration layer — 3rd party module integrations', ln.integration, '§13 Integration Architecture'],
    ['External / 3rd party systems', ln.external, '§11 Auth & Security Design · §13 Integration Architecture'],
    ['AI layer (conversational, RAG, multi-LLM)', ln.ai, '§12 AI Layer Architecture'],
  ];
  const table = `<table class="sv-table">
    <thead><tr><th>Layer</th><th>What it represents</th><th>Where it gets unpacked in this HLD</th></tr></thead>
    <tbody>${tableRows
      .map(
        ([name, note, ref]) =>
          `<tr><td class="sv-td-layer">${esc(name)}</td><td>${note ? esc(note) : '<span class="empty">—</span>'}</td><td class="sv-td-ref">${esc(ref)}</td></tr>`,
      )
      .join('')}</tbody></table>`;

  return `<div class="sv-bands">
    ${band('1. Access layer', `${svList(m.channels)}${actorsLine}`)}
    ${band('2. Core infrastructure', svList(m.coreInfra))}
    ${band('3. Core functional modules', `${svModules(m.functionalModules)}${rbac}`)}
    ${band('4. Integration layer — 3rd party module integrations', svModules(m.integrationModules))}
    ${band(`5. External / 3rd party systems${m.gatewayNote ? ` (${esc(m.gatewayNote)})` : ''}`, external)}
    ${band('6. AI layer — conversational, RAG, multi-LLM', ai)}
    <h3 class="sv-band-title" style="margin-top:14px;">The six layers — what each represents</h3>
    ${table}
    ${gaps}
  </div>`;
}

// ─── Main export ───────────────────────────────────────────────────────────

export function generateHldHtml(data: HldHtmlData): string {
  const date =
    data.createdAt instanceof Date
      ? data.createdAt.toLocaleDateString()
      : new Date(data.createdAt).toLocaleDateString();

  const toc = HLD_SECTION_ORDER.map(
    (key, i) => `<li><a href="#section-${key}">${i + 1}. ${esc(HLD_SECTION_NAMES[key])}</a></li>`,
  ).join('');

  const sectionBlocks = HLD_SECTION_ORDER.map((key, i) => {
    const body = data.sections?.[key];
    let inner: string;
    if (key === 'systemView' && data.systemView && typeof data.systemView === 'object') {
      // Band model is the canonical §3 view; legacy free-text layer fields are dropped.
      const rest = body && typeof body === 'object' ? renderSectionBody(body, SYSTEM_VIEW_LEGACY_FIELDS) : '';
      inner = renderSystemViewBands(data.systemView as Record<string, unknown>) + rest;
    } else {
      inner = renderSectionBody(body);
    }
    return `<div class="section" id="section-${key}">
      <h2 class="section-heading">${i + 1}. ${esc(HLD_SECTION_NAMES[key])}</h2>
      ${inner}
    </div>`;
  }).join('\n');

  const diagramEntries = Object.entries(data.mermaidDiagrams ?? {}).filter(([, src]) => !!src?.trim());
  const diagramBlocks = diagramEntries.length
    ? `<div class="content-area" id="diagrams" style="page-break-before:always;">
        <h2 class="section-heading">Architecture Diagrams</h2>
        ${diagramEntries
          .map(
            ([name, src]) =>
              `<div class="diagram-block"><h3>${esc(DIAGRAM_LABELS[name] ?? humanizeKey(name))}</h3>
               <pre class="mermaid">${esc(applyDiagramPalette(src))}</pre></div>`,
          )
          .join('\n')}
      </div>`
    : '';

  // Mermaid is loaded only when diagrams exist; Puppeteer waits for the SVG.
  const mermaidScript = diagramEntries.length
    ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
       <script>
         try {
           mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', theme: 'base',
             themeVariables: { fontFamily: 'Segoe UI, system-ui, sans-serif',
               mainBkg: '${PALETTE.node.fill}', nodeBorder: '${PALETTE.node.border}',
               lineColor: '${PALETTE.node.border}', primaryTextColor: '${PALETTE.node.text}' } });
         } catch (e) {}
       </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(data.productName)} &mdash; HLD</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 0; color: #1a1a2e; line-height: 1.6; }
    .cover-page { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:90vh; text-align:center; padding:60px 40px; page-break-after:always; }
    .cover-title { font-size:14px; text-transform:uppercase; letter-spacing:3px; color:#64748b; margin-bottom:16px; font-weight:600; }
    .cover-product { font-size:32px; font-weight:700; color:#1e293b; margin-bottom:32px; line-height:1.2; }
    .cover-divider { width:80px; height:3px; background:#ea580c; margin:0 auto 32px auto; border-radius:2px; }
    .cover-meta-table { margin:0 auto; border-collapse:collapse; }
    .cover-meta-table td { padding:6px 16px; font-size:14px; }
    .cover-meta-label { color:#64748b; font-weight:600; text-align:right; }
    .cover-meta-value { color:#1e293b; text-align:left; }
    .toc-page { padding:40px; page-break-after:always; }
    .toc-page h2 { font-size:20px; color:#1e293b; margin-bottom:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; }
    .toc-list { list-style:none; padding:0; margin:0; }
    .toc-list > li { padding:3px 0; }
    .toc-list > li > a { font-size:14px; font-weight:600; color:#1e293b; text-decoration:none; }
    .content-area { padding:20px 40px; }
    .section { margin-bottom:28px; page-break-inside:avoid; }
    .section-heading { font-size:18px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; color:#1e293b; }
    .fields { margin:0; }
    .field { margin:10px 0; }
    .field > dt { font-size:12px; color:#64748b; margin:0 0 3px 0; text-transform:capitalize; font-weight:600; }
    .field > dd { margin:0; font-size:13px; }
    .vobj { margin:4px 0 4px 0; }
    .vobj > dt { font-size:11px; color:#475569; font-weight:600; margin-top:4px; }
    .vobj > dd { margin:0 0 0 14px; font-size:12px; }
    .vlist { margin:2px 0; padding-left:20px; }
    .vlist > li { font-size:12px; margin:2px 0; }
    .empty { color:#94a3b8; font-style:italic; font-size:12px; }
    .sv-bands { margin:0; }
    .sv-band { margin:0 0 12px 0; padding:10px 12px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc; }
    .sv-band-title { font-size:13px; font-weight:700; color:#1e293b; margin:0 0 4px 0; }
    .sv-note { margin:0 0 6px 0; font-size:12px; color:#475569; }
    .sv-sub { margin:4px 0 0 0; font-size:12px; color:#334155; }
    .sv-gaps { margin:8px 0 0 0; padding:10px 12px; border:1px solid #fde68a; border-radius:6px; background:#fffbeb; }
    .sv-table { width:100%; border-collapse:collapse; font-size:12px; margin:4px 0 8px 0; }
    .sv-table th { background:#7C4A1E; color:#fff; text-align:left; padding:6px 9px; border:1px solid #E5E2DD; font-weight:600; }
    .sv-table td { padding:6px 9px; border:1px solid #E5E2DD; vertical-align:top; line-height:1.45; }
    .sv-td-layer { font-weight:600; color:#141413; width:22%; }
    .sv-td-ref { color:#475569; width:26%; }
    .diagram-block { margin:16px 0; page-break-inside:avoid; }
    .diagram-block h3 { font-size:14px; color:#334155; margin:0 0 8px 0; }
    pre.mermaid { background:#fbfafe; border:1px solid #ece9f7; border-radius:6px; padding:12px; font-size:12px; overflow-x:auto; }
    @media print { .section, .diagram-block { page-break-inside:avoid; } }
  </style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-title">High-Level Design</div>
    <div class="cover-product">HLD for ${esc(data.productName)}</div>
    <div class="cover-divider"></div>
    <table class="cover-meta-table">
      <tr><td class="cover-meta-label">Product:</td><td class="cover-meta-value">${esc(data.productName)}</td></tr>
      <tr><td class="cover-meta-label">Version:</td><td class="cover-meta-value">v${esc(String(data.version))}</td></tr>
      <tr><td class="cover-meta-label">Status:</td><td class="cover-meta-value">${esc(data.status)}</td></tr>
      <tr><td class="cover-meta-label">Date:</td><td class="cover-meta-value">${date}</td></tr>
      <tr><td class="cover-meta-label">Sections:</td><td class="cover-meta-value">17 · architecture diagrams</td></tr>
    </table>
  </div>

  <div class="toc-page">
    <h2>Table of Contents</h2>
    <ul class="toc-list">${toc}</ul>
  </div>

  <div class="content-area">
    ${sectionBlocks}
  </div>

  ${diagramBlocks}
  ${mermaidScript}
</body>
</html>`;
}
