'use client';

import { useEffect, useRef, useState } from 'react';
import {
  wireframeChat,
  ingestWireframeFeedback,
  createWireframeChanges,
  type WfProposedItem,
  type WfStaging,
  type WfStagedChangeInput,
} from '@/lib/pipeline-api';

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  selectedSlugs: string[];
  availableSlugs: string[];
  targetKind: 'LOFI' | 'HIFI';
  onChangesAdded: () => void;
}

interface ProposedRow extends WfProposedItem {
  include: boolean;
  desc: string;
}

interface StagingRow {
  group: 'General' | 'Design System' | string;
  description: string;
  slug: string | null;
  scopeAll: boolean;
  changeKind: string;
  phase: string;
  calloutRef: string | null;
  priority: string;
  include: boolean;
  unmatched?: boolean;
}

export function WireframeCopilot({ projectId, open, onClose, selectedSlugs, availableSlugs, targetKind, onChangesAdded }: Props) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [proposed, setProposed] = useState<ProposedRow[]>([]);
  const [staging, setStaging] = useState<WfStaging | null>(null);
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);
  const [refSlugs, setRefSlugs] = useState<string[]>([]);
  const [requestedBy, setRequestedBy] = useState('');
  const [source, setSource] = useState<'CUSTOMER' | 'INTERNAL'>('CUSTOMER');
  const [requestedOn, setRequestedOn] = useState('');
  const [scopeSlugs, setScopeSlugs] = useState<string[]>(selectedSlugs);
  const [scopeOpen, setScopeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed scope from the gallery's ticked screens each time the drawer opens.
  useEffect(() => { if (open) setScopeSlugs(selectedSlugs); }, [open, selectedSlugs]);

  if (!open) return null;

  const scope = scopeSlugs.length
    ? { kind: 'SELECTED' as const, slugs: scopeSlugs }
    : { kind: 'ALL' as const };
  const scopeLabel = scopeSlugs.length
    ? scopeSlugs.length === 1 ? scopeSlugs[0] : `${scopeSlugs.length} screens`
    : `All ${availableSlugs.length} screens`;

  const toggleScope = (slug: string) =>
    setScopeSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const toggleRef = (slug: string) =>
    setRefSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : prev.length >= 2 ? prev : [...prev, slug]));

  const send = async () => {
    if (!input.trim()) return;
    setBusy(true); setError(null);
    const msg = input.trim();
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    try {
      const res = await wireframeChat(projectId, { userMessage: msg, scope, targetKind, referenceSlugs: refSlugs });
      setThreadId(res.threadId);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
      setProposed(
        res.proposed.map((it) => ({ ...it, include: it.actionable !== false && it.kind !== 'QUESTION', desc: it.description })),
      );
    } catch (e) { setError(e instanceof Error ? e.message : 'Chat failed'); }
    finally { setBusy(false); }
  };

  const ingest = async (file?: File, rawText?: string) => {
    setBusy(true); setError(null);
    try {
      const s = await ingestWireframeFeedback(projectId, { file, rawText, uploadedBy: requestedBy || undefined, source, targetKind });
      setStaging(s);
      if (s.uploadedBy && !requestedBy) setRequestedBy(s.uploadedBy);
      const rows: StagingRow[] = [];
      s.general.forEach((it) => rows.push({ group: 'General', description: it.description, slug: null, scopeAll: true, changeKind: 'ALL', phase: it.phase ?? 'NOW', calloutRef: it.calloutRef ?? null, priority: it.priority ?? 'MEDIUM', include: true }));
      s.designSystem.forEach((it) => rows.push({ group: 'Design System', description: it.description, slug: null, scopeAll: true, changeKind: 'DESIGN_SYSTEM', phase: it.phase ?? 'NOW', calloutRef: it.calloutRef ?? null, priority: it.priority ?? 'MEDIUM', include: true }));
      s.screens.forEach((b) => b.items.forEach((it) => rows.push({ group: b.moduleRef || b.screenRef || 'Screen', description: it.description, slug: b.slug, scopeAll: false, changeKind: 'SCREEN', phase: it.phase ?? 'NOW', calloutRef: it.calloutRef ?? null, priority: it.priority ?? 'MEDIUM', include: !!b.slug })));
      s.unmatched.forEach((b) => b.items.forEach((it) => rows.push({ group: `Unmatched · ${b.screenRef ?? ''}`, description: it.description, slug: null, scopeAll: false, changeKind: 'SCREEN', phase: 'LATER', calloutRef: null, priority: 'MEDIUM', include: false, unmatched: true })));
      setStagingRows(rows);
    } catch (e) { setError(e instanceof Error ? e.message : 'Feedback parse failed'); }
    finally { setBusy(false); }
  };

  const addProposed = async () => {
    const items: WfStagedChangeInput[] = proposed.filter((p) => p.include).map((p) => ({
      description: p.desc,
      targetScreens: p.targetScreens ?? [],
      scopeAll: p.scopeAll ?? p.kind === 'ALL',
      changeKind: p.changeKind ?? p.kind ?? 'SCREEN',
      calloutRef: p.calloutRef ?? null,
      targetKind,
      priority: p.priority ?? 'MEDIUM',
      phase: p.phase,
      rationale: p.rationale,
    }));
    if (!items.length) return;
    await persist(items);
    setProposed([]);
  };

  const addStaging = async () => {
    const items: WfStagedChangeInput[] = stagingRows.filter((r) => r.include).map((r) => ({
      description: r.description,
      targetScreens: r.slug ? [r.slug] : [],
      scopeAll: r.scopeAll,
      changeKind: r.changeKind,
      calloutRef: r.calloutRef,
      targetKind,
      priority: r.priority,
      phase: r.phase,
    }));
    if (!items.length) return;
    await persist(items, staging?.importId);
    setStaging(null); setStagingRows([]);
  };

  const persist = async (items: WfStagedChangeInput[], importId?: string) => {
    setBusy(true); setError(null);
    try {
      await createWireframeChanges(projectId, { items, requestedBy: requestedBy || undefined, source, requestedOn: requestedOn || undefined, importId, threadId });
      onChangesAdded();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to add to register'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[440px] bg-white border-l shadow-xl flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <b className="text-sm">💬 Wireframe Copilot</b>
        <button
          onClick={() => setScopeOpen((o) => !o)}
          title="Choose which screen(s) this feedback is for"
          className="ml-auto text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-indigo-100"
        >Scope: {scopeLabel} ▾</button>
        <button onClick={onClose} className="text-gray-400 px-1">✕</button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Scope picker — pick which screen(s) the chat/feedback applies to */}
        {scopeOpen && (
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-2.5 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-900">Feedback is for…</span>
              <button onClick={() => setScopeSlugs([])} className={`rounded px-2 py-0.5 ${scopeSlugs.length === 0 ? 'bg-indigo-600 text-white' : 'border border-indigo-200 text-indigo-700'}`}>All screens</button>
            </div>
            <div className="max-h-40 overflow-auto grid grid-cols-1 gap-0.5">
              {availableSlugs.map((s) => (
                <label key={s} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" checked={scopeSlugs.includes(s)} onChange={() => toggleScope(s)} />
                  <span className="font-mono">{s}</span>
                </label>
              ))}
              {availableSlugs.length === 0 && <span className="text-gray-400">No {targetKind.toLowerCase()} screens yet.</span>}
            </div>
            <p className="text-[10px] text-indigo-700/80">Tip: pasting a block that starts with “Screen 01 — …” auto-routes to that screen — no need to pick here.</p>
          </div>
        )}
        {/* Prominent feedback upload */}
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full h-10 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">📄 Upload feedback document</button>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.md,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ingest(f); e.target.value = ''; }} />
        <p className="text-[11px] text-gray-400">PDF · DOCX · MD · TXT — or paste a review / one screen’s block below; either opens the staging table.</p>

        {/* Design System chip + reference picker */}
        <div className="flex items-center gap-2 flex-wrap bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-[11px]">
          <span className="font-bold text-orange-800">Design System</span>
          <span className="text-orange-700">auto-applied to edits</span>
          <a href={`/ba-tool/project/${projectId}/design-system`} className="ml-auto text-blue-600 underline">Edit ↗</a>
        </div>
        {availableSlugs.length > 0 && (
          <div className="text-[11px] text-gray-500">
            <span className="mr-1">Style reference (≤2):</span>
            {availableSlugs.slice(0, 12).map((s) => (
              <button key={s} onClick={() => toggleRef(s)} className={`mr-1 mb-1 rounded-full border px-2 py-0.5 ${refSlugs.includes(s) ? 'bg-violet-100 border-violet-300 text-violet-700' : 'border-gray-200 text-gray-500'}`}>{s}</button>
            ))}
          </div>
        )}

        {/* Conversation */}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block rounded-lg px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap text-left ${m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-50 border'}`}>{m.content}</div>
          </div>
        ))}

        {/* Proposed changes confirmation */}
        {proposed.length > 0 && (
          <div className="border border-dashed border-orange-400 bg-orange-50/40 rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-orange-800">✨ Proposed changes — confirm before adding</div>
            {proposed.map((p, i) => (
              <div key={i} className="bg-white border rounded-lg p-2">
                <div className="flex gap-2 items-start">
                  <input type="checkbox" checked={p.include} onChange={() => setProposed((arr) => arr.map((x, j) => j === i ? { ...x, include: !x.include } : x))} className="mt-1" />
                  <div className="flex-1">
                    <textarea value={p.desc} onChange={(e) => setProposed((arr) => arr.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} className="w-full text-xs border rounded p-1 resize-none" rows={2} />
                    <div className="text-[10px] text-gray-500 mt-1">{p.kind ?? p.changeKind} · {(p.targetScreens ?? []).join(', ') || (p.scopeAll || p.kind === 'ALL' ? 'all screens' : '—')}{p.phase === 'LATER' ? ' · later' : ''}</div>
                  </div>
                </div>
              </div>
            ))}
            {batchFields()}
            <button onClick={addProposed} disabled={busy} className="w-full h-8 rounded bg-orange-500 text-white text-xs font-semibold disabled:opacity-50">+ Add {proposed.filter((p) => p.include).length} to register</button>
          </div>
        )}

        {/* Feedback staging table */}
        {staging && (
          <div className="border rounded-xl p-3 space-y-2 bg-white">
            <div className="text-xs font-semibold flex items-center gap-2">
              📄 {staging.fileName ?? 'Pasted feedback'} → staging
              <span className="text-[10px] text-gray-400">uploaded by {staging.uploadedBy ?? (requestedBy || '—')}{staging.uploadedAt ? ` · ${staging.uploadedAt.slice(0, 10)}` : ''}</span>
            </div>
            <div className="max-h-72 overflow-auto">
              {stagingRows.map((r, i) => (
                <div key={i} className={`flex gap-2 items-start py-1.5 border-b text-[11px] ${r.unmatched ? 'opacity-70' : ''}`}>
                  <input type="checkbox" checked={r.include} onChange={() => setStagingRows((arr) => arr.map((x, j) => j === i ? { ...x, include: !x.include } : x))} className="mt-0.5" />
                  <div className="flex-1">
                    <div>{r.description}</div>
                    <div className="text-[10px] text-gray-400">{r.group} · {r.changeKind}{r.slug ? ` → ${r.slug}` : r.scopeAll ? ' → all' : r.unmatched ? ' → unmatched' : ''}{r.calloutRef ? ` · ${r.calloutRef}` : ''}{r.phase === 'LATER' ? ' · later' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            {batchFields()}
            <button onClick={addStaging} disabled={busy} className="w-full h-8 rounded bg-orange-500 text-white text-xs font-semibold disabled:opacity-50">+ Add {stagingRows.filter((r) => r.include).length} to register</button>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{error}</div>}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <p className="text-[11px] text-gray-400 mb-1">💡 Paste a whole review or one screen’s block, then “Parse as feedback”.</p>
        <div className="flex gap-2 items-end">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe a change, or paste feedback…" rows={2} className="flex-1 resize-none border rounded-lg p-2 text-xs" />
          <div className="flex flex-col gap-1">
            <button onClick={() => input.trim() && ingest(undefined, input.trim())} disabled={busy || !input.trim()} title="Parse pasted text as feedback" className="h-8 px-2 rounded border text-[11px] disabled:opacity-50">Parse</button>
            <button onClick={send} disabled={busy || !input.trim()} className="h-8 px-3 rounded bg-orange-500 text-white text-xs disabled:opacity-50">{busy ? '…' : 'Send'}</button>
          </div>
        </div>
      </div>
    </div>
  );

  function batchFields() {
    return (
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <label className="text-[9px] uppercase text-gray-400 block">Requestor</label>
          <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="w-full h-7 border rounded px-1.5 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase text-gray-400 block">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value as 'CUSTOMER' | 'INTERNAL')} className="w-full h-7 border rounded px-1 text-[11px]">
            <option value="CUSTOMER">Customer</option>
            <option value="INTERNAL">Internal</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] uppercase text-gray-400 block">Requested on <span className="lowercase text-gray-300">(opt)</span></label>
          <input type="date" value={requestedOn} onChange={(e) => setRequestedOn(e.target.value)} className="w-full h-7 border rounded px-1 text-[11px]" />
        </div>
      </div>
    );
  }
}
