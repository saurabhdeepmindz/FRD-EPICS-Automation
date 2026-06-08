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
  ChevronRight,
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
  SYSTEM_VIEW_LEGACY_FIELDS,
  TECHNICAL_VIEW_LEGACY_FIELDS,
  COMPONENT_VIEW_LEGACY_FIELDS,
  STYLE_VIEW_LEGACY_FIELDS,
  DEPLOYMENT_VIEW_LEGACY_FIELDS,
  DEPLOYMENT_SUBSECTIONS,
  STRUCTURE_VIEW_LEGACY_FIELDS,
  STRUCTURE_SUBSECTIONS,
  type Hld,
  type PrdGap,
  type ProjectStructure,
} from '@/lib/pipeline-api';
import { FreshnessBanner } from '@/components/ba-tool/FreshnessBanner';
import { HldMermaid } from '@/components/ba-tool/HldMermaid';
import { HldPreview } from '@/components/ba-tool/HldPreview';
import { HldSectionEditor } from '@/components/ba-tool/HldSectionEditor';
import { HldCopilot } from '@/components/ba-tool/HldCopilot';
import { HldSystemViewPanel } from '@/components/ba-tool/HldSystemViewPanel';
import { HldTechnicalViewPanel } from '@/components/ba-tool/HldTechnicalViewPanel';
import { HldComponentViewPanel } from '@/components/ba-tool/HldComponentViewPanel';
import { HldStyleViewPanel } from '@/components/ba-tool/HldStyleViewPanel';
import { HldDeploymentViewPanel } from '@/components/ba-tool/HldDeploymentViewPanel';
import { HldProjectStructurePanel } from '@/components/ba-tool/HldProjectStructurePanel';
import { Markdown } from '@/components/ba-tool/Markdown';
import { FALLBACK_PALETTE, DIAGRAM_FOR_SECTION, type DiagramPalette } from '@/lib/hld-diagram';

type View = 'diagrams' | 'edit' | 'preview';

