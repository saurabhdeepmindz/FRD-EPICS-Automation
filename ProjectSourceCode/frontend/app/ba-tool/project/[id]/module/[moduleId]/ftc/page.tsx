'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, Loader2, Save, Rocket, AlertTriangle, Sparkles, User as UserIcon, Download,
} from 'lucide-react';
import {
  getFtcConfig,
  saveFtcConfig,
  generateFtc,
  getFtc,
  listFtcsForModule,
  getBaModule,
  downloadFtcCsv,
  type BaFtcConfig,
  type BaModule,
  type FtcConfigBundle,
  type FtcBundle,
  type FtcArtifactSummary,
  type BaTestCase,
} from '@/lib/ba-api';
import { cn } from '@/lib/utils';
import { FtcNarrativeCard } from '@/components/ba-tool/FtcNarrativeCard';
import { MarkdownRenderer } from '@/components/ba-tool/MarkdownRenderer';

const FRAMEWORK_CHOICES = ['Playwright', 'Cypress', 'Selenium', 'pytest', 'JUnit', 'TestNG', 'Manual'] as const;
const COVERAGE_CHOICES = ['Smoke', 'Regression', 'Full'] as const;
const OWASP_WEB = [
  { code: 'A01', label: 'Broken Access Control' },
  { code: 'A02', label: 'Cryptographic Failures' },
  { code: 'A03', label: 'Injection' },
  { code: 'A04', label: 'Insecure Design' },
  { code: 'A05', label: 'Security Misconfiguration' },
  { code: 'A06', label: 'Vulnerable & Outdated Components' },
  { code: 'A07', label: 'Identification & Authentication Failures' },
  { code: 'A08', label: 'Software & Data Integrity Failures' },
  { code: 'A09', label: 'Security Logging & Monitoring Failures' },
  { code: 'A10', label: 'Server-Side Request Forgery' },
];
const OWASP_LLM = [
  { code: 'LLM01', label: 'Prompt Injection' },
  { code: 'LLM02', label: 'Sensitive Information Disclosure' },
  { code: 'LLM03', label: 'Supply Chain' },
  { code: 'LLM04', label: 'Data & Model Poisoning' },
  { code: 'LLM05', label: 'Improper Output Handling' },
  { code: 'LLM06', label: 'Excessive Agency' },
  { code: 'LLM07', label: 'System Prompt Leakage' },
  { code: 'LLM08', label: 'Vector & Embedding Weaknesses' },
  { code: 'LLM09', label: 'Misinformation' },
  { code: 'LLM10', label: 'Unbounded Consumption' },
];

