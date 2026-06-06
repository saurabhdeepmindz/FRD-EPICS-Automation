/**
 * Shared HLD diagram helpers (Sprint v10) — pastel per-layer palette + Mermaid
 * classDef injection. Extracted so the new /hld-v2 page + HldPreview reuse one
 * copy; the legacy /hld page keeps its own inline version (left untouched).
 */
import type { DiagramLayer } from './pipeline-api';

export type LayerKey = 'frontend' | 'backend' | 'calcEngine' | 'shared' | 'db' | 'config' | 'node';
export type DiagramPalette = Record<LayerKey, DiagramLayer>;

/** Pastel defaults — mirror the backend diagramPalette / Design System. */
export const FALLBACK_PALETTE: DiagramPalette = {
  frontend: { fill: '#ECEBFB', border: '#B9B0EC', text: '#4F46B5' },
  backend: { fill: '#E3F5EC', border: '#A6DCC4', text: '#2F8A60' },
  calcEngine: { fill: '#FBEEDC', border: '#EAC893', text: '#B97A2B' },
  shared: { fill: '#FBE7E4', border: '#ECB2AB', text: '#B24A3C' },
  db: { fill: '#E8F1FB', border: '#ABCAE9', text: '#2F62A6' },
  config: { fill: '#F1F0EC', border: '#D2CFC8', text: '#5C574F' },
  node: { fill: '#F4F3FB', border: '#C9C3E6', text: '#3A3550' },
};

/** HLD section key → its Mermaid diagram key (keys differ slightly). */
export const DIAGRAM_FOR_SECTION: Record<string, string> = {
  systemView: 'systemView',
  technicalLayersView: 'technicalLayers',
  componentView: 'componentView',
  architectureStyleView: 'architectureStyle',
  deploymentView: 'deployment',
};

type ClassLayer = Exclude<LayerKey, 'node'>;

/** Classify a Mermaid node (by id/label keywords) into a pastel layer. */
export function layerForNode(text: string): ClassLayer {
  const s = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  if (has('postgres', 'postgre', 'redis', 's3', 'gcs', 'database', 'sql', 'mongo', 'bucket', 'cache', 'datastore', 'storage', 'warehouse', 'data layer', 'persistence', 'data')) return 'db';
  if (has('calc', 'engine', 'python', 'fastapi', 'pandas', ' ai', 'ai ', 'ml ', 'worker', 'inference', 'model')) return 'calcEngine';
  if (has('cdn', 'gateway', 'load balancer', 'web app', 'webapp', 'admin portal', 'frontend', 'browser', ' ui', 'next', 'portal', 'client', 'mobile', 'presentation', 'users', 'actor', 'access')) return 'frontend';
  if (has('log', 'monitor', 'sentry', 'observability', 'metrics', 'config', 'terraform', 'docker', 'ci/cd', 'devops', 'grafana', 'prometheus', 'platform', 'infra')) return 'config';
  if (has('shared', 'package', 'library', 'sdk', 'common')) return 'shared';
  return 'backend';
}

/** Inject pastel `classDef` + per-node `class` assignments into a Mermaid graph. */
export function applyDiagramPalette(src: string, pal: DiagramPalette): string {
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
  for (const L of Object.keys(byLayer) as ClassLayer[]) {
    const c = pal[L];
    out += `classDef ${L} fill:${c.fill},stroke:${c.border},color:${c.text},stroke-width:1px;\n`;
    out += `class ${byLayer[L].join(',')} ${L};\n`;
  }
  return out;
}
