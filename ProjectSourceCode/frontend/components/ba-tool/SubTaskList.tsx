'use client';

import { useCallback, useEffect, useState } from 'react';
import { listBaSubTasks, type BaSubTask, TEAM_COLORS } from '@/lib/ba-api';
import { Loader2, ListChecks, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SubTaskListProps {
  moduleDbId: string;
  projectId: string;
}

export function SubTaskList({ moduleDbId, projectId }: SubTaskListProps) {
  const [subtasks, setSubtasks] = useState<BaSubTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBaSubTasks(moduleDbId);
      setSubtasks(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [moduleDbId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  if (subtasks.length === 0) {
    return (
      <div className="text-center py-12">
        <ListChecks className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No SubTasks generated yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Run SKILL-05 to generate SubTasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="subtask-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{subtasks.length} SubTasks</h3>
      </div>
      {subtasks.map((st) => (
        <Link
          key={st.id}
          href={`/ba-tool/project/${projectId}/module/${moduleDbId}/subtask/${st.id}`}
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
          data-testid={`subtask-card-${st.subtaskId}`}
        >
          <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
            {st.subtaskId}
          </span>
          {st.team && (
            <span className={cn('text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0', TEAM_COLORS[st.team] ?? 'bg-gray-100 text-gray-600')}>
              {st.team}
            </span>
          )}
          <span className="text-sm font-medium text-foreground truncate flex-1">{st.subtaskName}</span>
          {st.priority && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground shrink-0">
              {st.priority}
            </span>
          )}
          {st.estimatedEffort && (
            <span className="text-[10px] text-muted-foreground shrink-0">{st.estimatedEffort}</span>
          )}
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
            st.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
            st.status === 'IMPLEMENTED' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600',
          )}>
            {st.status}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </div>
  );
}
