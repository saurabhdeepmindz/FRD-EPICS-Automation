'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SKILL_LABELS, type BaSkillExecution, type BaArtifact } from '@/lib/ba-api';
import { getBaModule } from '@/lib/ba-api';
import { ArtifactViewer } from './ArtifactViewer';
import {
  Play, Loader2, CheckCircle2, XCircle, RotateCcw, ChevronDown, ChevronUp,
  FileText, AlertCircle, Layout,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillExecutionPanelProps {
  skillName: string;
  moduleDbId: string;
  execution: BaSkillExecution | null;
  running: boolean;
  error: string | null;
  canStart: boolean;
  prerequisiteMessage?: string;
  onStart: () => void;
  onApprove: () => void;
  onRetry: () => void;
  onModuleReload: () => void;
}

export function SkillExecutionPanel({
  skillName,
  moduleDbId,
  execution,
  running,
  error,
  canStart,
  prerequisiteMessage,
  onStart,
  onApprove,
  onRetry,
  onModuleReload,
}: SkillExecutionPanelProps) {
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const [outputExpanded, setOutputExpanded] = useState(true);
  const [artifacts, setArtifacts] = useState<BaArtifact[]>([]);
  const label = SKILL_LABELS[skillName] ?? skillName;

  // Load artifacts when execution is in review or approved
  const loadArtifacts = useCallback(async () => {
    if (!execution || (execution.status !== 'AWAITING_REVIEW' && execution.status !== 'APPROVED' && execution.status !== 'COMPLETED')) {
      setArtifacts([]);
      return;
    }
    try {
      const mod = await getBaModule(moduleDbId);
      const skillArtifacts = mod.artifacts.filter((a) =>
        a.artifactId.includes(mod.moduleId) || a.sections.length > 0,
      );
      setArtifacts(skillArtifacts);
    } catch {
      setArtifacts([]);
    }
  }, [execution, moduleDbId]);

  useEffect(() => { loadArtifacts(); }, [loadArtifacts]);

  // No execution yet — show start button
  if (!execution && !running) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Play className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">{label}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {canStart
            ? `Ready to execute ${label}. Click below to start AI analysis.`
            : prerequisiteMessage ?? 'Complete the previous step first.'}
        </p>
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        <Button size="lg" onClick={onStart} disabled={!canStart || running} className="min-w-[200px]">
          <Play className="h-4 w-4 mr-2" />
          Run {label}
        </Button>
      </div>
    );
  }

  // Running state
  if (running || execution?.status === 'RUNNING' || execution?.status === 'PENDING') {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <h3 className="text-sm font-semibold text-blue-800">Executing {label}...</h3>
          </div>
          <p className="text-xs text-blue-600 mb-2">
            AI is analysing your input. This may take 1-3 minutes depending on complexity.
          </p>
          <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (execution?.status === 'FAILED') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">{label} Failed</h3>
          </div>
          <p className="text-sm text-red-700 mb-4">
            {execution.errorMessage ?? 'An unknown error occurred during execution.'}
          </p>
          <Button size="sm" onClick={onRetry} variant="outline">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Awaiting Review or Approved — show structured output
  const isApproved = execution?.status === 'APPROVED';
  const isAwaitingReview = execution?.status === 'AWAITING_REVIEW' || execution?.status === 'COMPLETED';

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-4">
      {/* Status bar */}
      <div className={cn(
        'rounded-lg border p-4 flex items-center justify-between',
        isApproved ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50',
      )}>
        <div className="flex items-center gap-3">
          {isApproved ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600" />
          )}
          <div>
            <h3 className="text-sm font-semibold">
              {isApproved ? `${label} — Approved` : `${label} — Review Required`}
            </h3>
            {execution?.completedAt && (
              <p className="text-xs text-muted-foreground">
                Completed: {new Date(execution.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAwaitingReview && (
            <Button
              size="sm"
              onClick={() => { onApprove(); setTimeout(onModuleReload, 500); }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Approve & Continue
            </Button>
          )}
          {isApproved && (
            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
              Approved
            </span>
          )}
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode('structured')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            viewMode === 'structured' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          <Layout className="h-3 w-3" />
          Structured View
        </button>
        <button
          onClick={() => setViewMode('raw')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            viewMode === 'raw' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          <FileText className="h-3 w-3" />
          Raw Output
        </button>
      </div>

      {/* Structured view — ArtifactViewer */}
      {viewMode === 'structured' && artifacts.length > 0 && (
        <div className="space-y-6">
          {artifacts.map((artifact) => (
            <ArtifactViewer
              key={artifact.id}
              artifact={artifact}
              onSectionUpdated={loadArtifacts}
            />
          ))}
        </div>
      )}

      {viewMode === 'structured' && artifacts.length === 0 && execution?.humanDocument && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No structured artifacts parsed. Switch to "Raw Output" to see the full AI response.
        </p>
      )}

      {/* Raw output view */}
      {viewMode === 'raw' && execution?.humanDocument && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setOutputExpanded((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Raw AI Output</span>
              <span className="text-xs text-muted-foreground">
                ({execution.humanDocument.length.toLocaleString()} chars)
              </span>
            </div>
            {outputExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {outputExpanded && (
            <div className="border-t border-border px-6 py-4 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">
                {execution.humanDocument}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
