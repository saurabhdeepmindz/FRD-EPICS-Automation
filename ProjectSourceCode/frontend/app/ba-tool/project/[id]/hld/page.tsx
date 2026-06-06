'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getHld,
  generateHld,
  getDesignSystem,
  getProjectStructure,
  HLD_SECTIONS,
  HLD_DIAGRAM_LABELS,
  type Hld,
  type PrdGap,
  type DiagramLayer,
  type ProjectStructure,
} from '@/lib/pipeline-api';
import { FreshnessBanner } from '@/components/ba-tool/FreshnessBanner';

// Pastel layer palette (mirrors the backend diagramPalette defaults / Design System).
const FALLBACK_PALETTE: Record<'frontend' | 'backend' | 'calcEngine' | 'shared' | 'db' | 'config' | 'node', DiagramLayer> = {
  frontend: { fill: '#ECEBFB', border: '#B9B0EC', text: '#4F46B5' },
  backend: { fill: '#E3F5EC', border: '#A6DCC4', text: '#2F8A60' },
  calcEngine: { fill: '#FBEEDC', border: '#EAC893', text: '#B97A2B' },
  shared: { fill: '#FBE7E4', border: '#ECB2AB', text: '#B24A3C' },
  db: { fill: '#E8F1FB', border: '#ABCAE9', text: '#2F62A6' },
  config: { fill: '#F1F0EC', border: '#D2CFC8', text: '#5C574F' },
  node: { fill: '#F4F3FB', border: '#C9C3E6', text: '#3A3550' },
};

type LayerKey = 'frontend' | 'backend' | 'calcEngine' | 'shared' | 'db' | 'config';

/** Classify a Mermaid node (by id/label keywords) into a pastel layer. */
function layerForNode(text: string): LayerKey {
  const s = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  if (has('postgres', 'postgre', 'redis', 's3', 'gcs', 'database', 'sql', 'mongo', 'bucket', 'cache', 'datastore', 'storage', 'warehouse', 'data layer', 'persistence', 'data')) return 'db';
  if (has('calc', 'engine', 'python', 'fastapi', 'pandas', ' ai', 'ai ', 'ml ', 'worker', 'inference', 'model')) return 'calcEngine';
  if (has('cdn', 'gateway', 'load balancer', 'web app', 'webapp', 'admin portal', 'frontend', 'browser', ' ui', 'next', 'portal', 'client', 'mobile', 'presentation', 'users', 'actor', 'access')) return 'frontend';
  if (has('log', 'monitor', 'sentry', 'observability', 'metrics', 'config', 'terraform', 'docker', 'ci/cd', 'devops', 'grafana', 'prometheus', 'platform', 'infra')) return 'config';
  if (has('shared', 'package', 'library', 'sdk', 'common')) return 'shared';
  return 'backend'; // services / pods / APIs / auth / queues default to backend
}

/** Inject pastel `classDef` + per-node `class` assignments into a Mermaid graph. */
function applyDiagramPalette(src: string, pal: typeof FALLBACK_PALETTE): string {
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
  for (const L of Object.keys(byLayer) as LayerKey[]) {
    const c = pal[L];
    out += `classDef ${L} fill:${c.fill},stroke:${c.border},color:${c.text},stroke-width:1px;\n`;
    out += `class ${byLayer[L].join(',')} ${L};\n`;
  }
  return out;
}

/** HLD section key → its Mermaid diagram key (keys differ slightly). */
const DIAGRAM_FOR_SECTION: Record<string, string> = {
  systemView: 'systemView',
  technicalLayersView: 'technicalLayers',
  componentView: 'componentView',
  architectureStyleView: 'architectureStyle',
  deploymentView: 'deployment',
};

