/**
 * Type-aware deterministic lo-fi rendering (Sprint v9 · Track GG · GG-02).
 * Infers a screen archetype from the screen name + annotation titles and renders
 * a distinct grey-box skeleton per type, so lo-fi screens differ structurally
 * (not just by label). Token-driven via the shared `tokensToCss()`. Dependency-free.
 */
import { tokensToCss, type DesignTokens } from './design-tokens';

export type ScreenType = 'auth' | 'checkout' | 'dashboard' | 'list' | 'detail' | 'form' | 'generic';

export interface LoFiAnnotation {
  marker: string | number;
  title: string;
  description: string;
  prdRef?: string;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Classify a single text blob (word-bounded so "list" ≠ "listing"). */
function classifyText(text: string): ScreenType {
  const s = text.toLowerCase();
  const has = (...w: string[]) =>
    w.some((x) => new RegExp(`\\b${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s));
  if (has('checkout', 'payment', 'cart', 'billing', 'place order', 'pay now', 'pay', 'order summary')) return 'checkout';
  if (has('login', 'log in', 'sign in', 'signin', 'register', 'registration', 'sign up', 'signup', 'oauth', 'sso', 'forgot password', 'reset password', 'otp')) return 'auth';
  if (has('dashboard', 'overview', 'analytics', 'metrics', 'insights', 'home', 'landing', 'hub', 'kpi', 'report')) return 'dashboard';
  if (has('list', 'search', 'discovery', 'directory', 'catalog', 'browse', 'results', 'inbox', 'table', 'feed')) return 'list';
  if (has('detail', 'profile', 'summary', 'status', 'view')) return 'detail';
  if (has('form', 'create', 'edit', 'add', 'new', 'setup', 'settings', 'application', 'request', 'onboarding', 'kyc', 'wizard', 'submit')) return 'form';
  return 'generic';
}

/**
 * Infer a screen archetype. The screen NAME is authoritative; annotation titles
 * are only a fallback when the name alone is uninformative (so e.g. a "Landing"
 * screen with an "OAuth" annotation stays a dashboard, not auth).
 */
export function inferScreenType(name: string, annotationTitles: string[] = []): ScreenType {
  const byName = classifyText(name);
  if (byName !== 'generic') return byName;
  return classifyText(`${name} ${annotationTitles.join(' ')}`);
}

const TYPE_LABEL: Record<ScreenType, string> = {
  auth: 'Auth', checkout: 'Checkout', dashboard: 'Dashboard', list: 'List / Search', detail: 'Detail', form: 'Form', generic: 'Screen',
};

// ── per-type skeletons (grey-box, token-tinted) ─────────────────────────────

const ph = (h: number, label = '') => `<div class="ph" style="height:${h}px">${label ? `<span>${esc(label)}</span>` : ''}</div>`;
const line = (w = 100) => `<div class="ln" style="width:${w}%"></div>`;
const btn = (label: string, primary = true) => `<div class="btn ${primary ? 'pri' : 'sec'}">${esc(label)}</div>`;
const inputRow = (label: string) => `<div class="field"><div class="lbl">${esc(label)}</div><div class="inp"></div></div>`;

function skeleton(type: ScreenType, name: string): string {
  switch (type) {
    case 'auth':
      return `<div class="auth"><div class="card">
        <div class="logo"></div>
        <div class="h">${esc(name)}</div>
        ${inputRow('Email')}${inputRow('Password')}
        ${btn('Continue')}
        <div class="or">or</div>
        ${btn('Continue with Google', false)}${btn('Continue with SSO', false)}
      </div></div>`;
    case 'form':
      return `<div class="stack">
        <div class="steps">${[1, 2, 3].map((n) => `<span class="step ${n === 1 ? 'on' : ''}">${n}</span>`).join('')}</div>
        ${['Field A', 'Field B', 'Field C', 'Field D'].map(inputRow).join('')}
        ${ph(80, 'upload / picker')}
        <div class="row end">${btn('Back', false)}${btn('Save & continue')}</div>
      </div>`;
    case 'list':
      return `<div class="stack">
        <div class="searchbar"></div>
        <div class="chips">${[0, 0, 0, 0].map(() => '<span class="chip"></span>').join('')}</div>
        <div class="rows">${Array.from({ length: 5 }).map(() => `<div class="rowcard"><div class="thumb"></div><div class="meta">${line(60)}${line(40)}</div><div class="badge"></div></div>`).join('')}</div>
      </div>`;
    case 'dashboard':
      return `<div class="stack">
        ${ph(96, 'hero / welcome')}
        <div class="kpis">${[0, 0, 0, 0].map(() => `<div class="kpi">${line(40)}${line(70)}</div>`).join('')}</div>
        <div class="row2">${ph(150, 'chart')}${ph(150, 'chart')}</div>
        <div class="rows">${Array.from({ length: 3 }).map(() => `<div class="rowcard"><div class="meta">${line(50)}${line(30)}</div><div class="badge"></div></div>`).join('')}</div>
      </div>`;
    case 'detail':
      return `<div class="stack">
        ${ph(110, 'hero / header')}
        <div class="cols"><div class="main">${[0, 0, 0, 0, 0].map(() => `<div class="field"><div class="lbl"></div><div class="val">${line(80)}</div></div>`).join('')}</div>
        <div class="aside">${ph(70, 'summary')}${btn('Primary action')}${btn('Secondary', false)}</div></div>
      </div>`;
    case 'checkout':
      return `<div class="cols"><div class="main"><div class="h2">Details</div>${['Name', 'Address', 'Card'].map(inputRow).join('')}${btn('Pay now')}</div>
        <div class="aside"><div class="h2">Order summary</div>${Array.from({ length: 3 }).map(() => `<div class="sumrow">${line(60)}<span class="amt"></span></div>`).join('')}<div class="total">${line(40)}<span class="amt big"></span></div></div></div>`;
    default:
      return `<div class="stack">${ph(120, `${name} — lo-fi`)}${line(90)}${line(80)}${line(85)}${ph(80)}</div>`;
  }
}

/** Render a full lo-fi HTML doc for one screen, tinted by the design tokens. */
export function renderLoFi(
  screenName: string,
  screenDescription: string,
  annotations: LoFiAnnotation[],
  tokens?: DesignTokens,
): string {
  const type = inferScreenType(screenName, (annotations ?? []).map((a) => a.title));
  const callouts = (annotations ?? [])
    .map((a) => `<div class="cz"><span class="n">${esc(a.marker)}</span><div class="cb"><b>${esc(a.title)}</b><p>${esc(a.description)}</p>${a.prdRef ? `<small>${esc(a.prdRef)}</small>` : ''}</div></div>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${tokensToCss(tokens)}
*{box-sizing:border-box;font-family:var(--ui-font)}
body{margin:0;background:var(--bg-page);color:var(--text-primary)}
.wf{max-width:900px;margin:0 auto;padding:14px}
.bar{height:44px;background:var(--brand-primary);color:#fff;border-radius:var(--radius-card);display:flex;align-items:center;justify-content:space-between;padding:0 14px;font-weight:var(--weight-bold)}
.bar .tag{font-size:11px;font-weight:600;background:rgba(255,255,255,.18);padding:2px 8px;border-radius:var(--radius-pill)}
.body{margin-top:12px}
.desc{margin:12px 2px;color:var(--text-muted);font-size:13px;line-height:1.5}
.ph{background:var(--bg-soft);border:1px dashed var(--border-medium);border-radius:var(--radius-card);display:flex;align-items:center;justify-content:center;color:var(--text-subtle);font-size:12px;margin-bottom:10px}
.ln{height:10px;background:var(--bg-soft);border:1px solid var(--border);border-radius:6px;margin:6px 0}
.stack>*{margin-bottom:10px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:38px;border-radius:10px;font-size:13px;font-weight:var(--weight-bold);margin:4px 0;width:100%}
.btn.pri{background:var(--brand-cta);color:#fff}.btn.sec{background:var(--brand-surface);border:1px solid var(--border-medium);color:var(--text-primary)}
.field{margin:8px 0}.lbl{height:9px;width:30%;background:var(--bg-soft);border:1px solid var(--border);border-radius:4px;margin-bottom:5px}
.inp{height:34px;background:var(--brand-surface);border:1px solid var(--border-medium);border-radius:8px}
.val{margin-top:2px}
.auth{display:flex;justify-content:center;padding:18px}
.card{background:var(--brand-surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:22px;width:340px;box-shadow:var(--elevation)}
.logo{width:40px;height:40px;border-radius:10px;background:var(--brand-cta);margin:0 auto 12px}
.card .h{text-align:center;font-weight:var(--weight-bold);margin-bottom:14px}
.or{text-align:center;color:var(--text-subtle);font-size:12px;margin:8px 0}
.steps{display:flex;gap:8px;margin-bottom:6px}
.step{width:26px;height:26px;border-radius:50%;background:var(--bg-soft);border:1px solid var(--border-medium);color:var(--text-subtle);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.step.on{background:var(--brand-cta);color:#fff;border-color:var(--brand-cta)}
.row{display:flex;gap:8px}.row.end{justify-content:flex-end}
.searchbar{height:40px;background:var(--brand-surface);border:1px solid var(--border-medium);border-radius:var(--radius-pill)}
.chips{display:flex;gap:8px}.chip{width:64px;height:24px;background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--radius-pill)}
.rows{display:flex;flex-direction:column;gap:8px}
.rowcard{display:flex;align-items:center;gap:12px;background:var(--brand-surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:10px}
.rowcard .thumb{width:54px;height:54px;border-radius:8px;background:var(--bg-soft);border:1px solid var(--border);flex-shrink:0}
.rowcard .meta{flex:1}.rowcard .badge{width:54px;height:22px;border-radius:var(--radius-pill);background:var(--bg-soft);border:1px solid var(--border)}
.kpis{display:flex;gap:10px}.kpi{flex:1;background:var(--brand-surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:12px}
.row2{display:flex;gap:10px}.row2>.ph{flex:1}
.cols{display:flex;gap:12px}.cols .main{flex:2}.cols .aside{flex:1}
.h2{font-size:13px;font-weight:var(--weight-bold);margin-bottom:8px}
.sumrow,.total{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)}
.amt{width:48px;height:10px;background:var(--bg-soft);border:1px solid var(--border);border-radius:4px}.amt.big{height:16px;width:64px}
.total{border-bottom:none;font-weight:var(--weight-bold)}
.callouts{margin-top:14px;border-top:1px dashed var(--border-medium);padding-top:10px}
.cz{display:flex;gap:10px;background:var(--brand-surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:10px;margin:8px 0}
.n{flex:0 0 22px;height:22px;border-radius:50%;background:var(--brand-cta);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:700}
.cb b{font-size:13px;color:var(--text-primary)}.cb p{margin:2px 0;font-size:12px;color:var(--text-muted)}.cb small{color:var(--text-subtle);font-size:11px;font-family:var(--mono-font)}
</style></head><body><div class="wf">
<div class="bar"><span>${esc(screenName)}</span><span class="tag">${TYPE_LABEL[type]} · lo-fi</span></div>
<div class="body">${skeleton(type, screenName)}</div>
<div class="desc">${esc(screenDescription)}</div>
<div class="callouts">${callouts}</div>
</div></body></html>`;
}
