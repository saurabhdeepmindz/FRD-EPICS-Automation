'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, Loader2, Save, Rocket, AlertTriangle, Sparkles, User as UserIcon, Download, ShieldCheck,
} from 'lucide-react';
import {
  getFtcConfig,
  saveFtcConfig,
  generateFtc,
  getFtc,
  listFtcsForModule,
  getBaModule,
  downloadFtcCsv,
  downloadPlaywrightZip,
  listAcCoverage,
  reverifyAndExportPlaywright,
  type BaFtcConfig,
  type BaModule,
  type FtcConfigBundle,
  type FtcBundle,
  type FtcArtifactSummary,
  type BaTestCase,
  type AcCoverageBundle,
} from '@/lib/ba-api';
import { cn } from '@/lib/utils';
import { FtcNarrativeCard } from '@/components/ba-tool/FtcNarrativeCard';
import { TestCaseBody, usePseudoFileResolver } from '@/components/ba-tool/TestCaseBody';

const FRAMEWORK_CHOICES: { code: string; label: string; domain: string }[] = [
  { code: 'Playwright',    label: 'Playwright',    domain: 'UI / E2E' },
  { code: 'Cypress',       label: 'Cypress',       domain: 'UI / E2E' },
  { code: 'Selenium',      label: 'Selenium',      domain: 'UI / E2E' },
  { code: 'pytest',        label: 'pytest',        domain: 'Backend / API' },
  { code: 'JUnit',         label: 'JUnit',         domain: 'Backend (Java)' },
  { code: 'TestNG',        label: 'TestNG',        domain: 'Backend (Java)' },
  { code: 'REST-assured',  label: 'REST-assured',  domain: 'API contract' },
  { code: 'Postman',       label: 'Postman',       domain: 'API contract' },
  { code: 'k6',            label: 'k6',            domain: 'Performance' },
  { code: 'JMeter',        label: 'JMeter',        domain: 'Performance' },
  { code: 'Manual',        label: 'Manual',        domain: 'Human execution — no automation hints emitted' },
];
const COVERAGE_CHOICES = ['Smoke', 'Regression', 'Full'] as const;
const TEST_TYPE_CHOICES: { code: string; label: string }[] = [
  { code: 'Functional',    label: 'Functional' },
  { code: 'Integration',   label: 'Integration' },
  { code: 'UI',            label: 'UI' },
  { code: 'Security',      label: 'Security' },
  { code: 'Data',          label: 'Data' },
  { code: 'Performance',   label: 'Performance' },
  { code: 'Accessibility', label: 'Accessibility' },
  { code: 'API',           label: 'API' },
];
const DEFAULT_TEST_TYPES = ['Functional', 'Integration', 'UI', 'Security'];
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
  const [coverage, setCoverage] = useState<AcCoverageBundle | null>(null);
  const [exportingSafe, setExportingSafe] = useState(false);

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
        testingFrameworks: b.config.testingFrameworks ?? [],
        testTypes: (b.config.testTypes && b.config.testTypes.length > 0)
          ? b.config.testTypes
          : DEFAULT_TEST_TYPES,
        coverageTarget: b.config.coverageTarget,
        owaspWebEnabled: b.config.owaspWebEnabled,
        owaspLlmEnabled: b.config.owaspLlmEnabled,
        excludedOwaspWeb: b.config.excludedOwaspWeb,
        excludedOwaspLlm: b.config.excludedOwaspLlm,
        includeLldReferences: b.config.includeLldReferences,
        ftcTemplateId: b.config.ftcTemplateId,
        customNotes: b.config.customNotes,
      }) : ({
        testingFrameworks: ['Playwright'],
        testTypes: DEFAULT_TEST_TYPES,
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

  // F3: fetch the latest AC coverage summary once the FTC artifact is ready
  // so the export buttons can show a drift badge without extra clicks.
  useEffect(() => {
    if (!ftc?.artifact?.id) { setCoverage(null); return; }
    let cancelled = false;
    listAcCoverage(ftc.artifact.id)
      .then((c) => { if (!cancelled) setCoverage(c); })
      .catch(() => { if (!cancelled) setCoverage(null); });
    return () => { cancelled = true; };
  }, [ftc?.artifact?.id]);

  const handleSafeExport = useCallback(async () => {
    if (!ftc?.artifact) return;
    setExportingSafe(true);
    try {
      const fresh = await reverifyAndExportPlaywright(
        ftc.artifact.id,
        `${ftc.artifact.artifactId}-playwright.zip`,
      );
      setCoverage(fresh);
      const gaps = fresh.summary.uncovered + fresh.summary.partial;
      if (gaps > 0) {
        alert(
          `Playwright suite exported.\n\n` +
          `AC Coverage (fresh): ${fresh.summary.covered}/${fresh.summary.total} covered\n` +
          `${fresh.summary.partial} partial · ${fresh.summary.uncovered} uncovered\n\n` +
          `The ZIP reflects the current TCs; uncovered ACs have no automation yet.`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      alert(`Safe export failed: ${msg}`);
    } finally {
      setExportingSafe(false);
    }
  }, [ftc?.artifact]);

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
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadFtcCsv(ftc.artifact!.id, `${ftc.artifact!.artifactId}.csv`).catch(() => alert('CSV export failed'))}
                title="Export test cases as CSV matching the QA team template"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
              {(() => {
                const gaps = coverage ? coverage.summary.uncovered + coverage.summary.partial : 0;
                const hasCoverage = coverage && coverage.summary.total > 0;
                const driftTooltip = !hasCoverage
                  ? 'AC coverage not yet analyzed. Click "Re-verify + Export" for a checked export.'
                  : gaps > 0
                    ? `${coverage!.summary.covered}/${coverage!.summary.total} ACs covered — ` +
                      `${coverage!.summary.partial} partial, ${coverage!.summary.uncovered} uncovered. ` +
                      `Re-verify + Export runs a fresh check first.`
                    : `${coverage!.summary.covered}/${coverage!.summary.total} ACs covered. Suite is complete.`;
                return (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadPlaywrightZip(ftc.artifact!.id, `${ftc.artifact!.artifactId}-playwright.zip`).catch(() => alert('Playwright export failed'))}
                      title={driftTooltip}
                      className="relative"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Export Playwright Suite
                      {hasCoverage && gaps > 0 && (
                        <span
                          className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center leading-none"
                          aria-label={`${gaps} AC gaps`}
                        >
                          !{gaps}
                        </span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={hasCoverage && gaps > 0 ? 'default' : 'outline'}
                      onClick={handleSafeExport}
                      disabled={exportingSafe}
                      title="Re-verify AC coverage first, then download the Playwright ZIP. Use this after editing ACs or TCs."
                    >
                      {exportingSafe
                        ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                      Re-verify + Export
                    </Button>
                  </>
                );
              })()}
            </>
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

            {/* Testing frameworks — multi-select */}
            <div>
              <label className="text-xs font-medium mb-1 block">
                Testing frameworks <span className="text-muted-foreground font-normal">(pick one or more — the AI routes per-TC hints by category)</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Leave all unchecked to let the AI pick defaults (Playwright for UI, pytest for backend).
                Pick <strong>Manual</strong> alone to skip automation hints entirely.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[11px]">
                {FRAMEWORK_CHOICES.map((f) => {
                  const checked = (form.testingFrameworks ?? []).includes(f.code);
                  return (
                    <label key={f.code} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setForm({
                          ...form,
                          testingFrameworks: toggleInList(form.testingFrameworks, f.code),
                        })}
                      />
                      <span className="font-mono">{f.label}</span>
                      <span className="text-muted-foreground truncate">— {f.domain}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Coverage depth — single select (unchanged) + Test types multi-select */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block">
                  Coverage depth <span className="text-muted-foreground font-normal">(how exhaustive)</span>
                </label>
                <select
                  value={form.coverageTarget ?? ''}
                  onChange={(e) => setForm({ ...form, coverageTarget: e.target.value || null })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">(AI default — Regression)</option>
                  {COVERAGE_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Smoke ⊂ Regression ⊂ Full. Regression + Smoke are depth, not type.</p>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">
                  Test types <span className="text-muted-foreground font-normal">(which categories to emit)</span>
                </label>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {TEST_TYPE_CHOICES.map((t) => {
                    const checked = (form.testTypes ?? []).includes(t.code);
                    return (
                      <label key={t.code} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm({
                            ...form,
                            testTypes: toggleInList(form.testTypes, t.code),
                          })}
                        />
                        <span>{t.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Empty = emit all types.</p>
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
          <FtcPreview testCases={selectedFtc.testCases ?? []} moduleDbId={moduleDbId} />
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

function FtcPreview({ testCases, moduleDbId }: { testCases: BaTestCase[]; moduleDbId: string }) {
  const [open, setOpen] = useState<string | null>(testCases[0]?.id ?? null);
  const { resolve: resolveFiles } = usePseudoFileResolver(moduleDbId, testCases);

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
                    <div className="border-t border-border bg-muted/10">
                      <TestCaseBody tc={tc} resolveFiles={resolveFiles} />
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

