'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  analyzeAcCoverage,
  bulkCreateTestRuns,
  listAcCoverage,
  listTestCasesByArtifact,
  type BaAcCoverage,
  type BaArtifact,
  type BaTestCase,
  type BaTestRun,
} from '@/lib/ba-api';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw, Sparkles, User as UserIcon, Play, X } from 'lucide-react';
import { TestCaseBody, TestCaseAccordionHeader, usePseudoFileResolver } from './TestCaseBody';

interface Props {
  artifact: BaArtifact;
  moduleDbId: string;
  /**
   * When set, scroll that TC into view and ring-highlight briefly. Driven by the
   * artifact tree's per-TC-leaf click which routes sectionId to
   * `__test_case__:<testCaseDbId>`.
   */
  activeTcId?: string;
  onUpdated?: () => void;
}

/** Categories we surface as top-level buckets in the tree + artifact view. */
const CATEGORY_ORDER: string[] = [
  'Functional',
  'Integration',
  'Security',
  'UI',
  'Data',
  'Performance',
  'Accessibility',
  'API',
];

/**
 * Full FTC artifact view for the module-detail page. Replaces the raw
 * section-markdown dump (which showed the ```tc fenced-block key-value
 * headers verbatim) with a proper accordion per test case, where each
 * body is the shared `TestCaseBody`.
 *
 * Groups TCs by category for readability. TCs tagged `scope=white_box`
 * are pulled into a synthetic "White-Box" group at the end. Categories
 * with zero TCs are hidden.
 */
