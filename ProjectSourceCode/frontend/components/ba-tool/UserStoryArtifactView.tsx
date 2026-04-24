'use client';

import { useEffect, useMemo, useState } from 'react';
import { type BaArtifact } from '@/lib/ba-api';
import { ChevronDown, ChevronUp, AlertTriangle, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AiEditableSection } from './AiEditableSection';
import { ScreensGallery, extractScreenIds, filterReferencedScreens } from './ScreensGallery';

interface UserStoryArtifactViewProps {
  artifact: BaArtifact;
  activeStorySection?: string | null;
  onUpdated?: () => void;
}

/** Map numbered section keys to structured display */
export const STORY_SECTION_CONFIG: Record<string, { label: string; category: 'header' | 'flow' | 'technical' | 'integration' | 'testing' }> = {
  '1_user_story_id': { label: 'User Story ID', category: 'header' },
  '2_user_story_name': { label: 'User Story Name', category: 'header' },
  '3_user_story_description_goal': { label: 'User Story Description (Goal)', category: 'header' },
  '4_module_reference': { label: 'Module Reference', category: 'header' },
  '5_frd_feature_reference': { label: 'FRD Feature Reference', category: 'header' },
  '6_epic_reference': { label: 'EPIC Reference', category: 'header' },
  '7_user_story_type': { label: 'User Story Type', category: 'header' },
  '8_user_story_status': { label: 'User Story Status', category: 'header' },
  '9_trigger': { label: 'Trigger', category: 'flow' },
  '10_actor_s': { label: 'Actor(s)', category: 'flow' },
  '11_primary_flow': { label: 'Primary Flow', category: 'flow' },
  '12_alternate_exception_flows': { label: 'Alternate / Exception Flows', category: 'flow' },
  '13_statechart': { label: 'StateChart', category: 'flow' },
  '14_screen_reference': { label: 'Screen Reference', category: 'flow' },
  '15_display_field_types': { label: 'Display Field Types', category: 'technical' },
  '16_primary_class_name': { label: 'Primary Class Name', category: 'technical' },
  '17_api_contract': { label: 'API Contract (Input/Output)', category: 'technical' },
  '18_database_entities': { label: 'Database Entities', category: 'technical' },
  '19_business_rules': { label: 'Business Rules', category: 'technical' },
  '20_validations': { label: 'Validations', category: 'technical' },
  '21_integrations': { label: 'Integrations', category: 'integration' },
  '22_algorithm_outline': { label: 'Algorithm Outline', category: 'technical' },
  '23_error_handling_outline': { label: 'Error Handling Outline', category: 'technical' },
  '24_acceptance_criteria': { label: 'Acceptance Criteria', category: 'testing' },
  '25_source_file_reference': { label: 'Source File Reference', category: 'technical' },
  '26_traceability_header_content': { label: 'Traceability Header', category: 'testing' },
  '27_subtasks': { label: 'SubTasks', category: 'testing' },
};

export const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  header: { label: 'Story Identity', color: 'border-blue-200 bg-blue-50/30' },
  flow: { label: 'User Flows & Screens', color: 'border-green-200 bg-green-50/30' },
  technical: { label: 'Technical Specification', color: 'border-purple-200 bg-purple-50/30' },
  integration: { label: 'Integrations', color: 'border-amber-200 bg-amber-50/30' },
  testing: { label: 'Testing & Traceability', color: 'border-emerald-200 bg-emerald-50/30' },
};

