'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, Loader2, Save, Rocket, Upload, Plus, AlertTriangle, FileText, Eye, Download,
  Sparkles, User as UserIcon, FlaskConical, Network,
} from 'lucide-react';
import {
  getLldConfig,
  saveLldConfig,
  generateLld,
  getLld,
  listLldsForModule,
  listMasterData,
  createMasterDataEntry,
  dedupeCheck,
  uploadTemplate,
  getBaModule,
  downloadUnitTestsZip,
  downloadContractTestsZip,
  CATEGORY_LABELS,
  type BaLldConfig,
  type BaMasterDataCategory,
  type BaMasterDataEntry,
  type BaModule,
  type BaModuleStatus,
  type LldConfigBundle,
  type LldBundle,
  type LldArtifactSummary,
  type FuzzyMatchCandidate,
} from '@/lib/ba-api';
import { pushToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ba-tool/MarkdownRenderer';
import { LldNarrativeCard } from '@/components/ba-tool/LldNarrativeCard';

const TECH_STACK_ROWS: Array<{ key: keyof BaLldConfig & string; category: BaMasterDataCategory; label: string }> = [
  { key: 'frontendStackId', category: 'FRONTEND_STACK',  label: CATEGORY_LABELS.FRONTEND_STACK },
  { key: 'backendStackId',  category: 'BACKEND_STACK',   label: CATEGORY_LABELS.BACKEND_STACK },
  { key: 'databaseId',      category: 'DATABASE',        label: CATEGORY_LABELS.DATABASE },
  { key: 'streamingId',     category: 'STREAMING',       label: CATEGORY_LABELS.STREAMING },
  { key: 'cachingId',       category: 'CACHING',         label: CATEGORY_LABELS.CACHING },
  { key: 'storageId',       category: 'STORAGE',         label: CATEGORY_LABELS.STORAGE },
  { key: 'cloudId',         category: 'CLOUD',           label: CATEGORY_LABELS.CLOUD },
  { key: 'architectureId',  category: 'ARCHITECTURE',    label: CATEGORY_LABELS.ARCHITECTURE },
];

const TEMPLATE_ROWS: Array<{ key: keyof BaLldConfig & string; category: BaMasterDataCategory; label: string }> = [
  { key: 'projectStructureId', category: 'PROJECT_STRUCTURE', label: CATEGORY_LABELS.PROJECT_STRUCTURE },
  { key: 'backendTemplateId',  category: 'BACKEND_TEMPLATE',  label: CATEGORY_LABELS.BACKEND_TEMPLATE },
  { key: 'frontendTemplateId', category: 'FRONTEND_TEMPLATE', label: CATEGORY_LABELS.FRONTEND_TEMPLATE },
  { key: 'lldTemplateId',      category: 'LLD_TEMPLATE',      label: CATEGORY_LABELS.LLD_TEMPLATE },
  { key: 'codingGuidelinesId', category: 'CODING_GUIDELINES', label: CATEGORY_LABELS.CODING_GUIDELINES },
];

const DEFAULT_NFR_KEYS = ['Scalability', 'Security', 'Performance', 'Responsive'] as const;

export default function LldConfiguratorPage() {
  const params = useParams<{ id: string; moduleId: string }>();
  const router = useRouter();
  const { id: projectId, moduleId: moduleDbId } = params;

  const [bundle, setBundle] = useState<LldConfigBundle | null>(null);
  const [mod, setMod] = useState<BaModule | null>(null);
  const [entriesByCategory, setEntriesByCategory] = useState<Record<string, BaMasterDataEntry[]>>({});
  const [lld, setLld] = useState<LldBundle | null>(null);
  const [allLlds, setAllLlds] = useState<LldArtifactSummary[]>([]);
  const [selectedLldId, setSelectedLldId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<BaLldConfig>>({});
  const [nfr, setNfr] = useState<Record<string, string>>({});
  const [cloudServices, setCloudServices] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const [addInline, setAddInline] = useState<{ category: BaMasterDataCategory; label: string } | null>(null);
  const [uploadInline, setUploadInline] = useState<{ category: BaMasterDataCategory; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgBundle, moduleData, lldBundle, lldList] = await Promise.all([
        getLldConfig(moduleDbId),
        getBaModule(moduleDbId),
        getLld(moduleDbId),
        listLldsForModule(moduleDbId),
      ]);
      setBundle(cfgBundle);
      setMod(moduleData);
      setLld(lldBundle);
      setAllLlds(lldList);
      // Default the selector to the current LLD, else the newest
      const preferred = lldList.find((l) => l.isCurrent)?.id ?? lldList[0]?.id ?? '';
      setSelectedLldId((prev) => prev || preferred);
      const cfg = cfgBundle.config;
      if (cfg) {
        setForm(cfg);
        setNfr((cfg.nfrValues ?? {}) as Record<string, string>);
        setCloudServices(cfg.cloudServices ?? '');
        setCustomNotes(cfg.customNotes ?? '');
      }
      // Preload all 13 categories so every dropdown has its options
      const allCats: BaMasterDataCategory[] = [
        ...TECH_STACK_ROWS.map((r) => r.category),
        ...TEMPLATE_ROWS.map((r) => r.category),
      ];
      const loadedPairs = await Promise.all(
        allCats.map(async (c) => [c, await listMasterData(c, projectId)] as const),
      );
      const byCat: Record<string, BaMasterDataEntry[]> = {};
      for (const [c, entries] of loadedPairs) byCat[c] = entries;
      setEntriesByCategory(byCat);
      setError(null);
    } catch (e) {
      // Surface module-not-found (404) as a clear message with the offending id
      const axErr = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (axErr?.response?.status === 404) {
        setError(`Module not found (id: ${moduleDbId}). The URL may be stale — return to the project and re-open the module.`);
      } else {
        setError(axErr?.response?.data?.message ?? axErr?.message ?? 'Failed to load LLD config');
      }
    } finally {
      setLoading(false);
    }
  }, [moduleDbId, projectId]);

  useEffect(() => { load(); }, [load]);

  const canGenerate = useMemo(() => {
    if (!mod) return false;
    const s: BaModuleStatus = mod.moduleStatus;
    return s === 'EPICS_COMPLETE' || s === 'STORIES_COMPLETE' || s === 'SUBTASKS_COMPLETE' || s === 'APPROVED';
  }, [mod]);

  const hasStories = mod?.skillExecutions?.some((e) => e.skillName === 'SKILL-04' && (e.status === 'APPROVED' || e.status === 'AWAITING_REVIEW' || e.status === 'COMPLETED')) ?? false;
  const hasSubtasks = mod?.skillExecutions?.some((e) => e.skillName === 'SKILL-05' && (e.status === 'APPROVED' || e.status === 'AWAITING_REVIEW' || e.status === 'COMPLETED')) ?? false;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveLldConfig(moduleDbId, {
        ...form,
        cloudServices: cloudServices || null,
        customNotes: customNotes || null,
        nfrValues: Object.keys(nfr).length > 0 ? nfr : null,
      });
      await load();
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [moduleDbId, form, cloudServices, customNotes, nfr, load]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      alert('LLD requires EPICs to be complete for this module.');
      return;
    }
    setGenerating(true);
    try {
      await handleSave();
      await generateLld(moduleDbId);
      alert('LLD generation started. This may take a minute or two. Reload the page to see the result.');
      setTimeout(() => load(), 500);
    } catch (e) {
      alert(`Generate failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, moduleDbId, handleSave, load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading LLD configurator…</span>
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-destructive max-w-md">{error ?? 'Module not found'}</p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/ba-tool/project/${projectId}`}>Back to Project</Link>
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>Previous page</Button>
        </div>
      </div>
    );
  }

  const lldArtifactId = bundle?.lldArtifactId ?? null;

  return (
    <div className="min-h-screen bg-background" data-testid="lld-configurator-page">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/ba-tool/project/${projectId}/module/${moduleDbId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Module
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">AI LLD Workbench</h1>
            <p className="text-xs text-muted-foreground">
              {mod.moduleId} — {mod.moduleName} · Status: {mod.moduleStatus.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lldArtifactId && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/ba-tool/preview/artifact/${lldArtifactId}?back=/ba-tool/project/${projectId}/module/${moduleDbId}/lld`} target="_blank">
                  <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const artifactId = lld?.artifact?.artifactId ?? 'lld';
                  const t = pushToast({ title: 'Building unit-test ZIP…', variant: 'loading' });
                  try {
                    await downloadUnitTestsZip(lldArtifactId, `${artifactId}-unit-tests.zip`);
                    t.update({ title: 'Unit tests exported', description: 'Check your downloads folder.', variant: 'success' });
                  } catch (err) {
                    t.update({ title: 'Unit test export failed', description: err instanceof Error ? err.message : 'unknown', variant: 'destructive' });
                  }
                }}
                title="Generate runnable unit-test scaffolds (pytest / Jest / JUnit) from this LLD's pseudo-code files. Every test starts red; turns green as you implement."
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1" />
                Export Unit Tests
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const artifactId = lld?.artifact?.artifactId ?? 'lld';
                  const t = pushToast({ title: 'Building contract-test ZIP…', variant: 'loading' });
                  try {
                    await downloadContractTestsZip(lldArtifactId, `${artifactId}-contract-tests.zip`);
                    t.update({ title: 'Contract tests exported', description: 'Check UNRESOLVED_CONTRACTS.md inside the ZIP for any orphan consumers.', variant: 'success' });
                  } catch (err) {
                    t.update({ title: 'Contract test export failed', description: err instanceof Error ? err.message : 'unknown', variant: 'destructive' });
                  }
                }}
                title="Detect provider + consumer HTTP endpoints in this LLD and emit contract-test scaffolds (Jest+msw, pytest+respx) plus an OpenAPI stub. Flags orphan consumers that lack a provider."
              >
                <Network className="h-3.5 w-3.5 mr-1" />
                Export Contract Tests
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save selections
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating || !canGenerate}>
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
            {lldArtifactId ? 'Re-generate LLD' : 'Generate LLD'}
          </Button>
        </div>
      </header>

      {!canGenerate && (
        <div className="max-w-4xl mx-auto mt-4 px-6">
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">EPIC generation required</p>
              <p className="text-xs text-amber-800 mt-0.5">
                LLD can only be generated once EPICs are complete for this module. Current status:{' '}
                <strong>{mod.moduleStatus.replace(/_/g, ' ')}</strong>. Run SKILL-02-S (EPIC Generation) from the module workspace first.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Input summary */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Upstream inputs</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <InputBadge label="EPICs" available />
              <InputBadge label="User Stories" available={hasStories} />
              <InputBadge label="SubTasks" available={hasSubtasks} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              LLD consumes EPICs (required) plus User Stories and SubTasks when available. Missing inputs produce a thinner
              LLD — the skill will note this in the <strong>Applied Best-Practice Defaults</strong> section.
            </p>
          </CardContent>
        </Card>

        {/* Architect narrative — optional free-form input with mic/AI/attachments/gap-check */}
        <LldNarrativeCard
          moduleDbId={moduleDbId}
          moduleLabel={mod ? `${mod.moduleId} — ${mod.moduleName}` : moduleDbId}
          initialNarrative={bundle?.config?.narrative ?? ''}
          initialUseAsAdditional={bundle?.config?.useAsAdditional ?? true}
        />

        {/* Tech stack */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Tech Stack</h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              Each dropdown is optional. Leave null to let the AI pick industry defaults and report them in the LLD.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TECH_STACK_ROWS.map((row) => (
                <StackSelect
                  key={row.key}
                  row={row}
                  entries={entriesByCategory[row.category] ?? []}
                  value={(form[row.key] as string | null | undefined) ?? ''}
                  onChange={(v) => setForm((f) => ({ ...f, [row.key]: v || null }))}
                  onAddNew={() => setAddInline({ category: row.category, label: row.label })}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cloud Services */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Cloud Services</h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              Free-text list of cloud-provider services in use. Passed verbatim to the LLD skill.
            </p>
            <textarea
              value={cloudServices}
              onChange={(e) => setCloudServices(e.target.value)}
              placeholder="e.g. Lambda, SQS, DynamoDB, CloudFront, S3"
              rows={3}
              className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </CardContent>
        </Card>

        {/* Templates */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Templates</h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              Organisation-specific templates. Empty by default — upload via the Architect Console, or pick
              <strong> (none — use AI best practices)</strong> to let the skill use industry defaults.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATE_ROWS.map((row) => (
                <TemplateSelect
                  key={row.key}
                  row={row}
                  entries={entriesByCategory[row.category] ?? []}
                  value={(form[row.key] as string | null | undefined) ?? ''}
                  onChange={(v) => setForm((f) => ({ ...f, [row.key]: v || null }))}
                  onUploadNew={() => setUploadInline({ category: row.category, label: row.label })}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* NFR editor */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Non-Functional Requirements</h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              The four default NFR categories are shown. Leave blank to let the AI propose targets. Add custom NFRs below.
            </p>
            <div className="space-y-2">
              {DEFAULT_NFR_KEYS.map((key) => (
                <NfrRow
                  key={key}
                  label={key}
                  value={nfr[key] ?? ''}
                  onChange={(v) => setNfr((n) => ({ ...n, [key]: v }))}
                />
              ))}
              {Object.keys(nfr).filter((k) => !DEFAULT_NFR_KEYS.includes(k as typeof DEFAULT_NFR_KEYS[number])).map((key) => (
                <NfrRow
                  key={key}
                  label={key}
                  value={nfr[key]}
                  onChange={(v) => setNfr((n) => ({ ...n, [key]: v }))}
                  onRemove={() => setNfr((n) => {
                    const next = { ...n };
                    delete next[key];
                    return next;
                  })}
                />
              ))}
              <AddCustomNfrButton onAdd={(name) => setNfr((n) => ({ ...n, [name]: '' }))} />
            </div>
          </CardContent>
        </Card>

        {/* Custom notes */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Additional architect notes (optional)</h3>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Constraints, preferences, or anything the skill should know that's not captured elsewhere."
              rows={4}
              className="w-full rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </CardContent>
        </Card>

        {/* Existing LLDs — always-visible list of all generated LLDs */}
        {allLlds.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">
                  Generated LLDs for this module
                  <span className="ml-2 text-[11px] text-muted-foreground font-normal">({allLlds.length})</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {allLlds.length === 1
                    ? 'One LLD generated so far. Change stacks above and click Re-generate to create a new one — the existing one will be preserved.'
                    : 'Each LLD below was generated under a different stack. Re-generating with a different stack creates a new artifact (the older ones are preserved).'}
                </p>
              </div>

              <div className="space-y-2">
                {allLlds.map((l) => {
                  const isSelected = l.id === selectedLldId;
                  const previewHref = `/ba-tool/preview/artifact/${l.id}?back=/ba-tool/project/${projectId}/module/${moduleDbId}/lld`;
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        'rounded-md border px-3 py-2 transition-colors cursor-pointer',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:bg-muted/30',
                      )}
                      onClick={() => setSelectedLldId(l.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-sm font-mono text-foreground">{l.artifactId}</code>
                            {l.isCurrent && (
                              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                CURRENT
                              </span>
                            )}
                            {isSelected && !l.isCurrent && (
                              <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                SELECTED
                              </span>
                            )}
                            {l.languages.map((lang) => (
                              <span key={lang} className="text-[9px] bg-muted text-foreground px-1.5 py-0.5 rounded font-medium uppercase">
                                {lang}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {l.sectionCount} sections · {l.pseudoFileCount} pseudo-code files · generated {new Date(l.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
                          <Link href={previewHref} target="_blank">
                            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {addInline && (
        <AddInlineDialog
          category={addInline.category}
          label={addInline.label}
          projectId={projectId}
          onClose={() => setAddInline(null)}
          onCreated={(entry) => {
            setAddInline(null);
            load();
            // auto-select the new entry on the matching stack row
            const row = TECH_STACK_ROWS.find((r) => r.category === entry.category);
            if (row) setForm((f) => ({ ...f, [row.key]: entry.id }));
          }}
        />
      )}
      {uploadInline && (
        <UploadInlineDialog
          category={uploadInline.category}
          label={uploadInline.label}
          projectId={projectId}
          onClose={() => setUploadInline(null)}
          onUploaded={(entry) => {
            setUploadInline(null);
            load();
            const row = TEMPLATE_ROWS.find((r) => r.category === entry.category);
            if (row) setForm((f) => ({ ...f, [row.key]: entry.id }));
          }}
        />
      )}
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function InputBadge({ label, available }: { label: string; available: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
      available ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
    )}>
      {available ? '✓' : '–'} {label}
    </span>
  );
}

function StackSelect({ row, entries, value, onChange, onAddNew }: {
  row: { key: string; category: BaMasterDataCategory; label: string };
  entries: BaMasterDataEntry[];
  value: string;
  onChange: (v: string) => void;
  onAddNew: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{row.label}</label>
      <div className="flex gap-2 mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">(none — use AI best practices)</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}{e.scope === 'GLOBAL' ? '' : ' (project)'}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={onAddNew} title="Add new value inline">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TemplateSelect({ row, entries, value, onChange, onUploadNew }: {
  row: { key: string; category: BaMasterDataCategory; label: string };
  entries: BaMasterDataEntry[];
  value: string;
  onChange: (v: string) => void;
  onUploadNew: () => void;
}) {
  const isEmpty = entries.length === 0;
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{row.label}</label>
      <div className="flex gap-2 mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">(none — use AI best practices)</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}{e.scope === 'GLOBAL' ? '' : ' (project)'}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={onUploadNew} title="Upload template">
          <Upload className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isEmpty && (
        <p className="text-[10px] text-muted-foreground mt-1">No templates uploaded yet — click upload.</p>
      )}
    </div>
  );
}

function NfrRow({ label, value, onChange, onRemove }: {
  label: string; value: string; onChange: (v: string) => void; onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-foreground w-32 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Target for ${label.toLowerCase()} (e.g. 10k req/s)`}
        className="flex-1 rounded-md border border-input px-3 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {onRemove && (
        <Button size="sm" variant="ghost" onClick={onRemove} title="Remove custom NFR">✕</Button>
      )}
    </div>
  );
}

function AddCustomNfrButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  if (!adding) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add custom NFR
      </Button>
    );
  }
  return (
    <div className="flex gap-2 items-center pt-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Custom NFR name (e.g. Observability)"
        className="flex-1 rounded-md border border-input px-3 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <Button size="sm" onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(''); setAdding(false); } }}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
    </div>
  );
}

function AddInlineDialog({ category, label, projectId, onClose, onCreated }: {
  category: BaMasterDataCategory; label: string; projectId: string;
  onClose: () => void; onCreated: (entry: BaMasterDataEntry) => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<FuzzyMatchCandidate[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async (force = false) => {
    if (!name.trim() || !value.trim()) return;
    setSaving(true);
    try {
      if (!force) {
        const matches = await dedupeCheck(category, name.trim(), projectId);
        if (matches.length > 0) {
          setSuggestions(matches);
          setSaving(false);
          return;
        }
      }
      const entry = await createMasterDataEntry({
        category, scope: 'PROJECT', projectId,
        name: name.trim(), value: value.trim(), description: description.trim() || undefined,
        force,
      });
      onCreated(entry);
    } catch (err) {
      alert(`Create failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [category, projectId, name, value, description, onCreated]);

  return (
    <Modal title={`Add ${label}`} onClose={onClose}>
      <TextField label="Name *" value={name} onChange={setName} placeholder="e.g. Qwik" />
      <TextField label="Value (canonical id) *" value={value} onChange={setValue} placeholder="e.g. qwik" mono />
      <TextField label="Description" value={description} onChange={setDescription} multiline />
      {suggestions && suggestions.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-2">
          <p className="font-medium">Possible duplicate:</p>
          <ul className="list-disc pl-4">
            {suggestions.map((s) => <li key={s.id}>{s.name} ({s.scope}, distance {s.distance})</li>)}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Use existing</Button>
            <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>Create anyway</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => handleSave(false)} disabled={saving || !name.trim() || !value.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      )}
    </Modal>
  );
}

function UploadInlineDialog({ category, label, projectId, onClose, onUploaded }: {
  category: BaMasterDataCategory; label: string; projectId: string;
  onClose: () => void; onUploaded: (entry: BaMasterDataEntry) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const accept = category === 'PROJECT_STRUCTURE' ? '.zip,application/zip' : '.md,.txt,text/*';

  const submit = useCallback(async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      const { entry } = await uploadTemplate({ file, category, name: name.trim(), description: description.trim() || undefined, scope: 'PROJECT', projectId });
      onUploaded(entry);
    } catch (e) {
      alert(`Upload failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setUploading(false);
    }
  }, [file, name, description, category, projectId, onUploaded]);

  return (
    <Modal title={`Upload ${label}`} onClose={onClose}>
      <TextField label="Template name *" value={name} onChange={setName} placeholder="e.g. Acme LLD v1" />
      <TextField label="Description" value={description} onChange={setDescription} multiline />
      <div>
        <label className="text-xs font-medium text-muted-foreground">File *</label>
        <input
          type="file"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs mt-1"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {category === 'PROJECT_STRUCTURE' ? 'Upload a .zip of your project structure.' : 'Single text file (Markdown recommended). Max 1 MB.'}
        </p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={submit} disabled={uploading || !file || !name.trim()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Upload
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-2xl border border-border w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="px-4 py-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, multiline, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          rows={3} className={cn('w-full mt-1 rounded-md border border-input px-3 py-1.5 text-sm bg-background', mono && 'font-mono text-xs')} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={cn('w-full mt-1 rounded-md border border-input px-3 py-1.5 text-sm bg-background', mono && 'font-mono text-xs')} />
      )}
    </div>
  );
}
