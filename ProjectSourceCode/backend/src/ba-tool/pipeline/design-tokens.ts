/**
 * Design tokens (Sprint v9 · Track BB) — the canonical "look & feel" model and the
 * single `tokensToCss()` mapping shared by the Studio live-preview, the lo-fi
 * generator, the hi-fi prompt, and the wireframe navigator. Keeping ONE token→CSS
 * function guarantees the preview cannot drift from the generated output.
 *
 * Dependency-free (no Nest/Prisma) so it is reusable and unit-testable.
 * Shape is lifted from the user's reference wireframe `:root` block.
 */

/** One diagram layer's pastel triple (box fill, border, label text). */
export interface DiagramLayer {
  fill: string;
  border: string;
  text: string;
}

export interface DesignTokens {
  brand: {
    productName: string;
    primary: string;
    cta: string;
    ctaHover: string;
    surface: string;
  };
  neutral: {
    bgPage: string;
    bgSoft: string;
    textPrimary: string;
    textMuted: string;
    textSubtle: string;
    border: string;
    borderMedium: string;
  };
  semantic: {
    success: string;
    warning: string;
    danger: string;
    info: string;
    teal: string;
    purple: string;
  };
  /** Per-module accent colors. `auto` → deterministic wheel; `manual` → use `colors`. */
  modulePalette: {
    mode: 'auto' | 'manual';
    colors: Record<string, string>;
  };
  personaPalette: {
    employee: string;
    manager: string;
    hrAdmin: string;
    finance: string;
    admin: string;
    visitor: string;
  };
  /** Pastel layer palette for architecture + project-structure diagrams (v9 KK). */
  diagramPalette: {
    frontend: DiagramLayer;
    backend: DiagramLayer;
    calcEngine: DiagramLayer;
    shared: DiagramLayer;
    db: DiagramLayer;
    config: DiagramLayer;
    node: DiagramLayer;
  };
  typography: {
    uiFont: string;
    monoFont: string;
    baseSize: number; // px
    weightNormal: number;
    weightBold: number;
  };
  shape: {
    radiusCard: number; // px
    radiusPill: number; // px
    density: 'comfortable' | 'compact';
    elevation: 'flat' | 'soft' | 'raised';
  };
  platform: {
    mobileFrameWidth: number; // px (390 in the reference)
    breakpointMobile: number;
    breakpointTablet: number;
    touchTarget: number; // px
  };
}

/** Deterministic accent wheel used when modulePalette.mode === 'auto'. */
export const AUTO_MODULE_WHEEL = [
  '#F97316', '#7C3AED', '#10B981', '#3B82F6', '#EA580C',
  '#0D9488', '#D97706', '#DC2626', '#0284C7', '#14B8A6', '#9333EA',
];

