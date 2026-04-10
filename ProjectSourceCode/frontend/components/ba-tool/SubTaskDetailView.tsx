'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  updateBaSubTaskSection,
  approveBaSubTask,
  type BaSubTask,
  type BaSubTaskSection,
  TEAM_COLORS,
} from '@/lib/ba-api';
import {
  CheckCircle2, Edit3, Save, X, ChevronDown, ChevronUp,
  Sparkles, User, AlertTriangle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubTaskDetailViewProps {
  subtask: BaSubTask;
  onUpdated: () => void;
}

export function SubTaskDetailView({ subtask, onUpdated }: SubTaskDetailViewProps) {
  const [approving, setApproving] = useState(false);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await approveBaSubTask(subtask.id);
      onUpdated();
    } catch { alert('Failed to approve'); }
    finally { setApproving(false); }
  }, [subtask.id, onUpdated]);

  return (
    <div className="space-y-4" data-testid="subtask-detail">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-primary">{subtask.subtaskId}</span>
            {subtask.team && (
              <span className={cn('text-[9px] px-2 py-0.5 rounded font-bold', TEAM_COLORS[subtask.team] ?? 'bg-gray-100')}>
                {subtask.team}
              </span>
            )}
            <span className={cn(
              'text-[9px] px-2 py-0.5 rounded-full font-medium',
              subtask.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
            )}>
              {subtask.status}
            </span>
            {subtask.priority && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">{subtask.priority}</span>
            )}
          </div>
          {subtask.status === 'DRAFT' && (
            <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700 text-white">
              {approving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Approve SubTask
            </Button>
          )}
        </div>
        <h2 className="text-base font-semibold mb-2">{subtask.subtaskName}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {subtask.userStoryId && <div><span className="text-muted-foreground">Story:</span> <span className="font-mono">{subtask.userStoryId}</span></div>}
          {subtask.epicId && <div><span className="text-muted-foreground">EPIC:</span> <span className="font-mono">{subtask.epicId}</span></div>}
          {subtask.featureId && <div><span className="text-muted-foreground">Feature:</span> <span className="font-mono">{subtask.featureId}</span></div>}
          {subtask.moduleId && <div><span className="text-muted-foreground">Module:</span> <span className="font-mono">{subtask.moduleId}</span></div>}
          {subtask.className && <div><span className="text-muted-foreground">Class:</span> <span className="font-mono">{subtask.className}</span></div>}
          {subtask.methodName && <div><span className="text-muted-foreground">Method:</span> <span className="font-mono">{subtask.methodName}</span></div>}
          {subtask.sourceFileName && <div><span className="text-muted-foreground">File:</span> <span className="font-mono">{subtask.sourceFileName}</span></div>}
          {subtask.estimatedEffort && <div><span className="text-muted-foreground">Effort:</span> {subtask.estimatedEffort}</div>}
        </div>
        {subtask.tbdFutureRefs.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-amber-700">TBD-Future: {subtask.tbdFutureRefs.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Sections */}
      {(subtask.sections ?? []).map((section) => (
        <SubTaskSectionPanel
          key={section.id}
          subtaskId={subtask.id}
          section={section}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

// ─── Section Panel with inline editing (Task 12) ─────────────────────────────

function SubTaskSectionPanel({
  subtaskId,
  section,
  onUpdated,
}: {
  subtaskId: string;
  section: BaSubTaskSection;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.editedContent ?? section.aiContent);
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const displayContent = section.isHumanModified && section.editedContent ? section.editedContent : section.aiContent;

  // Special rendering for certain sections
  const isAlgorithm = section.sectionKey === 'algorithm';
  const isTraceability = section.sectionKey === 'traceability_header';
  const isProjectStructure = section.sectionKey === 'project_structure';
  const isIntegration = section.sectionKey === 'integration_points';

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateBaSubTaskSection(subtaskId, section.sectionKey, editContent);
      setEditing(false);
      onUpdated();
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  }, [subtaskId, section.sectionKey, editContent, onUpdated]);

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      isIntegration && displayContent.includes('TBD-Future') ? 'border-amber-200' : 'border-border',
    )}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-mono text-muted-foreground">S{section.sectionNumber}</span>
          <span className="text-sm font-semibold">{section.sectionLabel}</span>
          {!section.isHumanModified && <Sparkles className="h-2.5 w-2.5 text-blue-500" />}
          {section.isHumanModified && <User className="h-2.5 w-2.5 text-amber-500" />}
          {isIntegration && displayContent.includes('TBD-Future') && <AlertTriangle className="h-3 w-3 text-amber-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {editing ? (
            <div className="p-4 space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={Math.min(20, Math.max(6, displayContent.split('\n').length + 2))}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditContent(section.editedContent ?? section.aiContent); setEditing(false); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className={cn(
                'text-sm whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto',
                (isTraceability || isProjectStructure) ? 'font-mono text-xs bg-muted/30 rounded p-3' : '',
                isAlgorithm ? 'font-mono text-xs' : '',
              )}>
                {displayContent || <span className="text-muted-foreground italic">No content</span>}
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Edit3 className="h-3 w-3 mr-1" /> Edit
                </Button>
                {section.isHumanModified && (
                  <Button size="sm" variant="ghost" onClick={() => setShowOriginal((p) => !p)}>
                    {showOriginal ? 'Hide Original' : 'View Original'}
                  </Button>
                )}
              </div>
              {showOriginal && section.isHumanModified && (
                <div className="mt-2 rounded-md border border-blue-200 bg-blue-50/50 p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Original AI Content:</p>
                  <pre className="text-xs whitespace-pre-wrap text-blue-900 font-mono">{section.aiContent}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
