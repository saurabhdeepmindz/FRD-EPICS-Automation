'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  RefreshCw,
  ChevronRight,
  FolderOpen,
  Eye,
  Pencil,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getProjectPrd,
  generateProjectPrd,
  getProjectPrdGaps,
  getProjectPrdMarkdown,
  createCustomerInput,
  PRD_SECTION_NAMES,
  type ProjectPrd,
  type PrdGap,
} from '@/lib/pipeline-api';
import { MicButton } from '@/components/forms/MicButton';
import { PrdGapPanel } from '@/components/ba-tool/PrdGapPanel';
import { PrdSectionEditor } from '@/components/ba-tool/PrdSectionEditor';
import { FrdEditor } from '@/components/ba-tool/FrdEditor';
import { toStructured, fieldText, isAi, isNewItem, isStructuredField } from '@/lib/structured-field';

export default function ProjectPrdPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [prd, setPrd] = useState<ProjectPrd | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [gaps, setGaps] = useState<PrdGap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seedText, setSeedText] = useState('');
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([getProjectPrd(projectId), getProjectPrdGaps(projectId)]);
      setPrd(p);
      setGaps(g);
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
      const result = await generateProjectPrd(projectId);
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

  // U-02 — seed a PRD directly from a quick voice/text note when no inputs exist yet.
  const onSeedGenerate = async () => {
    if (!seedText.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      await createCustomerInput(projectId, {
        inputType: 'TEXT_CONTEXT',
        label: 'Quick-start note',
        text: seedText.trim(),
      });
      const result = await generateProjectPrd(projectId);
      setGaps(result.gaps);
      setSeedText('');
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

  // V-02 — download the canonical PRD as Markdown.
  const onDownloadMd = async () => {
    try {
      const res = await getProjectPrdMarkdown(projectId);
      if (!res) return;
      const blob = new Blob([res.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PRD-FRD-v${res.version}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const sectionKeys = prd
    ? Object.keys(prd.sections).sort((a, b) => Number(a) - Number(b))
    : [];

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
          <h1 className="text-lg font-semibold text-gray-900">Combined PRD + FRD</h1>
          <p className="text-sm text-gray-500">
            Stage 2 · 22 sections · FRD embedded under §6 Functional Requirements
            {prd && ` · v${prd.version} · ${prd.status}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/ba-tool/project/${projectId}/customer-inputs`}>
            <Button variant="outline" size="sm">← Inputs</Button>
          </Link>
          {prd ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView((v) => (v === 'edit' ? 'preview' : 'edit'))}
              >
                {view === 'edit' ? (
                  <><Eye className="h-4 w-4 mr-1" /> Preview</>
                ) : (
                  <><Pencil className="h-4 w-4 mr-1" /> Edit</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onDownloadMd}>
                <Download className="h-4 w-4 mr-1" /> .md
              </Button>
              <Button size="sm" onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Regenerating…</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Regenerate</>
                )}
              </Button>
            </>
          ) : null}
          <Link href={`/ba-tool/project/${projectId}/hld`}>
            <Button variant="outline" size="sm">HLD →</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !prd ? (
          // ── Empty state ──
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-gray-800">No PRD generated yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Generate a combined PRD + FRD from all customer inputs collected in Stage 1.
                </p>
              </div>
              <Button onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating (~1–2 min)…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Generate PRD + FRD</>
                )}
              </Button>
              <p className="text-xs text-gray-400">
                Uses customer inputs added in Stage 1.
              </p>

              {/* U-02 — quick conversational seed (no inputs needed) */}
              <div className="pt-4 mt-2 border-t text-left">
                <p className="text-xs font-medium text-gray-500 mb-2 text-center">
                  — or start from a quick note (type or narrate) —
                </p>
                <div className="flex items-start gap-2">
                  <textarea
                    value={seedText}
                    onChange={(e) => setSeedText(e.target.value)}
                    rows={4}
                    placeholder="Describe the product / requirements in your own words, or click the mic to narrate…"
                    className="flex-1 text-sm border rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    disabled={generating}
                  />
                  <MicButton
                    size="md"
                    onTranscribed={(t) => setSeedText((prev) => (prev ? `${prev} ${t}` : t))}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={onSeedGenerate} disabled={generating || !seedText.trim()}>
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-1" /> Narrate &amp; Generate PRD</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Export note */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0" />
              Exported to <code className="text-xs">ProjectArtifacts/02-PRD-FRD/PRD-FRD-v{prd.version}.md</code>
            </div>

            {/* Gap-answering loop (S-06) — answer in-place to enrich the PRD (edit view only) */}
            {view === 'edit' && gaps.length > 0 && (
              <PrdGapPanel
                key={`${prd.version}-${gaps.length}`}
                projectId={projectId}
                gaps={gaps}
                onAnswered={load}
              />
            )}

            {view === 'preview' ? (
              /* V-01 — canonical rendered document */
              <PrdPreview sections={prd.sections} sectionKeys={sectionKeys} />
            ) : (
              /* Editable sections (V-03 — editor always shown when a section is open) */
              <div className="space-y-2">
                {sectionKeys.map((key) => (
                  <PrdSection
                    key={key}
                    num={key}
                    name={PRD_SECTION_NAMES[key] ?? `Section ${key}`}
                    body={prd.sections[key]}
                    defaultOpen={key === '6'}
                    projectId={projectId}
                    prdId={prd.id}
                    onSaved={load}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section renderer ────────────────────────────────────────────────────────

function PrdSection({
  num,
  name,
  body,
  defaultOpen,
  projectId,
  prdId,
  onSaved,
}: {
  num: string;
  name: string;
  body: Record<string, unknown>;
  defaultOpen?: boolean;
  projectId: string;
  prdId: string;
  onSaved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const isFrd = num === '6';

  // V-03 — when a section is open it shows the editor directly (AI Suggest always
  // visible), matching the original always-editable form. Collapsing discards
  // unsaved edits for that section.
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs font-mono text-gray-400 w-6 shrink-0">{num}</span>
        <span className={`text-sm font-medium ${isFrd ? 'text-blue-700' : 'text-gray-800'}`}>
          {name}
        </span>
        {isFrd && (
          <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
            FRD
          </span>
        )}
        <ChevronRight
          className={`h-4 w-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 border-t">
          {isFrd ? (
            <FrdEditor
              projectId={projectId}
              prdId={prdId}
              body={body}
              onSaved={onSaved}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <PrdSectionEditor
              projectId={projectId}
              prdId={prdId}
              sectionKey={num}
              body={body}
              onSaved={onSaved}
              onCancel={() => setOpen(false)}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Canonical preview (V-01) — full read-only rendered document ──────────────

function PrdPreview({
  sections,
  sectionKeys,
}: {
  sections: Record<string, Record<string, unknown>>;
  sectionKeys: string[];
}) {
  return (
    <Card>
      <CardContent className="py-6 space-y-6">
        <div className="text-center border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-900">Product Requirements Document (PRD + FRD)</h2>
          <p className="text-xs text-gray-400 mt-1">Canonical view · 22 sections · §6 = FRD</p>
        </div>
        {sectionKeys.map((key) => {
          const isFrd = key === '6';
          return (
            <section key={key}>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                <span className="font-mono text-gray-400 mr-2">{key}.</span>
                {PRD_SECTION_NAMES[key] ?? `Section ${key}`}
                {isFrd && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                    FRD
                  </span>
                )}
              </h3>
              {isFrd ? <FrdView body={sections[key]} /> : <GenericView body={sections[key]} />}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Renders a field value (flat string or structured field): AI text blue, edits in ink. */
function FieldValue({ raw }: { raw: unknown }) {
  const f = toStructured(raw);
  const ai = isAi(f);
  const isNew = isNewItem(f);
  return (
    <span>
      {ai && (
        <span className="text-[9px] uppercase bg-blue-100 text-blue-600 rounded px-1 py-0.5 mr-1 align-middle">
          AI
        </span>
      )}
      {isNew && (
        <span className="text-[9px] uppercase bg-emerald-100 text-emerald-700 rounded px-1 py-0.5 mr-1 align-middle">
          NEW
        </span>
      )}
      <span className={`whitespace-pre-wrap ${ai ? 'text-blue-700' : ''}`}>{fieldText(f)}</span>
    </span>
  );
}

function renderValue(value: unknown): ReactNode {
  if (value == null) return <span className="text-gray-400">—</span>;
  if (typeof value === 'string' || isStructuredField(value)) return <FieldValue raw={value} />;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // arrays / objects → compact JSON
  return (
    <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function GenericView({ body }: { body: Record<string, unknown> }) {
  const entries = Object.entries(body);
  if (!entries.length) return <p className="text-sm text-gray-400 pt-3">Empty.</p>;
  return (
    <dl className="pt-3 space-y-3">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {k.replace(/_/g, ' ')}
          </dt>
          <dd className="text-sm text-gray-700 mt-0.5">{renderValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface FrdFeature {
  featureId?: string;
  featureName?: string;
  description?: string;
  businessRule?: string;
  acceptanceCriteria?: string;
  priority?: string;
}

/** Section 6 — group the `6.N_*` keys into modules with feature tables. */
function FrdView({ body }: { body: Record<string, unknown> }) {
  const modules: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(body)) {
    const m = k.match(/^(6\.\d+)_(.+)$/);
    if (!m) continue;
    const [, mod, field] = m;
    (modules[mod] ??= {})[field] = v;
  }
  const modKeys = Object.keys(modules).sort();
  if (!modKeys.length) return <GenericView body={body} />;

  return (
    <div className="pt-3 space-y-5">
      {modKeys.map((mk) => {
        const mod = modules[mk];
        const features = (mod.features as FrdFeature[] | undefined) ?? [];
        return (
          <div key={mk} className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-blue-600">{mod.moduleId as string}</span>
              <span className="text-sm font-semibold text-gray-800">
                {mod.moduleName as string}
              </span>
            </div>
            {mod.moduleDescription != null && (
              <p className="text-xs text-gray-500 mb-2">{renderValue(mod.moduleDescription)}</p>
            )}
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="bg-gray-50 rounded p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-500">{f.featureId}</span>
                    <span className="font-medium text-gray-800">
                      <FieldValue raw={f.featureName} />
                    </span>
                    {f.priority != null && f.priority !== '' && (
                      <span className="ml-auto text-[10px] bg-white border rounded px-1.5 py-0.5 text-gray-600">
                        {typeof f.priority === 'string' ? f.priority : JSON.stringify(f.priority)}
                      </span>
                    )}
                  </div>
                  {f.description != null && (
                    <p className="text-gray-600">
                      <FieldValue raw={f.description} />
                    </p>
                  )}
                  {f.businessRule != null && (
                    <p className="text-gray-500">
                      <span className="font-semibold">Rule: </span>
                      <FieldValue raw={f.businessRule} />
                    </p>
                  )}
                  {f.acceptanceCriteria != null && (
                    <p className="text-gray-500">
                      <span className="font-semibold">AC: </span>
                      <FieldValue raw={f.acceptanceCriteria} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
