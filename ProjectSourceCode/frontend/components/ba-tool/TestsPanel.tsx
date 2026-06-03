'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FlaskConical, PlayCircle, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, History, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listTestRuns, type TestRun, type TestRunKind, type TestRunStatus } from '@/lib/pipeline-api';

const STATUS_STYLE: Record<TestRunStatus, string> = {
  RUNNING: 'bg-blue-100 text-blue-700',
  PASSED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  ERROR: 'bg-amber-100 text-amber-700',
};

/**
 * P-03 (DEV) + Q-04 (FTC) — runs a tier of tests for the selected module and
 * shows the latest result + history. The two tiers are intentionally separate:
 *   kind=DEV → unit tests produced/run by /dev
 *   kind=FTC → Playwright tests derived from the module's FTC cases
 */
export function TestsPanel({
  projectId,
  moduleDbId,
  kind,
  title,
  description,
  onRun,
  runDisabledReason,
  loadSummary,
}: {
  projectId: string;
  moduleDbId: string | null;
  kind: TestRunKind;
  title: string;
  description: string;
  /** The API call that triggers this tier's run (DEV vs FTC). */
  onRun: (projectId: string, moduleDbId: string) => Promise<TestRun>;
  /** When set, the Run button is disabled with this reason. */
  runDisabledReason?: string;
  /** Optional: load a one-line "basis" string (e.g. FTC case count) to show. */
  loadSummary?: (projectId: string, moduleDbId: string) => Promise<string | null>;
}) {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!moduleDbId) {
      setRuns([]);
      setSummary(null);
      return;
    }
    try {
      setRuns(await listTestRuns(projectId, moduleDbId, kind));
    } catch {
      /* history load is best-effort */
    }
    if (loadSummary) {
      setSummary(await loadSummary(projectId, moduleDbId).catch(() => null));
    }
  }, [projectId, moduleDbId, kind, loadSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async () => {
    if (!moduleDbId) return;
    setRunning(true);
    setError(null);
    try {
      const result = await onRun(projectId, moduleDbId);
      setExpanded(result.id);
      await refresh();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Test run failed'),
      );
    } finally {
      setRunning(false);
    }
  };

  const latest = runs[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
          <FlaskConical className="h-4 w-4" /> {title}
          {latest && (
            <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${STATUS_STYLE[latest.status]}`}>
              latest: {latest.status}
            </span>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={run}
              disabled={!moduleDbId || running || !!runDisabledReason}
              title={runDisabledReason ?? undefined}
            >
              {running ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running…</>
              ) : (
                <><PlayCircle className="h-3 w-3 mr-1" /> Run</>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500">{description}</p>

        {summary && (
          <p className="text-xs text-gray-600 bg-gray-50 border rounded px-2.5 py-1.5">{summary}</p>
        )}

        {runDisabledReason && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {runDisabledReason}
          </p>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {!moduleDbId ? (
          <p className="text-xs text-gray-400">Select a module above to run tests.</p>
        ) : runs.length === 0 ? (
          <p className="text-xs text-gray-400">No runs yet — click “Run”.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
              <History className="h-3 w-3" /> History ({runs.length})
            </p>
            {runs.map((r) => (
              <div key={r.id} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === r.id ? null : r.id))}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                >
                  {r.status === 'PASSED' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : r.status === 'RUNNING' ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-500 shrink-0 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700">
                    {r.passed}/{r.total || '—'} passed
                    {r.failed > 0 && <span className="text-red-600"> · {r.failed} failed</span>}
                    {r.skipped > 0 && <span className="text-amber-600"> · {r.skipped} skipped</span>}
                  </span>
                  <span className="text-[10px] text-gray-400">{r.framework}</span>
                  {r.durationMs != null && <span className="text-[10px] text-gray-400">{(r.durationMs / 1000).toFixed(1)}s</span>}
                  <span className="text-[10px] text-gray-300 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                  {expanded === r.id ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                </button>
                {expanded === r.id && (
                  <div className="border-t px-2.5 py-2 space-y-1.5">
                    {r.command && <p className="text-[10px] font-mono text-gray-500">$ {r.command}</p>}
                    <pre className="bg-gray-900 text-gray-300 rounded p-2 text-[11px] font-mono max-h-56 overflow-auto whitespace-pre-wrap break-words">
                      {r.output ?? '(no output)'}
                    </pre>
                    {r.artifacts && (
                      <div className="text-[11px] text-gray-600 space-y-0.5">
                        <p className="flex items-start gap-1">
                          <FolderOpen className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                          <span className="font-mono break-all">{r.artifacts.dir}</span>
                        </p>
                        {r.artifacts.report && (
                          <p className="font-mono text-emerald-700 break-all">report: {r.artifacts.report}</p>
                        )}
                        {r.artifacts.files.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-gray-500">{r.artifacts.files.length} artifact file(s)</summary>
                            <ul className="mt-0.5 ml-3 space-y-0.5">
                              {r.artifacts.files.slice(0, 50).map((f) => (
                                <li key={f} className="font-mono text-gray-500 break-all">{f}</li>
                              ))}
                              {r.artifacts.files.length > 50 && <li className="text-gray-400">… +{r.artifacts.files.length - 50} more</li>}
                            </ul>
                          </details>
                        ) : (
                          <p className="text-gray-400">No artifact files produced (Playwright writes report/traces here when the suite runs).</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
