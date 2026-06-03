'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GitPullRequestArrow, Loader2, CheckCircle2, XCircle, AlertTriangle, FileCode2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listUpstreamSync,
  approveUpstreamSync,
  rejectUpstreamSync,
  type UpstreamSync,
  type UpstreamSyncStatus,
} from '@/lib/pipeline-api';

const STATUS_STYLE: Record<UpstreamSyncStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-gray-100 text-gray-500',
};

/**
 * P-05 + Track J — review panel for downstream→upstream drafts. When /dev writes
 * a file outside the LLD/sub-tasks, a PENDING draft is staged here. Approving
 * applies it upstream (LLD pseudo-file + sub-task + CHANGELOG + RTM); rejecting
 * discards it. Nothing changes upstream without a human decision.
 */
export function UpstreamSyncPanel({
  projectId,
  moduleDbId,
}: {
  projectId: string;
  moduleDbId: string | null;
}) {
  const [items, setItems] = useState<UpstreamSync[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!moduleDbId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await listUpstreamSync(projectId, moduleDbId));
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  }, [projectId, moduleDbId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = async (sync: UpstreamSync, approve: boolean) => {
    if (!moduleDbId) return;
    setBusyId(sync.id);
    setError(null);
    try {
      if (approve) await approveUpstreamSync(projectId, moduleDbId, sync.id);
      else await rejectUpstreamSync(projectId, moduleDbId, sync.id);
      await refresh();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Action failed'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = items.filter((i) => i.status === 'PENDING').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
          <GitPullRequestArrow className="h-4 w-4" /> Upstream Sync
          {pendingCount > 0 && (
            <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
              {pendingCount} pending review
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500">
          When <code className="text-xs">/dev</code> creates a file that wasn&apos;t in the LLD/sub-tasks, an upstream
          draft is staged here. <strong>Approve</strong> to apply it upstream (LLD pseudo-file + sub-task + CHANGELOG +
          RTM); <strong>Reject</strong> to discard. Nothing changes upstream without your decision.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {!moduleDbId ? (
          <p className="text-xs text-gray-400">Select a module above.</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400">
            {loading ? 'Loading…' : 'No upstream drafts. They appear after /dev creates files outside the LLD/sub-tasks.'}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="border rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileCode2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm font-mono text-gray-700">{s.filePath ?? s.trigger}</span>
                  <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${STATUS_STYLE[s.status]}`}>
                    {s.status}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(s.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-600">{s.summary}</p>
                <div className="text-[11px] text-gray-500 space-y-0.5 pl-1 border-l-2 border-gray-100">
                  {s.proposedLld && <p>📄 LLD: {s.proposedLld}</p>}
                  {s.proposedSubtask?.subtaskId && (
                    <p>🧩 Sub-task: {s.proposedSubtask.subtaskId} — {s.proposedSubtask.subtaskName}</p>
                  )}
                  {s.changelogEntry && <p>📝 CHANGELOG: {s.changelogEntry}</p>}
                </div>
                {s.status === 'PENDING' ? (
                  <div className="flex justify-end gap-2 pt-0.5">
                    <Button size="sm" variant="outline" disabled={busyId === s.id} onClick={() => decide(s, false)}>
                      {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-3 w-3 mr-1" /> Reject</>}
                    </Button>
                    <Button size="sm" disabled={busyId === s.id} onClick={() => decide(s, true)}>
                      {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</>}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400">
                    {s.status === 'APPROVED' ? 'Applied upstream' : 'Discarded'}
                    {s.resolvedNote ? ` · ${s.resolvedNote}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
