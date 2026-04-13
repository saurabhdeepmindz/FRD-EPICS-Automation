'use client';

import { useMemo, useState } from 'react';
import { type BaArtifact } from '@/lib/ba-api';
import { ChevronDown, ChevronUp, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';

interface EpicArtifactViewProps {
  artifact: BaArtifact;
}

interface ParsedEpic {
  epicId: string;
  epicName: string;
  moduleId: string;
  packageName: string;
  summary: string;
  businessContext: string;
  keyActors: string;
  highLevelFlow: string;
  scope: string;
  integrationDomains: string;
  acceptanceCriteria: string;
  nfrs: string;
  featureIds: string;
  prerequisites: string;
  outOfScope: string;
  risks: string;
}

function parseEpicContent(sections: { sectionKey: string; content: string }[]): { epic: ParsedEpic; otherSections: { label: string; content: string }[] } {
  const fullContent = sections.map((s) => s.content).join('\n\n');

  const get = (labels: string[]): string => {
    const lines = fullContent.split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^\s*[-*#]*\s*/, '').replace(/\*{1,2}/g, '').trim();
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx < 1) continue;
      const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
      const lineValue = cleaned.substring(colonIdx + 1).trim();
      if (!lineValue) continue;
      for (const target of labels) {
        if (lineLabel === target.toLowerCase() || lineLabel.includes(target.toLowerCase())) return lineValue;
      }
    }
    return '';
  };

  // Find the main EPIC section (usually named epic_01_... or similar)
  const epicSection = sections.find((s) =>
    s.sectionKey.startsWith('epic_') && !s.sectionKey.includes('step_') && !s.sectionKey.includes('output'),
  );
  const epicContent = epicSection?.content ?? fullContent;

  // Extract structured fields
  const extractBlock = (heading: string): string => {
    const regex = new RegExp(`####?\\s+(?:Section\\s+\\d+\\s*[—:-]\\s*)?${heading}[\\s\\S]*?\\n([\\s\\S]*?)(?=####?\\s+|$)`, 'i');
    const match = epicContent.match(regex);
    return match?.[1]?.trim() ?? '';
  };

  const epic: ParsedEpic = {
    epicId: get(['EPIC ID', 'Epic ID']) || 'EPIC-01',
    epicName: get(['EPIC Name', 'Epic Name']) || 'EPIC',
    moduleId: get(['Module ID']) || '',
    packageName: get(['Package Name']) || '',
    summary: extractBlock('Summary') || extractBlock('EPIC Name'),
    businessContext: extractBlock('Business Context'),
    keyActors: extractBlock('Key Actors'),
    highLevelFlow: extractBlock('High-Level Flow') || extractBlock('High Level Flow'),
    scope: extractBlock('Scope'),
    integrationDomains: extractBlock('Integration Domains') || extractBlock('Integration'),
    acceptanceCriteria: extractBlock('Acceptance Criteria'),
    nfrs: extractBlock('NFRs') || extractBlock('Non-Functional'),
    featureIds: extractBlock('FRD Feature IDs') || extractBlock('FRD FEATURE IDs'),
    prerequisites: extractBlock('Pre-requisites') || extractBlock('Prerequisites'),
    outOfScope: extractBlock('Out of Scope'),
    risks: extractBlock('Risks') || extractBlock('Challenges'),
  };

  const handledKeys = new Set(['introduction', epicSection?.sectionKey ?? '']);
  const otherSections = sections
    .filter((s) => !handledKeys.has(s.sectionKey) && s.sectionKey !== epicSection?.sectionKey)
    .map((s) => ({
      label: s.sectionKey.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      content: s.content,
    }));

  return { epic, otherSections };
}

export function EpicArtifactView({ artifact }: EpicArtifactViewProps) {
  const { epic, otherSections } = useMemo(() => parseEpicContent(artifact.sections), [artifact.sections]);

  return (
    <div className="space-y-4" data-testid="epic-artifact-view">
      {/* EPIC Header Card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="h-5 w-5 text-primary" />
          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{epic.epicId}</span>
          <h2 className="text-base font-semibold text-foreground">{epic.epicName}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
          {epic.moduleId && <div><span className="text-muted-foreground">Module:</span> <span className="font-mono">{epic.moduleId}</span></div>}
          {epic.packageName && <div><span className="text-muted-foreground">Package:</span> <span className="font-mono">{epic.packageName}</span></div>}
        </div>
      </div>

      {/* Structured EPIC sections */}
      {epic.featureIds && <EpicSection title="FRD Feature IDs" content={epic.featureIds} icon="features" />}
      {epic.summary && <EpicSection title="Summary" content={epic.summary} />}
      {epic.businessContext && <EpicSection title="Business Context" content={epic.businessContext} highlight />}
      {epic.keyActors && <EpicSection title="Key Actors" content={epic.keyActors} />}
      {epic.highLevelFlow && <EpicSection title="High-Level Flow" content={epic.highLevelFlow} mono />}
      {epic.scope && <EpicSection title="Scope & Classes" content={epic.scope} mono />}
      {epic.integrationDomains && <EpicSection title="Integration Domains" content={epic.integrationDomains} />}
      {epic.acceptanceCriteria && <EpicSection title="Acceptance Criteria" content={epic.acceptanceCriteria} />}
      {epic.nfrs && <EpicSection title="Non-Functional Requirements" content={epic.nfrs} />}
      {epic.prerequisites && <EpicSection title="Pre-requisites" content={epic.prerequisites} />}
      {epic.outOfScope && <EpicSection title="Out of Scope" content={epic.outOfScope} />}
      {epic.risks && <EpicSection title="Risks & Challenges" content={epic.risks} />}

      {/* Other sections */}
      {otherSections.map((s, idx) => (
        <EpicSection key={idx} title={s.label} content={s.content} defaultCollapsed />
      ))}
    </div>
  );
}

function EpicSection({
  title, content, highlight, mono, icon, defaultCollapsed,
}: {
  title: string; content: string; highlight?: boolean; mono?: boolean; icon?: string; defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const hasTbd = content.includes('TBD-Future');

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      highlight ? 'border-primary/30 bg-primary/5' : hasTbd ? 'border-amber-200' : 'border-border bg-card',
    )}>
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
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
