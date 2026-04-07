'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { GapItem } from '@/lib/api';
import { MicButton } from '@/components/forms/MicButton';

type GapStatus = 'pending' | 'answered' | 'skipped';

interface GapAnswer {
  gap: GapItem;
  status: GapStatus;
  answer: string;
}

interface GapWizardProps {
  gaps: GapItem[];
  onSubmitAll: (answers: string) => Promise<void>;
  onProceedToReview: () => void;
  loading: boolean;
}

const SECTION_NAMES: Record<number, string> = {
  1: 'Overview', 2: 'Scope', 3: 'Out of Scope', 4: 'Assumptions',
  5: 'Actors', 6: 'Functional Req', 7: 'Integrations', 8: 'Journeys',
  9: 'Landscape', 10: 'NFRs', 11: 'Technology', 12: 'DevOps',
  13: 'UI/UX', 14: 'Branding', 15: 'Compliance', 16: 'Testing',
  17: 'Deliverables', 18: 'Receivables', 19: 'Environment',
  20: 'Timelines', 21: 'Success Criteria', 22: 'Misc',
};

export function GapWizard({ gaps, onSubmitAll, onProceedToReview, loading }: GapWizardProps) {
  const [gapAnswers, setGapAnswers] = useState<GapAnswer[]>(() =>
    gaps.map((g) => ({ gap: g, status: 'pending', answer: '' })),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');

  // Unique sections that have gaps
  const sectionPills = useMemo(() => {
    const sectionMap = new Map<number, GapStatus>();
    for (const ga of gapAnswers) {
      const existing = sectionMap.get(ga.gap.section);
      if (!existing || existing === 'pending') {
        sectionMap.set(ga.gap.section, ga.status);
      }
      // If any gap in this section is still pending, mark section as pending
      if (ga.status === 'pending' && existing !== 'pending') {
        // Check if ALL gaps for this section are answered/skipped
        const allForSection = gapAnswers.filter((g) => g.gap.section === ga.gap.section);
        const allDone = allForSection.every((g) => g.status !== 'pending');
        if (!allDone) sectionMap.set(ga.gap.section, 'pending');
      }
    }
    // Recompute properly
    const result: { section: number; status: GapStatus }[] = [];
    const seen = new Set<number>();
    for (const ga of gapAnswers) {
      if (seen.has(ga.gap.section)) continue;
      seen.add(ga.gap.section);
      const allForSection = gapAnswers.filter((g) => g.gap.section === ga.gap.section);
      const allAnswered = allForSection.every((g) => g.status === 'answered');
      const allDone = allForSection.every((g) => g.status !== 'pending');
      const status: GapStatus = allAnswered ? 'answered' : allDone ? 'skipped' : 'pending';
      result.push({ section: ga.gap.section, status });
    }
    return result;
  }, [gapAnswers]);

  const answeredCount = gapAnswers.filter((g) => g.status === 'answered').length;
  const skippedCount = gapAnswers.filter((g) => g.status === 'skipped').length;
  const remainingCount = gapAnswers.filter((g) => g.status === 'pending').length;
  const allDone = remainingCount === 0;

  const current = gapAnswers[activeIndex];

  const moveToNext = useCallback(() => {
    // Find next pending gap
    for (let i = activeIndex + 1; i < gapAnswers.length; i++) {
      if (gapAnswers[i].status === 'pending') {
        setActiveIndex(i);
        setCurrentInput('');
        return;
      }
    }
    // Wrap around
    for (let i = 0; i < activeIndex; i++) {
      if (gapAnswers[i].status === 'pending') {
        setActiveIndex(i);
        setCurrentInput('');
        return;
      }
    }
    // All done — stay on current
    setCurrentInput('');
  }, [activeIndex, gapAnswers]);

  const handleSubmitAnswer = useCallback(() => {
    if (!currentInput.trim()) return;
    setGapAnswers((prev) => {
      const updated = [...prev];
      updated[activeIndex] = {
        ...updated[activeIndex],
        status: 'answered',
        answer: currentInput.trim(),
      };
      return updated;
    });
    moveToNext();
  }, [activeIndex, currentInput, moveToNext]);

  const handleSkip = useCallback(() => {
    setGapAnswers((prev) => {
      const updated = [...prev];
      updated[activeIndex] = { ...updated[activeIndex], status: 'skipped', answer: '' };
      return updated;
    });
    moveToNext();
  }, [activeIndex, moveToNext]);

  const handlePrevious = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
      setCurrentInput(gapAnswers[activeIndex - 1].answer);
    }
  }, [activeIndex, gapAnswers]);

  const handleNext = useCallback(() => {
    if (activeIndex < gapAnswers.length - 1) {
      setActiveIndex(activeIndex + 1);
      setCurrentInput(gapAnswers[activeIndex + 1].answer);
    }
  }, [activeIndex, gapAnswers]);

  const handleJumpToGap = useCallback(
    (idx: number) => {
      setActiveIndex(idx);
      setCurrentInput(gapAnswers[idx].answer);
    },
    [gapAnswers],
  );

  const handleReviewAll = useCallback(async () => {
    // Consolidate all answers into a single string for the gap-check API
    const consolidated = gapAnswers
      .filter((g) => g.status === 'answered')
      .map((g) => `Section ${g.gap.section}: ${g.answer}`)
      .join('\n\n');

    if (consolidated.trim()) {
      await onSubmitAll(consolidated);
    }
    onProceedToReview();
  }, [gapAnswers, onSubmitAll, onProceedToReview]);

  return (
    <div className="space-y-4" data-testid="gap-wizard">
      {/* ── Header: Gap count + Section pills ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">
              Gap Analysis — {gaps.length} gaps across {sectionPills.length} sections
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {answeredCount} answered
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> {skippedCount} skipped
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {remainingCount} remaining
            </span>
          </div>
        </div>

        {/* Section pills */}
        <div className="flex flex-wrap gap-1.5">
          {sectionPills.map((pill) => {
            const isActive = current?.gap.section === pill.section;
            const bgCls =
              pill.status === 'answered'
                ? 'bg-green-100 text-green-700 border-green-300'
                : pill.status === 'skipped'
                  ? 'bg-gray-100 text-gray-500 border-gray-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300';
            const ringCls = isActive ? 'ring-2 ring-primary ring-offset-1' : '';
            // Find first gap index for this section
            const gapIdx = gapAnswers.findIndex((g) => g.gap.section === pill.section);
            return (
              <button
                key={pill.section}
                onClick={() => gapIdx >= 0 && handleJumpToGap(gapIdx)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-full border transition-all ${bgCls} ${ringCls} hover:opacity-80`}
                title={`S${pill.section}: ${SECTION_NAMES[pill.section] ?? ''} (${pill.status})`}
              >
                S{pill.section} {SECTION_NAMES[pill.section] ?? ''}
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${((answeredCount + skippedCount) / gaps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Active gap card ── */}
      {current && (
        <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid="active-gap-card">
          {/* Card header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                Gap {activeIndex + 1} of {gaps.length}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Section {current.gap.section} — {SECTION_NAMES[current.gap.section] ?? ''}
              </span>
            </div>
            {current.status !== 'pending' && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                current.status === 'answered'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {current.status === 'answered' ? 'Answered' : 'Skipped'}
              </span>
            )}
          </div>

          {/* Question */}
          <div className="px-4 py-4">
            <div className="flex gap-3 mb-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-foreground leading-relaxed">{current.gap.question}</p>
            </div>

            {/* Answer textarea with mic */}
            <div className="flex items-start gap-2">
              <textarea
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                rows={4}
                placeholder="Type your answer or use the mic..."
                className="flex-1 rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
                data-testid="gap-answer-input"
              />
              <MicButton
                size="md"
                onTranscribed={(text) => setCurrentInput((prev) => prev ? `${prev} ${text}` : text)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Ctrl+Enter to submit &middot; Click mic for voice input</p>
          </div>

          {/* Card footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
              data-testid="btn-skip-gap"
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={!currentInput.trim()}
              data-testid="btn-submit-gap"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Submit & Next
            </Button>
          </div>
        </div>
      )}

      {/* ── Previously answered/skipped trail ── */}
      {gapAnswers.some((g) => g.status !== 'pending') && (
        <div className="space-y-1.5" data-testid="gap-trail">
          <p className="text-xs font-medium text-muted-foreground">Previously answered</p>
          {gapAnswers.map((ga, idx) => {
            if (ga.status === 'pending') return null;
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => handleJumpToGap(idx)}
                className={`w-full text-left rounded-md px-3 py-2 text-xs border transition-colors ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {ga.status === 'answered' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : (
                    <SkipForward className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}
                  <span className="font-medium text-muted-foreground">
                    Gap {idx + 1} (S{ga.gap.section}):
                  </span>
                  <span className="truncate text-foreground">
                    {ga.status === 'answered'
                      ? `"${ga.answer.substring(0, 60)}${ga.answer.length > 60 ? '...' : ''}"`
                      : 'Skipped'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Navigation + Review All footer ── */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={activeIndex === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={activeIndex >= gapAnswers.length - 1}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {answeredCount} answered &middot; {skippedCount} skipped &middot; {remainingCount} remaining
        </div>

        <Button
          size="sm"
          onClick={handleReviewAll}
          disabled={loading || (!allDone && answeredCount === 0)}
          data-testid="btn-review-all"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {allDone ? 'Review All & Proceed' : `Review (${answeredCount} answered)`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