/** Default look & feel — the Deepmindz Navy/Orange from the reference wireframes. */
export const DEFAULT_TOKENS: DesignTokens = {
  brand: { productName: '—', primary: '#0B1B2E', cta: '#F97316', ctaHover: '#FB923C', surface: '#FFFFFF' },
  neutral: {
    bgPage: '#ECEEF2', bgSoft: '#F8FAFC', textPrimary: '#1F2A3A',
    textMuted: '#64748B', textSubtle: '#94A3B8', border: '#E2E8F0', borderMedium: '#CBD5E1',
  },
  semantic: { success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6', teal: '#0D9488', purple: '#7C3AED' },
  modulePalette: { mode: 'auto', colors: {} },
  personaPalette: {
    employee: '#7C3AED', manager: '#0F766E', hrAdmin: '#D97706', finance: '#1D4ED8', admin: '#C2410C', visitor: '#475569',
  },
  // Exact pastels from the reference architecture/structure diagram (v9 KK).
  diagramPalette: {
    frontend:  { fill: '#ECEBFB', border: '#B9B0EC', text: '#4F46B5' },
    backend:   { fill: '#E3F5EC', border: '#A6DCC4', text: '#2F8A60' },
    calcEngine:{ fill: '#FBEEDC', border: '#EAC893', text: '#B97A2B' },
    shared:    { fill: '#FBE7E4', border: '#ECB2AB', text: '#B24A3C' },
    db:        { fill: '#E8F1FB', border: '#ABCAE9', text: '#2F62A6' },
    config:    { fill: '#F1F0EC', border: '#D2CFC8', text: '#5C574F' },
    node:      { fill: '#F4F3FB', border: '#C9C3E6', text: '#3A3550' },
  },
  typography: { uiFont: 'Inter', monoFont: 'JetBrains Mono', baseSize: 14, weightNormal: 400, weightBold: 700 },
  shape: { radiusCard: 12, radiusPill: 999, density: 'comfortable', elevation: 'soft' },
  platform: { mobileFrameWidth: 390, breakpointMobile: 480, breakpointTablet: 980, touchTarget: 44 },
};

/** Deep-merge a (possibly partial) token object onto the defaults. */
export function normalizeTokens(input: unknown): DesignTokens {
  const t = (input ?? {}) as Partial<DesignTokens>;
  const d = DEFAULT_TOKENS;
  return {
    brand: { ...d.brand, ...(t.brand ?? {}) },
    neutral: { ...d.neutral, ...(t.neutral ?? {}) },
    semantic: { ...d.semantic, ...(t.semantic ?? {}) },
    modulePalette: {
      mode: t.modulePalette?.mode === 'manual' ? 'manual' : 'auto',
      colors: { ...(t.modulePalette?.colors ?? {}) },
    },
    personaPalette: { ...d.personaPalette, ...(t.personaPalette ?? {}) },
    diagramPalette: {
      frontend: { ...d.diagramPalette.frontend, ...(t.diagramPalette?.frontend ?? {}) },
      backend: { ...d.diagramPalette.backend, ...(t.diagramPalette?.backend ?? {}) },
      calcEngine: { ...d.diagramPalette.calcEngine, ...(t.diagramPalette?.calcEngine ?? {}) },
      shared: { ...d.diagramPalette.shared, ...(t.diagramPalette?.shared ?? {}) },
      db: { ...d.diagramPalette.db, ...(t.diagramPalette?.db ?? {}) },
      config: { ...d.diagramPalette.config, ...(t.diagramPalette?.config ?? {}) },
      node: { ...d.diagramPalette.node, ...(t.diagramPalette?.node ?? {}) },
    },
    typography: { ...d.typography, ...(t.typography ?? {}) },
    shape: { ...d.shape, ...(t.shape ?? {}) },
    platform: { ...d.platform, ...(t.platform ?? {}) },
  };
}

/** Resolve a module's accent color (manual override → auto wheel by index). */
export function moduleColor(tokens: DesignTokens, moduleKey: string, index: number): string {
  const manual = tokens.modulePalette.colors[moduleKey];
  if (manual) return manual;
  return AUTO_MODULE_WHEEL[index % AUTO_MODULE_WHEEL.length];
}

const DENSITY_PAD: Record<DesignTokens['shape']['density'], string> = {
  comfortable: '16px',
  compact: '10px',
};
const ELEVATION_SHADOW: Record<DesignTokens['shape']['elevation'], string> = {
  flat: 'none',
  soft: '0 2px 8px rgba(0,0,0,.06)',
  raised: '0 8px 24px rgba(0,0,0,.12)',
};

/**
 * The canonical `:root` CSS variables for a token set. EVERY renderer (studio
 * preview, lo-fi, navigator, hi-fi prompt) uses this so output stays consistent.
 */
export function tokensToCss(input: unknown): string {
  const t = normalizeTokens(input);
  return `:root{
  --brand-primary:${t.brand.primary};
  --brand-cta:${t.brand.cta};
  --brand-cta-hover:${t.brand.ctaHover};
  --brand-surface:${t.brand.surface};
  --bg-page:${t.neutral.bgPage};
  --bg-soft:${t.neutral.bgSoft};
  --text-primary:${t.neutral.textPrimary};
  --text-muted:${t.neutral.textMuted};
  --text-subtle:${t.neutral.textSubtle};
  --border:${t.neutral.border};
  --border-medium:${t.neutral.borderMedium};
  --success:${t.semantic.success};
  --warning:${t.semantic.warning};
  --danger:${t.semantic.danger};
  --info:${t.semantic.info};
  --teal:${t.semantic.teal};
  --purple:${t.semantic.purple};
  --persona-employee:${t.personaPalette.employee};
  --persona-manager:${t.personaPalette.manager};
  --persona-hr:${t.personaPalette.hrAdmin};
  --persona-finance:${t.personaPalette.finance};
  --persona-admin:${t.personaPalette.admin};
  --persona-visitor:${t.personaPalette.visitor};
  --layer-frontend-fill:${t.diagramPalette.frontend.fill};--layer-frontend-border:${t.diagramPalette.frontend.border};--layer-frontend-text:${t.diagramPalette.frontend.text};
  --layer-backend-fill:${t.diagramPalette.backend.fill};--layer-backend-border:${t.diagramPalette.backend.border};--layer-backend-text:${t.diagramPalette.backend.text};
  --layer-calc-fill:${t.diagramPalette.calcEngine.fill};--layer-calc-border:${t.diagramPalette.calcEngine.border};--layer-calc-text:${t.diagramPalette.calcEngine.text};
  --layer-shared-fill:${t.diagramPalette.shared.fill};--layer-shared-border:${t.diagramPalette.shared.border};--layer-shared-text:${t.diagramPalette.shared.text};
  --layer-db-fill:${t.diagramPalette.db.fill};--layer-db-border:${t.diagramPalette.db.border};--layer-db-text:${t.diagramPalette.db.text};
  --layer-config-fill:${t.diagramPalette.config.fill};--layer-config-border:${t.diagramPalette.config.border};--layer-config-text:${t.diagramPalette.config.text};
  --ui-font:'${t.typography.uiFont}',-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;
  --mono-font:'${t.typography.monoFont}',ui-monospace,SFMono-Regular,Menlo,monospace;
  --base-size:${t.typography.baseSize}px;
  --weight-normal:${t.typography.weightNormal};
  --weight-bold:${t.typography.weightBold};
  --radius-card:${t.shape.radiusCard}px;
  --radius-pill:${t.shape.radiusPill}px;
  --space:${DENSITY_PAD[t.shape.density]};
  --elevation:${ELEVATION_SHADOW[t.shape.elevation]};
  --mobile-frame-w:${t.platform.mobileFrameWidth}px;
  --touch-target:${t.platform.touchTarget}px;
}`;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Google-fonts link for the two configured fonts (best-effort; degrades gracefully). */
function fontLink(t: DesignTokens): string {
  const fam = (f: string) => f.trim().replace(/\s+/g, '+');
  return `<link href="https://fonts.googleapis.com/css2?family=${fam(t.typography.uiFont)}:wght@400;500;600;700;800&family=${fam(t.typography.monoFont)}:wght@500;700&display=swap" rel="stylesheet">`;
}

/** Optional logo mark (data-URI) or a lettered fallback. */
function logoMark(logo: { dataUri?: string } | null | undefined, productName: string): string {
  if (logo?.dataUri) {
    return `<img src="${esc(logo.dataUri)}" alt="logo" style="width:30px;height:30px;border-radius:8px;object-fit:contain;background:var(--brand-cta)">`;
  }
  const letter = (productName || 'A').trim().charAt(0).toUpperCase();
  return `<div style="width:30px;height:30px;border-radius:8px;background:var(--brand-cta);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${esc(letter)}</div>`;
}

interface SampleOpts {
  platform?: 'web' | 'mobile';
  logo?: { dataUri?: string } | null;
}

/**
 * Deterministic sample screen used by the Studio live preview. Renders a
 * representative dashboard so a UX resource sees the design system applied,
 * for both web and the 390px mobile frame.
 */
export function renderSamplePreview(input: unknown, opts: SampleOpts = {}): string {
  const t = normalizeTokens(input);
  const platform = opts.platform === 'mobile' ? 'mobile' : 'web';
  const product = t.brand.productName && t.brand.productName !== '—' ? t.brand.productName : 'Your Product';
  const css = tokensToCss(t);

  const base = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--ui-font);background:var(--bg-page);color:var(--text-primary);font-size:var(--base-size)}
.card{background:var(--brand-surface);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--elevation)}
.pill{border-radius:var(--radius-pill);font-weight:var(--weight-bold)}
.cta{background:var(--brand-cta);color:#fff;border:none;border-radius:10px;font-weight:var(--weight-bold);cursor:pointer}`;

  if (platform === 'mobile') {
    return `<!doctype html><html><head><meta charset="utf-8">${fontLink(t)}<style>${css}
${base}
body{display:flex;justify-content:center;padding:16px}
.phone{width:var(--mobile-frame-w);min-height:720px;background:#1F2A3A;border-radius:40px;padding:10px}
.screen{background:var(--bg-soft);border-radius:30px;overflow:hidden;min-height:700px;display:flex;flex-direction:column}
.appbar{background:var(--brand-surface);border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;gap:10px}
.appbar h1{font-size:16px;font-weight:var(--weight-bold);color:var(--brand-primary)}
.body{padding:14px;display:flex;flex-direction:column;gap:12px}
.kpi{display:flex;gap:10px}
.kpi .card{flex:1;padding:12px}
.kpi .v{font-size:22px;font-weight:800;color:var(--brand-primary)}
.kpi .l{font-size:11px;color:var(--text-muted)}
.chip{display:inline-block;padding:3px 9px;font-size:11px}
.tabbar{margin-top:auto;background:var(--brand-surface);border-top:1px solid var(--border);display:flex;justify-content:space-around;padding:10px 0}
.tab{font-size:10px;color:var(--text-subtle)}.tab.on{color:var(--brand-cta);font-weight:var(--weight-bold)}
</style></head><body><div class="phone"><div class="screen">
<div class="appbar">${logoMark(opts.logo, product)}<h1>${esc(product)}</h1><span class="chip pill" style="margin-left:auto;background:var(--persona-employee);color:#fff">Employee</span></div>
<div class="body">
<div class="kpi"><div class="card"><div class="v">347</div><div class="l">Headcount</div></div><div class="card"><div class="v" style="color:var(--danger)">12%</div><div class="l">Attrition</div></div></div>
<div class="card" style="padding:12px;border-left:3px solid var(--warning)"><div style="font-size:12px;font-weight:var(--weight-bold)">AI insight</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">3 flight risks flagged this week.</div></div>
<div class="card" style="padding:12px"><div style="font-size:13px;font-weight:var(--weight-bold);margin-bottom:8px">Approvals</div>
<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">Leave · Priya</span><span class="chip pill" style="background:var(--success);color:#fff">Approve</span></div>
<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0"><span style="color:var(--text-muted)">WFH · Vikram</span><span class="chip pill" style="background:var(--warning);color:#fff">Review</span></div></div>
<button class="cta" style="padding:12px">Primary action</button>
</div>
<div class="tabbar"><span class="tab on">Home</span><span class="tab">Tasks</span><span class="tab">Reports</span><span class="tab">Profile</span></div>
</div></div></body></html>`;
  }

  // web
  return `<!doctype html><html><head><meta charset="utf-8">${fontLink(t)}<style>${css}
${base}
.shell{display:grid;grid-template-columns:220px 1fr;min-height:560px}
.side{background:var(--brand-primary);color:#fff;padding:16px}
.side .brand{display:flex;align-items:center;gap:9px;margin-bottom:18px}
.side .brand b{font-size:13px}
.nav{display:flex;flex-direction:column;gap:2px}
.nav a{color:rgba(255,255,255,.8);font-size:13px;padding:8px 10px;border-radius:8px;text-decoration:none}
.nav a.on{background:var(--brand-cta);color:#fff;font-weight:var(--weight-bold)}
.main{padding:24px;background:var(--bg-page)}
.hero{background:linear-gradient(135deg,var(--brand-primary),#1e3a5f);color:#fff;border-radius:var(--radius-card);padding:24px;margin-bottom:18px}
.hero .ey{font-size:11px;font-weight:var(--weight-bold);letter-spacing:1px;color:var(--brand-cta);text-transform:uppercase}
.hero h1{font-size:24px;margin:8px 0}
.kpis{display:flex;gap:12px;margin-bottom:18px}
.kpis .card{flex:1;padding:16px}
.kpis .v{font-size:26px;font-weight:800}
.kpis .l{font-size:12px;color:var(--text-muted)}
.row{display:flex;gap:12px}
.row .card{flex:1;padding:16px}
.h{font-size:14px;font-weight:var(--weight-bold);margin-bottom:10px}
.chip{display:inline-block;padding:3px 9px;font-size:11px;color:#fff}
.cta{padding:9px 16px}
</style></head><body><div class="shell">
<aside class="side"><div class="brand">${logoMark(opts.logo, product)}<b>${esc(product)}</b></div>
<nav class="nav"><a class="on">Dashboard</a><a>Employees</a><a>Leave</a><a>Payroll</a><a>Analytics</a></nav></aside>
<main class="main">
<div class="hero"><div class="ey">${esc(product)}</div><h1>People Dashboard</h1><div style="opacity:.8;font-size:13px">A representative screen rendered from your design system.</div></div>
<div class="kpis"><div class="card"><div class="v" style="color:var(--brand-cta)">347</div><div class="l">Headcount</div></div><div class="card"><div class="v" style="color:var(--danger)">12.4%</div><div class="l">Attrition YTD</div></div><div class="card"><div class="v" style="color:var(--purple)">42</div><div class="l">eNPS</div></div><div class="card"><div class="v" style="color:var(--success)">98%</div><div class="l">Payroll on-time</div></div></div>
<div class="row"><div class="card"><div class="h">Approvals</div>
<div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">Leave · Priya Menon</span><span class="chip pill" style="background:var(--success)">Approve</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">WFH · Vikram Singh</span><span class="chip pill" style="background:var(--warning)">Review</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 0"><span style="color:var(--text-muted)">Expense · Anjali</span><span class="chip pill" style="background:var(--danger)">Reject</span></div>
<button class="cta pill" style="margin-top:12px;border-radius:10px">Open inbox</button></div>
<div class="card"><div class="h">AI insight</div><div style="border-left:3px solid var(--warning);padding:10px 12px;background:var(--bg-soft);border-radius:8px;font-size:13px;color:var(--text-muted)">Engineering attrition risk is spiking — 3 employees above threshold. Recommend skip-level conversations this week.</div>
<div style="display:flex;gap:8px;margin-top:12px"><span class="chip pill" style="background:var(--persona-employee)">Employee</span><span class="chip pill" style="background:var(--persona-manager)">Manager</span><span class="chip pill" style="background:var(--persona-admin)">Admin</span></div></div></div>
</main></div></body></html>`;
}

