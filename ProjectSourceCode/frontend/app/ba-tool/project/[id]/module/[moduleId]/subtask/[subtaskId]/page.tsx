'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBaSubTask, type BaSubTask } from '@/lib/ba-api';
import { SubTaskDetailView } from '@/components/ba-tool/SubTaskDetailView';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SubTaskDetailPage() {
  const params = useParams<{ id: string; moduleId: string; subtaskId: string }>();
  const { id: projectId, moduleId: moduleDbId, subtaskId: subtaskDbId } = params;

  const [subtask, setSubtask] = useState<BaSubTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBaSubTask(subtaskDbId);
      setSubtask(data);
    } catch {
      setError('Failed to load SubTask');
    } finally {
      setLoading(false);
    }
  }, [subtaskDbId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading SubTask...</span>
      </div>
    );
  }

  if (error || !subtask) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? 'SubTask not found'}</p>
        <Button asChild variant="outline">
          <Link href={`/ba-tool/project/${projectId}/module/${moduleDbId}`}>Back to Module</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="subtask-detail-page">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/ba-tool/project/${projectId}/module/${moduleDbId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Module
            </Link>
          </Button>
          <h1 className="text-sm font-semibold">{subtask.subtaskId} — {subtask.subtaskName}</h1>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-6">
        <SubTaskDetailView subtask={subtask} onUpdated={load} />
      </div>
    </div>
  );
}