export default function HldPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [hld, setHld] = useState<Hld | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [gaps, setGaps] = useState<PrdGap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>('__diagrams');
  const initedKey = useRef(false);
  const [palette, setPalette] = useState(FALLBACK_PALETTE);
  const [structure, setStructure] = useState<ProjectStructure | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await getHld(projectId);
      setHld(h);
      // v9 KK — pull the project's pastel diagram palette + the derived structure.
      const [ds, st] = await Promise.all([
        getDesignSystem(projectId).catch(() => null),
        h ? getProjectStructure(projectId).catch(() => null) : Promise.resolve(null),
      ]);
      if (ds?.tokens?.diagramPalette) setPalette({ ...FALLBACK_PALETTE, ...ds.tokens.diagramPalette });
      if (st) setStructure(st);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateHld(projectId);
      setGaps(result.gaps);
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Generation failed');
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const diagramKeys = hld ? Object.keys(hld.mermaidDiagrams ?? {}) : [];

  // Land on Diagrams (if any) else the first section, once HLD loads.
  useEffect(() => {
    if (loading || !hld || initedKey.current) return;
    initedKey.current = true;
    setActiveKey(diagramKeys.length ? '__diagrams' : HLD_SECTIONS[0]?.key ?? '__diagrams');
  }, [loading, hld, diagramKeys.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/ba-tool/project/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Project
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">High Level Design (HLD)</h1>
          <p className="text-sm text-gray-500">
            Stage 5 · 17 sections · architecture diagrams
            {hld && ` · v${hld.version} · ${hld.status}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/ba-tool/project/${projectId}/project-prd`}>
            <Button variant="outline" size="sm">← PRD+FRD</Button>
          </Link>
          {hld && (
            <Button size="sm" onClick={onGenerate} disabled={generating}>
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Regenerating…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" /> Regenerate</>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
        <FreshnessBanner projectId={projectId} artifactType="HLD" />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !hld ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-gray-800">No HLD generated yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Generate a 17-section High Level Design with architecture diagrams from your PRD + FRD.
                </p>
              </div>
              <Button onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating (~1–2 min)…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Generate HLD</>
                )}
              </Button>
              <p className="text-xs text-gray-400">Requires a generated PRD + FRD (Stage 2).</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0" />
              Exported to <code className="text-xs">ProjectArtifacts/05-HLD/HLD-v{hld.version}.md</code>
            </div>

            {gaps.length > 0 && (
              <Card className="border-amber-200">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-4 w-4" /> {gaps.length} gaps flagged
                  </p>
                  <ul className="space-y-1">
                    {gaps.map((g, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        <span className="font-mono">§{g.section}</span> — {g.question}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
              {/* Left section menu */}
              <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto space-y-1 pr-1">
                {diagramKeys.length > 0 && (
                  <button
                    onClick={() => setActiveKey('__diagrams')}
                    className={`w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${activeKey === '__diagrams' ? 'border-gray-900 bg-white font-medium text-gray-900' : 'border-transparent text-gray-600 hover:bg-white hover:border-gray-200'}`}
                  >
                    <Network className="h-4 w-4 shrink-0" /> Architecture Diagrams
                    <span className="ml-auto text-[10px] text-gray-400">{diagramKeys.length}</span>
                  </button>
                )}
                <div className="pt-1">
                  {HLD_SECTIONS.map((s, i) => {
                    const has = !!hld.sections[s.key];
                    const isActive = activeKey === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActiveKey(s.key)}
                        className={`w-full text-left flex items-start gap-2 rounded-lg px-3 py-2 text-sm border ${isActive ? 'border-gray-900 bg-white font-medium text-gray-900' : 'border-transparent text-gray-600 hover:bg-white hover:border-gray-200'}`}
                      >
                        <span className="text-xs font-mono text-gray-400 w-5 shrink-0 mt-0.5">{i + 1}</span>
                        <span className="min-w-0">{s.name}</span>
                        {!has && <span className="ml-auto text-[10px] text-gray-300 shrink-0">—</span>}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Active panel */}
              <div className="min-w-0">
                {activeKey === '__diagrams' ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <Network className="h-4 w-4" /> Architecture Diagrams
                    </h2>
                    {diagramKeys.map((dk) => (
                      <Card key={dk}>
                        <CardContent className="p-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">{HLD_DIAGRAM_LABELS[dk] ?? dk}</p>
                          <Mermaid content={hld.mermaidDiagrams[dk]} palette={palette} />
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                ) : (
                  (() => {
                    const idx = HLD_SECTIONS.findIndex((s) => s.key === activeKey);
                    const sec = HLD_SECTIONS[idx];
                    if (!sec) return null;
                    const body = hld.sections[sec.key] as Record<string, unknown> | undefined;
                    return (
                      <section className="space-y-3">
                        <h2 className="font-semibold text-gray-900 flex items-baseline gap-2">
                          <span className="text-sm font-mono text-gray-400">{idx + 1}</span> {sec.name}
                        </h2>
                        {/* v9 KK — pastel project-structure diagram in §17 */}
                        {sec.key === 'projectStructure' && structure && (
                          <ProjectStructureDiagram structure={structure} palette={palette} />
                        )}
                        {/* v9 MM — render this section's architecture diagram inline (if any) */}
                        {DIAGRAM_FOR_SECTION[sec.key] && hld.mermaidDiagrams?.[DIAGRAM_FOR_SECTION[sec.key]] && (
                          <Card>
                            <CardContent className="p-4">
                              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Network className="h-4 w-4" /> {HLD_DIAGRAM_LABELS[DIAGRAM_FOR_SECTION[sec.key]] ?? 'Diagram'}
                              </p>
                              <Mermaid content={hld.mermaidDiagrams[DIAGRAM_FOR_SECTION[sec.key]]} palette={palette} />
                            </CardContent>
                          </Card>
                        )}
                        <Card>
                          <CardContent className="p-4">
                            {!body ? (
                              <p className="text-sm text-gray-400">Not generated.</p>
                            ) : (
                              <dl className="space-y-3">
                                {Object.entries(body).map(([k, v]) => (
                                  <div key={k}>
                                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                      {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                                    </dt>
                                    <dd className="text-sm text-gray-700 mt-0.5">{renderValue(v)}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </CardContent>
                        </Card>
                      </section>
                    );
                  })()
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Value renderers ─────────────────────────────────────────────────────────

function AiText({ value }: { value: string }) {
  const isAi = value.startsWith('[AI] ');
  const text = isAi ? value.slice(5) : value;
  return (
    <span>
      {isAi && (
        <span className="text-[9px] uppercase bg-purple-100 text-purple-600 rounded px-1 py-0.5 mr-1 align-middle">
          AI
        </span>
      )}
      <span className="whitespace-pre-wrap">{text}</span>
    </span>
  );
}

function renderValue(value: unknown): ReactNode {
  if (value == null) return <span className="text-gray-400">—</span>;
  if (typeof value === 'string') return <AiText value={value} />;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return (
    <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ─── Mermaid renderer (dynamic import; pastel theme; falls back to source) ────

type Palette = typeof FALLBACK_PALETTE;

function Mermaid({ content, palette }: { content: string; palette: Palette }) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        // v9 KK — pastel theme derived from the project's diagram palette.
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          themeVariables: {
            fontFamily: 'Inter, system-ui, sans-serif',
            primaryColor: palette.frontend.fill,
            primaryBorderColor: palette.frontend.border,
            primaryTextColor: palette.node.text,
            secondaryColor: palette.backend.fill,
            tertiaryColor: palette.calcEngine.fill,
            lineColor: palette.node.border,
            clusterBkg: '#FBFAFE',
            clusterBorder: palette.node.border,
            nodeBorder: palette.node.border,
            mainBkg: palette.node.fill,
            titleColor: palette.node.text,
            edgeLabelBackground: '#FFFFFF',
          },
        });
        // Inject per-layer pastel classes so nodes are colored (not uniform).
        const themed = applyDiagramPalette(content, palette);
        const { svg } = await mermaid.render(`hld-${id}`, themed);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Mermaid render failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, id, palette]);

  if (error) {
    return (
      <pre className="text-xs bg-amber-50 border border-amber-200 rounded p-2 overflow-x-auto text-amber-800">
        {content}
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-xs py-6 justify-center">
        <Loader2 className="h-3 w-3 animate-spin" /> Rendering diagram…
      </div>
    );
  }
  return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ─── Pastel project-structure diagram (v9 Track KK) ──────────────────────────

function ProjectStructureDiagram({ structure, palette }: { structure: ProjectStructure; palette: Palette }) {
  const legend: [keyof Palette, string][] = [
    ['frontend', 'Frontend'], ['backend', 'Backend'], ['calcEngine', 'Calc Engine'],
    ['shared', 'Shared Pkgs'], ['db', 'DB Tables'], ['config', 'Config / Files'],
  ];
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="text-center text-sm text-gray-500">
          monorepo root — <span className="font-medium text-gray-700">{structure.productName}</span>
        </div>
        {structure.groups.map((g) => {
          const c = palette[g.layer] ?? palette.node;
          return (
            <div key={g.key}>
              <div className="text-sm font-semibold mb-2" style={{ color: c.text }}>{g.title}</div>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it, i) => (
                  <span
                    key={i}
                    className="text-xs rounded-md px-2.5 py-1.5 border"
                    style={{ background: c.fill, borderColor: c.border, color: c.text }}
                  >
                    {it.name}
                    {it.note ? <span className="opacity-60"> · {it.note}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-3 pt-3 border-t">
          {legend.map(([k, label]) => {
            const c = palette[k];
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-3 w-3 rounded-sm border" style={{ background: c.fill, borderColor: c.border }} />
                {label}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