// ── Reference import (Sprint v9 · Track FF) ──────────────────────────────────
// Derive a token preset from an uploaded reference. HTML/CSS → deterministic
// `:root` variable parse, with a hex-frequency fallback for the brand colors.

const COLOR_RE = /^(#([0-9a-f]{3}|[0-9a-f]{6})|rgb|hsl)/i;

function isColor(v: string | undefined): v is string {
  return !!v && COLOR_RE.test(v.trim());
}

/** Relative luminance of a #rgb/#rrggbb hex (0=black … 1=white). */
function hexLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return 0.5;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Saturation proxy (max-min channel) of a hex — gray ≈ 0. */
function hexSaturation(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return 0;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/**
 * Extract a partial token set from reference HTML/CSS. Prefers `:root` custom
 * properties (exact), and falls back to a hex-frequency heuristic for the brand
 * primary/accent when no usable variables are present.
 */
export function extractTokensFromHtml(html: string): Partial<DesignTokens> {
  const vars: Record<string, string> = {};
  for (const block of html.match(/:root\s*\{[^}]*\}/gi) ?? []) {
    const re = /--([\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) vars[m[1].toLowerCase().trim()] = m[2].trim();
  }
  const pick = (...names: string[]): string | undefined => {
    for (const n of names) if (isColor(vars[n])) return vars[n].trim();
    return undefined;
  };

  const brand: Partial<DesignTokens['brand']> = {};
  const neutral: Partial<DesignTokens['neutral']> = {};
  const semantic: Partial<DesignTokens['semantic']> = {};

  let primary = pick('brand-primary', 'primary', 'color-primary', 'brand', 'navy');
  let cta = pick('brand-cta', 'cta', 'accent', 'color-accent', 'brand-secondary', 'primary-accent');
  const surface = pick('brand-surface', 'surface', 'card', 'white');
  const ctaHover = pick('brand-cta-hover', 'cta-hover', 'accent-hover');
  const bgPage = pick('bg-page', 'bg', 'background', 'page-bg');
  const bgSoft = pick('bg-soft', 'bg-subtle', 'soft-bg', 'muted-bg');
  const textPrimary = pick('text-primary', 'text', 'fg', 'foreground');
  const textMuted = pick('text-muted', 'muted', 'text-secondary');
  const textSubtle = pick('text-subtle', 'subtle', 'text-tertiary');
  const border = pick('border', 'border-subtle', 'divider');
  const success = pick('success', 'green', 'positive', 'ok');
  const warning = pick('warning', 'amber', 'yellow', 'caution');
  const danger = pick('danger', 'red', 'error', 'destructive', 'negative');
  const info = pick('info', 'blue', 'primary-info');
  const teal = pick('teal', 'cyan');
  const purple = pick('purple', 'violet');

  // Fallback: derive brand colors from hex frequency when :root lacked them.
  if (!primary || !cta) {
    const counts = new Map<string, number>();
    for (const hex of html.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
      const k = hex.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
    if (!primary) {
      // most-frequent dark, saturated-or-neutral color reads as a brand primary
      primary = ranked.find((h) => hexLuminance(h) < 0.4) ?? ranked[0];
    }
    if (!cta) {
      cta = ranked.find((h) => hexSaturation(h) > 0.35 && h !== primary) ?? primary;
    }
  }

  if (primary) brand.primary = primary;
  if (cta) brand.cta = cta;
  if (ctaHover) brand.ctaHover = ctaHover;
  if (surface) brand.surface = surface;
  if (bgPage) neutral.bgPage = bgPage;
  if (bgSoft) neutral.bgSoft = bgSoft;
  if (textPrimary) neutral.textPrimary = textPrimary;
  if (textMuted) neutral.textMuted = textMuted;
  if (textSubtle) neutral.textSubtle = textSubtle;
  if (border) neutral.border = border;
  if (success) semantic.success = success;
  if (warning) semantic.warning = warning;
  if (danger) semantic.danger = danger;
  if (info) semantic.info = info;
  if (teal) semantic.teal = teal;
  if (purple) semantic.purple = purple;

  const partial: Partial<DesignTokens> = {};
  if (Object.keys(brand).length) partial.brand = brand as DesignTokens['brand'];
  if (Object.keys(neutral).length) partial.neutral = neutral as DesignTokens['neutral'];
  if (Object.keys(semantic).length) partial.semantic = semantic as DesignTokens['semantic'];
  return partial;
}
