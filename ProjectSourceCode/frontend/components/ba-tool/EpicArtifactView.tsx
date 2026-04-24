'use client';

import { useEffect, useMemo, useState } from 'react';
import { type BaArtifact } from '@/lib/ba-api';
import { ChevronDown, ChevronUp, AlertTriangle, Layers, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiEditableSection } from './AiEditableSection';
import { ScreensGallery, filterReferencedScreens } from './ScreensGallery';
import { parseEpicContent, sortInternalSections, type EpicSectionId } from '@/lib/epic-parser';

interface EpicArtifactViewProps {
  artifact: BaArtifact;
  /** Active section from TOC click — scrolls panel and highlights target */
  activeSectionId?: string | null;
  /** Reload callback after inline edits */
  onUpdated?: () => void;
}

export function EpicArtifactView({ artifact, activeSectionId, onUpdated }: EpicArtifactViewProps) {
  const parsed = useMemo(() => parseEpicContent(artifact.sections), [artifact.sections]);
  const sortedInternalSections = useMemo(() => sortInternalSections(parsed.internalSections), [parsed.internalSections]);
  const [internalExpanded, setInternalExpanded] = useState(false);

  // If the active section is an internal step, auto-expand the internal group
  useEffect(() => {
    if (!activeSectionId) return;
    const isInternal = sortedInternalSections.some((s) => s.key === activeSectionId);
    if (isInternal) setInternalExpanded(true);

    // Scroll target into view
    const el = document.getElementById(`epic-sec-${activeSectionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSectionId, sortedInternalSections]);

  return (
    <div className="space-y-4" data-testid="epic-artifact-view">
      {/* EPIC Header Card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="h-5 w-5 text-primary" />
          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{parsed.header.epicId}</span>
          <h2 className="text-base font-semibold text-foreground">{parsed.header.epicName}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
          {parsed.header.moduleId && <div><span className="text-muted-foreground">Module:</span> <span className="font-mono">{parsed.header.moduleId}</span></div>}
          {parsed.header.packageName && <div><span className="text-muted-foreground">Package:</span> <span className="font-mono">{parsed.header.packageName}</span></div>}
        </div>
      </div>

      {/* ═══ Screens — show ALL module screens; highlight the ones this EPIC references ═══ */}
      {(() => {
        const allScreens = artifact.module?.screens ?? [];
        if (allScreens.length === 0) return null;
        const { matched, referencedIds } = filterReferencedScreens(
          allScreens,
          artifact.sections.map((s) => (s.isHumanModified && s.editedContent ? s.editedContent : s.content)),
        );
        // Reorder so referenced screens come first, non-referenced follow (dimmed).
        const matchedSet = new Set(matched.map((m) => m.screenId));
        const ordered = [
          ...allScreens.filter((s) => matchedSet.has(s.screenId)),
          ...allScreens.filter((s) => !matchedSet.has(s.screenId)),
        ];
        return (
          <div className="rounded-lg border border-border bg-card p-4" id="epic-sec-screens">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Referenced Screens</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {matched.length} referenced · {allScreens.length} total
              </span>
            </div>
            <ScreensGallery screens={ordered} highlightIds={referencedIds} />
          </div>
        );
      })()}

      {/* ═══ EPIC Content (structured sections) ═══ */}
      {parsed.sections.map((section) => (
        <EpicSection
          key={section.id}
          sectionId={section.id}
          dbSectionKey={section.dbSectionKey}
          title={section.label}
          content={section.content}
          highlight={section.highlight}
          isActive={activeSectionId === section.id}
          artifact={artifact}
          onUpdated={onUpdated}
        />
      ))}

      {/* ═══ EPIC Internal Processing ═══ */}
      {sortedInternalSections.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
          <button
            onClick={() => setInternalExpanded((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Cog className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">EPIC Internal Processing</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {sortedInternalSections.length} steps
              </span>
            </div>
            {internalExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {internalExpanded && (
            <div className="border-t border-border/50 p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground italic mb-2">
                These are the skill&apos;s internal processing steps and validations, not part of the EPIC deliverable itself.
              </p>
              {sortedInternalSections.map((s) => (
                <EpicSection
                  key={s.key}
                  sectionId={s.key}
                  title={s.label}
                  content={s.content}
                  defaultCollapsed
                  isActive={activeSectionId === s.key}
                  artifact={artifact}
                  onUpdated={onUpdated}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EpicSection({
  sectionId, dbSectionKey, title, content, highlight, defaultCollapsed, isActive, artifact, onUpdated,
}: {
  sectionId: string;
  /**
   * Optional override — the real backing DB sectionKey when the parser
   * matched a `section_N_label` row to the canonical `sectionId`. Without
   * this, AiEditableSection's findSection fails to locate the row and the
   * Save button is disabled as "no backing section".
   */
  dbSectionKey?: string;
  title: string;
  content: string;
  highlight?: boolean;
  defaultCollapsed?: boolean;
  isActive?: boolean;
  artifact: BaArtifact;
  onUpdated?: () => void;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const hasTbd = content.includes('TBD-Future');

  // Auto-expand when this section becomes active from TOC click
  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  // Resolve the underlying BaArtifactSection for this EPIC sub-section. We
  // try (1) the explicit dbSectionKey resolved by the parser, (2) sectionKey
  // matching the canonical id, (3) label match on sectionLabel. The first
  // two handle both new `section_N_label` rows and legacy `epic_*` blobs.
  const findSection = (sections: BaArtifact['sections']) => sections.find(
    (s) =>
      (dbSectionKey !== undefined && s.sectionKey === dbSectionKey) ||
      s.sectionKey === sectionId ||
      s.sectionLabel.toLowerCase() === title.toLowerCase(),
  );
  const matched = findSection(artifact.sections);
  const isAi = Boolean(matched?.aiGenerated && !matched?.isHumanModified);

  return (
    <div
      id={`epic-sec-${sectionId}`}
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        isActive ? 'border-primary ring-2 ring-primary/30' :
          highlight ? 'border-primary/30 bg-primary/5' :
          hasTbd ? 'border-amber-200' : 'border-border bg-card',
      )}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="text-sm font-semibold">{title}</span>
          {hasTbd && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          {highlight && <span className="text-[8px] bg-primary/20 text-primary px-1 rounded">AUTOMATION CRITICAL</span>}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3">
          <AiEditableSection
            artifact={artifact}
            label={title}
            content={content}
            findSection={findSection}
            isAi={isAi}
            onUpdated={onUpdated}
          />
        </div>
      )}
    </div>
  );
}
