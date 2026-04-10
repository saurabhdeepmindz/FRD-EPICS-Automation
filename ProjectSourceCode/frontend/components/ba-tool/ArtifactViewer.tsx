'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  updateArtifactSection,
  type BaArtifact,
  type BaArtifactSection,
} from '@/lib/ba-api';
import {
  ChevronDown, ChevronUp, Edit3, Save, X, Lock, Unlock,
  Sparkles, User, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactViewerProps {
  artifact: BaArtifact;
  onSectionUpdated: () => void;
}

export function ArtifactViewer({ artifact, onSectionUpdated }: ArtifactViewerProps) {
  return (
    <div className="space-y-3" data-testid="artifact-viewer">
      {/* Artifact header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{artifact.artifactId}</span>
          <span className="text-xs font-medium text-muted-foreground">{artifact.artifactType}</span>
          <ArtifactStatusBadge status={artifact.status} />
        </div>
        {artifact.approvedAt && (
          <span className="text-[10px] text-muted-foreground">
            Approved: {new Date(artifact.approvedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Sections */}
      {artifact.sections.map((section) => (
        <ArtifactSectionCard
          key={section.id}
          section={section}
          onUpdated={onSectionUpdated}
        />
      ))}

      {artifact.sections.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-8">
          No sections parsed from AI output.
        </p>
      )}
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────

function ArtifactSectionCard({
  section,
  onUpdated,
}: {
  section: BaArtifactSection;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.editedContent ?? section.content);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateArtifactSection(section.id, editContent);
      setEditing(false);
      onUpdated();
    } catch {
      alert('Failed to save section');
    } finally {
      setSaving(false);
    }
  }, [section.id, editContent, onUpdated]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(section.editedContent ?? section.content);
    setEditing(false);
  }, [section]);

  const displayContent = section.isHumanModified && section.editedContent
    ? section.editedContent
    : section.content;

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      section.isLocked ? 'border-border/50 bg-muted/20' : 'border-border bg-card',
    )}>
      {/* Section header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-semibold text-foreground truncate">{section.sectionLabel}</span>
          {/* Source badges */}
          {section.aiGenerated && !section.isHumanModified && (
            <span className="flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {section.isHumanModified && (
            <span className="flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
              <User className="h-2.5 w-2.5" /> Edited
            </span>
          )}
          {section.isLocked && (
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
          {displayContent.length.toLocaleString()} chars
        </span>
      </button>

      {/* Section body */}
      {expanded && (
        <div className="border-t border-border">
          {editing ? (
            <div className="p-4 space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="h-3.5 w-3.5 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save Changes
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Content display */}
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground max-h-[400px] overflow-y-auto">
                {renderContent(displayContent)}
              </div>
              {/* Edit button */}
              {!section.isLocked && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit Section
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Content renderer with structure highlighting ────────────────────────────

function renderContent(content: string): React.ReactNode {
  // Split by lines and apply formatting
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();

    // Headings (## or ###)
    if (trimmed.startsWith('### ')) {
      return <div key={idx} className="text-xs font-bold text-foreground mt-3 mb-1">{trimmed.slice(4)}</div>;
    }
    if (trimmed.startsWith('## ')) {
      return <div key={idx} className="text-sm font-bold text-foreground mt-4 mb-1 border-b border-border/50 pb-1">{trimmed.slice(3)}</div>;
    }
    if (trimmed.startsWith('# ')) {
      return <div key={idx} className="text-base font-bold text-foreground mt-4 mb-2">{trimmed.slice(2)}</div>;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return <div key={idx} className="text-sm pl-4 before:content-['•'] before:mr-2 before:text-muted-foreground">{trimmed.slice(2)}</div>;
    }

    // Numbered items
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      return <div key={idx} className="text-sm pl-4"><span className="text-muted-foreground font-mono mr-2">{numMatch[1]}.</span>{numMatch[2]}</div>;
    }

    // Feature IDs (FR-, F-, EPIC-, US-, ST-)
    if (trimmed.match(/^(FR-|F-|EPIC-|US-|ST-)/)) {
      return <div key={idx} className="text-sm font-mono text-primary bg-primary/5 px-2 py-0.5 rounded mt-1">{trimmed}</div>;
    }

    // TBD-Future markers
    if (trimmed.includes('TBD-Future') || trimmed.includes('[TBD-Future')) {
      return <div key={idx} className="text-sm bg-amber-50 text-amber-800 px-2 py-0.5 rounded mt-1">{trimmed}</div>;
    }

    // Empty line
    if (trimmed === '') {
      return <div key={idx} className="h-2" />;
    }

    // Normal text
    return <div key={idx} className="text-sm">{line}</div>;
  });
}

// ─── Status badge ────────────────────────────────────────────────────────────

function ArtifactStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    CONFIRMED_PARTIAL: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
  };
  return (
    <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', styles[status] ?? 'bg-gray-100 text-gray-600')}>
      {status.replace('_', ' ')}
    </span>
  );
}
