/**
 * Parse EPIC artifact sections into structured content + internal processing steps.
 * Shared between ArtifactTree (for TOC) and EpicArtifactView (for rendering).
 */

export type EpicSectionId =
  | 'featureIds'
  | 'summary'
  | 'businessContext'
  | 'keyActors'
  | 'highLevelFlow'
  | 'scope'
  | 'integrationDomains'
  | 'acceptanceCriteria'
  | 'nfrs'
  | 'prerequisites'
  | 'outOfScope'
  | 'risks';

export interface EpicSectionDef {
  id: EpicSectionId;
  label: string;
  content: string;
  highlight?: boolean;
}

export interface ParsedEpicHeader {
  epicId: string;
  epicName: string;
  moduleId: string;
  packageName: string;
}

export interface ParsedEpic {
  header: ParsedEpicHeader;
  sections: EpicSectionDef[]; // only includes sections that have content
  internalSections: { key: string; label: string; content: string }[]; // Step N, Output checklist
}

/** Build the ordered list of EPIC sections — keeps consistent order in both tree and view */
const EPIC_SECTION_ORDER: { id: EpicSectionId; label: string; labels: string[]; highlight?: boolean }[] = [
  { id: 'featureIds', label: 'FRD Feature IDs', labels: ['FRD Feature IDs', 'FRD FEATURE IDs'] },
  { id: 'summary', label: 'Summary', labels: ['Summary'] },
  { id: 'businessContext', label: 'Business Context', labels: ['Business Context'], highlight: true },
  { id: 'keyActors', label: 'Key Actors', labels: ['Key Actors'] },
  { id: 'highLevelFlow', label: 'High-Level Flow', labels: ['High-Level Flow', 'High Level Flow'] },
  { id: 'scope', label: 'Scope & Classes', labels: ['Scope'] },
  { id: 'integrationDomains', label: 'Integration Domains', labels: ['Integration Domains', 'Integration'] },
  { id: 'acceptanceCriteria', label: 'Acceptance Criteria', labels: ['Acceptance Criteria'] },
  { id: 'nfrs', label: 'Non-Functional Requirements', labels: ['NFRs', 'Non-Functional'] },
  { id: 'prerequisites', label: 'Pre-requisites', labels: ['Pre-requisites', 'Prerequisites'] },
  { id: 'outOfScope', label: 'Out of Scope', labels: ['Out of Scope'] },
  { id: 'risks', label: 'Risks & Challenges', labels: ['Risks', 'Challenges'] },
];

export function parseEpicContent(sections: { sectionKey: string; content: string }[]): ParsedEpic {
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

  const epicSection = sections.find((s) =>
    s.sectionKey.startsWith('epic_') && !s.sectionKey.includes('step_') && !s.sectionKey.includes('output'),
  );
  const epicContent = epicSection?.content ?? fullContent;

  const extractBlock = (heading: string): string => {
    const regex = new RegExp(`####?\\s+(?:Section\\s+\\d+\\s*[—:-]\\s*)?${heading}[\\s\\S]*?\\n([\\s\\S]*?)(?=####?\\s+|$)`, 'i');
    const match = epicContent.match(regex);
    return match?.[1]?.trim() ?? '';
  };

  // Build structured sections
  const structured: EpicSectionDef[] = [];
  for (const def of EPIC_SECTION_ORDER) {
    let content = '';
    for (const label of def.labels) {
      content = extractBlock(label);
      if (content) break;
    }
    if (content) {
      structured.push({ id: def.id, label: def.label, content, highlight: def.highlight });
    }
  }

  // Internal processing = all sections NOT in the main EPIC section, NOT introduction
  const handledKeys = new Set(['introduction', epicSection?.sectionKey ?? '']);
  const internalSections = sections
    .filter((s) => !handledKeys.has(s.sectionKey))
    .map((s) => ({
      key: s.sectionKey,
      label: s.sectionKey.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      content: s.content,
    }));

  return {
    header: {
      epicId: get(['EPIC ID', 'Epic ID']) || 'EPIC-01',
      epicName: get(['EPIC Name', 'Epic Name']) || 'EPIC',
      moduleId: get(['Module ID']) || '',
      packageName: get(['Package Name']) || '',
    },
    sections: structured,
    internalSections,
  };
}

/** Sort internal sections by step number */
export function sortInternalSections<T extends { label: string }>(sections: T[]): T[] {
  const extractStepNumber = (label: string): number | null => {
    const m = label.match(/^step\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };
  return [...sections].sort((a, b) => {
    const aStep = extractStepNumber(a.label);
    const bStep = extractStepNumber(b.label);
    if (aStep !== null && bStep !== null) return aStep - bStep;
    if (aStep !== null) return -1;
    if (bStep !== null) return 1;
    return a.label.localeCompare(b.label);
  });
}
