'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  Pencil,
  Eye,
  Download,
  FileText,
  FileType,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getHld,
  generateHld,
  getDesignSystem,
  getProjectStructure,
  getHldMarkdown,
  hldPdfUrl,
  hldDocxUrl,
  HLD_SECTIONS,
  HLD_DIAGRAM_LABELS,
  type Hld,
  type PrdGap,
  type ProjectStructure,
} from '@/lib/pipeline-api';
import { FreshnessBanner } from '@/components/ba-tool/FreshnessBanner';
import { HldMermaid } from '@/components/ba-tool/HldMermaid';
import { HldPreview } from '@/components/ba-tool/HldPreview';
import { HldSectionEditor } from '@/components/ba-tool/HldSectionEditor';
import { HldCopilot } from '@/components/ba-tool/HldCopilot';
import { FALLBACK_PALETTE, DIAGRAM_FOR_SECTION, type DiagramPalette } from '@/lib/hld-diagram';

type View = 'diagrams' | 'edit' | 'preview';

export default function HldV2Page() {
  const params = useParams();
  const projectId = params.id as string;

  const [hld, setHld] = useState<Hld | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [gaps, setGaps] = useState<PrdGap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>('__diagrams');
  const [view, setView] = useState<View>('diagrams');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const initedKey = useRef(false);
  const [palette, setPalette] = useState<DiagramPalette>(FALLBACK_PALETTE);
  const [structure, setStructure] = useState<ProjectStructure | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await getHld(projectId);
      setHld(h);
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
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Generation failed'),
      );
    } finally {
      setGenerating(false);
    }
  };

  const diagramKeys = hld ? Object.keys(hld.mermaidDiagrams ?? {}).filter((k) => hld.mermaidDiagrams[k]?.trim()) : [];

  useEffect(() => {
    if (loading || !hld || initedKey.current) return;
    initedKey.current = true;
    setActiveKey(diagramKeys.length ? '__diagrams' : HLD_SECTIONS[0]?.key ?? '__diagrams');
  }, [loading, hld, diagramKeys.length]);

  // Entering Edit needs a real section (not the diagrams pseudo-entry).
  const enterEdit = () => {
    if (activeKey === '__diagrams') setActiveKey(HLD_SECTIONS[0]?.key ?? '__diagrams');
    setView('edit');
  };

  const editIndex = HLD_SECTIONS.findIndex((s) => s.key === activeKey);
  const editSection = HLD_SECTIONS[editIndex];

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
          <h1 className="text-lg font-semibold text-gray-900">
            High Level Design (HLD) — Enhanced
          </h1>
          <p className="text-sm text-gray-500">
            Stage 5 · 17 sections · architecture diagrams
            {hld && ` · v${hld.version} · ${hld.status}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hld && (
            <>
              <div className="flex items-center rounded-lg border overflow-hidden">
                <ToggleBtn active={view === 'diagrams'} onClick={() => setView('diagrams')}>
                  <Network className="h-4 w-4 mr-1" /> Diagrams
                </ToggleBtn>
                <ToggleBtn active={view === 'edit'} onClick={enterEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </ToggleBtn>
                <ToggleBtn active={view === 'preview'} onClick={() => setView('preview')}>
                  <Eye className="h-4 w-4 mr-1" /> Preview
                </ToggleBtn>
              </div>
              <DownloadMenu
                projectId={projectId}
                hldId={hld.id}
                onError={setError}
              />
              <Button
                variant={copilotOpen ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCopilotOpen((o) => !o)}
                title="Architect Copilot — per-section AI research"
              >
                <Sparkles className="h-4 w-4 mr-1" /> Copilot
              </Button>
              <Button size="sm" onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Regenerating…</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Regenerate</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
        <FreshnessBanner projectId={projectId} artifactType="HLD" />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
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

            {/* ─── PREVIEW ─── */}
            {view === 'preview' ? (
              <HldPreview hld={hld} palette={palette} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
                {/* Left section menu */}
                <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto space-y-1 pr-1">
                  {view === 'diagrams' && diagramKeys.length > 0 && (
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
                  {view === 'edit' && editSection ? (
                    <HldSectionEditor
                      key={editSection.key}
                      projectId={projectId}
                      hldId={hld.id}
                      sectionKey={editSection.key}
                      sectionName={editSection.name}
                      body={hld.sections[editSection.key] as Record<string, unknown> | undefined}
                      onSaved={async () => {
                        await load();
                        setView('diagrams');
                      }}
                      onCancel={() => setView('diagrams')}
                    />
                  ) : activeKey === '__diagrams' ? (
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <Network className="h-4 w-4" /> Architecture Diagrams
                      </h2>
                      {diagramKeys.map((dk) => (
                        <Card key={dk}>
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">{HLD_DIAGRAM_LABELS[dk] ?? dk}</p>
                            <HldMermaid content={hld.mermaidDiagrams[dk]} palette={palette} />
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
                      const diagKey = DIAGRAM_FOR_SECTION[sec.key];
                      return (
                        <section className="space-y-3">
                          <h2 className="font-semibold text-gray-900 flex items-baseline gap-2">
                            <span className="text-sm font-mono text-gray-400">{idx + 1}</span> {sec.name}
                          </h2>
                          {sec.key === 'projectStructure' && structure && (
                            <ProjectStructureDiagram structure={structure} palette={palette} />
                          )}
                          {diagKey && hld.mermaidDiagrams?.[diagKey] && (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                  <Network className="h-4 w-4" /> {HLD_DIAGRAM_LABELS[diagKey] ?? 'Diagram'}
                                </p>
                                <HldMermaid content={hld.mermaidDiagrams[diagKey]} palette={palette} />
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
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => setView('edit')}>
                              <Pencil className="h-4 w-4 mr-1" /> Edit this section
                            </Button>
                          </div>
                        </section>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Architect Copilot drawer (Track C) */}
      {copilotOpen && hld && (() => {
        const ck = activeKey === '__diagrams' ? HLD_SECTIONS[0]?.key ?? 'documentControl' : activeKey;
        const cs = HLD_SECTIONS.find((s) => s.key === ck);
        return (
          <HldCopilot
            projectId={projectId}
            hldId={hld.id}
            sectionKey={ck}
            sectionName={cs?.name ?? ck}
            currentBody={hld.sections[ck] as Record<string, unknown> | undefined}
            onApplied={load}
            onClose={() => setCopilotOpen(false)}
          />
        );
      })()}
    </div>
  );
}

// ─── Header toggle button ────────────────────────────────────────────────────

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-1.5 text-sm border-r last:border-r-0 ${active ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}

// ─── Download menu (PDF / DOCX / MD) ─────────────────────────────────────────

function DownloadMenu({
  projectId,
  hldId,
  onError,
}: {
  projectId: string;
  hldId: string;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const downloadFile = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setOpen(false);
  };

  const downloadMd = async () => {
    try {
      const res = await getHldMarkdown(projectId);
      if (!res) return;
      const blob = new Blob([res.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HLD-v${res.version}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Download className="h-4 w-4 mr-1" /> Download <ChevronDown className="h-3.5 w-3.5 ml-1" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-44 bg-white border rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={() => downloadFile(hldPdfUrl(projectId, hldId))}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 text-red-500" /> PDF
            </button>
            <button
              onClick={() => downloadFile(hldDocxUrl(projectId, hldId))}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileType className="h-4 w-4 text-blue-500" /> DOCX
            </button>
            <button
              onClick={downloadMd}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4 text-gray-500" /> Markdown (.md)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Read-only value renderer (browse view) ──────────────────────────────────

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
    <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
  );
}

// ─── Pastel project-structure diagram (mirrors legacy /hld) ───────────────────

function ProjectStructureDiagram({ structure, palette }: { structure: ProjectStructure; palette: DiagramPalette }) {
  const legend: [keyof DiagramPalette, string][] = [
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
