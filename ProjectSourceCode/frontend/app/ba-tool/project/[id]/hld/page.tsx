'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Layers,
  Loader2,
  Sparkles,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  FolderOpen,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getHld,
  generateHld,
  HLD_SECTIONS,
  HLD_DIAGRAM_LABELS,
  type Hld,
  type PrdGap,
} from '@/lib/pipeline-api';
import { FreshnessBanner } from '@/components/ba-tool/FreshnessBanner';

export default function HldPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [hld, setHld] = useState<Hld | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [gaps, setGaps] = useState<PrdGap[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHld(await getHld(projectId));
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

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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

            {/* Architecture diagrams */}
            {diagramKeys.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Network className="h-4 w-4" /> Architecture Diagrams
                </h2>
                <div className="space-y-3">
                  {diagramKeys.map((dk) => (
                    <Card key={dk}>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          {HLD_DIAGRAM_LABELS[dk] ?? dk}
                        </p>
                        <Mermaid content={hld.mermaidDiagrams[dk]} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Sections */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" /> Sections
              </h2>
              <div className="space-y-2">
                {HLD_SECTIONS.map((s, i) => (
                  <HldSection
                    key={s.key}
                    num={i + 1}
                    name={s.name}
                    body={hld.sections[s.key] as Record<string, unknown> | undefined}
                    defaultOpen={i < 2}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section renderer ────────────────────────────────────────────────────────

function HldSection({
  num,
  name,
  body,
  defaultOpen,
}: {
  num: number;
  name: string;
  body: Record<string, unknown> | undefined;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs font-mono text-gray-400 w-6 shrink-0">{num}</span>
        <span className="text-sm font-medium text-gray-800">{name}</span>
        <ChevronRight
          className={`h-4 w-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 border-t">
          {!body ? (
            <p className="text-sm text-gray-400 pt-3">Not generated.</p>
          ) : (
            <dl className="pt-3 space-y-3">
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
      )}
    </Card>
  );
}

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

// ─── Mermaid renderer (dynamic import; falls back to source on error) ─────────

function Mermaid({ content }: { content: string }) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        const { svg } = await mermaid.render(`hld-${id}`, content);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Mermaid render failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, id]);

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
