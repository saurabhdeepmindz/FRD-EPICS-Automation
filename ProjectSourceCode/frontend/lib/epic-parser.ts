/**
 * Parse EPIC artifact sections into structured content + internal processing steps.
 * Shared between ArtifactTree (for TOC) and EpicArtifactView (for rendering).
 */

export type EpicSectionId =
  | 'featureIds'
  | 'initiativeReference'
  | 'summary'
  | 'businessContext'
  | 'keyActors'
  | 'highLevelFlow'
  | 'prerequisites'
  | 'trigger'
  | 'scope'
  | 'outOfScope'
  | 'integrationDomains'
  | 'acceptanceCriteria'
  | 'nfrs'
  | 'businessValue'
  | 'integrationWithOtherEpics'
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
  { id: 'initiativeReference', label: 'Initiative Reference', labels: ['Initiative Reference', 'Initiative'] },
  { id: 'summary', label: 'Summary', labels: ['Summary'] },
  { id: 'businessContext', label: 'Business Context', labels: ['Business Context'], highlight: true },
  { id: 'keyActors', label: 'Key Actors', labels: ['Key Actors'] },
  { id: 'highLevelFlow', label: 'High-Level Flow', labels: ['High-Level Flow', 'High Level Flow'] },
  { id: 'prerequisites', label: 'Pre-requisites', labels: ['Pre-requisites', 'Prerequisites'] },
  { id: 'trigger', label: 'Trigger', labels: ['Trigger'] },
  { id: 'scope', label: 'Scope & Classes', labels: ['Scope'] },
  { id: 'outOfScope', label: 'Out of Scope', labels: ['Out of Scope'] },
  { id: 'integrationDomains', label: 'Integration Domains', labels: ['Integration Domains', 'Integration Domains TBD Future Format', 'Integration'] },
  { id: 'acceptanceCriteria', label: 'Acceptance Criteria', labels: ['Acceptance Criteria'] },
  { id: 'nfrs', label: 'Non-Functional Requirements', labels: ['NFRs', 'Non-Functional'] },
  { id: 'businessValue', label: 'Business Value', labels: ['Business Value'] },
  { id: 'integrationWithOtherEpics', label: 'Integration with Other EPICs', labels: ['Integration with Other EPICs', 'Integration with Other Epics'] },
  { id: 'risks', label: 'Risks & Challenges', labels: ['Risks', 'Challenges', 'Risks & Challenges'] },
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

  // Some skill runs (e.g. MOD-04 in Taxcomp) store each EPIC sub-section as
  // its OWN DB row with a key like `section_3_summary` / `section_12_acceptance_criteria`
  // rather than one big `epic_*` blob with `#### Summary` sub-headings. We
  // need to recognise both shapes — look up each target label in two places:
  //   (a) the legacy blob (via `#### Summary` heading regex), and
  //   (b) any section row whose key normalises to the same label.
  // The rows consumed this way get added to `handledKeys` so they don't
  // also appear in the Internal Processing dump.
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const handledKeys = new Set(['introduction', epicSection?.sectionKey ?? '']);

  const findSectionByLabels = (labels: string[]): { content: string; key: string | null } => {
    const wanted = labels.map(normalise);
    for (const s of sections) {
      if (s.sectionKey.includes('step_') || s.sectionKey === 'output_checklist') continue;
      const keyNorm = normalise(s.sectionKey);
      // A key like `section_12_acceptance_criteria` contains "acceptancecriteria"
      // after normalisation; match if the target label appears as a substring.
      if (wanted.some((w) => keyNorm.includes(w))) {
        return { content: s.content, key: s.sectionKey };
      }
    }
    return { content: '', key: null };
  };

  // Build structured sections
  const structured: EpicSectionDef[] = [];
  for (const def of EPIC_SECTION_ORDER) {
    let content = '';
    // (a) try the legacy `#### Heading` regex against the blob
    for (const label of def.labels) {
      content = extractBlock(label);
      if (content) break;
    }
    // (b) fall back to matching a DB section row by normalised key
    if (!content) {
      const found = findSectionByLabels(def.labels);
      if (found.content) {
        content = found.content;
        if (found.key) handledKeys.add(found.key);
      }
    }
    if (content) {
      structured.push({ id: def.id, label: def.label, content, highlight: def.highlight });
    }
  }

  // Internal processing = remaining sections — these are the skill's own
  // workflow steps (step_1_…, step_2_…), the output_checklist, and any
  // section rows whose labels don't map to the canonical EPIC structure.
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