export function UserStoryArtifactView({ artifact, activeStorySection, onUpdated }: UserStoryArtifactViewProps) {
  // Detect multi-story artifact — SKILL-04's per-feature loop produces an
  // artifact with one DB row per story (key shapes: `us_NNN_<title>` when the
  // AI wrote a titled heading, OR `user_story_us_NNN` when it wrote just the
  // bare ID). In that layout the 27-subsection breakdown lives inside each
  // story's single content blob rather than as separate DB sections. A
  // single-story artifact (the v1-v3 shape) uses numbered keys like
  // `1_user_story_id` — detect by checking for those canonical keys.
  const canonicalSectionKeys = new Set(Object.keys(STORY_SECTION_CONFIG));
  const hasCanonicalSections = artifact.sections.some((s) => canonicalSectionKeys.has(s.sectionKey));
  const storyRowRe = /^(?:us_|user_story_us_)(\d+)/;
  const storyRows = artifact.sections
    .map((s) => {
      const m = storyRowRe.exec(s.sectionKey);
      if (!m) return null;
      return { section: s, usNumber: parseInt(m[1], 10) };
    })
    .filter((x): x is { section: typeof artifact.sections[number]; usNumber: number } => x !== null)
    .sort((a, b) => a.usNumber - b.usNumber);
  const isMultiStoryArtifact = !hasCanonicalSections && storyRows.length >= 2;

  // Extract story header info from sections (only meaningful in single-story mode)
  const storyId = artifact.sections.find((s) => s.sectionKey === '1_user_story_id')?.content?.trim() ?? '';
  const storyName = artifact.sections.find((s) => s.sectionKey === '2_user_story_name')?.content?.trim() ?? '';
  const storyGoal = artifact.sections.find((s) => s.sectionKey === '3_user_story_description_goal')?.content?.trim() ?? '';
  const storyType = artifact.sections.find((s) => s.sectionKey === '7_user_story_type')?.content?.trim() ?? '';
  const storyStatus = artifact.sections.find((s) => s.sectionKey === '8_user_story_status')?.content?.trim() ?? '';

  // ─── Multi-story render path ────────────────────────────────────────────
  if (isMultiStoryArtifact) {
    return <MultiStoryView artifact={artifact} storyRows={storyRows} activeStorySection={activeStorySection} onUpdated={onUpdated} />;
  }

  // Group sections by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof artifact.sections> = { header: [], flow: [], technical: [], integration: [], testing: [] };
    const unmatched: typeof artifact.sections = [];

    for (const section of artifact.sections) {
      const config = STORY_SECTION_CONFIG[section.sectionKey];
      if (config) {
        groups[config.category].push(section);
      } else if (!['introduction'].includes(section.sectionKey)) {
        // Try to match by section key containing the story heading
        if (section.sectionKey.startsWith('us_') || section.sectionKey.includes('user_story')) {
          // This is the main story wrapper section — skip it
        } else {
          unmatched.push(section);
        }
      }
    }
    return { groups, unmatched };
  }, [artifact.sections]);

  const typeBadgeColor = storyType.toLowerCase().includes('frontend') ? 'bg-blue-100 text-blue-700'
    : storyType.toLowerCase().includes('backend') ? 'bg-purple-100 text-purple-700'
    : storyType.toLowerCase().includes('integration') ? 'bg-orange-100 text-orange-700'
    : 'bg-gray-100 text-gray-600';

  const statusBadgeColor = storyStatus.includes('PARTIAL') ? 'bg-amber-100 text-amber-700'
    : storyStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4" data-testid="user-story-artifact-view">
      {/* Story Header Card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{storyId || artifact.artifactId}</span>
          {storyType && <span className={cn('text-[9px] px-2 py-0.5 rounded font-bold', typeBadgeColor)}>{storyType}</span>}
          {storyStatus && <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium', statusBadgeColor)}>{storyStatus}</span>}
        </div>
        <h2 className="text-base font-semibold text-foreground mb-2">{storyName || 'User Story'}</h2>
        {storyGoal && (
          <p className="text-sm text-muted-foreground italic bg-muted/30 rounded p-3">{storyGoal}</p>
        )}
      </div>

      {/* Referenced Screens — only those this User Story actually references */}
      {(() => {
        const allScreens = artifact.module?.screens ?? [];
        if (allScreens.length === 0) return null;
        const { matched } = filterReferencedScreens(
          allScreens,
          artifact.sections.map((s) => (s.isHumanModified && s.editedContent ? s.editedContent : s.content)),
        );
        if (matched.length === 0) return null;
        return (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Referenced Screens</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {matched.length} of {allScreens.length}
              </span>
            </div>
            <ScreensGallery screens={matched} />
          </div>
        );
      })()}

      {/* Grouped sections */}
      {(['header', 'flow', 'technical', 'integration', 'testing'] as const).map((category) => {
        const sections = grouped.groups[category];
        if (sections.length === 0) return null;
        const config = CATEGORY_LABELS[category];
        // Skip header sections that are already shown in the card above
        const displaySections = category === 'header'
          ? sections.filter((s) => !['1_user_story_id', '2_user_story_name', '3_user_story_description_goal', '7_user_story_type', '8_user_story_status'].includes(s.sectionKey))
          : sections;
        if (displaySections.length === 0) return null;

        return (
          <div key={category} className={cn('rounded-lg border p-3', config.color)}>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{config.label}</h3>
            <div className="space-y-2">
              {displaySections.map((section) => {
                const sConfig = STORY_SECTION_CONFIG[section.sectionKey];
                const label = sConfig?.label ?? section.sectionKey.replace(/_/g, ' ').replace(/^\d+\s*/, '');
                const content = section.isHumanModified && section.editedContent ? section.editedContent : section.content;
                const isAlgorithm = section.sectionKey.includes('algorithm') || section.sectionKey.includes('primary_flow');
                const isCode = section.sectionKey.includes('traceability') || section.sectionKey.includes('api_contract');
                const hasTbd = content.includes('TBD-Future');

                return (
                  <StorySectionCard
                    key={section.id}
                    label={label}
                    content={content}
                    isAlgorithm={isAlgorithm}
                    isCode={isCode}
                    hasTbd={hasTbd}
                    isModified={section.isHumanModified}
                    isActive={activeStorySection === section.sectionKey}
                    artifact={artifact}
                    sectionKey={section.sectionKey}
                    isAi={section.aiGenerated && !section.isHumanModified}
                    onUpdated={onUpdated}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Unmatched sections */}
      {grouped.unmatched.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Other Sections</h3>
          <div className="space-y-2">
            {grouped.unmatched.map((section) => (
              <StorySectionCard
                key={section.id}
                label={section.sectionKey.replace(/_/g, ' ')}
                content={section.isHumanModified && section.editedContent ? section.editedContent : section.content}
                isAlgorithm={false}
                isCode={false}
                hasTbd={false}
                isModified={section.isHumanModified}
                artifact={artifact}
                sectionKey={section.sectionKey}
                isAi={section.aiGenerated && !section.isHumanModified}
                onUpdated={onUpdated}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StorySectionCard({
  label, content, isAlgorithm, isCode, hasTbd, isModified, isActive, artifact, sectionKey, isAi, onUpdated,
}: {
  label: string; content: string; isAlgorithm: boolean; isCode: boolean; hasTbd: boolean; isModified: boolean; isActive?: boolean;
  artifact?: BaArtifact; sectionKey?: string; isAi?: boolean; onUpdated?: () => void;
}) {
  const [expanded, setExpanded] = useState(isActive ?? true);

  return (
    <div className={cn(
      'rounded-md border overflow-hidden bg-white/80',
      isActive ? 'border-primary ring-1 ring-primary/20' : hasTbd ? 'border-amber-300' : 'border-border/50',
    )}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          <span className="text-xs font-semibold">{label}</span>
          {hasTbd && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
          {isModified && <Sparkles className="h-2.5 w-2.5 text-amber-500" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/30 px-3 py-2">
          <div className={cn('max-h-[400px] overflow-y-auto', hasTbd ? 'text-amber-900' : '')}>
            {content ? (
              artifact && sectionKey ? (
                <AiEditableSection
                  artifact={artifact}
                  label={label}
                  content={content}
                  findSection={(sections) => sections.find((s) => s.sectionKey === sectionKey)}
                  isAi={isAi}
                  onUpdated={onUpdated}
                />
              ) : (
                <MarkdownRenderer content={content} />
              )
            ) : (
              <span className="text-muted-foreground italic text-sm">No content</span>
            )}
            {/* Screen Reference section: show ONLY the screens this section references */}
            {sectionKey === '14_screen_reference' && artifact?.module?.screens && artifact.module.screens.length > 0 && (() => {
              const ids = extractScreenIds(content);
              if (ids.length === 0) return null;
              const matched = artifact.module.screens.filter((s) => ids.includes(s.screenId));
              if (matched.length === 0) return null;
              return (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Referenced Screens ({matched.length})</p>
                  <ScreensGallery screens={matched} compact />
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-story view (SKILL-04 per-feature loop output) ────────────────────

function MultiStoryView({
  artifact,
  storyRows,
  activeStorySection,
  onUpdated,
}: {
  artifact: BaArtifact;
  storyRows: Array<{ section: BaArtifact['sections'][number]; usNumber: number }>;
  activeStorySection?: string | null;
  onUpdated?: () => void;
}) {
  const deriveFeatureId = (section: BaArtifact['sections'][number]): string => {
    const content = section.isHumanModified && section.editedContent ? section.editedContent : section.content;
    const m = content.match(/(?:FRD Feature|Feature ID|Feature Reference)[^\n]*?(F-\d+-\d+)/i);
    return m ? m[1] : 'UNASSIGNED';
  };

  const storiesByFeature = useMemo(() => {
    const groups = new Map<string, typeof storyRows>();
    for (const row of storyRows) {
      const fid = deriveFeatureId(row.section);
      const list = groups.get(fid) ?? [];
      list.push(row);
      groups.set(fid, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [storyRows]);

  const coverage = artifact.sections.find((s) => s.sectionKey === 'coverage_summary');
  const rtm = artifact.sections.find((s) => s.sectionKey === 'rtm_extension');

  return (
    <div className="space-y-4" data-testid="user-story-artifact-view-multi">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{artifact.artifactId}</span>
          <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-muted text-muted-foreground">
            {storyRows.length} stories · {storiesByFeature.length} features
          </span>
        </div>
        <h2 className="text-base font-semibold text-foreground">User Stories</h2>
      </div>

      {(() => {
        const allScreens = artifact.module?.screens ?? [];
        if (allScreens.length === 0) return null;
        const { matched, referencedIds } = filterReferencedScreens(
          allScreens,
          artifact.sections.map((s) => (s.isHumanModified && s.editedContent ? s.editedContent : s.content)),
        );
        const matchedSet = new Set(matched.map((m) => m.screenId));
        const ordered = [
          ...allScreens.filter((s) => matchedSet.has(s.screenId)),
          ...allScreens.filter((s) => !matchedSet.has(s.screenId)),
        ];
        return (
          <div className="rounded-lg border border-border bg-card p-4">
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

      {coverage && coverage.content.trim().length > 10 && (
        <CollapsibleUsSection label="Coverage Summary" artifact={artifact} sectionKey="coverage_summary"
          content={coverage.isHumanModified && coverage.editedContent ? coverage.editedContent : coverage.content}
          onUpdated={onUpdated} defaultOpen
        />
      )}
      {rtm && rtm.content.trim().length > 10 && (
        <CollapsibleUsSection label="RTM Extension" artifact={artifact} sectionKey="rtm_extension"
          content={rtm.isHumanModified && rtm.editedContent ? rtm.editedContent : rtm.content}
          onUpdated={onUpdated}
        />
      )}

      {storiesByFeature.map(([featureId, rows]) => (
        <FeatureStoryGroup
          key={featureId}
          featureId={featureId}
          rows={rows}
          artifact={artifact}
          activeStorySection={activeStorySection}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

function FeatureStoryGroup({
  featureId,
  rows,
  artifact,
  activeStorySection,
  onUpdated,
}: {
  featureId: string;
  rows: Array<{ section: BaArtifact['sections'][number]; usNumber: number }>;
  artifact: BaArtifact;
  activeStorySection?: string | null;
  onUpdated?: () => void;
}) {
  const anyActive = rows.some((r) => activeStorySection === r.section.sectionKey);
  const [expanded, setExpanded] = useState(anyActive);
  // React to tree-click changes after mount — without this, clicking a
  // different story in a collapsed group wouldn't re-open the group.
  useEffect(() => {
    if (anyActive) setExpanded(true);
  }, [anyActive, activeStorySection]);
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{featureId}</span>
          <span className="text-sm font-semibold">User Stories</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {rows.length} {rows.length === 1 ? 'story' : 'stories'}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/50 p-3 space-y-2">
          {rows.map(({ section, usNumber }) => (
            <StoryRow
              key={section.id}
              usNumber={usNumber}
              section={section}
              artifact={artifact}
              defaultOpen={activeStorySection === section.sectionKey}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StoryRow({
  usNumber, section, artifact, defaultOpen, onUpdated,
}: {
  usNumber: number;
  section: BaArtifact['sections'][number];
  artifact: BaArtifact;
  defaultOpen?: boolean;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  // Re-open when the tree re-selects this story after mount. Also scrolls
  // the card into view so the content appears on the right without manual
  // scrolling.
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      const usId = `US-${String(usNumber).padStart(3, '0')}`;
      const el = typeof document !== 'undefined' ? document.getElementById(`story-${usId}`) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [defaultOpen, usNumber]);
  const content = section.isHumanModified && section.editedContent ? section.editedContent : section.content;
  const titleFromLabel = section.sectionLabel && /—|\-\s/.test(section.sectionLabel) ? section.sectionLabel : null;
  const firstHeading = content.match(/#{1,2}\s*User Story:?\s*(US-\d+[^\n]*)/i);
  const title = titleFromLabel ?? (firstHeading ? firstHeading[1].trim() : `US-${String(usNumber).padStart(3, '0')}`);
  const usId = `US-${String(usNumber).padStart(3, '0')}`;

  const type = /frontend/i.test(title) || /frontend/i.test(content.slice(0, 500)) ? 'Frontend'
    : /backend/i.test(title) || /backend/i.test(content.slice(0, 500)) ? 'Backend'
    : /integration/i.test(title) || /integration/i.test(content.slice(0, 500)) ? 'Integration'
    : null;
  const typeBadge = type === 'Frontend' ? 'bg-blue-100 text-blue-700'
    : type === 'Backend' ? 'bg-purple-100 text-purple-700'
    : type === 'Integration' ? 'bg-orange-100 text-orange-700'
    : '';
  const hasTbd = content.includes('TBD-Future');

  return (
    <div id={`story-${usId}`} className={cn('rounded-md border overflow-hidden scroll-mt-4', hasTbd ? 'border-amber-300' : 'border-border/60')}>
      <button onClick={() => setOpen((p) => !p)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 text-left">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          <span className="font-mono text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{usId}</span>
          {type && <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold', typeBadge)}>{type}</span>}
          <span className="text-xs font-medium truncate">{title.replace(/^US-\d+\s*[—-]?\s*/, '')}</span>
          {hasTbd && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
          {section.isHumanModified && <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-3 py-2 bg-muted/10">
          <AiEditableSection
            artifact={artifact}
            label={title}
            content={content}
            findSection={(sections) => sections.find((s) => s.sectionKey === section.sectionKey)}
            isAi={section.aiGenerated && !section.isHumanModified}
            onUpdated={onUpdated}
          />
        </div>
      )}
    </div>
  );
}

function CollapsibleUsSection({
  label, content, artifact, sectionKey, onUpdated, defaultOpen,
}: {
  label: string; content: string; artifact: BaArtifact; sectionKey: string; onUpdated?: () => void; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen((p) => !p)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 text-left">
        <div className="flex items-center gap-2">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="text-sm font-semibold">{label}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border/50 px-4 py-3">
          <AiEditableSection
            artifact={artifact}
            label={label}
            content={content}
            findSection={(sections) => sections.find((s) => s.sectionKey === sectionKey)}
            onUpdated={onUpdated}
          />
        </div>
      )}
    </div>
  );
}
