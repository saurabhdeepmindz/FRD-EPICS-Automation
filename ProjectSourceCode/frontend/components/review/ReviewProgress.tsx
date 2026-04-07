'use client';

interface ReviewProgressProps {
  total: number;
  accepted: number;
  edited: number;
  skipped: number;
}

export function ReviewProgress({ total, accepted, edited, skipped }: ReviewProgressProps) {
  const decided = accepted + edited + skipped;
  const pct = total > 0 ? Math.round((decided / total) * 100) : 0;
  const populatedPct = total > 0 ? Math.round(((accepted + edited) / total) * 100) : 0;

  return (
    <div data-testid="review-progress">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{accepted + edited} of {total} sections populated</span>
        <span>{populatedPct}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
        {accepted > 0 && (
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(accepted / total) * 100}%` }} />
        )}
        {edited > 0 && (
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${(edited / total) * 100}%` }} />
        )}
        {skipped > 0 && (
          <div className="h-full bg-muted-foreground/30 transition-all" style={{ width: `${(skipped / total) * 100}%` }} />
        )}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Accepted: {accepted}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Edited: {edited}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Skipped: {skipped}</span>
        <span>Pending: {total - decided}</span>
      </div>
    </div>
  );
}
