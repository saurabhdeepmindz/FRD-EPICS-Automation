'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Send,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Copy,
  Sparkles,
  MessageSquare,
  Wand2,
  LayoutTemplate,
  ChevronRight,
  ChevronDown,
  Globe,
  Upload,
  Trash2,
  ExternalLink,
  FileText,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/forms/MicButton';
import { Markdown } from '@/components/ba-tool/Markdown';
import {
  listHldProviders,
  listHldTemplates,
  saveHldAsTemplate,
  getHldThread,
  hldCopilotChat,
  saveHldInsight,
  hldCopilotMerge,
  updateHldSection,
  listHldReferences,
  addHldReferenceUrl,
  uploadHldReferenceDocument,
  setHldReferenceInclude,
  deleteHldReference,
  type HldProvider,
  type HldTemplate,
  type HldChatMessage,
  type HldReference,
} from '@/lib/pipeline-api';

const QUICK_PROMPTS = [
  'Best practices for this section in our project?',
  'What are the key trade-offs and which do you recommend?',
  'Security considerations to address here?',
  'A reference architecture that fits our stack?',
  'Common pitfalls to avoid?',
];

/**
 * HE-11 / HE-12 — HLD Architect Copilot drawer. Per-section conversational AI
 * (model picker + voice + quick prompts), save answers as insights, and
 * synthesize current section + insights into a draft applied as a new field.
 */
