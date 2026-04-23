'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  analyzeAcCoverage,
  listAcCoverage,
  listTestCasesByArtifact,
  type BaAcCoverage,
  type BaArtifact,
  type BaTestCase,
} from '@/lib/ba-api';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw, Sparkles, User as UserIcon } from 'lucide-react';
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
export function FtcArtifactView({ artifact, moduleDbId, activeTcId }: Props) {
  const [testCases, setTestCases] = useState<BaTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTc, setOpenTc] = useState<string | null>(null);

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

        {/* ── AC Coverage Verifier ── */}
        <AcCoverageCard artifactDbId={artifact.id} />

        {/* ── Per-category groups ── */}
        {grouped.map((group) => (
          <section key={group.key} className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/60 pb-1">
              {group.label} <span className="text-muted-foreground/70 font-normal">({group.tcs.length})</span>
            </h4>
            <div className="space-y-1.5">
              {group.tcs.map((tc) => {
                const isOpen = openTc === tc.id;
                return (
                  <div
                    key={tc.id}
                    id={`tc-${tc.id}`}
                    className="rounded-md border border-border transition-all scroll-mt-4"
                  >
                    <button
                      className="w-full flex items-center justify-between gap-2 p-2 text-left hover:bg-muted/30"
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
        ))}
      </CardContent>
    </Card>
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
