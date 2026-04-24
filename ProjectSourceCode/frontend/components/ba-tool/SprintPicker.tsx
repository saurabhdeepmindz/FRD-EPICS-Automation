'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSprints, type BaSprint, type BaSprintStatus } from '@/lib/ba-api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SprintPickerProps {
  projectId: string;
  /** Selected sprint DB id, or '' for none. */
  value: string;
  onChange: (sprintDbId: string) => void;
  label?: string;
  className?: string;
  /** When true, the option list includes CANCELLED/COMPLETED. Default false — active/planning only. */
  includeClosed?: boolean;
}

const STATUS_ORDER: Record<BaSprintStatus, number> = {
  ACTIVE: 0,
  PLANNING: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

const STATUS_TONE: Record<BaSprintStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PLANNING: 'bg-sky-100 text-sky-700',
  COMPLETED: 'bg-gray-200 text-gray-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

/**
 * B2 — Sprint dropdown backed by BaSprint. Shared by Record Run + Bulk Run
 * dialogs. Fetches once per mount per projectId. Silently falls back to a
 * "No sprints yet" hint with a deep-link to the Sprints page when empty.
 */
export function SprintPicker({
  projectId,
  value,
  onChange,
  label = 'Sprint',
  className,
  includeClosed = false,
}: SprintPickerProps) {
  const [sprints, setSprints] = useState<BaSprint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSprints(projectId)
      .then((list) => { if (!cancelled) setSprints(list); })
      .catch(() => { if (!cancelled) setSprints([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const visible = (sprints ?? [])
    .filter((s) => includeClosed || (s.status !== 'CANCELLED' && s.status !== 'COMPLETED'))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.sprintCode.localeCompare(b.sprintCode));

  const selected = sprints?.find((s) => s.id === value);

  return (
    <div className={className}>
      {label && <label className="text-xs font-semibold block mb-1">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background"
        >
          <option value="">— no sprint —</option>
          {visible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sprintCode} — {s.name} [{s.status}]
            </option>
          ))}
        </select>
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 min-h-[14px]">
        {selected ? (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold', STATUS_TONE[selected.status])}>
            {selected.status}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">&nbsp;</span>
        )}
        {!loading && (sprints?.length ?? 0) === 0 ? (
          <Link
            href={`/ba-tool/project/${projectId}/sprints`}
            target="_blank"
            className="text-[10px] text-primary hover:underline"
          >
            Create a sprint →
          </Link>
        ) : (
          <Link
            href={`/ba-tool/project/${projectId}/sprints`}
            target="_blank"
            className="text-[10px] text-muted-foreground hover:text-primary hover:underline"
          >
            Manage sprints →
          </Link>
        )}
      </div>
    </div>
  );
}