export default function FtcWorkbenchPage() {
  const params = useParams<{ id: string; moduleId: string }>();
  const { id: projectId, moduleId: moduleDbId } = params;

  const [bundle, setBundle] = useState<FtcConfigBundle | null>(null);
  const [mod, setMod] = useState<BaModule | null>(null);
  const [ftc, setFtc] = useState<FtcBundle | null>(null);
  const [allFtcs, setAllFtcs] = useState<FtcArtifactSummary[]>([]);
  const [selectedFtcId, setSelectedFtcId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<BaFtcConfig>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, m, f, all] = await Promise.all([
        getFtcConfig(moduleDbId),
        getBaModule(moduleDbId),
        getFtc(moduleDbId),
        listFtcsForModule(moduleDbId),
      ]);
      setBundle(b);
      setMod(m);
      setFtc(f);
      setAllFtcs(all);
      setSelectedFtcId(f.artifact?.id ?? '');
      setForm(b.config ? ({
        testingFramework: b.config.testingFramework,
        coverageTarget: b.config.coverageTarget,
        owaspWebEnabled: b.config.owaspWebEnabled,
        owaspLlmEnabled: b.config.owaspLlmEnabled,
        excludedOwaspWeb: b.config.excludedOwaspWeb,
        excludedOwaspLlm: b.config.excludedOwaspLlm,
        includeLldReferences: b.config.includeLldReferences,
        ftcTemplateId: b.config.ftcTemplateId,
        customNotes: b.config.customNotes,
      }) : ({
        owaspWebEnabled: true,
        owaspLlmEnabled: true,
        excludedOwaspWeb: [],
        excludedOwaspLlm: [],
        includeLldReferences: true,
      }));
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 404) {
        setError('Module not found (id: ' + moduleDbId + '). The URL may be stale.');
      } else {
        setError('Failed to load FTC Workbench. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  }, [moduleDbId]);

  useEffect(() => { load(); }, [load]);

  const toggleInList = (list: string[] | null | undefined, code: string): string[] => {
    const arr = list ?? [];
    return arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code];
  };

  /**
   * Extract a useful error message from anything that can be thrown in this
   * page — axios errors (most common) surface the backend's actual message
   * via `response.data.message`; plain Errors fall back to `.message`; and
   * unknowns get a safe string coercion.
   */
  const extractErrorMessage = (err: unknown): string => {
    const anyErr = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    if (anyErr?.response) {
      const status = anyErr.response.status ?? '???';
      const data = anyErr.response.data;
      if (typeof data === 'string') return `HTTP ${status}: ${data}`;
      if (data && typeof data === 'object') {
        const d = data as { message?: unknown; error?: string };
        const msg = Array.isArray(d.message) ? d.message.join('; ') : d.message ?? d.error;
        return msg ? `HTTP ${status}: ${String(msg)}` : `HTTP ${status}`;
      }
      return `HTTP ${status}`;
    }
    if (err instanceof Error) return err.message;
    return String(err);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveFtcConfig(moduleDbId, form as Partial<BaFtcConfig>);
      await load();
    } catch (err: unknown) {
      alert(`Save failed — ${extractErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }, [moduleDbId, form, load]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      // Save config first so any dropdown/checkbox changes are captured.
      try {
        await saveFtcConfig(moduleDbId, form as Partial<BaFtcConfig>);
      } catch (err: unknown) {
        throw new Error(`Save config failed — ${extractErrorMessage(err)}`);
      }

      // Kick off generation. Returns RUNNING immediately with an execution id.
      let executionId: string;
      try {
        const res = await generateFtc(moduleDbId);
        executionId = res.executionId;
      } catch (err: unknown) {
        throw new Error(`Kick-off failed — ${extractErrorMessage(err)}`);
      }

      alert(`FTC generation started (execution ${executionId}). This can take 2-5 min — the page will refresh automatically.`);

      // Poll every 10s up to 10 min. A new artifact id (different from what
      // we currently have loaded) signals the run finished.
      const priorArtifactId = ftc?.artifact?.id ?? null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
        try {
          const latest = await getFtc(moduleDbId);
          if (latest.artifact && latest.artifact.id !== priorArtifactId) {
            setFtc(latest);
            const all = await listFtcsForModule(moduleDbId);
            setAllFtcs(all);
            setSelectedFtcId(latest.artifact.id);
            break;
          }
        } catch {
          // transient poll errors — keep trying
        }
      }
    } catch (err: unknown) {
      alert(`Generate failed: ${extractErrorMessage(err)}`);
    } finally {
      setGenerating(false);
    }
  }, [moduleDbId, form, ftc]);

  const selectedFtc = useMemo(() => {
    if (!selectedFtcId) return ftc;
    if (ftc?.artifact?.id === selectedFtcId) return ftc;
    return null; // would need a per-artifact fetch; MVP shows the active one
  }, [selectedFtcId, ftc]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading FTC Workbench…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-muted-foreground max-w-md text-center">{error}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/ba-tool/project/${projectId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to project
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/ba-tool/project/${projectId}/module/${moduleDbId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Module
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold">AI FTC Workbench</h1>
            <p className="text-xs text-muted-foreground">
              {mod?.moduleId} — {mod?.moduleName} · {allFtcs.length} generated FTC version{allFtcs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ftc?.artifact && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadFtcCsv(ftc.artifact!.id, `${ftc.artifact!.artifactId}.csv`).catch(() => alert('CSV export failed'))}
              title="Export test cases as CSV matching the QA team template"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save config
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
            {ftc?.artifact ? 'Regenerate FTC' : 'Generate FTC'}
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Functional Test Cases</h3>
            <p className="text-[11px] text-muted-foreground">
              FTC consumes EPICs (required) plus User Stories / SubTasks when available. When the
              module has an active LLD and <em>Include LLD references</em> is on, test cases cite
              LLD classes/methods and are tagged as white-box.
            </p>
          </CardContent>
        </Card>

        <FtcNarrativeCard
          moduleDbId={moduleDbId}
          moduleLabel={mod ? `${mod.moduleId} — ${mod.moduleName}` : moduleDbId}
          initialNarrative={bundle?.config?.narrative ?? ''}
          initialUseAsAdditional={bundle?.config?.useAsAdditional ?? true}
        />

        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">Test Strategy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Testing framework</label>
                <select
                  value={form.testingFramework ?? ''}
                  onChange={(e) => setForm({ ...form, testingFramework: e.target.value || null })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">(AI default — Playwright for web, pytest for backend)</option>
                  {FRAMEWORK_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Coverage target</label>
                <select
                  value={form.coverageTarget ?? ''}
                  onChange={(e) => setForm({ ...form, coverageTarget: e.target.value || null })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">(AI default — Regression)</option>
                  {COVERAGE_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.includeLldReferences ?? true}
                onChange={(e) => setForm({ ...form, includeLldReferences: e.target.checked })}
              />
              <span>Include LLD references when generating — produces white-box TCs that cite LLD classes/methods (only effective when an LLD artifact exists).</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">OWASP Coverage</h3>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.owaspWebEnabled ?? true}
                    onChange={(e) => setForm({ ...form, owaspWebEnabled: e.target.checked })}
                  />
                  Web Top 10
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.owaspLlmEnabled ?? true}
                    onChange={(e) => setForm({ ...form, owaspLlmEnabled: e.target.checked })}
                  />
                  LLM Top 10
                </label>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Uncheck categories below that don&apos;t apply to this module — the AI will list them as
              "N/A" in the coverage matrix rather than fabricate tests.
            </p>
            <OwaspChecklist
              title="Web Top 10 (2021)"
              items={OWASP_WEB}
              enabled={form.owaspWebEnabled ?? true}
              excluded={form.excludedOwaspWeb ?? []}
              onToggle={(code) => setForm({ ...form, excludedOwaspWeb: toggleInList(form.excludedOwaspWeb, code) })}
            />
            <OwaspChecklist
              title="LLM Top 10 (GenAI 2025) — applies to AI modules"
              items={OWASP_LLM}
              enabled={form.owaspLlmEnabled ?? true}
              excluded={form.excludedOwaspLlm ?? []}
              onToggle={(code) => setForm({ ...form, excludedOwaspLlm: toggleInList(form.excludedOwaspLlm, code) })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold">Custom Notes</h3>
            <textarea
              value={form.customNotes ?? ''}
              onChange={(e) => setForm({ ...form, customNotes: e.target.value })}
              rows={3}
              placeholder="Anything the skill should know beyond the narrative — e.g. test users, test tenant, shared fixtures..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </CardContent>
        </Card>

        {allFtcs.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Generated FTC Artifacts</h3>
                <select
                  value={selectedFtcId}
                  onChange={(e) => setSelectedFtcId(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  {allFtcs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.artifactId} {a.isCurrent ? '(active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {allFtcs.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      'border rounded p-2 cursor-pointer',
                      a.isCurrent ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30',
                    )}
                    onClick={() => setSelectedFtcId(a.id)}
                  >
                    <p className="font-mono font-semibold">{a.artifactId}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {a.testCaseCount} test cases · {a.whiteBoxCount} white-box
                    </p>
                    {a.owaspCategories.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        OWASP: {a.owaspCategories.slice(0, 5).join(', ')}{a.owaspCategories.length > 5 ? '…' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedFtc?.artifact && (
          <FtcPreview testCases={selectedFtc.testCases ?? []} />
        )}
      </main>
    </div>
  );
}

function OwaspChecklist({
  title,
  items,
  enabled,
  excluded,
  onToggle,
}: {
  title: string;
  items: { code: string; label: string }[];
  enabled: boolean;
  excluded: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className={cn('rounded-md border border-border p-2', !enabled && 'opacity-50 pointer-events-none')}>
      <p className="text-xs font-medium mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-1 text-[11px]">
        {items.map((i) => {
          const isExcluded = excluded.includes(i.code);
          return (
            <label key={i.code} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!isExcluded} onChange={() => onToggle(i.code)} />
              <span className="font-mono">{i.code}</span>
              <span className="text-muted-foreground truncate">{i.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function FtcPreview({ testCases }: { testCases: BaTestCase[] }) {
  const [open, setOpen] = useState<string | null>(testCases[0]?.id ?? null);

  // Group TCs by scenarioGroup, then within each group split into positive/negative/edge.
  const grouped = useMemo(() => {
    const byGroup = new Map<string, { positive: BaTestCase[]; negative: BaTestCase[]; edge: BaTestCase[] }>();
    for (const tc of testCases) {
      const group = tc.scenarioGroup ?? 'Ungrouped';
      if (!byGroup.has(group)) byGroup.set(group, { positive: [], negative: [], edge: [] });
      const bucket = byGroup.get(group)!;
      if (tc.testKind === 'negative') bucket.negative.push(tc);
      else if (tc.testKind === 'edge') bucket.edge.push(tc);
      else bucket.positive.push(tc);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [testCases]);

  if (testCases.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground italic">
            No test cases parsed from the last generation. Check the raw AI output via Preview.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPos = testCases.filter((t) => t.testKind === 'positive').length;
  const totalNeg = testCases.filter((t) => t.testKind === 'negative').length;
  const totalEdge = testCases.filter((t) => t.testKind === 'edge').length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Test Cases ({testCases.length})</h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{totalPos} positive</span>
            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{totalNeg} negative</span>
            {totalEdge > 0 && (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">{totalEdge} edge</span>
            )}
          </div>
        </div>

        {grouped.map(([groupName, bucket]) => (
          <div key={groupName} className="space-y-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">
              {groupName}
            </div>
            {[...bucket.positive, ...bucket.negative, ...bucket.edge].map((tc) => {
              const isOpen = open === tc.id;
              const display = tc.isHumanModified && tc.editedContent ? tc.editedContent : tc.aiContent;
              return (
                <div key={tc.id} className="rounded-md border border-border">
                  <button
                    className="w-full flex items-center justify-between gap-2 p-2 text-left hover:bg-muted/30"
                    onClick={() => setOpen(isOpen ? null : tc.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono text-xs font-semibold">{tc.testCaseId}</span>
                      <span className="text-xs text-foreground truncate">{tc.title}</span>
                      {/* testKind pill */}
                      <span className={cn(
                        'text-[9px] px-1 py-0.5 rounded font-bold shrink-0',
                        tc.testKind === 'negative' ? 'bg-red-100 text-red-700' :
                        tc.testKind === 'edge' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700',
                      )}>
                        {tc.testKind.toUpperCase()}
                      </span>
                      {/* scope pill */}
                      <span className={cn(
                        'text-[9px] px-1 py-0.5 rounded font-bold shrink-0',
                        tc.scope === 'white_box' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
                      )}>
                        {tc.scope === 'white_box' ? 'WHITE' : 'BLACK'}
                      </span>
                      {tc.category && (
                        <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded">{tc.category}</span>
                      )}
                      {tc.owaspCategory && (
                        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-mono">{tc.owaspCategory}</span>
                      )}
                      {tc.isIntegrationTest && (
                        <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded">INT</span>
                      )}
                      {/* executionStatus pill */}
                      <span className={cn(
                        'text-[9px] px-1 py-0.5 rounded font-semibold shrink-0',
                        tc.executionStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700' :
                        tc.executionStatus === 'FAIL' ? 'bg-rose-100 text-rose-700' :
                        tc.executionStatus === 'BLOCKED' ? 'bg-yellow-100 text-yellow-700' :
                        tc.executionStatus === 'SKIPPED' ? 'bg-gray-100 text-gray-600' :
                        'bg-slate-100 text-slate-500',
                      )}>
                        {tc.executionStatus === 'NOT_RUN' ? 'NOT RUN' : tc.executionStatus}
                      </span>
                      {tc.isHumanModified && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">
                          <UserIcon className="h-2.5 w-2.5" /> Edited
                        </span>
                      )}
                      {!tc.isHumanModified && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{isOpen ? '▼' : '▶'}</span>
                  </button>
                  {isOpen && (
                    <div className="p-3 border-t border-border bg-muted/10 text-sm">
                      <MarkdownRenderer content={display} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
