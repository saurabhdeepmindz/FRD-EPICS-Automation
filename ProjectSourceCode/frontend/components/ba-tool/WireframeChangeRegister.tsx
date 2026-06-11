'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listWireframeChanges,
  getWireframeChangeDiff,
  applyWireframeChange,
  runAllWireframeChanges,
  acceptWireframeChange,
  revertWireframeChange,
  reopenWireframeChange,
  commentWireframeChange,
  wireframeChangeStreamUrl,
  wireframeChangeExportUrl,
  type WfChange,
} from '@/lib/pipeline-api';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IMPLEMENTED: 'bg-emerald-100 text-emerald-800',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
  REVERTED: 'bg-violet-100 text-violet-800',
  DEFERRED: 'bg-slate-100 text-slate-600',
};

interface DiffRow { slug: string; before: string; after: string }

export function WireframeChangeRegister({ projectId, refreshSignal }: { projectId: string; refreshSignal?: number }) {
  const [changes, setChanges] = useState<WfChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ change: WfChange; rows: DiffRow[] } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setChanges(await listWireframeChanges(projectId, { status: status || undefined, source: source || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load changes');
    } finally {
      setLoading(false);
    }
  }, [projectId, status, source]);

  useEffect(() => { void load(); }, [load, refreshSignal]);

  // Live status flips via SSE.
  useEffect(() => {
    const es = new EventSource(wireframeChangeStreamUrl(projectId));
    es.onmessage = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void load(), 400);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [projectId, load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusyId(null); }
  };

  const openDiff = async (change: WfChange) => {
    setError(null);
    try { setDiff({ change, rows: await getWireframeChangeDiff(projectId, change.id) }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load diff'); }
  };

  const onComment = async (change: WfChange) => {
    const message = window.prompt(`Comment on ${change.changeCode}:`);
    if (message?.trim()) await act(change.id, () => commentWireframeChange(projectId, change.id, message.trim()));
  };

  const counts = changes.reduce<Record<string, number>>((a, c) => { a[c.status] = (a[c.status] ?? 0) + 1; return a; }, {});

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-gray-900">Change Register</h2>
        {Object.entries(counts).map(([s, n]) => (
          <span key={s} className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${STATUS_CLASS[s] ?? 'bg-gray-100'}`}>{n} {s.toLowerCase().replace('_', ' ')}</span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-md border border-gray-300 px-2 text-xs">
            <option value="">Status: All</option>
            {Object.keys(STATUS_CLASS).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="h-8 rounded-md border border-gray-300 px-2 text-xs">
            <option value="">Source: All</option>
            <option value="CUSTOMER">Customer</option>
            <option value="INTERNAL">Internal</option>
          </select>
          <a href={wireframeChangeExportUrl(projectId)} target="_blank" rel="noreferrer" className="h-8 inline-flex items-center rounded-md border border-gray-300 px-3 text-xs hover:bg-gray-50">⬇ Export</a>
          <button
            onClick={() => act('all', async () => { setRunningAll(true); try { await runAllWireframeChanges(projectId, { stopOnFailure: false }); } finally { setRunningAll(false); } })}
            disabled={runningAll || !changes.some((c) => ['PENDING', 'FAILED'].includes(c.status))}
            className="h-8 inline-flex items-center rounded-md bg-gray-900 text-white px-3 text-xs font-medium disabled:opacity-50"
          >{runningAll ? 'Running…' : '▶ Run all'}</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : changes.length === 0 ? (
        <div className="border rounded-lg bg-white py-10 text-center text-sm text-gray-400">
          No changes yet. Open the Copilot, describe or upload feedback, and add changes here.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Change</th>
                <th className="text-left px-3 py-2">Screens</th>
                <th className="text-left px-3 py-2">Requestor</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-left px-3 py-2">Requested</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{c.changeCode}</td>
                  <td className="px-3 py-2 max-w-[280px]">{c.description}{c.calloutRef ? <span className="ml-1 text-gray-400">{c.calloutRef}</span> : null}</td>
                  <td className="px-3 py-2 text-gray-500">{c.scopeAll ? 'ALL' : c.targetScreens.join(', ') || '—'}</td>
                  <td className="px-3 py-2">{c.requestedBy ?? '—'}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${c.source === 'CUSTOMER' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700'}`}>{c.source}</span></td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{c.requestedOn ? c.requestedOn.slice(0, 10) : '—'}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${STATUS_CLASS[c.status] ?? 'bg-gray-100'}`}>{c.status.replace('_', ' ')}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {['PENDING', 'FAILED', 'DEFERRED'].includes(c.status) && (
                        <button disabled={busyId === c.id} onClick={() => act(c.id, () => applyWireframeChange(projectId, c.id))} className="rounded border border-gray-900 bg-gray-900 text-white px-2 py-0.5 text-[11px] disabled:opacity-50">{busyId === c.id ? '…' : 'Run'}</button>
                      )}
                      {['IMPLEMENTED', 'NEEDS_REVIEW'].includes(c.status) && (
                        <>
                          <button onClick={() => openDiff(c)} className="rounded border px-2 py-0.5 text-[11px] hover:bg-gray-50">Before/After</button>
                          <button disabled={busyId === c.id} onClick={() => act(c.id, () => acceptWireframeChange(projectId, c.id))} className="rounded border border-emerald-500 bg-emerald-500 text-white px-2 py-0.5 text-[11px]">Accept</button>
                          <button disabled={busyId === c.id} onClick={() => act(c.id, () => revertWireframeChange(projectId, c.id))} className="rounded border border-violet-300 text-violet-700 px-2 py-0.5 text-[11px]">Revert</button>
                        </>
                      )}
                      {c.status === 'REVERTED' && (
                        <button disabled={busyId === c.id} onClick={() => act(c.id, () => reopenWireframeChange(projectId, c.id))} className="rounded border px-2 py-0.5 text-[11px] hover:bg-gray-50">Reopen</button>
                      )}
                      <button onClick={() => onComment(c)} className="rounded border px-2 py-0.5 text-[11px] hover:bg-gray-50">💬</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Before/After modal */}
      {diff && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDiff(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-2.5 border-b">
              <span className="font-medium text-gray-900">{diff.change.changeCode} · before / after</span>
              <span className="text-xs text-gray-400 truncate">{diff.change.description}</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => act(diff.change.id, () => acceptWireframeChange(projectId, diff.change.id)).then(() => setDiff(null))} className="rounded bg-emerald-500 text-white px-3 py-1 text-xs">✓ Accept</button>
                <button onClick={() => act(diff.change.id, () => revertWireframeChange(projectId, diff.change.id)).then(() => setDiff(null))} className="rounded border border-violet-300 text-violet-700 px-3 py-1 text-xs">↩ Revert</button>
                <button onClick={() => setDiff(null)} className="text-gray-500 px-2">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {diff.rows.length === 0 && <div className="text-sm text-gray-400 text-center py-8">No edited screens to compare.</div>}
              {diff.rows.map((r) => (
                <div key={r.slug}>
                  <div className="text-xs font-mono text-gray-500 mb-1">{r.slug}</div>
                  <div className="grid grid-cols-2 gap-px bg-gray-200 rounded overflow-hidden h-72">
                    <div className="flex flex-col bg-white min-h-0">
                      <div className="text-[10px] font-bold px-2 py-1 bg-gray-50 border-b">Before</div>
                      <iframe title={`${r.slug}-before`} sandbox="" srcDoc={r.before} className="flex-1 w-full bg-white" />
                    </div>
                    <div className="flex flex-col bg-white min-h-0">
                      <div className="text-[10px] font-bold px-2 py-1 bg-emerald-50 border-b text-emerald-700">After (edited)</div>
                      <iframe title={`${r.slug}-after`} sandbox="" srcDoc={r.after} className="flex-1 w-full bg-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
