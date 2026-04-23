'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/forms/MicButton';
import { AISuggestButton } from '@/components/forms/AISuggestButton';
import {
  baRefineSection,
  deleteLldAttachment,
  listLldAttachments,
  lldGapCheck,
  saveLldConfig,
  uploadLldAttachments,
  type BaLldAttachmentMeta,
  type BaLldGap,
} from '@/lib/ba-api';
import { AlertTriangle, Edit3, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  moduleDbId: string;
  moduleLabel: string;
  initialNarrative: string;
  initialUseAsAdditional: boolean;
  onSaved?: (narrative: string, useAsAdditional: boolean) => void;
}

const ACCEPTED_TYPES = '.md,.txt,.pdf,.docx,.png,.jpg,.jpeg';
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Top-of-page narrative + attachments + gap-check card for the LLD Configurator.
 * Parallels the PRD's narrative-first entry point: architect writes or dictates
 * free-form requirements, optionally attaches up to 30 MB of supporting docs,
 * runs a structured gap-check, answers the AI's questions, then triggers LLD
 * generation. The existing stack/template/NFR selectors remain unchanged below.
 */
export function LldNarrativeCard({
  moduleDbId,
  moduleLabel,
  initialNarrative,
  initialUseAsAdditional,
  onSaved,
}: Props) {
  const [narrative, setNarrative] = useState(initialNarrative);
  const [useAsAdditional, setUseAsAdditional] = useState(initialUseAsAdditional);
  const [editing, setEditing] = useState(initialNarrative.length === 0);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const [attachments, setAttachments] = useState<BaLldAttachmentMeta[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [gapLoading, setGapLoading] = useState(false);
  const [gaps, setGaps] = useState<BaLldGap[] | null>(null);
  const [gapAnswers, setGapAnswers] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initial attachment load (runs once per module change).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listLldAttachments(moduleDbId);
        if (!cancelled) {
          setAttachments(res.attachments);
          setTotalBytes(res.totalBytes);
        }
      } catch {
        // silent — architect can still type a narrative without attachments
      }
    })();
    return () => { cancelled = true; };
  }, [moduleDbId]);

  const persistConfig = useCallback(async (nextNarrative: string, nextUseAsAdditional: boolean) => {
    setSaving(true);
    try {
      await saveLldConfig(moduleDbId, {
        narrative: nextNarrative || null,
        useAsAdditional: nextUseAsAdditional,
      } as Parameters<typeof saveLldConfig>[1]);
      onSaved?.(nextNarrative, nextUseAsAdditional);
    } catch {
      alert('Failed to save narrative. Check the backend is running.');
    } finally {
      setSaving(false);
    }
  }, [moduleDbId, onSaved]);

  const handleSave = useCallback(async () => {
    await persistConfig(narrative, useAsAdditional);
    setEditing(false);
  }, [narrative, useAsAdditional, persistConfig]);

  const handleMicTranscribed = useCallback((text: string) => {
    if (!editing) setEditing(true);
    setNarrative((prev) => (prev ? `${prev}\n${text}` : text));
  }, [editing]);

  const handleAISuggest = useCallback(async () => {
    if (!narrative.trim()) {
      alert('Write or dictate some text first — AI Suggest refines what you have.');
      return;
    }
    setSuggesting(true);
    try {
      const { suggestion } = await baRefineSection({
        artifactType: 'LLD_NARRATIVE',
        sectionLabel: 'Architect Narrative',
        currentText: narrative,
        moduleContext: `This is a free-form narrative from the Architect describing additional LLD requirements for module ${moduleLabel}. Preserve intent and technical terms; tighten language; keep it under 1500 words.`,
      });
      if (!editing) setEditing(true);
      setNarrative(suggestion);
    } catch {
      alert('AI Suggest failed. Check the AI service is running.');
    } finally {
      setSuggesting(false);
    }
  }, [narrative, moduleLabel, editing]);

  const handleFilesPicked = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    const incoming = picked.reduce((s, f) => s + f.size, 0);
    if (totalBytes + incoming > MAX_TOTAL_BYTES) {
      alert(`Total attachments would exceed 30 MB (${formatBytes(totalBytes + incoming)}). Delete some first.`);
      return;
    }
    setUploading(true);
    try {
      const res = await uploadLldAttachments(moduleDbId, picked);
      setAttachments(res.attachments);
      setTotalBytes(res.totalBytes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'upload failed';
      alert(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [moduleDbId, totalBytes]);

  const handleDeleteAttachment = useCallback(async (id: string) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteLldAttachment(moduleDbId, id);
      const res = await listLldAttachments(moduleDbId);
      setAttachments(res.attachments);
      setTotalBytes(res.totalBytes);
    } catch {
      alert('Delete failed');
    }
  }, [moduleDbId]);

  const handleGapCheck = useCallback(async () => {
    if (!narrative.trim()) {
      alert('Write or dictate a narrative first.');
      return;
    }
    // Persist the latest narrative before asking the AI so the server sees it.
    await persistConfig(narrative, useAsAdditional);
    setGapLoading(true);
    try {
      const { gaps: received } = await lldGapCheck(moduleDbId);
      setGaps(received);
      setGapAnswers({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      alert(`Gap-check failed: ${msg}`);
    } finally {
      setGapLoading(false);
    }
  }, [narrative, useAsAdditional, moduleDbId, persistConfig]);

  const handleAnswerChange = useCallback((gapId: string, text: string) => {
    setGapAnswers((prev) => ({ ...prev, [gapId]: text }));
  }, []);

  const handleAcceptAllDefaults = useCallback(() => {
    if (!gaps) return;
    const filled: Record<string, string> = {};
    for (const g of gaps) filled[g.id] = `(accept default) ${g.suggestion}`;
    setGapAnswers(filled);
  }, [gaps]);

  const handleAppendAnswersToNarrative = useCallback(async () => {
    if (!gaps || gaps.length === 0) return;
    const answered = gaps
      .map((g) => {
        const a = gapAnswers[g.id]?.trim();
        if (!a) return null;
        return `- **${g.category} — ${g.question}**\n  ${a}`;
      })
      .filter((x): x is string => x !== null);
    if (answered.length === 0) {
      alert('Answer at least one gap question (or click "Accept all defaults") before continuing.');
      return;
    }
    const appended = `${narrative.trim()}\n\n## Gap-Check Resolutions\n${answered.join('\n')}`;
    setNarrative(appended);
    await persistConfig(appended, useAsAdditional);
    setGaps(null);
    setGapAnswers({});
    alert('Gap answers folded into the narrative. Click "Generate LLD" to produce the document.');
  }, [gaps, gapAnswers, narrative, useAsAdditional, persistConfig]);

  const overLimit = totalBytes > MAX_TOTAL_BYTES;

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">Architect Narrative <span className="text-muted-foreground font-normal">(optional)</span></h3>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={useAsAdditional}
            onChange={(e) => {
              setUseAsAdditional(e.target.checked);
              // Persist the toggle immediately so the next generate call picks it up
              void persistConfig(narrative, e.target.checked);
            }}
            className="h-3.5 w-3.5"
          />
          <span>Use as additional context (unchecked = drive LLD from narrative only)</span>
        </label>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Describe additional LLD requirements that go beyond the default framework — e.g. custom integrations,
          specific security constraints, performance targets, or capabilities missing from the standard 19-section template.
          The AI will compare against the framework and ask follow-up questions for any gaps before generating the LLD.
        </p>

        {/* Textarea + controls */}
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-end gap-1.5 px-3 py-2 bg-muted/20 border-b border-border">
            <MicButton onTranscribed={handleMicTranscribed} />
            <AISuggestButton onClick={handleAISuggest} loading={suggesting} />
            {!editing ? (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(true)}>
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="h-3.5 w-3.5 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setNarrative(initialNarrative); setEditing(false); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </>
            )}
          </div>
          {editing ? (
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={Math.min(18, Math.max(6, narrative.split('\n').length + 1))}
              placeholder="e.g. This module also needs a Kafka-based event bus for audit events, plus rate-limit enforcement at 100 req/sec per tenant..."
              className="w-full px-3 py-2 text-sm bg-background resize-y focus:outline-none font-mono"
            />
          ) : (
            <div className="px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
              {narrative || <span className="text-muted-foreground italic">No narrative yet — click Edit or use the mic to start.</span>}
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Attachments</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                overLimit ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground',
              )}>
                {formatBytes(totalBytes)} / 30 MB
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || overLimit}
            >
              <Upload className="h-3 w-3 mr-1" />
              {uploading ? 'Uploading…' : 'Add files'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => handleFilesPicked(e.target.files)}
            />
          </div>
          {attachments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">No attachments. Accepts: .md, .txt, .pdf, .docx, .png, .jpg (30 MB total).</p>
          ) : (
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-xs border border-border rounded px-2 py-1 bg-card">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono truncate">{a.fileName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(a.sizeBytes)}</span>
                    {a.extractionNote && (
                      <span title={a.extractionNote} className="text-amber-600 shrink-0"><AlertTriangle className="h-3 w-3" /></span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteAttachment(a.id)}
                    className="text-muted-foreground hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Gap-check */}
        <div className="border-t border-primary/20 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Run a gap-check to let the AI compare your narrative against the 19-section LLD framework and ask about anything unclear.
            </p>
            <Button size="sm" onClick={handleGapCheck} disabled={gapLoading || !narrative.trim()}>
              {gapLoading ? <span className="h-3.5 w-3.5 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              {gaps ? 'Re-run gap-check' : 'Check for gaps'}
            </Button>
          </div>

          {gaps && gaps.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold">AI identified {gaps.length} gap{gaps.length !== 1 ? 's' : ''}</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7" onClick={handleAcceptAllDefaults}>Accept all defaults</Button>
                  <Button size="sm" className="h-7" onClick={handleAppendAnswersToNarrative}>
                    Append answers → Narrative
                  </Button>
                </div>
              </div>
              {gaps.map((g) => (
                <GapRow
                  key={g.id}
                  gap={g}
                  answer={gapAnswers[g.id] ?? ''}
                  onChange={(text) => handleAnswerChange(g.id, text)}
                />
              ))}
            </div>
          )}
          {gaps && gaps.length === 0 && (
            <p className="mt-3 text-xs text-emerald-700">No gaps — the narrative is complete. Click "Generate LLD" below.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GapRow({
  gap,
  answer,
  onChange,
}: {
  gap: BaLldGap;
  answer: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase font-semibold">{gap.category}</span>
        <span className="text-xs font-semibold">{gap.question}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        <span className="font-medium">Suggested default:</span> {gap.suggestion}
      </p>
      <div className="flex items-start gap-1.5">
        <textarea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Your answer (leave blank to skip, or click 'Accept all defaults' above)…"
          className="flex-1 rounded border border-input px-2 py-1 text-xs bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <MicButton onTranscribed={(text) => onChange(answer ? `${answer} ${text}` : text)} />
      </div>
    </div>
  );
}
