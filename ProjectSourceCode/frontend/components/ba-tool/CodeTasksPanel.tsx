'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ListChecks, Loader2, Wand2, Link2, FileCode2, AlertTriangle, RefreshCw,
  Play, PlayCircle, ShieldQuestion, Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  planCodeTasks,
  listCodeTasks,
  runAllCodeTasks,
  runCodeTask,
  agentRunStreamUrl,
  resolveAgentPermission,
  type CodeTask,
  type CodeTaskStatus,
  type AgentRunEvent,
} from '@/lib/pipeline-api';

const STATUS_STYLE: Record<CodeTaskStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-500',
  RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-amber-100 text-amber-700',
};

const EVT_STATUS: Record<string, CodeTaskStatus> = {
  running: 'RUNNING',
  completed: 'COMPLETED',
  failed: 'FAILED',
  skipped: 'SKIPPED',
};

interface PendingPermission {
  requestId: string;
  tool: string;
  detail: string;
}

/**
 * O-04 + P-02 — the module's `/prd` task plan with live `/dev` execution.
 * "Generate Plan" materialises sub-tasks into ordered, linked tasks; "Run All"
 * and per-task "Run" execute them via /dev, flipping each task's status live
 * (RUNNING → COMPLETED/FAILED) over SSE, with in-UI permission approval.
 */
