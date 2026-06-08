/**
 * HLD → HTML template (Sprint v10, HE-04).
 *
 * Mirrors `prd-html.ts`: a single HTML string consumed by BOTH Puppeteer (PDF)
 * and html-to-docx (DOCX), and reused for the in-app canonical Preview so all
 * three outputs match. Architecture diagrams are emitted as Mermaid that renders
 * to SVG under Puppeteer (pastel per-layer fills injected server-side); in DOCX
 * the diagram source appears as a labelled code block (html-to-docx runs no JS).
 */

import { awsIconSvg, AWS_FAMILY_LABELS, type AwsFamily } from './aws-icons';
import { buildFlowDiagramSvg, type FlowDiagramModel } from './aws-flow-diagram';

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
  /** Layered technical view band model — canonical §4 representation. */
  technicalView?: unknown;
  /** Detailed component view model — canonical §5 representation. */
  componentView?: unknown;
  /** Architecture style & patterns view model — canonical §6 representation. */
  styleView?: unknown;
  /** AWS deployment view model — canonical §7 representation. */
  deploymentView?: unknown;
  /** AWS flow diagrams model — §7.5 connected reference-architecture views. */
  deploymentFlows?: unknown;
  /** Project structure model — canonical §17 representation. */
  structureView?: unknown;
}