export default function HldPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [hld, setHld] = useState<Hld | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [gaps, setGaps] = useState<PrdGap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>('__diagrams');
  // Focused sub-heading (field) within the active section — drives the Copilot scope.
  const [activeField, setActiveField] = useState<string | null>(null);
  // Left-menu sections expanded to show their sub-headings (field keys).
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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

  // §3/§4/§5/§6 now render as band diagrams (not Mermaid).
  const bandDiagramKeys = new Set(['systemView', 'technicalLayers', 'componentView', 'architectureStyle']);
  const diagramKeys = hld
    ? Object.keys(hld.mermaidDiagrams ?? {}).filter((k) => hld.mermaidDiagrams[k]?.trim() && !bandDiagramKeys.has(k))
    : [];
  // Diagrams not tied to a section (those shown inline) — for the Preview nav entry.
  const mappedDiagramSet = new Set(HLD_SECTIONS.map((s) => DIAGRAM_FOR_SECTION[s.key]).filter(Boolean));
  const unmappedDiagramKeys = diagramKeys.filter((k) => !mappedDiagramSet.has(k));

  const scrollToPreview = (key: string) => {
    document.getElementById(`prev-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  // Sub-headings of a section = its body field keys (humanized in the menu).
  // For §3 the band diagram is canonical, so legacy free-text layer fields are
  // excluded — the menu matches what's actually rendered.
  const fieldsForSection = (key: string): string[] => {
    const body = hld?.sections?.[key] as Record<string, unknown> | undefined;
    if (!body) return [];
    const keys = Object.keys(body);
    if (key === 'systemView') return keys.filter((k) => !SYSTEM_VIEW_LEGACY_FIELDS.includes(k));
    if (key === 'technicalLayersView') return keys.filter((k) => !TECHNICAL_VIEW_LEGACY_FIELDS.includes(k));
    if (key === 'componentView') return keys.filter((k) => !COMPONENT_VIEW_LEGACY_FIELDS.includes(k));
    if (key === 'architectureStyleView') return keys.filter((k) => !STYLE_VIEW_LEGACY_FIELDS.includes(k));
    if (key === 'deploymentView') return keys.filter((k) => !DEPLOYMENT_VIEW_LEGACY_FIELDS.includes(k));
    if (key === 'projectStructure') return keys.filter((k) => !STRUCTURE_VIEW_LEGACY_FIELDS.includes(k));
    return keys;
  };

  const selectSection = (key: string) => {
    setActiveKey(key);
    setActiveField(null);
  };
  const selectField = (sectionKey: string, fieldKey: string) => {
    setActiveKey(sectionKey);
    setActiveField(fieldKey);
  };
  const toggleExpand = (key: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // §17 sub-section nav: select Project Structure, then scroll to the sub-anchor.
  const scrollToStruct = (id: string) => {
    selectSection('projectStructure');
    setTimeout(() => document.getElementById(`struct-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // §7 sub-section nav: select Deployment View, then scroll to the sub-anchor.
  const scrollToDeploy = (id: string) => {
    selectSection('deploymentView');
    setTimeout(() => document.getElementById(`deploy-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // The focused sub-heading's content (string/JSON) for grounding the Copilot.
  const activeFieldContent: string | null = (() => {
    if (!activeField || activeKey === '__diagrams') return null;
    const body = hld?.sections?.[activeKey] as Record<string, unknown> | undefined;
    const v = body?.[activeField];
    if (v == null) return '';
    if (typeof v === 'string') return v.startsWith('[AI] ') ? v.slice(5) : v;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  })();

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
            High Level Design (HLD)
          </h1>
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

            {/* ─── PREVIEW (PRD-style: left nav jumps to anchors) ─── */}
            {view === 'preview' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
                <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto space-y-1 pr-1">
                  <div className="pt-1">
                    {HLD_SECTIONS.map((s, i) => (
                      <button
                        key={s.key}
                        onClick={() => scrollToPreview(s.key)}
                        className="w-full text-left flex items-start gap-2 rounded-lg px-3 py-2 text-sm border border-transparent text-gray-600 hover:bg-white hover:border-gray-200"
                      >
                        <span className="text-xs font-mono text-gray-400 w-5 shrink-0 mt-0.5">{i + 1}</span>
                        <span className="min-w-0">{s.name}</span>
                        {!hld.sections[s.key] && <span className="ml-auto text-[10px] text-gray-300 shrink-0">—</span>}
                      </button>
                    ))}
                    {unmappedDiagramKeys.length > 0 && (
                      <button
                        onClick={() => scrollToPreview('__diagrams')}
                        className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm border border-transparent text-gray-600 hover:bg-white hover:border-gray-200"
                      >
                        <Network className="h-4 w-4 shrink-0" /> Architecture Diagrams
                      </button>
                    )}
                  </div>
                </aside>
                <div className="min-w-0">
                  <HldPreview hld={hld} palette={palette} structure={structure} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
                {/* Left section menu */}
                <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto space-y-1 pr-1">
                  {view === 'diagrams' && diagramKeys.length > 0 && (
                    <button
                      onClick={() => selectSection('__diagrams')}
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
                      const subFields = fieldsForSection(s.key);
                      const isExpanded = expandedSections.has(s.key);
                      return (
                        <div key={s.key}>
                          <div
                            className={`w-full flex items-stretch gap-1 rounded-lg border ${isActive ? 'border-gray-900 bg-white text-gray-900' : 'border-transparent text-gray-600 hover:bg-white hover:border-gray-200'}`}
                          >
                            <button
                              onClick={() => selectSection(s.key)}
                              className={`flex-1 min-w-0 text-left flex items-start gap-2 px-3 py-2 text-sm ${isActive && !activeField ? 'font-medium' : ''}`}
                            >
                              <span className="text-xs font-mono text-gray-400 w-5 shrink-0 mt-0.5">{i + 1}</span>
                              <span className="min-w-0">{s.name}</span>
                              {!has && <span className="ml-auto text-[10px] text-gray-300 shrink-0">—</span>}
                            </button>
                            {(subFields.length > 0 || s.key === 'projectStructure' || s.key === 'deploymentView') && (
                              <button
                                onClick={() => toggleExpand(s.key)}
                                className="px-1.5 text-gray-400 hover:text-gray-700 shrink-0"
                                title={isExpanded ? 'Collapse sub-headings' : 'Expand sub-headings'}
                                aria-label={isExpanded ? 'Collapse sub-headings' : 'Expand sub-headings'}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                          {/* §17 — fixed sub-section nav (17.1–17.5) scrolling to the panel anchors */}
                          {isExpanded && s.key === 'projectStructure' && (
                            <div className="ml-7 mt-0.5 mb-1 border-l border-gray-200 pl-1.5 space-y-0.5">
                              {STRUCTURE_SUBSECTIONS.map((ss) => (
                                <button
                                  key={ss.id}
                                  onClick={() => scrollToStruct(ss.id)}
                                  className="w-full text-left rounded-md px-2.5 py-1.5 text-xs border border-transparent text-gray-500 hover:bg-white hover:border-gray-200"
                                >
                                  {ss.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* §7 — fixed sub-section nav (7, 7.1–7.4) scrolling to the panel anchors */}
                          {isExpanded && s.key === 'deploymentView' && (
                            <div className="ml-7 mt-0.5 mb-1 border-l border-gray-200 pl-1.5 space-y-0.5">
                              {DEPLOYMENT_SUBSECTIONS.map((ss) => (
                                <button
                                  key={ss.id}
                                  onClick={() => scrollToDeploy(ss.id)}
                                  className="w-full text-left rounded-md px-2.5 py-1.5 text-xs border border-transparent text-gray-500 hover:bg-white hover:border-gray-200"
                                >
                                  {ss.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {isExpanded && s.key !== 'projectStructure' && s.key !== 'deploymentView' && subFields.length > 0 && (
                            <div className="ml-7 mt-0.5 mb-1 border-l border-gray-200 pl-1.5 space-y-0.5">
                              {subFields.map((fk) => {
                                const fieldActive = isActive && activeField === fk;
                                return (
                                  <button
                                    key={fk}
                                    onClick={() => selectField(s.key, fk)}
                                    className={`w-full text-left rounded-md px-2.5 py-1.5 text-xs border ${fieldActive ? 'border-purple-300 bg-purple-50 text-purple-800 font-medium' : 'border-transparent text-gray-500 hover:bg-white hover:border-gray-200'}`}
                                  >
                                    {humanizeField(fk)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
                      activeFieldKey={activeField}
                      onFieldFocus={(fk) => setActiveField(fk)}
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
                      // §3/§4/§5/§6 render as band diagrams (canonical); hide legacy free-text fields + mermaid.
                      const isBandSection =
                        sec.key === 'systemView' ||
                        sec.key === 'technicalLayersView' ||
                        sec.key === 'componentView' ||
                        sec.key === 'architectureStyleView' ||
                        sec.key === 'deploymentView' ||
                        sec.key === 'projectStructure';
                      const bodyEntries = body
                        ? Object.entries(body).filter(([k]) => {
                            if (sec.key === 'systemView') return !SYSTEM_VIEW_LEGACY_FIELDS.includes(k);
                            if (sec.key === 'technicalLayersView') return !TECHNICAL_VIEW_LEGACY_FIELDS.includes(k);
                            if (sec.key === 'componentView') return !COMPONENT_VIEW_LEGACY_FIELDS.includes(k);
                            if (sec.key === 'architectureStyleView') return !STYLE_VIEW_LEGACY_FIELDS.includes(k);
                            if (sec.key === 'deploymentView') return !DEPLOYMENT_VIEW_LEGACY_FIELDS.includes(k);
                            if (sec.key === 'projectStructure') return !STRUCTURE_VIEW_LEGACY_FIELDS.includes(k);
                            return true;
                          })
                        : [];
                      return (
                        <section className="space-y-3">
                          <h2 className="font-semibold text-gray-900 flex items-baseline gap-2">
                            <span className="text-sm font-mono text-gray-400">{idx + 1}</span> {sec.name}
                          </h2>
                          {sec.key === 'projectStructure' && (
                            <HldProjectStructurePanel projectId={projectId} hldId={hld.id} />
                          )}
                          {sec.key === 'systemView' && (
                            <HldSystemViewPanel projectId={projectId} hldId={hld.id} onNavigateSection={selectSection} />
                          )}
                          {sec.key === 'technicalLayersView' && (
                            <HldTechnicalViewPanel projectId={projectId} hldId={hld.id} />
                          )}
                          {sec.key === 'componentView' && (
                            <HldComponentViewPanel projectId={projectId} hldId={hld.id} onNavigateSection={selectSection} />
                          )}
                          {sec.key === 'architectureStyleView' && (
                            <HldStyleViewPanel projectId={projectId} hldId={hld.id} />
                          )}
                          {sec.key === 'deploymentView' && (
                            <HldDeploymentViewPanel projectId={projectId} hldId={hld.id} />
                          )}
                          {diagKey && hld.mermaidDiagrams?.[diagKey] && !isBandSection && (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                  <Network className="h-4 w-4" /> {HLD_DIAGRAM_LABELS[diagKey] ?? 'Diagram'}
                                </p>
                                <HldMermaid content={hld.mermaidDiagrams[diagKey]} palette={palette} />
                              </CardContent>
                            </Card>
                          )}
                          {(bodyEntries.length > 0 || !isBandSection) && (
                            <Card>
                              <CardContent className="p-4">
                                {!body ? (
                                  <p className="text-sm text-gray-400">Not generated.</p>
                                ) : bodyEntries.length === 0 ? (
                                  <p className="text-sm text-gray-400">Shown in the diagram above.</p>
                                ) : (
                                  <dl className="space-y-3">
                                    {bodyEntries.map(([k, v]) => (
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
                          )}
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
        // Only forward the focused sub-heading when it belongs to the active section.
        const fk = activeKey === ck ? activeField : null;
        return (
          <HldCopilot
            projectId={projectId}
            hldId={hld.id}
            sectionKey={ck}
            sectionName={cs?.name ?? ck}
            currentBody={hld.sections[ck] as Record<string, unknown> | undefined}
            fieldKey={fk}
            fieldName={fk ? humanizeField(fk) : null}
            fieldContent={fk ? activeFieldContent : null}
            onApplied={load}
            onClose={() => setCopilotOpen(false)}
          />
        );
      })()}
    </div>
  );
}

// Humanize a section field key into a readable sub-heading label.
function humanizeField(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
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

function renderValue(value: unknown): ReactNode {
  if (value == null || value === '') return <span className="text-gray-400">—</span>;
  if (typeof value === 'string') {
    const isAi = value.startsWith('[AI] ');
    const text = isAi ? value.slice(5) : value;
    return (
      <div>
        {isAi && (
          <span className="text-[9px] uppercase bg-purple-100 text-purple-600 rounded px-1 py-0.5 mr-1 align-middle">
            AI
          </span>
        )}
        <Markdown className="inline-block w-full align-top">{text}</Markdown>
      </div>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((v, i) => (
          <li key={i}>{renderValue(v)}</li>
        ))}
      </ul>
    );
  }
  return (
    <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
  );
}
