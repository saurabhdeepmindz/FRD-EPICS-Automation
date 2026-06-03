'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Loader2, FileEdit, Terminal, CheckCircle2, XCircle, ShieldQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  startAgentRun,
  agentRunStreamUrl,
  resolveAgentPermission,
  type AgentSkill,
  type AgentRunEvent,
} from '@/lib/pipeline-api';

interface LogLine {
  kind: 'log' | 'tool' | 'file' | 'result' | 'error';
  text: string;
}

interface PendingPermission {
  requestId: string;
  tool: string;
  detail: string;
}

/**
 * K-03/K-04/K-05 — runs a skill agentically and streams the result live:
 * logs, tool calls, incremental file edits, and in-UI permission prompts.
 */
export function AgentRunPanel({
  projectId,
  skill,
  apiKeySet,
  moduleDbId,
  disabledReason,
}: {
  projectId: string;
  skill: AgentSkill;
  apiKeySet: boolean;
  /** N-04 — when set, the run is scoped to this module. */
  moduleDbId?: string;
  /** When set, the Run button is disabled and this explains why. */
  disabledReason?: string;
}) {
  const [subtask, setSubtask] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filesChanged, setFilesChanged] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingPermission | null>(null);
  const [finalResult, setFinalResult] = useState<{ ok: boolean; text: string } | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, pending]);

  useEffect(() => () => esRef.current?.close(), []);

  const append = (line: LogLine) => setLines((prev) => [...prev, line]);

  const onRun = async () => {
    if (skill.needsSubtask && !subtask.trim()) return;
    setRunning(true);
    setLines([]);
    setFilesChanged([]);
    setFinalResult(null);
    setPending(null);
    try {
      const { runId } = await startAgentRun(projectId, skill.id, subtask.trim() || undefined, moduleDbId);
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
          case 'log':
            append({ kind: 'log', text: e.text });
            break;
          case 'tool':
            append({ kind: 'tool', text: `${e.tool} — ${e.summary}` });
            break;
          case 'file':
            append({ kind: 'file', text: `${e.action} ${e.path}` });
            setFilesChanged((prev) => (prev.includes(e.path) ? prev : [...prev, e.path]));
            break;
          case 'permission':
            setPending({ requestId: e.requestId, tool: e.tool, detail: e.detail });
            break;
          case 'result':
            append({ kind: 'result', text: e.summary });
            setFinalResult({ ok: e.ok, text: e.summary });
            es.close();
            setRunning(false);
            break;
          case 'error':
            append({ kind: 'error', text: e.message });
            setFinalResult({ ok: false, text: e.message });
            es.close();
            setRunning(false);
            break;
        }
      };
      es.onerror = () => {
        es.close();
        setRunning(false);
      };
    } catch (err) {
      append({
        kind: 'error',
        text:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Failed to start run'),
      });
      setRunning(false);
    }
  };

  const decide = async (allow: boolean) => {
    if (!pending || !runIdRef.current) return;
    const p = pending;
    setPending(null);
    append({ kind: 'tool', text: `${allow ? '✅ allowed' : '⛔ denied'}: ${p.tool}` });
    await resolveAgentPermission(projectId, runIdRef.current, p.requestId, allow).catch(() => undefined);
  };

  const iconFor = (kind: LogLine['kind']) => {
    switch (kind) {
      case 'tool': return <Terminal className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />;
      case 'file': return <FileEdit className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />;
      case 'result': return <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />;
      case 'error': return <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />;
      default: return <span className="h-3 w-3 shrink-0" />;
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800">{skill.label}</p>
          <p className="text-xs text-gray-400 truncate">{skill.description}</p>
        </div>
        {skill.needsSubtask && (
          <input
            value={subtask}
            onChange={(e) => setSubtask(e.target.value)}
            placeholder="Task / subtask (e.g. Task 3)"
            className="text-xs border rounded px-2 py-1 w-44"
            disabled={running}
          />
        )}
        <Button
          size="sm"
          onClick={onRun}
          disabled={running || !apiKeySet || !!disabledReason}
          title={disabledReason ?? undefined}
          className="shrink-0"
        >
          {running ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running…</> : <><Play className="h-3 w-3 mr-1" /> Run</>}
        </Button>
      </div>
      {disabledReason && (
        <p className="text-xs text-amber-600">{disabledReason}</p>
      )}

      {/* Permission dialog (K-04) */}
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

      {/* Live log + progress */}
      {(lines.length > 0 || running) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 bg-gray-900 rounded-lg p-2.5 max-h-72 overflow-y-auto text-xs font-mono">
            {lines.map((l, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                {iconFor(l.kind)}
                <span className={
                  l.kind === 'error' ? 'text-red-300'
                  : l.kind === 'file' ? 'text-emerald-300'
                  : l.kind === 'tool' ? 'text-blue-300'
                  : l.kind === 'result' ? 'text-emerald-200 font-semibold'
                  : 'text-gray-300'
                }>
                  {l.text}
                </span>
              </div>
            ))}
            {running && <div className="text-gray-500 py-0.5">…</div>}
            <div ref={logEndRef} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Files changed ({filesChanged.length})
            </p>
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {filesChanged.map((f, i) => (
                <div key={i} className="text-xs text-gray-600 font-mono flex items-center gap-1">
                  <FileEdit className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
              ))}
              {filesChanged.length === 0 && <p className="text-xs text-gray-400">None yet.</p>}
            </div>
          </div>
        </div>
      )}

      {finalResult && (
        <div className={`text-xs rounded px-2 py-1.5 ${finalResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {finalResult.ok ? '✅ ' : '⛔ '}{finalResult.text}
        </div>
      )}
    </div>
  );
}
