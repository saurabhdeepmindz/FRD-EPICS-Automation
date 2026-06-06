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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/forms/MicButton';
import { Markdown } from '@/components/ba-tool/Markdown';
import {
  listHldProviders,
  listHldTemplates,
  getHldThread,
  hldCopilotChat,
  saveHldInsight,
  hldCopilotMerge,
  updateHldSection,
  type HldProvider,
  type HldTemplate,
  type HldChatMessage,
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
  const [tab, setTab] = useState<'chat' | 'saved' | 'templates'>('chat');
  const [providers, setProviders] = useState<HldProvider[]>([]);
  const [provider, setProvider] = useState('anthropic');
  const [templates, setTemplates] = useState<HldTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<HldTemplate | null>(null);
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
    <div className="fixed top-0 right-0 z-30 h-screen w-[400px] bg-white border-l shadow-xl flex flex-col">
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
      ) : (
        // ─── Templates tab (Architecture console) ───
        <div className="cp-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2">
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
  );
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