/** Legacy free-text §3 fields superseded by the band model; hidden when it exists. */
const SYSTEM_VIEW_LEGACY_FIELDS = new Set(['layers', 'phasing', 'externalSystems']);
/** Legacy free-text §4 fields superseded by the layered technical view model. */
const TECHNICAL_VIEW_LEGACY_FIELDS = new Set(['layers', 'description']);
/** Legacy free-text §5 fields superseded by the detailed component view model. */
const COMPONENT_VIEW_LEGACY_FIELDS = new Set(['components', 'description']);
/** Legacy free-text §6 fields superseded by the architecture style & patterns view. */
const STYLE_VIEW_LEGACY_FIELDS = new Set(['tiers', 'description', 'patternsByTier']);
/** Legacy free-text §7 fields superseded by the AWS deployment view model. */
const DEPLOYMENT_VIEW_LEGACY_FIELDS = new Set(['description', 'cloudMapping', 'serverlessChoices', 'notInScope']);
/** Legacy free-text §17 fields superseded by the project structure view. */
const STRUCTURE_VIEW_LEGACY_FIELDS = new Set(['aiAgent', 'backend', 'frontend', 'namingConventions']);

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
  // The 3rd column links to each section's anchor (id="section-<key>") for PDF/HTML.
  type Ref = { key: string; n: number; name: string };
  const tableRows: { name: string; note?: string; refs: Ref[] }[] = [
    { name: 'Access layer', note: ln.access, refs: [
      { key: 'technicalLayersView', n: 4, name: 'Layered Technical View' },
      { key: 'architectureStyleView', n: 6, name: 'Architecture Style & Patterns View' },
    ] },
    { name: 'Core infrastructure', note: ln.coreInfra, refs: [
      { key: 'technologyStack', n: 9, name: 'Technology Stack' },
      { key: 'integrations', n: 13, name: 'Integration Architecture' },
    ] },
    { name: 'Core functional modules', note: ln.functionalModules, refs: [
      { key: 'componentView', n: 5, name: 'Detailed Component View' },
      { key: 'designPatterns', n: 10, name: 'Design Patterns Catalogue' },
    ] },
    { name: 'Integration layer — 3rd party module integrations', note: ln.integration, refs: [
      { key: 'integrations', n: 13, name: 'Integration Architecture' },
    ] },
    { name: 'External / 3rd party systems', note: ln.external, refs: [
      { key: 'authDesign', n: 11, name: 'Auth & Security Design' },
      { key: 'integrations', n: 13, name: 'Integration Architecture' },
    ] },
    { name: 'AI layer (conversational, RAG, multi-LLM)', note: ln.ai, refs: [
      { key: 'aiLayer', n: 12, name: 'AI Layer Architecture' },
    ] },
  ];
  const refLinks = (refs: Ref[]) =>
    refs.map((r) => `<a href="#section-${r.key}">§${r.n} ${esc(r.name)}</a>`).join(' · ');
  const table = `<table class="sv-table">
    <thead><tr><th>Layer</th><th>What it represents</th><th>Where it gets unpacked in this HLD</th></tr></thead>
    <tbody>${tableRows
      .map(
        (row) =>
          `<tr><td class="sv-td-layer">${esc(row.name)}</td><td>${row.note ? esc(row.note) : '<span class="empty">—</span>'}</td><td class="sv-td-ref">${refLinks(row.refs)}</td></tr>`,
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

// ─── Layered Technical View band model → HTML (canonical §4 representation) ────

type TvLayer = { key?: string; name?: string; applicable?: boolean; outOfScope?: string; nodes?: string[]; whatLivesHere?: string; keyTech?: string };

function renderTechnicalViewBands(model: Record<string, unknown>): string {
  const m = model as { layers?: TvLayer[]; gaps?: string[] };
  const layers = m.layers ?? [];
  const shown = layers.filter((l) => l.applicable !== false);

  const bands = shown
    .map((l) => {
      const inner = (l.nodes ?? []).length
        ? svList(l.nodes)
        : `<span class="empty">${esc(l.keyTech ?? '—')}</span>`;
      return `<div class="sv-band"><h3 class="sv-band-title">${esc(l.name ?? '')}</h3>${inner}</div>`;
    })
    .join('');

  const rows = layers
    .map((l) => {
      const oos = l.applicable === false;
      const what = oos
        ? `<em>Out of scope — ${esc(l.outOfScope ?? 'not applicable to this project')}</em>`
        : l.whatLivesHere
          ? esc(l.whatLivesHere)
          : '<span class="empty">—</span>';
      const tech = oos ? '—' : esc(l.keyTech ?? '—');
      return `<tr><td class="sv-td-layer">${esc(l.name ?? '')}</td><td>${what}</td><td class="sv-td-ref">${tech}</td></tr>`;
    })
    .join('');
  const table = `<table class="sv-table">
    <thead><tr><th>Layer</th><th>What lives here</th><th>Key technology / pattern</th></tr></thead>
    <tbody>${rows}</tbody></table>`;

  const gaps = m.gaps?.length
    ? `<div class="sv-gaps"><h3 class="sv-band-title">Gaps &amp; assumptions</h3>${svList(m.gaps)}</div>`
    : '';

  return `<div class="sv-bands">
    ${bands}
    <h3 class="sv-band-title" style="margin-top:14px;">The technical layers — what lives in each</h3>
    ${table}
    ${gaps}
  </div>`;
}

// ─── Detailed Component View model → HTML (canonical §5 representation) ────────

type CvComponent = { name?: string; subtext?: string };
type CvLayer = { key?: string; name?: string; applicable?: boolean; outOfScope?: string; pattern?: string; components?: CvComponent[] };
type CvService = { name?: string; dominantConcern?: string; whereKeys?: string[] };

function renderComponentViewBands(model: Record<string, unknown>): string {
  const m = model as { intro?: string; layers?: CvLayer[]; services?: CvService[]; reading?: string[]; gaps?: string[] };
  const shown = (m.layers ?? []).filter((l) => l.applicable !== false);

  const bands = shown
    .map((l) => {
      const banner = l.pattern && l.pattern !== '—' ? `<span class="cv-pattern">${esc(l.pattern)}</span>` : '';
      const comps = (l.components ?? []).length
        ? `<ul class="vlist">${l.components!
            .map((c) => `<li>${esc(c.name ?? '')}${c.subtext ? ` <em>— ${esc(c.subtext)}</em>` : ''}</li>`)
            .join('')}</ul>`
        : `<span class="empty">${esc(l.pattern ?? '—')}</span>`;
      return `<div class="sv-band"><h3 class="sv-band-title">${esc(l.name ?? '')} ${banner}</h3>${comps}</div>`;
    })
    .join('');

  const reading = (m.reading ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">5.1 · Reading the detailed view</h3>${svList(m.reading)}`
    : '';

  // §5.2 table — Service | Dominant concern | Where it lives (links to section anchors).
  const refLink = (key: string) => {
    const n = HLD_SECTION_ORDER.indexOf(key) + 1;
    if (n <= 0) return '';
    return `<a href="#section-${key}">§${n} ${esc(HLD_SECTION_NAMES[key])}</a>`;
  };
  const svcRows = (m.services ?? [])
    .map((s) => {
      const where = (s.whereKeys ?? []).map(refLink).filter(Boolean).join(' · ') || '—';
      return `<tr><td class="sv-td-layer">${esc(s.name ?? '')}</td><td>${esc(s.dominantConcern ?? '—')}</td><td class="sv-td-ref">${where}</td></tr>`;
    })
    .join('');
  const servicesTable = (m.services ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">5.2 · How modules show up in this view</h3>
       <table class="sv-table"><thead><tr><th>Service</th><th>Dominant concern</th><th>Where it lives</th></tr></thead><tbody>${svcRows}</tbody></table>`
    : '';

  const gaps = m.gaps?.length
    ? `<div class="sv-gaps"><h3 class="sv-band-title">Gaps &amp; assumptions</h3>${svList(m.gaps)}</div>`
    : '';

  return `<div class="sv-bands">
    ${m.intro ? `<p class="sv-note">${esc(m.intro)}</p>` : ''}
    ${bands}
    ${reading}
    ${servicesTable}
    ${gaps}
  </div>`;
}

// ─── Architecture Style & Patterns View model → HTML (canonical §6) ───────────

type StTier = { key?: string; name?: string; applicable?: boolean; pattern?: string; components?: { name?: string; subtext?: string }[] };
type StMpTier = { tier?: string; archetype?: string; stack?: string; responsibility?: string; mustHave?: boolean };

function renderStyleViewBands(model: Record<string, unknown>): string {
  const m = model as {
    intro?: string; actors?: string[]; tiers?: StTier[];
    architecturalChoices?: { choice?: string; explicit?: string }[];
    tierPatterns?: { tier?: string; patterns?: string }[];
    modulePattern?: { applicable?: boolean; note?: string; tiers?: StMpTier[]; forcingFunctions?: { service?: string; trigger?: string }[] };
    gaps?: string[];
  };
  const shown = (m.tiers ?? []).filter((t) => t.applicable !== false);

  const actors = (m.actors ?? []).length
    ? `<div class="sv-band"><h3 class="sv-band-title">Actors</h3><p class="sv-sub">${(m.actors ?? []).map((a) => esc(a)).join(' · ')}</p></div>`
    : '';

  const bands = shown
    .map((t) => {
      const banner = t.pattern && t.pattern !== '—' ? `<span class="cv-pattern">${esc(t.pattern)}</span>` : '';
      const comps = (t.components ?? []).length
        ? `<ul class="vlist">${t.components!
            .map((c) => `<li>${esc(c.name ?? '')}${c.subtext ? ` <em>— ${esc(c.subtext)}</em>` : ''}</li>`)
            .join('')}</ul>`
        : '';
      return `<div class="sv-band"><h3 class="sv-band-title">${esc(t.name ?? '')} ${banner}</h3>${comps}</div>`;
    })
    .join('');

  const choices = (m.architecturalChoices ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">6.1 · What this view tells you that the others do not</h3>
       <table class="sv-table"><thead><tr><th>Architectural choice</th><th>What the diagram makes explicit</th></tr></thead>
       <tbody>${(m.architecturalChoices ?? [])
         .map((c) => `<tr><td class="sv-td-layer">${esc(c.choice ?? '')}</td><td>${esc(c.explicit ?? '')}</td></tr>`)
         .join('')}</tbody></table>`
    : '';

  const tps = (m.tierPatterns ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">6.2 · Design patterns visible in this view</h3>
       <table class="sv-table"><thead><tr><th>Tier</th><th>Patterns applied</th></tr></thead>
       <tbody>${(m.tierPatterns ?? [])
         .map((tp) => `<tr><td class="sv-td-layer">${esc(tp.tier ?? '')}</td><td>${esc(tp.patterns ?? '')}</td></tr>`)
         .join('')}</tbody></table>`
    : '';

  const mp = m.modulePattern;
  let mpHtml = '';
  if (mp) {
    const note = mp.note ? `<p class="sv-note">${esc(mp.note)}</p>` : '';
    const mpTable = mp.applicable !== false && (mp.tiers ?? []).length
      ? `<table class="sv-table"><thead><tr><th>Tier</th><th>Service archetype</th><th>Stack</th><th>Responsibility</th></tr></thead>
         <tbody>${(mp.tiers ?? [])
           .map((t) => `<tr><td class="sv-td-layer">${esc(t.tier ?? '')}${t.mustHave ? ' *' : ''}</td><td>${esc(t.archetype ?? '')}</td><td>${esc(t.stack ?? '')}</td><td>${esc(t.responsibility ?? '')}</td></tr>`)
           .join('')}</tbody></table>`
      : '';
    const ffTable = mp.applicable !== false && (mp.forcingFunctions ?? []).length
      ? `<p class="sv-sub" style="margin-top:6px;"><strong>When to break the optional tiers out of M1</strong></p>
         <table class="sv-table"><thead><tr><th>Service to extract</th><th>Forcing function</th></tr></thead>
         <tbody>${(mp.forcingFunctions ?? [])
           .map((f) => `<tr><td class="sv-td-layer">${esc(f.service ?? '')}</td><td>${esc(f.trigger ?? '')}</td></tr>`)
           .join('')}</tbody></table>`
      : '';
    mpHtml = `<h3 class="sv-band-title" style="margin-top:14px;">6.3 · The 3-Tier Module Pattern</h3>${note}${mpTable}${ffTable}`;
  }

  const gaps = m.gaps?.length
    ? `<div class="sv-gaps"><h3 class="sv-band-title">Gaps &amp; assumptions</h3>${svList(m.gaps)}</div>`
    : '';

  return `<div class="sv-bands">
    ${m.intro ? `<p class="sv-note">${esc(m.intro)}</p>` : ''}
    ${actors}
    ${bands}
    ${choices}
    ${tps}
    ${mpHtml}
    ${gaps}
  </div>`;
}

// ─── AWS Deployment View model → HTML (canonical §7) ──────────────────────────

type DvService = { name?: string; abbr?: string; family?: string; subtext?: string };
type DvLayer = {
  key?: string; name?: string; applicable?: boolean; outOfScope?: string;
  services?: DvService[]; subGroups?: { label?: string; services?: DvService[] }[];
};

function renderDeploymentView(model: Record<string, unknown>): string {
  const m = model as {
    intro?: string; cloud?: string; region?: string; account?: string; scopeNote?: string;
    layers?: DvLayer[];
    serviceMapping?: { hldLayer?: string; component?: string; awsService?: string; rationale?: string }[];
    serverless?: { intro?: string; patterns?: { pattern?: string; detail?: string }[]; closing?: string };
    notInView?: { item?: string; reason?: string }[];
    evolution?: { when?: string; added?: string }[];
    gaps?: string[];
  };
  let seed = 0;
  const tile = (s: DvService) => {
    const icon = awsIconSvg(s.family, 36, seed++);
    return `<div class="dv-tile"><div class="dv-ico">${icon}</div><div class="dv-tx"><span class="dv-name">${esc(s.name ?? s.abbr ?? '')}</span>${s.subtext ? `<span class="dv-sub">${esc(s.subtext)}</span>` : ''}</div></div>`;
  };
  const tiles = (services?: DvService[]) =>
    `<div class="dv-row">${(services ?? []).map(tile).join('')}</div>`;

  const shownLayers = (m.layers ?? []).filter((l) => l.applicable !== false);
  const bands = shownLayers
    .map((l) => {
      const inner = l.subGroups?.length
        ? l.subGroups
            .map((g) => `<div class="dv-group"><p class="dv-grp-label">${esc(g.label ?? '')}</p>${tiles(g.services)}</div>`)
            .join('')
        : tiles(l.services);
      return `<div class="dv-band"><h4 class="dv-band-title">${esc(l.name ?? '')}</h4>${inner}</div>`;
    })
    .join('');
  const oos = (m.layers ?? [])
    .filter((l) => l.applicable === false)
    .map((l) => `<p class="dv-oos"><strong>${esc(l.name ?? '')}:</strong> Out of scope${l.outOfScope ? ` — ${esc(l.outOfScope)}` : ''}</p>`)
    .join('');

  // Legend of the families actually used in the diagram.
  const usedFamilies = new Set<string>();
  shownLayers.forEach((l) => {
    (l.services ?? []).forEach((s) => s.family && usedFamilies.add(s.family));
    (l.subGroups ?? []).forEach((g) => (g.services ?? []).forEach((s) => s.family && usedFamilies.add(s.family)));
  });
  const legend = usedFamilies.size
    ? `<div class="dv-legend">${[...usedFamilies]
        .map(
          (f) =>
            `<span class="dv-leg"><span class="dv-leg-ico">${awsIconSvg(f, 16, seed++)}</span>${esc(AWS_FAMILY_LABELS[f as AwsFamily] ?? f)}</span>`,
        )
        .join('')}</div>`
    : '';

  const meta = [m.cloud, m.region ? `Region: ${m.region}` : '', m.account ? `Account: ${m.account}` : '']
    .filter(Boolean)
    .map((x) => esc(x as string))
    .join(' &middot; ');

  const mapping = (m.serviceMapping ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">7.1 &middot; AWS service mapping — HLD layer to AWS service</h3>
       <table class="sv-table"><thead><tr><th>HLD layer</th><th>Component</th><th>AWS service</th><th>Rationale and trade-offs</th></tr></thead>
       <tbody>${(m.serviceMapping ?? [])
         .map((r) => `<tr><td class="sv-td-layer">${esc(r.hldLayer ?? '')}</td><td>${esc(r.component ?? '')}</td><td>${esc(r.awsService ?? '')}</td><td>${esc(r.rationale ?? '')}</td></tr>`)
         .join('')}</tbody></table>`
    : '';

  const sl = m.serverless;
  const serverless = sl
    ? `<h3 class="sv-band-title" style="margin-top:14px;">7.2 &middot; Serverless choices — where Lambda fits</h3>
       ${sl.intro ? `<p class="sv-note">${esc(sl.intro)}</p>` : ''}
       ${(sl.patterns ?? []).length ? `<ul class="vlist">${(sl.patterns ?? []).map((p) => `<li><strong>${esc(p.pattern ?? '')}</strong> — ${esc(p.detail ?? '')}</li>`).join('')}</ul>` : ''}
       ${sl.closing ? `<p class="sv-note">${esc(sl.closing)}</p>` : ''}`
    : '';

  const notIn = (m.notInView ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">7.3 &middot; What is deliberately NOT in this view</h3>
       <ul class="vlist">${(m.notInView ?? []).map((n) => `<li><strong>${esc(n.item ?? '')}</strong> — ${esc(n.reason ?? '')}</li>`).join('')}</ul>`
    : '';

  const evolution = (m.evolution ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">7.4 &middot; How this view evolves</h3>
       <table class="sv-table"><thead><tr><th>When</th><th>What is added to this view</th></tr></thead>
       <tbody>${(m.evolution ?? [])
         .map((e) => `<tr><td class="sv-td-layer">${esc(e.when ?? '')}</td><td>${esc(e.added ?? '')}</td></tr>`)
         .join('')}</tbody></table>`
    : '';

  const gaps = m.gaps?.length
    ? `<div class="sv-gaps"><h3 class="sv-band-title">Gaps &amp; assumptions</h3>${svList(m.gaps)}</div>`
    : '';

  return `<div class="sv-bands">
    ${m.intro ? `<p class="sv-note">${esc(m.intro)}</p>` : ''}
    ${meta ? `<p class="sv-sub"><strong>${meta}</strong></p>` : ''}
    ${m.scopeNote ? `<p class="sv-note">${esc(m.scopeNote)}</p>` : ''}
    ${bands}
    ${legend}
    ${oos}
    ${mapping}
    ${serverless}
    ${notIn}
    ${evolution}
    ${gaps}
  </div>`;
}

// ─── AWS Flow Diagrams → HTML (§7.5, connected reference-architecture views) ───

function renderDeploymentFlows(model: Record<string, unknown>): string {
  const m = model as { diagrams?: FlowDiagramModel[]; consolidated?: FlowDiagramModel };
  const all: FlowDiagramModel[] = [...(m.diagrams ?? [])];
  if (m.consolidated) all.push(m.consolidated);
  if (!all.length) return '';
  const blocks = all
    .map(
      (d) => `<div class="dv-flow"><h4 class="dv-band-title">${esc(d.title ?? 'Flow')}</h4>
        ${d.description ? `<p class="sv-note">${esc(d.description)}</p>` : ''}
        <div class="dv-flow-wrap">${buildFlowDiagramSvg(d)}</div></div>`,
    )
    .join('');
  return `<h3 class="sv-band-title" style="margin-top:14px;">7.5 &middot; AWS flow diagrams</h3>${blocks}`;
}

// ─── Project Structure model → HTML (canonical §17) ───────────────────────────

type PsFolderRef = { folder?: string; poc?: boolean; purpose?: string };

function renderProjectStructure(model: Record<string, unknown>): string {
  const m = model as {
    monorepoLabel?: string;
    groups?: { key?: string; title?: string; items?: string[] }[];
    intro?: string;
    principles?: { principle?: string; how?: string }[];
    backend?: { stack?: string; intro?: string; rootTree?: string; perModuleTree?: string; folderReference?: PsFolderRef[] };
    frontend?: { stack?: string; intro?: string; rootTree?: string; componentRule?: { scope?: string; location?: string; rule?: string }[]; promotionRule?: string };
    aiAgent?: { applicable?: boolean; note?: string; stack?: string; rootTree?: string; folderResponsibilities?: PsFolderRef[]; runtimeInteraction?: string };
    namingConventions?: { concern?: string; convention?: string; examples?: string }[];
    gaps?: string[];
  };
  const tree = (s?: string) => (s ? `<pre class="ps-tree">${esc(s)}</pre>` : '');
  const refTable = (rows?: PsFolderRef[]) =>
    rows?.length
      ? `<table class="sv-table"><thead><tr><th>Folder</th><th>POC</th><th>Purpose</th></tr></thead><tbody>${rows
          .map((r) => `<tr><td class="sv-td-layer">${esc(r.folder ?? '')}</td><td>${r.poc ? '★' : ''}</td><td>${esc(r.purpose ?? '')}</td></tr>`)
          .join('')}</tbody></table>`
      : '';

  const overview = (m.groups ?? []).length
    ? `<div class="sv-band">${(m.groups ?? [])
        .map((g) => `<p class="sv-sub"><strong>${esc(g.title ?? '')}:</strong> ${esc((g.items ?? []).join(' · '))}</p>`)
        .join('')}${m.aiAgent ? `<p class="sv-sub"><strong>AI Agent:</strong> ${m.aiAgent.applicable === false ? `<em>${esc(m.aiAgent.note ?? 'Not applicable')}</em>` : esc(m.aiAgent.note ?? 'applicable')}</p>` : ''}</div>`
    : '';

  const principles = (m.principles ?? []).length
    ? `<table class="sv-table"><thead><tr><th>Principle</th><th>How it shows up in the structure</th></tr></thead><tbody>${(m.principles ?? [])
        .map((p) => `<tr><td class="sv-td-layer">${esc(p.principle ?? '')}</td><td>${esc(p.how ?? '')}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

  const backend = m.backend
    ? `<h3 class="sv-band-title" style="margin-top:14px;">17.1 · Backend project structure${m.backend.stack ? ` (${esc(m.backend.stack)})` : ''}</h3>
       ${m.backend.intro ? `<p class="sv-note">${esc(m.backend.intro)}</p>` : ''}
       ${tree(m.backend.rootTree)}`
    : '';

  const perModule = m.backend && (m.backend.perModuleTree || (m.backend.folderReference ?? []).length)
    ? `<h3 class="sv-band-title" style="margin-top:14px;">17.2 · Per-module structure — apps/[module]-api/</h3>
       ${tree(m.backend.perModuleTree)}${refTable(m.backend.folderReference)}`
    : '';

  const frontend = m.frontend
    ? `<h3 class="sv-band-title" style="margin-top:14px;">17.3 · Frontend project structure${m.frontend.stack ? ` (${esc(m.frontend.stack)})` : ''}</h3>
       ${m.frontend.intro ? `<p class="sv-note">${esc(m.frontend.intro)}</p>` : ''}
       ${tree(m.frontend.rootTree)}
       ${(m.frontend.componentRule ?? []).length ? `<table class="sv-table"><thead><tr><th>Scope</th><th>Location</th><th>Rule</th></tr></thead><tbody>${(m.frontend.componentRule ?? []).map((c) => `<tr><td class="sv-td-layer">${esc(c.scope ?? '')}</td><td>${esc(c.location ?? '')}</td><td>${esc(c.rule ?? '')}</td></tr>`).join('')}</tbody></table>` : ''}
       ${m.frontend.promotionRule ? `<p class="sv-note"><strong>Promotion rule —</strong> ${esc(m.frontend.promotionRule)}</p>` : ''}`
    : '';

  const ai = m.aiAgent
    ? `<h3 class="sv-band-title" style="margin-top:14px;">17.4 · AI Agent project structure${m.aiAgent.applicable !== false && m.aiAgent.stack ? ` (${esc(m.aiAgent.stack)})` : ''}</h3>
       ${m.aiAgent.applicable === false
         ? `<p class="sv-note"><em>${esc(m.aiAgent.note ?? 'Not applicable — no AI agent required.')}</em></p>`
         : `${m.aiAgent.note ? `<p class="sv-note">${esc(m.aiAgent.note)}</p>` : ''}${tree(m.aiAgent.rootTree)}${refTable(m.aiAgent.folderResponsibilities)}${tree(m.aiAgent.runtimeInteraction)}`}`
    : '';

  const naming = (m.namingConventions ?? []).length
    ? `<h3 class="sv-band-title" style="margin-top:14px;">17.5 · Naming conventions across all stacks</h3>
       <table class="sv-table"><thead><tr><th>Concern</th><th>Convention</th><th>Examples</th></tr></thead><tbody>${(m.namingConventions ?? [])
         .map((n) => `<tr><td class="sv-td-layer">${esc(n.concern ?? '')}</td><td>${esc(n.convention ?? '')}</td><td>${esc(n.examples ?? '')}</td></tr>`)
         .join('')}</tbody></table>`
    : '';

  const gaps = m.gaps?.length
    ? `<div class="sv-gaps"><h3 class="sv-band-title">Gaps &amp; assumptions</h3>${svList(m.gaps)}</div>`
    : '';

  return `<div class="sv-bands">
    ${m.monorepoLabel ? `<p class="sv-sub" style="text-align:center;font-weight:600;">${esc(m.monorepoLabel)}</p>` : ''}
    ${overview}
    ${m.intro ? `<p class="sv-note">${esc(m.intro)}</p>` : ''}
    ${principles}
    ${backend}
    ${perModule}
    ${frontend}
    ${ai}
    ${naming}
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
    } else if (key === 'technicalLayersView' && data.technicalView && typeof data.technicalView === 'object') {
      // Band model is the canonical §4 view; legacy free-text layer fields are dropped.
      const rest = body && typeof body === 'object' ? renderSectionBody(body, TECHNICAL_VIEW_LEGACY_FIELDS) : '';
      inner = renderTechnicalViewBands(data.technicalView as Record<string, unknown>) + rest;
    } else if (key === 'componentView' && data.componentView && typeof data.componentView === 'object') {
      // Band model is the canonical §5 view; legacy free-text fields are dropped.
      const rest = body && typeof body === 'object' ? renderSectionBody(body, COMPONENT_VIEW_LEGACY_FIELDS) : '';
      inner = renderComponentViewBands(data.componentView as Record<string, unknown>) + rest;
    } else if (key === 'architectureStyleView' && data.styleView && typeof data.styleView === 'object') {
      // Band model is the canonical §6 view; legacy free-text fields are dropped.
      const rest = body && typeof body === 'object' ? renderSectionBody(body, STYLE_VIEW_LEGACY_FIELDS) : '';
      inner = renderStyleViewBands(data.styleView as Record<string, unknown>) + rest;
    } else if (key === 'deploymentView' && data.deploymentView && typeof data.deploymentView === 'object') {
      // AWS deployment view is the canonical §7 view; legacy free-text fields are dropped.
      const rest = body && typeof body === 'object' ? renderSectionBody(body, DEPLOYMENT_VIEW_LEGACY_FIELDS) : '';
      const flows = data.deploymentFlows && typeof data.deploymentFlows === 'object'
        ? renderDeploymentFlows(data.deploymentFlows as Record<string, unknown>)
        : '';
      inner = renderDeploymentView(data.deploymentView as Record<string, unknown>) + flows + rest;
    } else if (key === 'projectStructure' && data.structureView && typeof data.structureView === 'object') {
      // Structure model is the canonical §17 view; legacy free-text fields are dropped.
      const rest = body && typeof body === 'object' ? renderSectionBody(body, STRUCTURE_VIEW_LEGACY_FIELDS) : '';
      inner = renderProjectStructure(data.structureView as Record<string, unknown>) + rest;
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
    .sv-td-ref a { color:#4F46B5; text-decoration:none; }
    .cv-pattern { font-size:10px; font-style:italic; color:#64748b; font-weight:400; }
    .ps-tree { font-family:'Consolas','Courier New',monospace; font-size:10.5px; line-height:1.45; white-space:pre; overflow-x:auto; background:#f8fafc; border:1px solid #E5E2DD; border-radius:6px; padding:8px 10px; margin:4px 0; }
    /* §7 AWS Deployment View — service-catalogue bands with AWS-style icons */
    .dv-band { margin:0 0 10px 0; padding:8px 10px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc; page-break-inside:avoid; }
    .dv-band-title { font-size:12px; font-weight:700; color:#1e293b; margin:0 0 7px 0; }
    .dv-group { margin:0 0 6px 0; }
    .dv-grp-label { font-size:10.5px; font-weight:600; color:#475569; margin:0 0 4px 0; }
    .dv-row { display:flex; flex-wrap:wrap; gap:7px; }
    .dv-tile { display:flex; align-items:center; gap:6px; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:5px 8px 5px 5px; min-width:118px; }
    .dv-ico { flex:0 0 auto; line-height:0; }
    .dv-tx { display:flex; flex-direction:column; line-height:1.2; }
    .dv-name { font-size:10.5px; font-weight:600; color:#1e293b; }
    .dv-sub { font-size:9px; color:#64748b; }
    .dv-oos { font-size:11px; color:#92400e; margin:2px 0; }
    .dv-legend { display:flex; flex-wrap:wrap; gap:10px; margin:4px 0 6px 0; }
    .dv-leg { display:flex; align-items:center; gap:4px; font-size:9.5px; color:#475569; }
    .dv-leg-ico { line-height:0; }
    /* §7.5 AWS flow diagrams */
    .dv-flow { margin:0 0 14px 0; page-break-inside:avoid; }
    .dv-flow-wrap { overflow-x:auto; }
    .dv-flow-svg { max-width:100%; height:auto; }
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