export function HldCopilot({
  projectId,
  hldId,
  sectionKey,
  sectionName,
  currentBody,
  onApplied,
  onClose,
}: {
  projectId: string;
  hldId: string;
  sectionKey: string;
  sectionName: string;
  currentBody: Record<string, unknown> | undefined;
  onApplied: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'chat' | 'saved' | 'templates' | 'references'>('chat');
  const [providers, setProviders] = useState<HldProvider[]>([]);
  const [provider, setProvider] = useState('anthropic');
  const [templates, setTemplates] = useState<HldTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<HldTemplate | null>(null);
  // HD-09 — save-as-template form
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplScope, setTplScope] = useState<'GLOBAL' | 'PROJECT'>('GLOBAL');
  const [tplWhole, setTplWhole] = useState(true);
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplMsg, setTplMsg] = useState<string | null>(null);
  // RR-08 — references
  const [references, setReferences] = useState<HldReference[]>([]);
  const [refUrl, setRefUrl] = useState('');
  const [refTagSection, setRefTagSection] = useState(false); // tag to current section vs whole-HLD
  const [addingRef, setAddingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<HldChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingSel, setSavingSel] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load providers once.
  useEffect(() => {
    void listHldProviders(projectId)
      .then((p) => {
        setProviders(p);
        const firstAvail = p.find((x) => x.available);
        if (firstAvail) setProvider((cur) => (p.find((x) => x.id === cur)?.available ? cur : firstAvail.id));
      })
      .catch(() => setProviders([]));
    void listHldTemplates(projectId).then(setTemplates).catch(() => setTemplates([]));
  }, [projectId]);

  // Load references for this HLD (whole-HLD + section scope shown together).
  useEffect(() => {
    void listHldReferences(projectId, hldId).then(setReferences).catch(() => setReferences([]));
  }, [projectId, hldId]);

  // Load this section's thread whenever the section changes.
  useEffect(() => {
    setMessages([]);
    setDraft(null);
    setSelected(new Set());
    setExpanded(new Set());
    void getHldThread(projectId, hldId, sectionKey)
      .then((msgs) => {
        setMessages(msgs);
        const lastA = [...msgs].reverse().find((m) => m.role === 'assistant');
        if (lastA) setExpanded(new Set([lastA.id])); // newest answer open by default
      })
      .catch(() => setMessages([]));
  }, [projectId, hldId, sectionKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || sending) return;
      setSending(true);
      setError(null);
      setInput('');
      try {
        const { userMessage, assistantMessage } = await hldCopilotChat(projectId, hldId, {
          sectionKey,
          provider,
          message: msg,
          template: activeTemplate ? `${activeTemplate.name}\n${activeTemplate.body}` : null,
        });
        setMessages((m) => [...m, userMessage, assistantMessage]);
        setExpanded((e) => new Set(e).add(assistantMessage.id)); // open the new answer
      } catch (err) {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (err instanceof Error ? err.message : 'Chat failed'),
        );
      } finally {
        setSending(false);
      }
    },
    [projectId, hldId, sectionKey, provider, sending, activeTemplate],
  );

  const toggleSave = async (m: HldChatMessage) => {
    try {
      const updated = await saveHldInsight(projectId, hldId, m.id, !m.savedToSection);
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, savedToSection: updated.savedToSection } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const saved = messages.filter((m) => m.role === 'assistant' && m.savedToSection);

  const synthesize = async () => {
    setMerging(true);
    setError(null);
    try {
      const { draft: d } = await hldCopilotMerge(projectId, hldId, sectionKey, provider);
      setDraft(d);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Synthesize failed'),
      );
    } finally {
      setMerging(false);
    }
  };

  const applyDraft = async () => {
    if (!draft) return;
    setApplying(true);
    setError(null);
    try {
      await updateHldSection(projectId, hldId, sectionKey, { ...(currentBody ?? {}), aiSynthesis: draft });
      setDraft(null);
      await onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const reloadTemplates = () => listHldTemplates(projectId).then(setTemplates).catch(() => {});
  const reloadReferences = () => listHldReferences(projectId, hldId).then(setReferences).catch(() => {});

  // RR-08 — add a reference URL (server fetches + summarizes).
  const addUrl = async () => {
    const url = refUrl.trim();
    if (!url) return;
    setAddingRef(true);
    setError(null);
    try {
      await addHldReferenceUrl(projectId, hldId, {
        url,
        sectionKey: refTagSection ? sectionKey : null,
        provider,
      });
      setRefUrl('');
      await reloadReferences();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Add URL failed'),
      );
    } finally {
      setAddingRef(false);
    }
  };

  // RR-08 — upload a reference document (server extracts + summarizes).
  const uploadDoc = async (file: File) => {
    setAddingRef(true);
    setError(null);
    try {
      await uploadHldReferenceDocument(projectId, hldId, file, {
        sectionKey: refTagSection ? sectionKey : null,
        provider,
      });
      await reloadReferences();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Upload failed'),
      );
    } finally {
      setAddingRef(false);
    }
  };

  const toggleRefInclude = async (r: HldReference) => {
    try {
      const updated = await setHldReferenceInclude(projectId, hldId, r.id, !r.includeInContext);
      setReferences((list) => list.map((x) => (x.id === r.id ? { ...x, includeInContext: updated.includeInContext } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const removeRef = async (r: HldReference) => {
    try {
      await deleteHldReference(projectId, hldId, r.id);
      setReferences((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Included READY references in scope for the current section (whole-HLD + this section).
  const activeRefCount = references.filter(
    (r) => r.includeInContext && r.status === 'READY' && (r.sectionKey == null || r.sectionKey === sectionKey),
  ).length;

  // HD-09 — save the current HLD (whole doc or this section) as a reusable template.
  const saveTemplate = async () => {
    setSavingTpl(true);
    setTplMsg(null);
    setError(null);
    try {
      const res = await saveHldAsTemplate(projectId, hldId, {
        name: tplName.trim() || undefined,
        scope: tplScope,
        sectionKey: tplWhole ? null : sectionKey,
      });
      await reloadTemplates();
      setTplMsg(`Saved “${res.name}” · ${res.scope === 'GLOBAL' ? 'all projects' : 'this project'}`);
      setShowSaveTpl(false);
      setTplName('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Save failed'),
      );
    } finally {
      setSavingTpl(false);
    }
  };

  // ── Q&A pairing + bulk selection (accordion) ──────────────────────────────
  interface QaItem {
    key: string;
    question: string;
    answer: string;
    model: string | null;
    assistantId: string | null; // null = no answer yet (can't select/save)
    savedToSection: boolean;
  }
  const qaItems: QaItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      const a = messages[i + 1]?.role === 'assistant' ? messages[i + 1] : null;
      qaItems.push({
        key: m.id,
        question: m.content,
        answer: a?.content ?? '',
        model: a?.model ?? null,
        assistantId: a?.id ?? null,
        savedToSection: a?.savedToSection ?? false,
      });
      if (a) i++;
    } else {
      qaItems.push({
        key: m.id,
        question: '(answer)',
        answer: m.content,
        model: m.model,
        assistantId: m.id,
        savedToSection: m.savedToSection,
      });
    }
  }
  const selectableIds = qaItems.map((q) => q.assistantId).filter((x): x is string => !!x);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const allExpanded = qaItems.length > 0 && qaItems.every((q) => expanded.has(q.key));

  const toggleExpand = (key: string) =>
    setExpanded((e) => {
      const n = new Set(e);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));
  const toggleExpandAll = () => setExpanded(allExpanded ? new Set() : new Set(qaItems.map((q) => q.key)));

  /** Bulk-save all checked answers as insights. */
  const saveSelected = async () => {
    const ids = qaItems.filter((q) => q.assistantId && selected.has(q.assistantId) && !q.savedToSection).map((q) => q.assistantId!);
    if (!ids.length) return;
    setSavingSel(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => saveHldInsight(projectId, hldId, id, true)));
      setMessages((list) => list.map((x) => (ids.includes(x.id) ? { ...x, savedToSection: true } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingSel(false);
    }
  };

  /** Copy all checked answers (each prefixed with its question) to the clipboard. */
  const copySelected = () => {
    const text = qaItems
      .filter((q) => q.assistantId && selected.has(q.assistantId))
      .map((q) => `## ${q.question}\n\n${q.answer}`)
      .join('\n\n---\n\n');
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {/* Dimmed glass backdrop — click to close */}
      <div
        className="fixed inset-0 z-20 bg-gray-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed top-0 right-0 z-30 h-screen w-[560px] max-w-[95vw] bg-white border-l shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Architect Copilot</p>
          <p className="text-[11px] text-gray-500 truncate">§ {sectionName}</p>
        </div>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm">
        <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')}>
          <MessageSquare className="h-4 w-4 mr-1" /> Chat
        </TabBtn>
        <TabBtn active={tab === 'saved'} onClick={() => setTab('saved')}>
          <Bookmark className="h-4 w-4 mr-1" /> Saved ({saved.length})
        </TabBtn>
        <TabBtn active={tab === 'templates'} onClick={() => setTab('templates')}>
          <LayoutTemplate className="h-4 w-4 mr-1" /> Templates
        </TabBtn>
        <TabBtn active={tab === 'references'} onClick={() => setTab('references')}>
          <Paperclip className="h-4 w-4 mr-1" /> Refs{references.length ? ` (${references.length})` : ''}
        </TabBtn>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* Body */}
      {tab === 'chat' ? (
        <>
          {/* Top toolbar — query count + bulk controls */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50/70 text-xs">
            <span className="font-medium text-gray-700">
              {qaItems.length} {qaItems.length === 1 ? 'query' : 'queries'}
            </span>
            {selected.size > 0 && <span className="text-purple-600">· {selected.size} selected</span>}
            {qaItems.length > 0 && (
              <>
                <label className="ml-auto inline-flex items-center gap-1 cursor-pointer text-gray-600 select-none">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-purple-600" />
                  Select all
                </label>
                <button onClick={toggleExpandAll} className="text-gray-500 hover:text-gray-800">
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </>
            )}
          </div>

          {/* Conversation — accordion of Q&As (vertical + horizontal scroll) */}
          <div ref={scrollRef} className="cp-scroll flex-1 overflow-auto px-3 py-3 space-y-2">
            {qaItems.length === 0 && !sending && (
              <div className="text-center text-xs text-gray-400 pt-2 pb-1">
                Ask the copilot about <span className="font-medium">{sectionName}</span> — it knows your PRD, FRD &amp; stack.
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={sending}
                  className="text-[11px] bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1 hover:bg-indigo-100 disabled:opacity-50"
                >
                  {q.replace(/\?.*/, '').slice(0, 28)}
                </button>
              ))}
            </div>
            {qaItems.map((it, idx) => (
              <QaAccordion
                key={it.key}
                index={idx + 1}
                item={it}
                expanded={expanded.has(it.key)}
                selected={!!it.assistantId && selected.has(it.assistantId)}
                onToggleExpand={() => toggleExpand(it.key)}
                onToggleSelect={() => it.assistantId && toggleSelect(it.assistantId)}
              />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          {/* Bulk action bar — common Save / Copy, sized like Send, act on checked */}
          {qaItems.length > 0 && (
            <div className="border-t px-3 py-2 flex items-center gap-2">
              <Button size="sm" onClick={saveSelected} disabled={selected.size === 0 || savingSel}>
                {savingSel ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bookmark className="h-4 w-4 mr-1" />}
                Save to section{selected.size ? ` (${selected.size})` : ''}
              </Button>
              <Button size="sm" variant="outline" onClick={copySelected} disabled={selected.size === 0}>
                <Copy className="h-4 w-4 mr-1" /> {copied ? 'Copied!' : `Copy${selected.size ? ` (${selected.size})` : ''}`}
              </Button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t p-3 space-y-2">
            {activeTemplate && (
              <div className="flex items-center gap-1.5 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-2 py-1">
                <LayoutTemplate className="h-3 w-3 shrink-0" />
                <span className="truncate">Pattern: {activeTemplate.name}</span>
                <button onClick={() => setActiveTemplate(null)} className="ml-auto text-amber-500 hover:text-amber-700">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {activeRefCount > 0 && (
              <button
                onClick={() => setTab('references')}
                className="flex items-center gap-1.5 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-2 py-1 w-full"
                title="Included references are added to the chat context"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span>{activeRefCount} reference{activeRefCount > 1 ? 's' : ''} in context</span>
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder="Ask for best practices, trade-offs, references…  (⌘/Ctrl+Enter)"
              className="w-full text-sm border rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/40"
              disabled={sending}
            />
            <div className="flex items-center gap-2">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="text-xs border rounded-md px-2 py-1.5 bg-white"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}{!p.available ? ' (add key)' : ''}
                  </option>
                ))}
              </select>
              <MicButton size="md" onTranscribed={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))} />
              <Button size="sm" className="ml-auto" onClick={() => send(input)} disabled={sending || !input.trim()}>
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
            </div>
          </div>
        </>
      ) : tab === 'saved' ? (
        // ─── Saved tab ───
        <div className="cp-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {saved.length === 0 ? (
            <div className="text-center text-xs text-gray-400 pt-6">
              No saved insights yet. In Chat, click <BookmarkCheck className="inline h-3 w-3" /> on an answer to save it,
              then synthesize them into the section.
            </div>
          ) : (
            <>
              {saved.map((m) => (
                <div key={m.id} className="border rounded-lg p-2.5 bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[10px] text-gray-400">{m.model ?? 'AI'}</span>
                    <button onClick={() => toggleSave(m)} className="ml-auto text-gray-300 hover:text-red-500" title="Remove from saved">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="cp-scroll max-h-72 overflow-y-auto pr-1 border-t pt-1.5">
                    <Markdown>{m.content}</Markdown>
                  </div>
                </div>
              ))}
              <Button className="w-full" size="sm" onClick={synthesize} disabled={merging}>
                {merging ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                Synthesize merged section
              </Button>
            </>
          )}
        </div>
      ) : tab === 'templates' ? (
        // ─── Templates tab (Architecture console) ───
        <div className="cp-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {/* HD-09 — save this HLD as a reusable template */}
          <div className="border rounded-lg bg-indigo-50/40 border-indigo-200 p-2.5">
            {!showSaveTpl ? (
              <button
                onClick={() => {
                  setShowSaveTpl(true);
                  setTplMsg(null);
                }}
                className="w-full flex items-center gap-2 text-sm font-medium text-indigo-700"
              >
                <Bookmark className="h-4 w-4" /> Save this HLD as a template
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-indigo-800">Save as template</p>
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder={tplWhole ? 'HLD template name…' : `${sectionName} (template)`}
                  className="w-full text-sm border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-gray-500">Content</label>
                  <select
                    value={tplWhole ? 'whole' : 'section'}
                    onChange={(e) => setTplWhole(e.target.value === 'whole')}
                    className="border rounded-md px-2 py-1 bg-white"
                  >
                    <option value="whole">Whole HLD</option>
                    <option value="section">This section ({sectionName})</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-gray-500">Scope</label>
                  <select
                    value={tplScope}
                    onChange={(e) => setTplScope(e.target.value as 'GLOBAL' | 'PROJECT')}
                    className="border rounded-md px-2 py-1 bg-white"
                  >
                    <option value="GLOBAL">All projects (global)</option>
                    <option value="PROJECT">This project only</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Button size="sm" onClick={saveTemplate} disabled={savingTpl}>
                    {savingTpl ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bookmark className="h-4 w-4 mr-1" />}
                    Save template
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowSaveTpl(false)} disabled={savingTpl}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {tplMsg && <p className="text-[11px] text-emerald-700 mt-1.5">✓ {tplMsg}</p>}
          </div>

          <p className="text-[11px] text-gray-400 px-0.5">
            Pick a reference pattern to steer the copilot, or draft this section from it.
          </p>
          {templates.length === 0 ? (
            <div className="text-center text-xs text-gray-400 pt-6">No templates available.</div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="border rounded-lg p-2.5 bg-white">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="ml-auto text-[9px] uppercase rounded px-1 py-0.5 bg-gray-100 text-gray-500">{t.source}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.summary}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => {
                      setActiveTemplate(t);
                      setTab('chat');
                    }}
                  >
                    Use as context
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7"
                    disabled={sending}
                    onClick={() => {
                      setActiveTemplate(t);
                      setTab('chat');
                      void send(
                        `Draft this section following the "${t.name}" reference pattern. Give a complete first draft tailored to our project.`,
                      );
                    }}
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1" /> Draft section
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // ─── References tab (RR-08) ───
        <div className="cp-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2">
          <div className="border rounded-lg bg-amber-50/40 border-amber-200 p-2.5 space-y-2">
            <p className="text-xs font-semibold text-amber-800">Add a reference for grounding</p>
            <div className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-amber-600 shrink-0" />
              <input
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                placeholder="https://… (latest trends / best practices)"
                className="flex-1 text-sm border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                disabled={addingRef}
              />
              <Button size="sm" onClick={addUrl} disabled={addingRef || !refUrl.trim()}>
                {addingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDoc(f);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={addingRef}>
                <Upload className="h-4 w-4 mr-1" /> Upload document
              </Button>
              <label className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={refTagSection} onChange={(e) => setRefTagSection(e.target.checked)} className="accent-amber-600" />
                tag to “{sectionName}”
              </label>
            </div>
            <p className="text-[10px] text-gray-400">
              Checked (✓) references are added to the chat context. Untagged = whole HLD.
            </p>
          </div>

          {references.length === 0 ? (
            <div className="text-center text-xs text-gray-400 pt-6">No references yet.</div>
          ) : (
            references.map((r) => (
              <div key={r.id} className="border rounded-lg p-2.5 bg-white">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={r.includeInContext}
                    disabled={r.status !== 'READY'}
                    onChange={() => toggleRefInclude(r)}
                    className="mt-1 accent-amber-600 shrink-0 disabled:opacity-40"
                    title={r.status === 'READY' ? 'Include in chat context' : 'Not ready'}
                  />
                  {r.type === 'URL' ? <Globe className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-1" /> : <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-1" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-800 truncate">{r.title}</span>
                      {r.sourceUrl && (
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gray-600 shrink-0">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusBadge status={r.status} />
                      {r.sectionKey && <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1 py-0.5">§ tagged</span>}
                    </div>
                  </div>
                  <button onClick={() => removeRef(r)} className="text-gray-300 hover:text-red-500 shrink-0 mt-0.5" title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {r.status === 'FAILED' && r.error && <p className="text-[11px] text-red-600 mt-1 ml-6">{r.error}</p>}
                {r.status === 'READY' && r.summary && (
                  <details className="mt-1.5 ml-6">
                    <summary className="text-[11px] text-indigo-600 cursor-pointer">View summary</summary>
                    <div className="cp-scroll max-h-60 overflow-y-auto border-t mt-1 pt-1.5">
                      <Markdown>{r.summary}</Markdown>
                    </div>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Merge review modal */}
      {draft != null && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-500" />
              <p className="text-sm font-semibold">Review merged draft · {sectionName}</p>
              <button onClick={() => setDraft(null)} className="ml-auto text-gray-400 hover:text-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-0 overflow-hidden flex-1">
              <div className="cp-scroll overflow-y-auto p-4 border-r">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Current section</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{currentText(currentBody)}</pre>
              </div>
              <div className="cp-scroll overflow-y-auto p-4 bg-emerald-50/40">
                <p className="text-[10px] uppercase tracking-wide text-emerald-600 mb-2">AI-merged draft (new "aiSynthesis" field)</p>
                <Markdown>{draft}</Markdown>
              </div>
            </div>
            <div className="px-5 py-3 border-t flex items-center gap-2">
              <p className="text-[11px] text-gray-400 mr-auto">Adds/updates an “AI Synthesis” field — your existing fields are kept.</p>
              <Button variant="outline" size="sm" onClick={() => setDraft(null)} disabled={applying}>Discard</Button>
              <Button size="sm" onClick={applyDraft} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Apply to section
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: 'PENDING' | 'READY' | 'FAILED' }) {
  const map = {
    READY: 'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-red-100 text-red-700',
  } as const;
  const label = status === 'READY' ? '✓ ready' : status === 'PENDING' ? '⏳ pending' : '✕ failed';
  return <span className={`text-[9px] uppercase rounded px-1 py-0.5 ${map[status]}`}>{label}</span>;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center py-2 ${active ? 'text-purple-700 font-medium border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}

function QaAccordion({
  index,
  item,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelect,
}: {
  index: number;
  item: { question: string; answer: string; model: string | null; assistantId: string | null; savedToSection: boolean };
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
}) {
  const canSelect = !!item.assistantId;
  return (
    <div className={`border rounded-lg bg-white ${selected ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-2 px-2.5 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={!canSelect}
          className="mt-1 accent-purple-600 shrink-0 disabled:opacity-40"
          title={canSelect ? 'Select for Save / Copy' : 'No answer yet'}
        />
        <button onClick={onToggleExpand} className="flex items-start gap-1.5 min-w-0 flex-1 text-left">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
          )}
          <span className="text-[10px] font-mono text-gray-400 mt-0.5 shrink-0">Q{index}</span>
          <span className={`text-sm text-gray-800 ${expanded ? '' : 'line-clamp-2'}`}>{item.question}</span>
        </button>
        {item.savedToSection && (
          <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-1" aria-label="Saved to section" />
        )}
      </div>
      {expanded && item.answer && (
        <div className="cp-scroll border-t px-3 py-2 max-h-80 overflow-auto">
          <Markdown>{item.answer}</Markdown>
          {item.model && <p className="text-[10px] text-gray-400 mt-1">{item.model}</p>}
        </div>
      )}
    </div>
  );
}

function currentText(body: Record<string, unknown> | undefined): string {
  if (!body || !Object.keys(body).length) return '(empty)';
  return Object.entries(body)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v, null, 2)}`)
    .join('\n\n');
}
