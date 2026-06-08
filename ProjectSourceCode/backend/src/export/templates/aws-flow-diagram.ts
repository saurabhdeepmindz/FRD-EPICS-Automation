/**
 * AWS flow-diagram renderer (§7.5) — turns a data-driven flow model into an AWS
 * reference-architecture style SVG: left-to-right tiers as dashed group boxes,
 * real AWS service icons as nodes, elbow connector arrows, and an optional bottom
 * caption bracket. Pure string output (no JS/React) so the SAME renderer drives
 * the on-screen view, the PDF (inline SVG), and — in PR #2 — a rasterized PNG for
 * DOCX. Layout is deterministic and computed here; the AI only supplies the graph
 * (nodes / edges / tiers), never coordinates.
 *
 * NOTE: this file is mirrored in `frontend/lib/aws-flow-diagram.ts` (only the
 * import paths differ), following the repo's shared-logic duplication pattern.
 */

import { AWS_SERVICE_ICONS } from './aws-service-icons';
import { AWS_FAMILY_COLORS, type AwsFamily } from './aws-icons';

export interface FlowNode {
  id: string;
  /** Key into AWS_SERVICE_ICONS (e.g. "s3", "ecs"); falls back to family tile. */
  iconKey?: string;
  /** AWS service-family for the fallback tile colour when iconKey is unknown. */
  family?: string;
  label: string;
  /** Tier this node belongs to; omit / "external" for non-AWS client nodes. */
  tierId?: string;
  kind?: 'aws' | 'external';
}
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}
export interface FlowTier {
  id: string;
  label: string;
}
export interface FlowDiagramModel {
  id?: string;
  title?: string;
  description?: string;
  caption?: string;
  tiers?: FlowTier[];
  nodes?: FlowNode[];
  edges?: FlowEdge[];
}

const ICON = 46;
const NODE_W = 128;
const LABEL_LH = 12;
const LABEL_LINES = 2;
const NODE_H = ICON + 6 + LABEL_LINES * LABEL_LH;
const ROW_GAP = 26;
const COL_GAP = 78;
const EXT_W = 96;
const GROUP_PAD = 16;
const GROUP_LABEL_H = 26;
const MARGIN = 14;
const CAPTION_H = 34;

const C = {
  group: '#94a3b8',
  groupLabel: '#64748b',
  arrow: '#64748b',
  label: '#1e293b',
  edgeLabel: '#64748b',
  extStroke: '#94a3b8',
  extFill: '#475569',
} as const;

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Wrap a label into ≤2 lines (~16 chars/line) on word boundaries. */
function wrap(label: string): string[] {
  const words = (label ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > 16) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
    if (lines.length === LABEL_LINES - 1 && (cur + ' ').length > 16) break;
  }
  if (cur) lines.push(cur);
  if (lines.length > LABEL_LINES) {
    const last = lines.slice(LABEL_LINES - 1).join(' ');
    lines.length = LABEL_LINES - 1;
    lines.push(last.length > 17 ? `${last.slice(0, 16)}…` : last);
  }
  return lines.slice(0, LABEL_LINES);
}

/** Uniquify an icon body's internal ids so multiple icons can share one SVG. */
function uniqIcon(body: string, prefix: string): string {
  const ids = new Set<string>();
  body.replace(/id="([^"]+)"/g, (_m, id: string) => {
    ids.add(id);
    return _m;
  });
  let out = body;
  ids.forEach((id) => {
    const nid = prefix + id;
    out = out
      .split(`id="${id}"`).join(`id="${nid}"`)
      .split(`url(#${id})`).join(`url(#${nid})`)
      .split(`href="#${id}"`).join(`href="#${nid}"`);
  });
  return out;
}

function familyTile(family: string | undefined, x: number, y: number, size: number, idSeed: string): string {
  const fam = (family ?? '') as AwsFamily;
  const [c1, c2] = AWS_FAMILY_COLORS[fam] ?? AWS_FAMILY_COLORS.compute;
  const gid = `ft-${idSeed}`;
  return `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#${gid})"/>`;
}

function iconAt(node: FlowNode, x: number, y: number, idx: number): string {
  const key = (node.iconKey ?? '').toLowerCase();
  const ico = key ? AWS_SERVICE_ICONS[key] : undefined;
  if (ico) {
    return `<svg x="${x}" y="${y}" width="${ICON}" height="${ICON}" viewBox="${ico.vb}">${uniqIcon(ico.body, `n${idx}_`)}</svg>`;
  }
  return familyTile(node.family, x, y, ICON, `n${idx}`);
}

/** External client glyph (browser-style monitor) for non-AWS nodes. */
function extGlyph(x: number, y: number): string {
  const s = ICON;
  return `<g transform="translate(${x},${y})" fill="none" stroke="${C.extFill}" stroke-width="2">
    <rect x="${s * 0.1}" y="${s * 0.12}" width="${s * 0.8}" height="${s * 0.56}" rx="3"/>
    <path d="M${s * 0.35} ${s * 0.85}h${s * 0.3}M${s * 0.5} ${s * 0.68}v${s * 0.17}" stroke-linecap="round"/>
  </g>`;
}

/**
 * Render a flow diagram model to a standalone SVG string (AWS reference-arch style).
 */
