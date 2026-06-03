'use client';

/**
 * PrdReviewMode (Sprint v7 · Track W · Tasks 13–14).
 * Draft-review gate: per-section Accept / Edit / Skip, Accept All Pending,
 * progress summary, and Confirm (DRAFT → CONFIRMED / CONFIRMED_PARTIAL).
 */

import { useState } from 'react';
import { Check, Pencil, SkipForward, CheckCheck, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  setPrdReviewStatus,
  acceptAllPrdReview,
  confirmProjectPrd,
  PRD_SECTION_NAMES,
  type ProjectPrd,
  type ReviewStatus,
} from '@/lib/pipeline-api';
import { toStructured, fieldText } from '@/lib/structured-field';

interface PrdReviewModeProps {
  projectId: string;
  prd: ProjectPrd;
  onChanged: () => void | Promise<void>;
  /** Switch to the guided editor (review "Edit"). */
  onEditSection: (key: string) => void;
}

function leafText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return fieldText(toStructured(v));
  if (Array.isArray(v)) return v.map(leafText).filter(Boolean).join(' · ');
  if (typeof v === 'object') {
    const f = toStructured(v);
    if (f.aiContent != null || f.editedContent != null) return fieldText(f);
    return Object.values(v as Record<string, unknown>).map(leafText).filter(Boolean).join(' — ');
  }
  return String(v);
}

const PILL: Record<ReviewStatus, string> = {
  accepted: 'bg-green-100 text-green-700',
  edited: 'bg-blue-100 text-blue-700',
  skipped: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-100 text-amber-700',
};

export function PrdReviewMode({ projectId, prd, onChanged, onEditSection }: PrdReviewModeProps) {
  const [busy, setBusy] = useState(false);
  const review = prd.review ?? {};
  const progress = prd.reviewProgress ?? { accepted: 0, edited: 0, skipped: 0, pending: 22 };
  const reviewed = progress.accepted + progress.edited + progress.skipped;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (key: string, status: ReviewStatus) =>
    act(() => setPrdReviewStatus(projectId, prd.id, key, status));

  return (
    <div className="space-y-4">
      {/* Header — progress + actions */}
      <Card className="border-blue-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-medium text-gray-800">
              Draft review — {reviewed}/22 reviewed
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => act(() => acceptAllPrdReview(projectId, prd.id))} disabled={busy}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Accept All Pending
              </Button>
              <Button
                size="sm"
                onClick={() => act(() => confirmProjectPrd(projectId, prd.id))}
                disabled={busy}
                title={progress.pending > 0 ? 'Some sections still pending — will confirm as partial' : 'Confirm the PRD'}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                Confirm PRD
              </Button>
            </div>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(reviewed / 22) * 100}%` }} />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>✓ {progress.accepted} accepted</span>
            <span>✎ {progress.edited} edited</span>
            <span>⤳ {progress.skipped} skipped</span>
            <span>● {progress.pending} pending</span>
            <span className="ml-auto">Status: <span className="font-medium text-gray-700">{prd.status}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Section review cards */}
      {Array.from({ length: 22 }, (_, i) => String(i + 1)).map((key) => {
        const status = (review[key] ?? 'pending') as ReviewStatus;
        const preview = leafText(prd.sections[key]);
        return (
          <Card key={key}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-gray-400">{key}.</span>
                <span className="text-sm font-medium text-gray-800">{PRD_SECTION_NAMES[key] ?? `Section ${key}`}</span>
                <span className={`ml-auto text-[10px] uppercase rounded px-1.5 py-0.5 ${PILL[status]}`}>{status}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap mb-2">
                {preview || <span className="text-gray-300">—</span>}
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant={status === 'accepted' ? 'default' : 'outline'} size="sm" onClick={() => setStatus(key, 'accepted')} disabled={busy}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Accept
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEditSection(key)} disabled={busy}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant={status === 'skipped' ? 'default' : 'ghost'} size="sm" onClick={() => setStatus(key, 'skipped')} disabled={busy} className="text-gray-500">
                  <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