export function FtcArtifactView({ artifact, moduleDbId, activeTcId, onUpdated }: Props) {
  const [testCases, setTestCases] = useState<BaTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTc, setOpenTc] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    const tcs = await listTestCasesByArtifact(artifact.id);
    setTestCases(tcs);
  }, [artifact.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tcs = await listTestCasesByArtifact(artifact.id);
        if (!cancelled) setTestCases(tcs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artifact.id]);

  const toggleTc = useCallback((tcId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tcId)) next.delete(tcId);
      else next.add(tcId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(testCases.map((t) => t.id)));
  }, [testCases]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const toggleGroup = useCallback((groupTcs: BaTestCase[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = groupTcs.every((t) => next.has(t.id));
      if (allSelected) {
        for (const t of groupTcs) next.delete(t.id);
      } else {
        for (const t of groupTcs) next.add(t.id);
      }
      return next;
    });
  }, []);

  const { resolve: resolveFiles } = usePseudoFileResolver(moduleDbId, testCases);

  // Group by category with White-Box as a synthetic bucket. Keep empty buckets
  // out so the view isn't cluttered.
  const grouped = useMemo(() => {
    const buckets: Record<string, BaTestCase[]> = {};
    const whiteBox: BaTestCase[] = [];
    for (const tc of testCases) {
      if (tc.scope === 'white_box') {
        whiteBox.push(tc);
        continue;
      }
      const cat = tc.category && CATEGORY_ORDER.includes(tc.category) ? tc.category : 'Functional';
      buckets[cat] ??= [];
      buckets[cat].push(tc);
    }
    const ordered: Array<{ key: string; label: string; tcs: BaTestCase[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      if (buckets[cat] && buckets[cat].length > 0) {
        ordered.push({ key: cat, label: `${cat} Test Cases`, tcs: buckets[cat] });
      }
    }
    if (whiteBox.length > 0) {
      ordered.push({ key: 'white_box', label: 'White-Box Test Cases', tcs: whiteBox });
    }
    return ordered;
  }, [testCases]);

  // Scroll + ring-highlight when activeTcId changes.
  useEffect(() => {
    if (!activeTcId) return;
    // Expand the active TC so its content is visible.
    setOpenTc(activeTcId);
    const el = document.getElementById(`tc-${activeTcId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-2', 'ring-primary');
    const t = setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
    return () => clearTimeout(t);
  }, [activeTcId, testCases.length]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Loading test cases…</CardContent>
      </Card>
    );
  }
  if (testCases.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground italic">
          No test cases parsed from this FTC artifact. Open the AI FTC Workbench to regenerate.
        </CardContent>
      </Card>
    );
  }

  const totalPos = testCases.filter((t) => t.testKind === 'positive').length;
  const totalNeg = testCases.filter((t) => t.testKind === 'negative').length;
  const totalEdge = testCases.filter((t) => t.testKind === 'edge').length;
  const totalWB = testCases.filter((t) => t.scope === 'white_box').length;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* ── Header summary ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Test Cases ({testCases.length})</h3>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{totalPos} positive</span>
            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{totalNeg} negative</span>
            {totalEdge > 0 && (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">{totalEdge} edge</span>
            )}
            {totalWB > 0 && (
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">{totalWB} white-box</span>
            )}
          </div>
        </div>

        {/* ── Bulk-run toolbar ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-md border border-dashed border-border bg-muted/20 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === testCases.length}
              ref={(el) => {
                if (el) el.indeterminate = selected.size > 0 && selected.size < testCases.length;
              }}
              onChange={() => (selected.size === testCases.length ? clearSelection() : selectAll())}
              className="cursor-pointer"
              title="Select all / none"
            />
            <span className="text-muted-foreground">
              {selected.size === 0
                ? 'Select test cases to record runs in bulk'
                : `${selected.size} selected`}
            </span>
            {selected.size > 0 && (
              <button onClick={clearSelection} className="text-primary hover:underline">
                Clear
              </button>
            )}
          </div>
          <Button
            size="sm"
            variant={selected.size > 0 ? 'default' : 'outline'}
            disabled={selected.size === 0}
            onClick={() => setBulkDialogOpen(true)}
            className="h-7"
            title={selected.size === 0 ? 'Pick one or more TCs first' : `Record run for ${selected.size} TC(s)`}
          >
            <Play className="h-3 w-3 mr-1" />
            Run selected {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>

        {/* ── AC Coverage Verifier ── */}
        <AcCoverageCard artifactDbId={artifact.id} />

        {/* ── Per-category groups ── */}
        {grouped.map((group) => {
          const groupSelectedCount = group.tcs.filter((t) => selected.has(t.id)).length;
          const groupAllSelected = groupSelectedCount === group.tcs.length && group.tcs.length > 0;
          return (
            <section key={group.key} className="space-y-1.5">
              <div className="flex items-center gap-2 border-b border-border/60 pb-1">
                <input
                  type="checkbox"
                  checked={groupAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = groupSelectedCount > 0 && !groupAllSelected;
                  }}
                  onChange={() => toggleGroup(group.tcs)}
                  className="cursor-pointer"
                  title={`Select all ${group.label}`}
                  onClick={(e) => e.stopPropagation()}
                />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                  {group.label} <span className="text-muted-foreground/70 font-normal">({group.tcs.length})</span>
                  {groupSelectedCount > 0 && (
                    <span className="ml-2 text-[10px] text-primary normal-case">· {groupSelectedCount} selected</span>
                  )}
                </h4>
              </div>
              <div className="space-y-1.5">
                {group.tcs.map((tc) => {
                  const isOpen = openTc === tc.id;
                  const isSelected = selected.has(tc.id);
                  return (
                    <div
                      key={tc.id}
                      id={`tc-${tc.id}`}
                      className={cn(
                        'rounded-md border transition-all scroll-mt-4',
                        isSelected ? 'border-primary/60 bg-primary/5' : 'border-border',
                      )}
                    >
                      <div className="flex items-center gap-2 p-2 hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTc(tc.id)}
                          className="cursor-pointer shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${tc.testCaseId}`}
                        />
                        <button
                          className="flex-1 flex items-center justify-between gap-2 text-left min-w-0"
                          onClick={() => setOpenTc(isOpen ? null : tc.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <TestCaseAccordionHeader tc={tc} />
                            {tc.isHumanModified ? (
                              <span className="flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">
                                <UserIcon className="h-2.5 w-2.5" /> Edited
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                <Sparkles className="h-2.5 w-2.5" /> AI
                              </span>
                            )}
                          </div>
                          <span className={cn('text-[10px] text-muted-foreground shrink-0')}>
                            {isOpen ? '▼' : '▶'}
                          </span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-border bg-muted/10">
                          <TestCaseBody tc={tc} resolveFiles={resolveFiles} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>

      {bulkDialogOpen && (
        <BulkRunDialog
          selectedTcs={testCases.filter((t) => selected.has(t.id))}
          onClose={() => setBulkDialogOpen(false)}
          onSuccess={async () => {
            setBulkDialogOpen(false);
            clearSelection();
            await reload();
            onUpdated?.();
          }}
        />
      )}
    </Card>
  );
}

// ─── Bulk Run Dialog ────────────────────────────────────────────────────────

interface BulkRunDialogProps {
  selectedTcs: BaTestCase[];
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

function BulkRunDialog({ selectedTcs, onClose, onSuccess }: BulkRunDialogProps) {
  const [status, setStatus] = useState<BaTestRun['status']>('PASS');
  const [executor, setExecutor] = useState('');
  const [environment, setEnvironment] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await bulkCreateTestRuns({
        testCaseIds: selectedTcs.map((t) => t.id),
        status,
        executor: executor.trim() || null,
        environment: environment.trim() || null,
        sprintId: sprintId.trim() || null,
        notes: notes.trim() || null,
      });
      if (res.created === 0) {
        setError('No runs were created. Check server logs.');
      } else {
        if (res.missingCount > 0) {
          alert(`Recorded ${res.created} runs. ${res.missingCount} TC(s) were not found and skipped.`);
        }
        await onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-lg border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Bulk Record Run — {selectedTcs.length} test case{selectedTcs.length > 1 ? 's' : ''}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            The same status + metadata will be recorded against each selected test case.
            Need to open defects? Use the per-TC flow after this bulk pass — defects aren&apos;t created in bulk by design.
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  type="button"
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-bold border',
                    status === s
                      ? s === 'PASS' ? 'bg-green-500 text-white border-green-500' :
                        s === 'FAIL' ? 'bg-rose-500 text-white border-rose-500' :
                        s === 'BLOCKED' ? 'bg-amber-500 text-white border-amber-500' :
                        'bg-sky-500 text-white border-sky-500'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-semibold block mb-1">Executor</label>
              <input
                type="text"
                value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                placeholder="QA name"
                className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Environment</label>
              <input
                type="text"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                placeholder="dev / stage / prod"
                className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Sprint</label>
              <input
                type="text"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                placeholder="v2.3"
                className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Notes (optional, applied to all)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Regression suite pre-release smoke …"
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background resize-none"
            />
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Selected test cases ({selectedTcs.length})</summary>
            <ul className="mt-1 max-h-40 overflow-y-auto font-mono text-[11px] space-y-0.5 pl-4">
              {selectedTcs.map((tc) => (
                <li key={tc.id} className="text-muted-foreground">
                  <span className="text-primary">{tc.testCaseId}</span> — {tc.title}
                </li>
              ))}
            </ul>
          </details>

          {error && <div className="text-xs text-rose-600 bg-rose-50 rounded p-2">{error}</div>}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
            Record {selectedTcs.length} run{selectedTcs.length > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── AC Coverage Card ───────────────────────────────────────────────────────

/**
 * Renders the AC Coverage Verifier matrix. On mount, fetches stored
 * coverage rows (populated during FTC generation by the parser). The
 * "Re-verify" button calls the standalone Python AC-coverage endpoint;
 * its results replace any prior POST_GEN_CHECK rows but leave AI_SKILL
 * rows from the original generation intact as an audit trail.
 */
function AcCoverageCard({ artifactDbId }: { artifactDbId: string }) {
  const [bundle, setBundle] = useState<{
    rows: BaAcCoverage[];
    summary: { covered: number; partial: number; uncovered: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listAcCoverage(artifactDbId);
        if (!cancelled) setBundle(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artifactDbId]);

  const handleReverify = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await analyzeAcCoverage(artifactDbId);
      setBundle(res);
      setExpanded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      alert(`Re-verify failed: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }, [artifactDbId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          Loading AC coverage…
        </CardContent>
      </Card>
    );
  }

  const rows = bundle?.rows ?? [];
  const summary = bundle?.summary ?? { covered: 0, partial: 0, uncovered: 0, total: 0 };
  const uncoveredCount = summary.uncovered;
  const partialCount = summary.partial;
  const hasAnyGap = uncoveredCount > 0 || partialCount > 0;

  return (
    <section className="rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold">AC Coverage</h4>
          {summary.total === 0 ? (
            <span className="text-[10px] text-muted-foreground italic">
              Not yet analyzed — run Re-verify to extract ACs from upstream artifacts.
            </span>
          ) : (
            <>
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                {summary.covered} covered
              </span>
              {partialCount > 0 && (
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {partialCount} partial
                </span>
              )}
              {uncoveredCount > 0 && (
                <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {uncoveredCount} uncovered
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">of {summary.total}</span>
              {hasAnyGap && (
                <span className="flex items-center gap-1 text-[10px] text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> gaps detected
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summary.total > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded((p) => !p)} className="h-7">
              {expanded ? 'Hide details' : 'Show details'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleReverify} disabled={analyzing} className="h-7">
            {analyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Re-verify
          </Button>
        </div>
      </div>

      {expanded && summary.total > 0 && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Source</th>
                <th className="px-2 py-1.5 font-semibold">AC</th>
                <th className="px-2 py-1.5 font-semibold">Covering TCs</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="px-2 py-1.5 font-semibold">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50 align-top">
                  <td className="px-2 py-1.5 font-mono text-[11px] text-primary whitespace-nowrap">
                    {r.acSource}
                    <br />
                    <span className="text-muted-foreground text-[9px]">{r.acSourceType}</span>
                  </td>
                  <td className="px-2 py-1.5 max-w-[360px]">{r.acText}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">
                    {r.coveringTcRefs.length > 0 ? (
                      <div className="flex flex-wrap gap-0.5">
                        {r.coveringTcRefs.map((ref) => (
                          <span key={ref} className="bg-blue-50 text-blue-700 px-1 rounded">{ref}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusPill status={r.status} />
                    {r.source === 'POST_GEN_CHECK' && (
                      <span className="ml-1 text-[9px] text-muted-foreground italic">(re-checked)</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 max-w-[320px] text-muted-foreground italic">
                    {r.rationale ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: BaAcCoverage['status'] }) {
  if (status === 'COVERED') {
    return (
      <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
        <CheckCircle2 className="h-3 w-3" /> COVERED
      </span>
    );
  }
  if (status === 'PARTIAL') {
    return (
      <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
        <AlertTriangle className="h-3 w-3" /> PARTIAL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
      <XCircle className="h-3 w-3" /> UNCOVERED
    </span>
  );
}
