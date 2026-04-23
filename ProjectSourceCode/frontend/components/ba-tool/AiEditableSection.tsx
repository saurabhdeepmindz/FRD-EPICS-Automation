'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit3, Save, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MicButton } from '@/components/forms/MicButton';
import { AISuggestButton } from '@/components/forms/AISuggestButton';
import { baRefineSection, updateArtifactSection, type BaArtifact, type BaArtifactSection } from '@/lib/ba-api';

interface AiEditableSectionProps {
  /** Parent artifact — provides artifactType and sections list for section lookup */
  artifact: BaArtifact;
  /** Label for both display and AI prompt context */
  label: string;
  /** Current content shown to the user (may come from a parsed structured view) */
  content: string;
  /** Predicate used to find the underlying `BaArtifactSection` to persist edits */
  findSection?: (sections: BaArtifactSection[]) => BaArtifactSection | undefined;
  /** Reload callback after save — usually re-fetches the module */
  onUpdated?: () => void;
  /** Whether the displayed content is AI-generated (applies blue styling) */
  isAi?: boolean;
  /** Optional wrapper className for the outer container */
  className?: string;
}

/**
 * Inline editor with Mic + AI Suggest + blue AI-text styling, reusable
 * across FRD / EPIC / User Story / SubTask structured views.
 *
 * When the caller provides `findSection`, edits are persisted via
 * `updateArtifactSection` on the matched `BaArtifactSection`. If no matching
 * section is found, the editor falls back to local-only edit (user sees their
 * edits until navigation).
 */
export function AiEditableSection({
  artifact,
  label,
  content,
  findSection,
  onUpdated,
  isAi = false,
  className,
}: AiEditableSectionProps) {
  const matchedSection = findSection ? findSection(artifact.sections) : undefined;
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const handleAISuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const { suggestion } = await baRefineSection({
        artifactType: artifact.artifactType,
        sectionLabel: label,
        currentText: editing ? editContent : content,
        moduleContext: artifact.artifactId,
      });
      if (!editing) {
        setEditContent(suggestion);
        setEditing(true);
      } else {
        setEditContent(suggestion);
      }
    } catch {
      alert('AI Suggest failed. Check AI service is running.');
    } finally {
      setSuggesting(false);
    }
  }, [artifact.artifactType, artifact.artifactId, label, editing, editContent, content]);

  const handleMicTranscribed = useCallback((text: string) => {
    if (!editing) {
      setEditContent(content);
      setEditing(true);
    }
    setEditContent((prev) => (prev ? `${prev}\n${text}` : text));
  }, [editing, content]);

  const handleSave = useCallback(async () => {
    if (!matchedSection) {
      // No persisted section — just close editor
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateArtifactSection(matchedSection.id, editContent);
      setEditing(false);
      onUpdated?.();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [matchedSection, editContent, onUpdated]);

  const handleEditClick = useCallback(() => {
    setEditContent(content);
    setEditing(true);
  }, [content]);

  const handleCancel = useCallback(() => {
    setEditContent(content);
    setEditing(false);
  }, [content]);

  return (
    <div className={cn('relative', className)}>
      {/* Control row — visible at top-right, non-intrusive */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <MicButton onTranscribed={handleMicTranscribed} />
        <AISuggestButton onClick={handleAISuggest} loading={suggesting} />
        {!editing && (
          <Button size="sm" variant="ghost" onClick={handleEditClick} className="h-7">
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={Math.min(20, Math.max(6, editContent.split('\n').length + 2))}
            className={cn(
              'w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono',
              isAi && 'text-blue-600',
            )}
          />
          {isAi && (
            <p className="text-[11px] text-blue-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI-generated content — edit as needed
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !matchedSection}>
              {saving ? (
                <span className="h-3.5 w-3.5 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              {matchedSection ? 'Save' : 'Save (no backing section)'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn('text-sm leading-relaxed', isAi ? 'text-blue-600' : 'text-foreground')}>
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
