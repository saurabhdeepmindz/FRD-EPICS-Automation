'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  updateArtifactSection,
  type BaArtifact,
  type BaArtifactSection,
  type BaSkillExecution,
  SKILL_LABELS,
  type BaModuleStatus,
} from '@/lib/ba-api';
import type { TreeNodeId } from './ArtifactTree';
import { FrdArtifactView } from './FrdArtifactView';
import { Edit3, Save, X, Sparkles, User, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactContentPanelProps {
  activeNode: TreeNodeId | null;
  executions: BaSkillExecution[];
  artifacts: BaArtifact[];
  onSectionUpdated: () => void;
}

export function ArtifactContentPanel({
  activeNode,
  executions,
  artifacts,
  onSectionUpdated,
}: ArtifactContentPanelProps) {
  // No selection
  if (!activeNode) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select an item from the tree to view its content</p>
        </div>
      </div>
    );
  }

  // Skill-level overview
  if (activeNode.type === 'skill' && activeNode.skillName) {
    const exec = executions.find((e) => e.skillName === activeNode.skillName);
    const label = SKILL_LABELS[activeNode.skillName] ?? activeNode.skillName;
    return (
      <div className="p-6">
        <SkillOverview skillName={activeNode.skillName} label={label} execution={exec ?? null} />
      </div>
    );
  }

  // Artifact-level overview
  if (activeNode.type === 'artifact' && activeNode.artifactId) {
    const artifact = artifacts.find((a) => a.id === activeNode.artifactId);
    if (!artifact) return <EmptyState message="Artifact not found" />;

    // FRD artifacts use the specialized feature card view
    if (artifact.artifactType === 'FRD') {
      // sectionId carries the featureId (F-XX-XX) when clicked from tree
      const activeFeatureId = activeNode.sectionId?.startsWith('F-') ? activeNode.sectionId : null;
      return (
        <div className="p-6 overflow-y-auto h-full">
          <FrdArtifactView artifact={artifact} activeFeatureId={activeFeatureId} />
        </div>
      );
    }

    // All other artifacts use generic section cards
    return (
      <div className="p-6 space-y-4 overflow-y-auto h-full">
        <ArtifactHeader artifact={artifact} />
        {artifact.sections.map((section) => (
          <SectionCard key={section.id} section={section} onUpdated={onSectionUpdated} />
        ))}
      </div>
    );
  }

  // Section-level — show single section focused
  if (activeNode.type === 'section' && activeNode.sectionId) {
    const artifact = artifacts.find((a) => a.id === activeNode.artifactId);
    const section = artifact?.sections.find((s) => s.id === activeNode.sectionId);
    if (!section) return <EmptyState message="Section not found" />;
    return (
      <div className="p-6 overflow-y-auto h-full">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground font-mono">{artifact?.artifactId}</p>
        </div>
        <SectionCard section={section} onUpdated={onSectionUpdated} defaultExpanded />
      </div>
    );
  }

  return <EmptyState message="Unknown selection" />;
}

// ─── Skill Overview ──────────────────────────────────────────────────────────

function SkillOverview({ skillName, label, execution }: { skillName: string; label: string; execution: BaSkillExecution | null }) {
  if (!execution) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">{label} has not been executed yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        <span className={cn(
          'text-xs px-2 py-1 rounded-full font-medium',
          execution.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
          execution.status === 'AWAITING_REVIEW' ? 'bg-amber-100 text-amber-700' :
          execution.status === 'FAILED' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-600',
        )}>
          {execution.status}
        </span>
      </div>

      {execution.completedAt && (
        <p className="text-xs text-muted-foreground">
          Completed: {new Date(execution.completedAt).toLocaleString()}
        </p>
      )}

      {execution.errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{execution.errorMessage}</p>
        </div>
      )}

      {/* Full raw output */}
      {execution.humanDocument && (
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Full AI Output</h3>
            <p className="text-xs text-muted-foreground">{execution.humanDocument.length.toLocaleString()} characters</p>
          </div>
          <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-xs text-foreground leading-relaxed font-sans">
              {execution.humanDocument}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Artifact Header ─────────────────────────────────────────────────────────

function ArtifactHeader({ artifact }: { artifact: BaArtifact }) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-bold text-foreground">{artifact.artifactId}</span>
        <span className="text-xs text-muted-foreground">{artifact.artifactType.replace('_', ' ')}</span>
        <span className={cn(
          'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
          artifact.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
          artifact.status === 'CONFIRMED_PARTIAL' ? 'bg-amber-100 text-amber-700' :
          artifact.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600',
        )}>
          {artifact.status.replace('_', ' ')}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{artifact.sections.length} sections</span>
    </div>
  );
}

// ─── Section Card (reused for artifact-level and section-level views) ────────

function SectionCard({
  section,
  onUpdated,
  defaultExpanded = false,
}: {
  section: BaArtifactSection;
  onUpdated: () => void;
  defaultExpanded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.editedContent ?? section.content);
  const [saving, setSaving] = useState(false);

  const displayContent = section.isHumanModified && section.editedContent
    ? section.editedContent
    : section.content;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateArtifactSection(section.id, editContent);
      setEditing(false);
      onUpdated();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [section.id, editContent, onUpdated]);

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      section.isLocked ? 'border-border/50 bg-muted/20' : 'border-border bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{section.sectionLabel}</h3>
          {section.aiGenerated && !section.isHumanModified && (
            <span className="flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {section.isHumanModified && (
            <span className="flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              <User className="h-2.5 w-2.5" /> Edited
            </span>
          )}
          {section.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>
        {!section.isLocked && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7">
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={Math.min(20, Math.max(8, displayContent.split('\n').length + 2))}
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="h-3.5 w-3.5 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditContent(section.editedContent ?? section.content); setEditing(false); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground max-h-[500px] overflow-y-auto">
            {renderFormattedContent(displayContent)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Content formatter ───────────────────────────────────────────────────────

function renderFormattedContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) return <div key={idx} className="text-xs font-bold text-foreground mt-3 mb-1">{trimmed.slice(4)}</div>;
    if (trimmed.startsWith('## ')) return <div key={idx} className="text-sm font-bold text-foreground mt-4 mb-1 border-b border-border/50 pb-1">{trimmed.slice(3)}</div>;
    if (trimmed.startsWith('# ')) return <div key={idx} className="text-base font-bold text-foreground mt-4 mb-2">{trimmed.slice(2)}</div>;
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <div key={idx} className="text-sm pl-4 before:content-['•'] before:mr-2 before:text-muted-foreground">{trimmed.slice(2)}</div>;
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) return <div key={idx} className="text-sm pl-4"><span className="text-muted-foreground font-mono mr-2">{numMatch[1]}.</span>{numMatch[2]}</div>;
    if (trimmed.match(/^(FR-|F-|EPIC-|US-|ST-)/)) return <div key={idx} className="text-sm font-mono text-primary bg-primary/5 px-2 py-0.5 rounded mt-1">{trimmed}</div>;
    if (trimmed.includes('TBD-Future') || trimmed.includes('[TBD-Future')) return <div key={idx} className="text-sm bg-amber-50 text-amber-800 px-2 py-0.5 rounded mt-1">{trimmed}</div>;
    if (trimmed === '') return <div key={idx} className="h-2" />;
    return <div key={idx} className="text-sm">{line}</div>;
  });
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
