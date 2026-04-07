/** Section metadata for all 22 PRD sections */

export interface SectionMeta {
  number: number;
  name: string;
  shortName: string;
  /** Sub-modules for sections with sub-tabs (e.g., 6 has 13 modules) */
  subModules?: { key: string; label: string }[];
}

export const SECTIONS: readonly SectionMeta[] = [
  { number: 1, name: 'Overview / Objective', shortName: 'Overview' },
  { number: 2, name: 'High-Level Scope', shortName: 'Scope' },
  { number: 3, name: 'Out of Scope', shortName: 'Out of Scope' },
  { number: 4, name: 'Assumptions and Constraints', shortName: 'Assumptions' },
  { number: 5, name: 'Actors / User Types', shortName: 'Actors' },
  {
    number: 6,
    name: 'Functional Requirements',
    shortName: 'Functional Req',
    // subModules are DYNAMIC — derived from PRD content at runtime, not hardcoded
  },
  { number: 7, name: 'Integration Requirements', shortName: 'Integrations' },
  { number: 8, name: 'Customer Journeys / Flows', shortName: 'Journeys' },
  { number: 9, name: 'Functional Landscape', shortName: 'Landscape' },
  {
    number: 10,
    name: 'Non-Functional Requirements',
    shortName: 'NFRs',
    subModules: [
      { key: '10.1', label: 'Performance' },
      { key: '10.2', label: 'Security' },
      { key: '10.3', label: 'Scalability' },
      { key: '10.4', label: 'Availability' },
      { key: '10.5', label: 'Privacy' },
      { key: '10.6', label: 'Maintainability' },
      { key: '10.7', label: 'Audit & Logging' },
    ],
  },
  { number: 11, name: 'Technology', shortName: 'Technology' },
  { number: 12, name: 'DevOps and Observability', shortName: 'DevOps' },
  { number: 13, name: 'UI/UX Requirements', shortName: 'UI/UX' },
  { number: 14, name: 'Branding Requirements', shortName: 'Branding' },
  { number: 15, name: 'Compliance Requirements', shortName: 'Compliance' },
  { number: 16, name: 'Testing Requirements', shortName: 'Testing' },
  { number: 17, name: 'Key Deliverables', shortName: 'Deliverables' },
  { number: 18, name: 'Receivables', shortName: 'Receivables' },
  { number: 19, name: 'Environment', shortName: 'Environment' },
  { number: 20, name: 'High-Level Timelines', shortName: 'Timelines' },
  { number: 21, name: 'Success Criteria', shortName: 'Success' },
  { number: 22, name: 'Miscellaneous Requirements', shortName: 'Misc' },
] as const;

export function getSectionMeta(sectionNumber: number): SectionMeta | undefined {
  return SECTIONS.find((s) => s.number === sectionNumber);
}
