'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  updateArtifactSection,
  baRefineSection,
  downloadProjectStructureZip,
  downloadPseudoFile,
  downloadPseudoFilesZip,
  listPseudoFilesByArtifact,
  savePseudoFile,
  type BaArtifact,
  type BaArtifactSection,
  type BaPseudoFile,
  type BaScreen,
  type BaSkillExecution,
  SKILL_LABELS,
} from '@/lib/ba-api';
import type { TreeNodeId } from './ArtifactTree';
import { FrdArtifactView } from './FrdArtifactView';
import { EpicArtifactView } from './EpicArtifactView';
import { UserStoryArtifactView } from './UserStoryArtifactView';
import { FtcArtifactView } from './FtcArtifactView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MicButton } from '@/components/forms/MicButton';
import { AISuggestButton } from '@/components/forms/AISuggestButton';
import { Edit3, Save, X, Sparkles, User, Lock, FileText, Eye, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// `api` (axios) is intentionally not imported here for downloads — see
// download() below. Anchor-href streaming bypasses JS heap limits.

interface ArtifactContentPanelProps {
  activeNode: TreeNodeId | null;
  executions: BaSkillExecution[];
  artifacts: BaArtifact[];
  moduleScreens?: BaScreen[];
  onSectionUpdated: () => void;
}

function ArtifactToolbar({ artifact }: { artifact: BaArtifact }) {
  const pathname = usePathname();
  const backParam = pathname ? `?back=${encodeURIComponent(pathname)}` : '';
  const previewHref = `/ba-tool/preview/artifact/${artifact.id}${backParam}`;
  const isLld = artifact.artifactType === 'LLD';

  const download = (format: 'pdf' | 'docx') => {
    // Direct anchor link to the backend export URL — let the browser stream
    // the file natively rather than buffering it through axios + a Blob in
    // JS heap. The buffered approach failed with "Network Error" on ~20 MB+
    // payloads (a 27-story SUBTASK PDF can hit 19+ MB once every Mermaid
    // diagram + screen image is embedded). Streaming has no in-memory size
    // limit, no axios timeout edge cases, and the browser drives the
    // download exactly the same way as right-click → Save As.
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const a = document.createElement('a');
      a.href = `${apiBase}/api/ba/artifacts/${artifact.id}/export/${format}`;
      a.download = `${artifact.artifactId}.${format}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${format} download] failed:`, err);
      alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // LLD-only RTM download. Mirrors the same 3 variants exposed on the
  // preview page (downloadRtm) so the editor view can drive the same
  // /api/ba/artifacts/:id/rtm-{html,csv,bundle} endpoints without sending
  // the user to a separate tab first.
  const downloadRtm = (variant: 'html' | 'csv' | 'bundle') => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const endpoint = variant === 'bundle' ? 'rtm-bundle' : variant === 'html' ? 'rtm-html' : 'rtm-csv';
      const moduleId = artifact.module?.moduleId ?? artifact.artifactId;
      const ext = variant === 'bundle' ? 'zip' : variant;
      const a = document.createElement('a');
      a.href = `${apiBase}/api/ba/artifacts/${artifact.id}/${endpoint}`;
      a.download = variant === 'bundle'
        ? `LLD-${moduleId}-rtm-bundle.zip`
        : `LLD-${moduleId}-rtm.${ext}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[RTM ${variant} download] failed:`, err);
      alert(`RTM download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 mb-3 pb-3 border-b border-border flex-wrap">
      <Button size="sm" variant="outline" asChild>
        <Link href={previewHref} target="_blank">
          <Eye className="h-3.5 w-3.5 mr-1" />
          Preview
        </Link>
      </Button>
      <Button size="sm" variant="outline" onClick={() => download('pdf')}>
        <Download className="h-3.5 w-3.5 mr-1" />
        PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => download('docx')}>
        <Download className="h-3.5 w-3.5 mr-1" />
        DOCX
      </Button>
      {/* LLD-only — the Module-SubTask-LLD-RTM bundle (HTML / CSV /
          full ZIP). Mirrors the buttons on the LLD preview page so the
          editor view doesn't force a separate-tab round-trip. */}
      {isLld && (
        <>
          <Button size="sm" variant="outline" onClick={() => downloadRtm('html')} title="Interactive RTM explorer (HTML)">
            <Download className="h-3.5 w-3.5 mr-1" />
            RTM HTML
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadRtm('csv')} title="Flat tabular RTM (CSV)">
            <Download className="h-3.5 w-3.5 mr-1" />
            RTM CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadRtm('bundle')} title="Full RTM bundle (HTML + CSV + tree + schema + impl-status)">
            <Download className="h-3.5 w-3.5 mr-1" />
            RTM Bundle
          </Button>
        </>
      )}
    </div>
  );
}

export function ArtifactContentPanel({
  activeNode,
  executions,
  artifacts,
  moduleScreens = [],
  onSectionUpdated,
}: ArtifactContentPanelProps) {
  // Adapt module screens (BaScreen) to the lighter shape EpicArtifactView/UserStoryArtifactView use
  const screensLite = moduleScreens.map((s) => ({
    id: s.id,
    screenId: s.screenId,
    screenTitle: s.screenTitle,
    screenType: s.screenType,
    fileData: s.fileData,
    displayOrder: s.displayOrder,
    textDescription: s.textDescription,
  }));
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

  // Helper: enrich artifact with module.screens so structured views can render thumbnails.
  // The /api/ba/modules/:id call doesn't attach module.screens to each artifact;
  // we splice them in here from the parent module's screens list.
  const withScreens = (a: BaArtifact): BaArtifact => ({
    ...a,
    module: {
      id: a.module?.id ?? '',
      moduleId: a.module?.moduleId ?? '',
      moduleName: a.module?.moduleName ?? '',
      packageName: a.module?.packageName ?? '',
      project: a.module?.project,
      screens: screensLite,
    },
  });

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
          <ArtifactToolbar artifact={artifact} />
          <FrdArtifactView artifact={withScreens(artifact)} activeFeatureId={activeFeatureId} onUpdated={onSectionUpdated} />
        </div>
      );
    }

    // EPIC artifacts use the structured EPIC view
    if (artifact.artifactType === 'EPIC') {
      return (
        <div className="p-6 overflow-y-auto h-full">
          <ArtifactToolbar artifact={artifact} />
          <EpicArtifactView artifact={withScreens(artifact)} onUpdated={onSectionUpdated} />
        </div>
      );
    }

    // User Story artifacts use the structured story view
    if (artifact.artifactType === 'USER_STORY') {
      return (
        <div className="p-6 overflow-y-auto h-full">
          <ArtifactToolbar artifact={artifact} />
          <UserStoryArtifactView artifact={withScreens(artifact)} onUpdated={onSectionUpdated} />
        </div>
      );
    }

    // FTC artifacts get a structured per-test-case view (no raw-markdown dump).
    if (artifact.artifactType === 'FTC') {
      return (
        <div className="p-6 space-y-4 overflow-y-auto h-full pb-32">
          <ArtifactToolbar artifact={artifact} />
          <ArtifactHeader artifact={artifact} />
          <FtcArtifactView
            artifact={artifact}
            moduleDbId={artifact.module?.id ?? ''}
            artifacts={artifacts}
            onUpdated={onSectionUpdated}
          />
        </div>
      );
    }

    // All other artifacts use generic section cards. LLD artifacts also get
    // a pseudo-code-files appendix with numbered sub-sections + downloads.
    const bottomPad = artifact.artifactType === 'LLD' ? 'pb-32' : 'pb-6';
    return (
      <div className={cn('p-6 space-y-4 overflow-y-auto h-full', bottomPad)}>
        <ArtifactToolbar artifact={artifact} />
        <ArtifactHeader artifact={artifact} />
        {artifact.sections.map((section) => (
          <SectionCard key={section.id} section={section} artifactType={artifact.artifactType} artifactId={artifact.id} moduleContext={artifact.artifactId} onUpdated={onSectionUpdated} />
        ))}
        {artifact.artifactType === 'LLD' && (
          <LldPseudoFilesCard artifactDbId={artifact.id} artifactId={artifact.artifactId} sectionStartIndex={artifact.sections.length + 1} />
        )}
      </div>
    );
  }

  // Section-level — show single section focused
  if (activeNode.type === 'section' && activeNode.sectionId) {
    const artifact = artifacts.find((a) => a.id === activeNode.artifactId);

    // FTC synthetic "Test Case" node — click on a TC leaf in the tree routes
    // here with sectionId = `__test_case__:<tcDbId>`. We render the full
    // FtcArtifactView and pass activeTcId so the view scrolls + highlights.
    if (artifact?.artifactType === 'FTC' && activeNode.sectionId?.startsWith('__test_case__')) {
      const [, activeTcId] = activeNode.sectionId.split(':');
      return (
        <div className="p-6 space-y-4 overflow-y-auto h-full pb-32">
          <ArtifactToolbar artifact={artifact} />
          <ArtifactHeader artifact={artifact} />
          <FtcArtifactView
            artifact={artifact}
            moduleDbId={artifact.module?.id ?? ''}
            activeTcId={activeTcId || undefined}
            artifacts={artifacts}
            onUpdated={onSectionUpdated}
          />
        </div>
      );
    }

    // LLD synthetic "Pseudo-Code Files" node — render the pseudo-file card.
    // Accepts either the bare key (section-level click) or `__pseudo_code_files__:<fileId>`
    // (individual file click from tree), in which case we focus + scroll that file.
    if (artifact?.artifactType === 'LLD' && activeNode.sectionId?.startsWith('__pseudo_code_files__')) {
      const [, focusFileId] = activeNode.sectionId.split(':');
      return (
        <div className="p-6 space-y-4 overflow-y-auto h-full pb-32">
          <ArtifactToolbar artifact={artifact} />
          <LldPseudoFilesCard
            artifactDbId={artifact.id}
            artifactId={artifact.artifactId}
            sectionStartIndex={artifact.sections.length + 1}
            focusFileId={focusFileId || undefined}
          />
        </div>
      );
    }

    // FRD feature click (F-XX-XX) — route to FRD view with active feature
    if (artifact?.artifactType === 'FRD' && activeNode.sectionId.startsWith('F-')) {
      return (
        <div className="p-6 overflow-y-auto h-full">
          <ArtifactToolbar artifact={artifact} />
          <FrdArtifactView artifact={withScreens(artifact)} activeFeatureId={activeNode.sectionId} onUpdated={onSectionUpdated} />
        </div>
      );
    }

    // EPIC section click — route to EPIC view with active section
    if (artifact?.artifactType === 'EPIC') {
      return (
        <div className="p-6 overflow-y-auto h-full">
          <ArtifactToolbar artifact={artifact} />
          <EpicArtifactView artifact={withScreens(artifact)} activeSectionId={activeNode.sectionId} onUpdated={onSectionUpdated} />
        </div>
      );
    }

    // User Story section click — route to structured story view with active section
    if (artifact?.artifactType === 'USER_STORY') {
      // sectionId may be the ba_artifact_sections.id (from tree) — resolve to sectionKey
      const matched = artifact.sections.find((s) => s.id === activeNode.sectionId);
      const activeSectionKey = matched?.sectionKey ?? activeNode.sectionId;
      return (
        <div className="p-6 overflow-y-auto h-full">
          <ArtifactToolbar artifact={artifact} />
          <UserStoryArtifactView artifact={withScreens(artifact)} activeStorySection={activeSectionKey} onUpdated={onSectionUpdated} />
        </div>
      );
    }

    const section = artifact?.sections.find((s) => s.id === activeNode.sectionId);
    if (!section) return <EmptyState message="Section not found" />;
    return (
      <div className="p-6 overflow-y-auto h-full">
        {artifact && <ArtifactToolbar artifact={artifact} />}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground font-mono">{artifact?.artifactId}</p>
        </div>
        <SectionCard section={section} artifactType={artifact?.artifactType} artifactId={artifact?.id} moduleContext={artifact?.artifactId} onUpdated={onSectionUpdated} defaultExpanded />
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
            <MarkdownRenderer content={execution.humanDocument} />
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
  artifactType,
  artifactId,
  moduleContext,
  onUpdated,
  defaultExpanded = false,
}: {
  section: BaArtifactSection;
  artifactType?: string;
  /** Db id of the parent artifact — needed for LLD download buttons */
  artifactId?: string;
  moduleContext?: string;
  onUpdated: () => void;
  defaultExpanded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.editedContent ?? section.content);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const displayContent = section.isHumanModified && section.editedContent
    ? section.editedContent
    : section.content;

  const isAiDisplay = Boolean(section.aiGenerated) && !section.isHumanModified;

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

  const handleAISuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const { suggestion } = await baRefineSection({
        artifactType: artifactType ?? 'SECTION',
        sectionLabel: section.sectionLabel,
        currentText: editing ? editContent : displayContent,
        moduleContext: moduleContext ?? '',
      });
      if (!editing) setEditing(true);
      setEditContent(suggestion);
    } catch {
      alert('AI Suggest failed. Check AI service is running.');
    } finally {
      setSuggesting(false);
    }
  }, [artifactType, section.sectionLabel, editing, editContent, displayContent, moduleContext]);

  const handleMicTranscribed = useCallback((text: string) => {
    if (!editing) setEditing(true);
    setEditContent((prev) => (prev ? `${prev}\n${text}` : text));
  }, [editing]);

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      section.isLocked ? 'border-border/50 bg-muted/20' : 'border-border bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{section.sectionLabel}</h3>
          {isAiDisplay && (
            <span className="flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </span>
          )}
          {section.isHumanModified && (
            <span className="flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
              <User className="h-2.5 w-2.5" /> Edited
            </span>
          )}
          {section.isLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        {!section.isLocked && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* LLD Project Structure — Download ZIP of tree + placeholder files */}
            {artifactType === 'LLD' && section.sectionKey === 'project_structure' && artifactId && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => downloadProjectStructureZip(artifactId, 'project-structure.zip').catch(() => alert('Download failed'))}
                title="Download project structure as ZIP (empty folders + placeholder files)"
              >
                <Download className="h-3 w-3 mr-1" />
                Download structure
              </Button>
            )}
            <MicButton onTranscribed={handleMicTranscribed} />
            <AISuggestButton onClick={handleAISuggest} loading={suggesting} />
            {!editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7">
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
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
              className={cn(
                'w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono',
                isAiDisplay && 'text-blue-600',
              )}
            />
            {isAiDisplay && (
              <p className="text-[11px] text-blue-600">AI-generated content — edit as needed</p>
            )}
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
          <div className={cn(
            'text-sm leading-relaxed max-h-[500px] overflow-y-auto',
            isAiDisplay ? 'text-blue-600' : 'text-foreground',
          )}>
            <MarkdownRenderer content={displayContent} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LLD Pseudo-Code Files card (editor view) ───────────────────────────────

function LldPseudoFilesCard({
  artifactDbId,
  artifactId,
  sectionStartIndex,
  focusFileId,
}: {
  artifactDbId: string;
  artifactId: string;
  sectionStartIndex: number;
  /** If set, scroll the matching file sub-section into view after render. */
  focusFileId?: string;
}) {
  const [files, setFiles] = useState<BaPseudoFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listPseudoFilesByArtifact(artifactDbId);
        if (!cancelled) setFiles(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artifactDbId]);

  // When a specific file is focused (via tree click), scroll it into view and
  // highlight briefly. Runs after files load.
  useEffect(() => {
    if (!focusFileId || files.length === 0) return;
    const el = document.getElementById(`pf-${focusFileId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-2', 'ring-primary');
    const t = setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
    return () => clearTimeout(t);
  }, [focusFileId, files.length]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading pseudo-code files…
      </div>
    );
  }
  if (files.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {sectionStartIndex}. Pseudo-Code Files
          </h3>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => downloadPseudoFilesZip(artifactDbId, `${artifactId}-pseudo-files.zip`).catch(() => alert('Download failed'))}
          title="Download all pseudo-code files as ZIP, placed in the project structure from Section 16"
        >
          <Download className="h-3 w-3 mr-1" />
          Download all
        </Button>
      </div>
      <div className="p-4 space-y-4">
        {files.map((f, idx) => (
          <LldPseudoFileItem
            key={f.id}
            file={f}
            index={idx + 1}
            sectionStartIndex={sectionStartIndex}
            onSaved={(updated) => {
              setFiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Single pseudo-code file row with inline edit + mic + AI suggest ─────────

function LldPseudoFileItem({
  file,
  index,
  sectionStartIndex,
  onSaved,
}: {
  file: BaPseudoFile;
  index: number;
  sectionStartIndex: number;
  onSaved: (updated: BaPseudoFile) => void;
}) {
  const basename = file.path.split('/').pop() ?? 'file';
  const displayContent = file.isHumanModified && file.editedContent ? file.editedContent : file.aiContent;

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(displayContent);
  const [instruction, setInstruction] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Keep editContent in sync when the parent file prop changes (e.g. after another edit pass).
  useEffect(() => {
    if (!editing) setEditContent(displayContent);
  }, [displayContent, editing]);

  const handleMicTranscribed = useCallback((text: string) => {
    if (!editing) setEditing(true);
    // Mic dictation goes into the AI instruction banner — NOT into the code body,
    // so we don't pollute a Python/TS source file with an English sentence.
    setInstruction((prev) => (prev ? `${prev} ${text}` : text));
  }, [editing]);

  const handleAISuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const { suggestion } = await baRefineSection({
        artifactType: 'PSEUDO_CODE',
        sectionLabel: `${basename} (${file.language})`,
        currentText: editing ? editContent : displayContent,
        moduleContext: `Pseudo-code file at path: ${file.path}. Language: ${file.language}. Preserve code formatting and language syntax. Output only the refined code without explanation or markdown fences.`,
        instruction: instruction || undefined,
      });
      if (!editing) setEditing(true);
      setEditContent(suggestion);
      setInstruction('');
    } catch {
      alert('AI Suggest failed. Check AI service is running.');
    } finally {
      setSuggesting(false);
    }
  }, [basename, file.language, file.path, editing, editContent, displayContent, instruction]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await savePseudoFile(file.id, editContent);
      setEditing(false);
      setInstruction('');
      onSaved(updated);
    } catch {
      alert('Failed to save pseudo-code file');
    } finally {
      setSaving(false);
    }
  }, [file.id, editContent, onSaved]);

  const handleCancel = useCallback(() => {
    setEditContent(displayContent);
    setInstruction('');
    setEditing(false);
  }, [displayContent]);

  return (
    <div id={`pf-${file.id}`} className="rounded-md border border-border/60 overflow-hidden scroll-mt-4 transition-all">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/10 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm font-semibold text-foreground shrink-0">
            {sectionStartIndex}.{index} {basename}
          </h4>
          <code className="text-[10px] font-mono text-muted-foreground truncate">{file.path}</code>
          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase shrink-0">{file.language}</span>
          {file.isHumanModified && (
            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Edited</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <MicButton onTranscribed={handleMicTranscribed} />
          <AISuggestButton onClick={handleAISuggest} loading={suggesting} />
          {!editing && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(true)}>
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => downloadPseudoFile(file.id, basename).catch(() => alert('Download failed'))}
            title={`Download ${basename}`}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Mic-dictated AI instruction banner — visible while editing with text captured */}
      {editing && instruction && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium">AI instruction:</span> {instruction}
            <button
              type="button"
              onClick={() => setInstruction('')}
              className="ml-2 text-amber-700 underline hover:text-amber-900"
            >
              clear
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <div className="p-3 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={Math.min(28, Math.max(12, editContent.split('\n').length + 1))}
            className="w-full rounded-md border border-input px-3 py-2 text-xs bg-background font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <span className="h-3.5 w-3.5 mr-1 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[500px] bg-muted/5">
          {displayContent}
        </pre>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