export function CodeTasksPanel({
  projectId,
  moduleDbId,
  moduleLabel,
  runDisabledReason,
}: {
  projectId: string;
  moduleDbId: string | null;
  moduleLabel: string | null;
  /** When set, Run-all / per-task Run are disabled (not ready, no API key, …). */
  runDisabledReason?: string;
}) {
  const [tasks, setTasks] = useState<CodeTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningTaskKey, setRunningTaskKey] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!moduleDbId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setTasks(await listCodeTasks(projectId, moduleDbId));
    } catch (err) {
      setError(errMsg(err, 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [projectId, moduleDbId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Close any open stream on unmount / module change.
  useEffect(() => () => esRef.current?.close(), [moduleDbId]);

  const onPlan = async () => {
    if (!moduleDbId) return;
    setPlanning(true);
    setError(null);
    try {
      setTasks(await planCodeTasks(projectId, moduleDbId));
    } catch (err) {
      setError(errMsg(err, 'Plan generation failed'));
    } finally {
      setPlanning(false);
    }
  };

  const updateTaskStatus = (taskKey: string, status: CodeTaskStatus, taskError?: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.taskKey === taskKey ? { ...t, status, errorMessage: taskError ?? t.errorMessage } : t,
      ),
    );

  const startRun = async (starter: () => Promise<{ runId: string }>, taskKey: string | null) => {
    if (!moduleDbId) return;
    setRunning(true);
    setRunningTaskKey(taskKey);
    setError(null);
    setLog([]);
    setPending(null);
    try {
      const { runId } = await starter();
      runIdRef.current = runId;
      const es = new EventSource(agentRunStreamUrl(projectId, runId));
      esRef.current = es;
      es.onmessage = (ev) => {
        let e: AgentRunEvent;
        try {
          e = JSON.parse(ev.data) as AgentRunEvent;
        } catch {
          return;
        }
        switch (e.type) {
          case 'task':
            updateTaskStatus(e.taskKey, EVT_STATUS[e.status] ?? 'PENDING', e.error);
            appendLog(setLog, `${iconFor(e.status)} Task ${e.sequence} ${e.status}${e.title ? ` — ${e.title}` : ''}`);
            break;
          case 'log':
            appendLog(setLog, e.text);
            break;
          case 'tool':
            appendLog(setLog, `⚙ ${e.tool} — ${e.summary}`);
            break;
          case 'file':
            appendLog(setLog, `✎ ${e.action} ${e.path}`);
            break;
          case 'permission':
            setPending({ requestId: e.requestId, tool: e.tool, detail: e.detail });
            break;
          case 'result':
            appendLog(setLog, e.ok ? `✅ ${e.summary}` : `⛔ ${e.summary}`);
            finishRun(es);
            void refresh();
            break;
          case 'error':
            setError(e.message);
            finishRun(es);
            void refresh();
            break;
        }
      };
      es.onerror = () => {
        finishRun(es);
        void refresh();
      };
    } catch (err) {
      setError(errMsg(err, 'Failed to start run'));
      setRunning(false);
      setRunningTaskKey(null);
    }
  };

  const finishRun = (es: EventSource) => {
    es.close();
    setRunning(false);
    setRunningTaskKey(null);
    setPending(null);
  };

  const decide = async (allow: boolean) => {
    if (!pending || !runIdRef.current) return;
    const p = pending;
    setPending(null);
    appendLog(setLog, `${allow ? '✅ allowed' : '⛔ denied'}: ${p.tool}`);
    await resolveAgentPermission(projectId, runIdRef.current, p.requestId, allow).catch(() => undefined);
  };

  const counts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const hasRunnable = tasks.some((t) => t.status === 'PENDING' || t.status === 'FAILED');
  const runBlocked = running || !!runDisabledReason;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
          <ListChecks className="h-4 w-4" /> Task Plan
          <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-gray-400">
              {counts.COMPLETED ?? 0} done · {counts.FAILED ?? 0} failed · {counts.PENDING ?? 0} pending
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {tasks.length > 0 && (
              <Button size="sm" variant="ghost" onClick={refresh} disabled={loading || planning || running} title="Refresh">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onPlan} disabled={!moduleDbId || planning || running}>
              {planning ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Planning…</>
              ) : (
                <><Wand2 className="h-3 w-3 mr-1" /> Generate Plan</>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => startRun(() => runAllCodeTasks(projectId, moduleDbId!), null)}
              disabled={runBlocked || !hasRunnable}
              title={runDisabledReason ?? undefined}
            >
              {running && runningTaskKey === null ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running…</>
              ) : (
                <><PlayCircle className="h-3 w-3 mr-1" /> Run All</>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500">
          The plan is derived from {moduleLabel ? <strong>{moduleLabel}</strong> : 'the module'}&apos;s sub-tasks,
          ordered by their prerequisite sequence. Each task links the sub-task(s) and pseudo file(s) it implements;
          <code className="text-xs"> /dev</code> executes them and updates status live.
        </p>

        {runDisabledReason && tasks.length > 0 && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {runDisabledReason}
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {/* Permission dialog (K-04 reused) */}
        {pending && (
          <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
              <ShieldQuestion className="h-4 w-4" /> Permission requested
            </p>
            <p className="text-xs text-amber-700 font-mono break-all">{pending.detail}</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => decide(false)}>Deny</Button>
              <Button size="sm" onClick={() => decide(true)}>Allow</Button>
            </div>
          </div>
        )}

        {!moduleDbId ? (
          <p className="text-xs text-gray-400">Select a module above to view or generate its task plan.</p>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-gray-400">
            {loading ? 'Loading…' : 'No tasks yet — click “Generate Plan” to build the task list from sub-tasks.'}
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="border rounded-lg p-2.5 flex items-start gap-3">
                <span className="text-xs font-mono text-gray-400 mt-0.5 w-6 shrink-0 text-right">{t.sequence}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-gray-400">{t.taskKey}</span>
                    {t.isDynamic && (
                      <span className="text-[9px] uppercase bg-purple-100 text-purple-700 rounded px-1 py-0.5">dynamic</span>
                    )}
                    <span className="text-sm text-gray-800">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.subtaskRefs.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
                        <Link2 className="h-2.5 w-2.5" /> {s}
                      </span>
                    ))}
                    {t.pseudoFileRefs.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5" title={p}>
                        <FileCode2 className="h-2.5 w-2.5" /> {p.split('/').pop()}
                      </span>
                    ))}
                    {t.pseudoFileRefs.length === 0 && t.targetFiles.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
                        <FileCode2 className="h-2.5 w-2.5" /> {f}
                      </span>
                    ))}
                  </div>
                  {t.status === 'FAILED' && t.errorMessage && (
                    <p className="text-[11px] text-red-600">{t.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${STATUS_STYLE[t.status]}`}>
                    {t.status === 'RUNNING' && <Loader2 className="h-2.5 w-2.5 mr-0.5 inline animate-spin" />}
                    {t.status}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    title={runDisabledReason ?? `Run ${t.taskKey}`}
                    disabled={runBlocked || t.status === 'RUNNING'}
                    onClick={() => startRun(() => runCodeTask(projectId, moduleDbId, t.taskKey), t.taskKey)}
                  >
                    {running && runningTaskKey === t.taskKey ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live run log */}
        {log.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-2.5 max-h-56 overflow-y-auto text-xs font-mono">
            <p className="text-gray-500 flex items-center gap-1 mb-1"><Terminal className="h-3 w-3" /> /dev output</p>
            {log.map((l, i) => (
              <div key={i} className="text-gray-300 py-0.5 whitespace-pre-wrap break-words">{l}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function appendLog(setLog: Dispatch<SetStateAction<string[]>>, line: string) {
  setLog((prev) => [...prev.slice(-200), line]);
}

function iconFor(status: string): string {
  return status === 'completed' ? '✅' : status === 'failed' ? '⛔' : status === 'running' ? '▶' : '•';
}

function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : fallback)
  );
}
