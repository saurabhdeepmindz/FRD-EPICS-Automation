'use client';

import { useMemo, useState } from 'react';
import { type BaArtifact } from '@/lib/ba-api';
import { ChevronDown, ChevronUp, AlertTriangle, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';

interface UserStoryArtifactViewProps {
  artifact: BaArtifact;
  activeStorySection?: string | null;
}

/** Map numbered section keys to structured display */
const STORY_SECTION_CONFIG: Record<string, { label: string; category: 'header' | 'flow' | 'technical' | 'integration' | 'testing' }> = {
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

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  header: { label: 'Story Identity', color: 'border-blue-200 bg-blue-50/30' },
  flow: { label: 'User Flows & Screens', color: 'border-green-200 bg-green-50/30' },
  technical: { label: 'Technical Specification', color: 'border-purple-200 bg-purple-50/30' },
  integration: { label: 'Integrations', color: 'border-amber-200 bg-amber-50/30' },
  testing: { label: 'Testing & Traceability', color: 'border-emerald-200 bg-emerald-50/30' },
};

export function UserStoryArtifactView({ artifact, activeStorySection }: UserStoryArtifactViewProps) {
  // Extract story header info from sections
  const storyId = artifact.sections.find((s) => s.sectionKey === '1_user_story_id')?.content?.trim() ?? '';
  const storyName = artifact.sections.find((s) => s.sectionKey === '2_user_story_name')?.content?.trim() ?? '';
  const storyGoal = artifact.sections.find((s) => s.sectionKey === '3_user_story_description_goal')?.content?.trim() ?? '';
  const storyType = artifact.sections.find((s) => s.sectionKey === '7_user_story_type')?.content?.trim() ?? '';
  const storyStatus = artifact.sections.find((s) => s.sectionKey === '8_user_story_status')?.content?.trim() ?? '';

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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StorySectionCard({
  label, content, isAlgorithm, isCode, hasTbd, isModified, isActive,
}: {
  label: string; content: string; isAlgorithm: boolean; isCode: boolean; hasTbd: boolean; isModified: boolean; isActive?: boolean;
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
            {content ? <MarkdownRenderer content={content} /> : <span className="text-muted-foreground italic text-sm">No content</span>}
          </div>
        </div>
      )}
    </div>
  );
}