export function buildFlowDiagramSvg(model: FlowDiagramModel): string {
  const tiers = model.tiers ?? [];
  const nodes = model.nodes ?? [];
  const edges = model.edges ?? [];
  if (!nodes.length) return '<p class="dv-oos">No flow defined.</p>';

  const externals = nodes.filter((n) => n.kind === 'external' || !n.tierId);
  const tierOrder = tiers.length ? tiers : inferTiers(nodes);
  const columns: { width: number; nodes: FlowNode[]; tier?: FlowTier }[] = [];
  if (externals.length) columns.push({ width: EXT_W, nodes: externals });
  for (const t of tierOrder) {
    const tn = nodes.filter((n) => n.tierId === t.id && n.kind !== 'external');
    if (tn.length) columns.push({ width: NODE_W, nodes: tn, tier: t }); // skip empty tiers (e.g. a Client tier holding only external nodes)
  }

  const colH = (c: { nodes: FlowNode[] }) => c.nodes.length * NODE_H + Math.max(0, c.nodes.length - 1) * ROW_GAP;
  const maxColH = Math.max(0, ...columns.map(colH));
  const contentTop = GROUP_LABEL_H + GROUP_PAD;
  const groupBottom = contentTop + maxColH + GROUP_PAD;

  // Assign positions.
  const pos = new Map<string, { ix: number; iy: number; cx: number; cy: number; idx: number }>();
  let x = MARGIN;
  let idx = 0;
  const colX: number[] = [];
  columns.forEach((col) => {
    colX.push(x);
    const ch = colH(col);
    const top = contentTop + (maxColH - ch) / 2;
    col.nodes.forEach((n, i) => {
      const ny = top + i * (NODE_H + ROW_GAP);
      const ix = x + (col.width - ICON) / 2;
      pos.set(n.id, { ix, iy: ny, cx: ix + ICON / 2, cy: ny + ICON / 2, idx: idx++ });
    });
    x += col.width + COL_GAP;
  });
  const width = x - COL_GAP + MARGIN;
  const height = groupBottom + MARGIN + (model.caption ? CAPTION_H : 0);

  // Group boxes (skip the external column).
  let groups = '';
  columns.forEach((col, ci) => {
    if (!col.tier) return;
    const gx = colX[ci] - GROUP_PAD;
    const gw = col.width + GROUP_PAD * 2;
    groups += `<rect x="${gx}" y="2" width="${gw}" height="${groupBottom - 4}" rx="8" fill="none" stroke="${C.group}" stroke-width="1.2" stroke-dasharray="5 4"/>
      <text x="${gx + gw / 2}" y="18" text-anchor="middle" font-size="12" font-weight="600" fill="${C.groupLabel}">${esc(col.tier.label)}</text>`;
  });

  // Edges (elbow connectors, icon edge to icon edge).
  let edgeSvg = '';
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const sx = a.ix + ICON;
    const sy = a.cy;
    const tx = b.ix;
    const ty = b.cy;
    const midX = sx + Math.max(12, (tx - sx) / 2);
    const d =
      Math.abs(sy - ty) < 1
        ? `M${sx} ${sy} L${tx - 1} ${ty}`
        : `M${sx} ${sy} L${midX} ${sy} L${midX} ${ty} L${tx - 1} ${ty}`;
    edgeSvg += `<path d="${d}" fill="none" stroke="${C.arrow}" stroke-width="1.4" marker-end="url(#dv-arrow)"/>`;
    if (e.label) {
      edgeSvg += `<text x="${midX}" y="${(sy + ty) / 2 - 3}" text-anchor="middle" font-size="9" fill="${C.edgeLabel}">${esc(e.label)}</text>`;
    }
  }

  // Nodes (icon + wrapped label).
  let nodeSvg = '';
  columns.forEach((col) => {
    col.nodes.forEach((n) => {
      const p = pos.get(n.id)!;
      const isExt = n.kind === 'external' || !n.tierId;
      const icon = isExt ? extGlyph(p.ix, p.iy) : iconAt(n, p.ix, p.iy, p.idx);
      const lines = wrap(n.label);
      const labelY = p.iy + ICON + 11;
      const tspans = lines
        .map((ln, li) => `<tspan x="${p.cx}" dy="${li === 0 ? 0 : LABEL_LH}">${esc(ln)}</tspan>`)
        .join('');
      nodeSvg += `${icon}<text x="${p.cx}" y="${labelY}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${C.label}">${tspans}</text>`;
    });
  });

  // Optional bottom caption bracket spanning the tier groups.
  let caption = '';
  if (model.caption) {
    const firstTierCi = columns.findIndex((c) => c.tier);
    const bx1 = colX[firstTierCi] - GROUP_PAD;
    const bx2 = colX[colX.length - 1] + columns[columns.length - 1].width + GROUP_PAD;
    const by = groupBottom + 12;
    caption = `<path d="M${bx1} ${by - 5} L${bx1} ${by} L${bx2} ${by} L${bx2} ${by - 5}" fill="none" stroke="${C.groupLabel}" stroke-width="1.2"/>
      <text x="${(bx1 + bx2) / 2}" y="${by + 18}" text-anchor="middle" font-size="12" font-weight="600" fill="${C.groupLabel}">${esc(model.caption)}</text>`;
  }

  return `<svg class="dv-flow-svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
    <defs><marker id="dv-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${C.arrow}"/></marker></defs>
    ${groups}${edgeSvg}${nodeSvg}${caption}
  </svg>`;
}

/** Derive tier list from the nodes' tierIds (preserves first-seen order). */
function inferTiers(nodes: FlowNode[]): FlowTier[] {
  const seen: string[] = [];
  for (const n of nodes) {
    if (n.tierId && n.kind !== 'external' && !seen.includes(n.tierId)) seen.push(n.tierId);
  }
  return seen.map((id) => ({ id, label: id }));
}
