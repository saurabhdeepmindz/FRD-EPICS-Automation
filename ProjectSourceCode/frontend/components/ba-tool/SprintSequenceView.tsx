'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSprintSequence, type SprintSequence, TEAM_COLORS } from '@/lib/ba-api';
import { Loader2, ListChecks, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SprintSequenceViewProps {
  moduleDbId: string;
  projectId: string;
}

const PRIORITY_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  P0: { bg: 'bg-red-50', border: 'border-red-200', label: 'P0 — Must Build First' },
  P1: { bg: 'bg-amber-50', border: 'border-amber-200', label: 'P1 — Core Logic' },
  P2: { bg: 'bg-blue-50', border: 'border-blue-200', label: 'P2 — API + Frontend' },
  P3: { bg: 'bg-green-50', border: 'border-green-200', label: 'P3 — Tests' },
};

export function SprintSequenceView({ moduleDbId, projectId }: SprintSequenceViewProps) {
  const [sequence, setSequence] = useState<SprintSequence | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSprintSequence(moduleDbId);
      setSequence(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [moduleDbId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  if (!sequence || sequence.subtasks.length === 0) {
    return (
      <div className="text-center py-12">
        <ListChecks className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No SubTasks generated yet.</p>
      </div>
    );
  }

  const stMap = new Map(sequence.subtasks.map((st) => [st.subtaskId, st]));

  return (
    <div className="space-y-6" data-testid="sprint-sequence">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sprint Sequencing — Dependency Order</h3>
        <span className="text-xs text-muted-foreground">{sequence.subtasks.length} SubTasks, {sequence.dependencies.length} dependencies</span>
      </div>

      {/* Priority columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(['P0', 'P1', 'P2', 'P3'] as const).map((priority) => {
          const ids = sequence.priorities[priority];
          const config = PRIORITY_COLORS[priority];
          return (
            <div key={priority} className={cn('rounded-lg border p-3', config.bg, config.border)}>
              <h4 className="text-xs font-bold mb-3">{config.label}</h4>
              <div className="space-y-2">
                {ids.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">No tasks</p>
                ) : (
                  ids.map((id, idx) => {
                    const st = stMap.get(id);
                    if (!st) return null;
                    return (
                      <Link
                        key={id}
                        href={`/ba-tool/project/${projectId}/module/${moduleDbId}/subtask/${st.id}`}
                        className="block rounded-md border border-border bg-white p-2 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] text-muted-foreground">{idx + 1}.</span>
                          <span className="font-mono text-[10px] text-primary">{st.subtaskId}</span>
                          {st.team && (
                            <span className={cn('text-[7px] px-1 py-0.5 rounded font-bold', TEAM_COLORS[st.team] ?? '')}>
                              {st.team}
                            </span>
                          )}
                          <span className={cn(
                            'text-[7px] px-1 py-0.5 rounded-full ml-auto',
                            st.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                          )}>
                            {st.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-foreground truncate">{st.subtaskName}</p>
                        {st.prerequisites.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                            <ArrowRight className="h-2.5 w-2.5" />
                            <span>depends on: {st.prerequisites.join(', ')}</span>
                          </div>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
