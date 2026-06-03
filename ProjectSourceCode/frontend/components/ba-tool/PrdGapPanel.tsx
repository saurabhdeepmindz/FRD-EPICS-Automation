'use client';

/**
 * PrdGapPanel (Sprint v6 · Track S · S-06).
 *
 * Interactive gap-answering loop on the project-prd page. Ports the legacy
 * `conversational/GapWizard` UX (per-gap card, voice/text answer, progress trail)
 * onto the new persistent model: answers are submitted as a structured array to
 * `answerProjectPrdGaps`, which merges them via the AI `/gap-check` endpoint and
 * creates a new PRD version. On success the parent reloads (fewer gaps, fuller PRD).
 */

import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Send,
  SkipForward,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MicButton } from '@/components/forms/MicButton';
import { PRD_SECTION_NAMES, answerProjectPrdGaps, type PrdGap } from '@/lib/pipeline-api';

type GapStatus = 'pending' | 'answered' | 'skipped';

interface GapRow {
  gap: PrdGap;
  status: GapStatus;
  answer: string;
}

interface PrdGapPanelProps {
  projectId: string;
  gaps: PrdGap[];
  /** Called after answers are merged + a new PRD version is created. */
  onAnswered: () => void | Promise<void>;
}

function sectionName(n: number): string {
  return PRD_SECTION_NAMES[String(n)] ?? `Section ${n}`;
}

export function PrdGapPanel({ projectId, gaps, onAnswered }: PrdGapPanelProps) {
  const [rows, setRows] = useState<GapRow[]>(() =>
    gaps.map((g) => ({ gap: g, status: 'pending', answer: '' })),
  );
  const [active, setActive] = useState(0);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = rows.filter((r) => r.status === 'answered').length;
  const skippedCount = rows.filter((r) => r.status === 'skipped').length;
  const remaining = rows.filter((r) => r.status === 'pending').length;
  const current = rows[active];

  const moveToNextPending = useCallback(() => {
    for (let i = active + 1; i < rows.length; i++) {
      if (rows[i].status === 'pending') {
        setActive(i);
        setInput('');
        return;
      }
    }
    for (let i = 0; i < active; i++) {
      if (rows[i].status === 'pending') {
        setActive(i);
        setInput('');
        return;
      }
    }
    setInput('');
  }, [active, rows]);

  const submitAnswer = useCallback(() => {
    if (!input.trim()) return;
    setRows((prev) => {
      const next = [...prev];
      next[active] = { ...next[active], status: 'answered', answer: input.trim() };
      return next;
    });
    moveToNextPending();
  }, [input, active, moveToNextPending]);

  const skip = useCallback(() => {
    setRows((prev) => {
      const next = [...prev];
      next[active] = { ...next[active], status: 'skipped', answer: '' };
      return next;
    });
    moveToNextPending();
  }, [active, moveToNextPending]);

  const jumpTo = useCallback(
    (i: number) => {
      setActive(i);
      setInput(rows[i].answer);
    },
    [rows],
  );

  const submitAll = useCallback(async () => {
    const answers = rows
      .filter((r) => r.status === 'answered' && r.answer.trim())
      .map((r) => ({ section: r.gap.section, question: r.gap.question, answer: r.answer.trim() }));
    if (!answers.length) return;
    setSubmitting(true);
    setError(null);
    try {
      await answerProjectPrdGaps(projectId, answers);
      await onAnswered();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to submit answers');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [rows, projectId, onAnswered]);

  if (!gaps.length) return null;

  const pct = Math.round(((answeredCount + skippedCount) / gaps.length) * 100);

  return (
    <Card className="border-amber-200">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {gaps.length} gap{gaps.length === 1 ? '' : 's'} flagged — answer to enrich the PRD
          </p>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {answeredCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> {skippedCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {remaining}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {/* Active gap */}
        {current && (
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <span className="text-xs font-medium text-gray-600">
                Gap {active + 1} of {gaps.length} · <span className="font-mono">§{current.gap.section}</span>{' '}
                {sectionName(current.gap.section)}
              </span>
              {current.status !== 'pending' && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    current.status === 'answered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {current.status === 'answered' ? 'Answered' : 'Skipped'}
                </span>
              )}
            </div>
            <div className="px-3 py-3 space-y-3">
              <p className="text-sm text-gray-800 leading-relaxed">{current.gap.question}</p>
              <div className="flex items-start gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={3}
                  placeholder="Type your answer or use the mic…"
                  className="flex-1 rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      submitAnswer();
                    }
                  }}
                />
                <MicButton size="md" onTranscribed={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} />
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={skip} className="text-gray-500">
                  <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
                </Button>
                <Button size="sm" onClick={submitAnswer} disabled={!input.trim()}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Submit &amp; Next
                </Button>
              </div>
              <p className="text-[10px] text-gray-400">Ctrl+Enter to submit · click the mic for voice input</p>
            </div>
          </div>
        )}

        {/* Trail */}
        {rows.some((r) => r.status !== 'pending') && (
          <div className="space-y-1">
            {rows.map((r, i) =>
              r.status === 'pending' ? null : (
                <button
                  key={i}
                  onClick={() => jumpTo(i)}
                  className={`w-full text-left rounded px-2.5 py-1.5 text-xs border transition-colors ${
                    i === active ? 'border-blue-300 bg-blue-50/50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {r.status === 'answered' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    ) : (
                      <SkipForward className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    )}
                    <span className="text-gray-500 font-medium">§{r.gap.section}</span>
                    <span className="text-gray-700 truncate">
                      {r.status === 'answered' ? `"${r.answer.slice(0, 60)}${r.answer.length > 60 ? '…' : ''}"` : 'Skipped'}
                    </span>
                  </span>
                </button>
              ),
            )}
          </div>
        )}

        {/* Footer nav + submit */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => jumpTo(Math.max(0, active - 1))}
              disabled={active === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => jumpTo(Math.min(rows.length - 1, active + 1))}
              disabled={active >= rows.length - 1}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={submitAll} disabled={submitting || answeredCount === 0}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Merging…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Submit {answeredCount} answer{answeredCount === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
