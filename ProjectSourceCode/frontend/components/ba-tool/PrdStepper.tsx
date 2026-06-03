'use client';

/**
 * PrdStepper (Sprint v7 · Track X · Task 6).
 * Numbered 1–22 stepper colored by authoring status (or review status in review mode).
 */

import type { SectionStatus, ReviewStatus } from '@/lib/pipeline-api';

interface PrdStepperProps {
  activeKey: string;
  /** Authoring status per section key ("1".."22"). */
  statuses: Record<string, SectionStatus>;
  /** When set (review mode), color by review status instead. */
  review?: Record<string, ReviewStatus>;
  onSelect: (key: string) => void;
}

function authoringClass(status: SectionStatus, active: boolean): string {
  if (active) return 'bg-blue-600 text-white ring-2 ring-blue-300 scale-110';
  if (status === 'COMPLETE') return 'bg-green-500 text-white';
  if (status === 'IN_PROGRESS') return 'bg-amber-500 text-white';
  return 'bg-gray-200 text-gray-500';
}

function reviewClass(status: ReviewStatus, active: boolean): string {
  if (active) return 'bg-blue-600 text-white ring-2 ring-blue-300 scale-110';
  if (status === 'accepted' || status === 'edited') return 'bg-green-500 text-white';
  if (status === 'skipped') return 'bg-gray-400 text-white';
  return 'bg-amber-400 text-white'; // pending
}

export function PrdStepper({ activeKey, statuses, review, onSelect }: PrdStepperProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-4 py-3 border-b bg-white">
      {Array.from({ length: 22 }, (_, i) => String(i + 1)).map((key) => {
        const active = key === activeKey;
        const cls = review
          ? reviewClass(review[key] ?? 'pending', active)
          : authoringClass(statuses[key] ?? 'NOT_STARTED', active);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            title={`Section ${key}`}
            className={`w-8 h-8 rounded-full text-xs font-medium shrink-0 flex items-center justify-center transition-all ${cls}`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
