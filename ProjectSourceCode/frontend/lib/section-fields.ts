/**
 * Field definitions for all 22 PRD sections.
 * Each section lists its fields with label, key, and input type.
 * This drives the generic SectionForm renderer.
 */

export interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}

export const SECTION_FIELDS: Record<number, FieldDef[]> = {
  1: [
    { key: 'productName', label: 'Product Name', placeholder: 'e.g., Luggage Storage Marketplace' },
    { key: 'objective', label: 'Objective', multiline: true, rows: 4, placeholder: 'What is the product and why is it being built?' },
    { key: 'targetAudience', label: 'Target Audience', multiline: true, rows: 3, placeholder: 'Who is this product for?' },
    { key: 'problemStatement', label: 'Problem Statement', multiline: true, rows: 3, placeholder: 'What problem does it solve?' },
  ],
  2: [
    { key: 'scopeSummary', label: 'Scope Summary', multiline: true, rows: 3, placeholder: 'High-level summary of what is included in this release' },
    { key: 'coreFeatures', label: 'Core Features', multiline: true, rows: 6, placeholder: 'Bullet list of core capability areas included in this release' },
    { key: 'platforms', label: 'Target Platforms', placeholder: 'e.g., Web (responsive), iOS, Android' },
  ],
  3: [
    { key: 'excludedItems', label: 'Out of Scope Items', multiline: true, rows: 8, placeholder: 'List items explicitly excluded from this release (one per line)' },
    { key: 'deferredTo', label: 'Deferred To', placeholder: 'e.g., v2, Phase 2, TBD' },
  ],
  4: [
    { key: 'businessAssumptions', label: 'Business Assumptions', multiline: true, rows: 4, placeholder: 'Numbered list of business assumptions' },
    { key: 'technicalConstraints', label: 'Technical Constraints', multiline: true, rows: 4, placeholder: 'Numbered list of technical constraints' },
    { key: 'regulatoryConstraints', label: 'Regulatory Constraints', multiline: true, rows: 3, placeholder: 'Compliance-related constraints' },
    { key: 'dependencies', label: 'External Dependencies', multiline: true, rows: 3, placeholder: 'Third-party systems, APIs, or services' },
  ],
  5: [
    { key: 'primaryActors', label: 'Primary Actors', multiline: true, rows: 6, placeholder: 'Actor Name — Role — Key Permissions (one per line)' },
    { key: 'systemActors', label: 'System Actors', multiline: true, rows: 3, placeholder: 'Automated agents or background processes' },
    { key: 'externalActors', label: 'External Actors', multiline: true, rows: 3, placeholder: 'Third-party integrations or external users' },
  ],
  // Section 6 module-level fields (shown when a module sub-tab is selected, NOT a specific feature)
  6: [
    { key: 'moduleId', label: 'Module ID', placeholder: 'e.g., MOD-AUTH, MOD-KYC, MOD-BOOK' },
    { key: 'moduleName', label: 'Module Name', placeholder: 'e.g., Authentication, Bookings, Payments' },
    { key: 'moduleDescription', label: 'Module Description', multiline: true, rows: 4, placeholder: 'What this module does, its boundaries and responsibilities' },
    { key: 'moduleBusinessRules', label: 'Module-Level Business Rules', multiline: true, rows: 4, placeholder: 'Business rules that apply across ALL features in this module (leave blank if none beyond feature-level rules)' },
  ],
  7: [
    { key: 'integrations', label: 'Integration List', multiline: true, rows: 8, placeholder: 'Provider — Purpose — Data Exchanged — Phase (one per line)' },
    { key: 'apiStandards', label: 'API Standards', multiline: true, rows: 3, placeholder: 'REST, GraphQL, gRPC, webhooks, etc.' },
  ],
  8: [
    { key: 'journeyName', label: 'Journey Name', placeholder: 'e.g., Customer Booking Flow' },
    { key: 'actor', label: 'Actor', placeholder: 'Which user role performs this journey?' },
    { key: 'steps', label: 'Journey Steps', multiline: true, rows: 8, placeholder: 'Step-by-step flow (numbered)' },
    { key: 'alternateFlows', label: 'Alternate / Error Flows', multiline: true, rows: 4, placeholder: 'What happens if something goes wrong?' },
  ],
  9: [
    { key: 'modules', label: 'Module Descriptions', multiline: true, rows: 10, placeholder: 'Module Name — What it does — Inputs — Outputs (one per line)' },
    { key: 'moduleDependencies', label: 'Module Dependencies', multiline: true, rows: 4, placeholder: 'Which modules depend on which?' },
  ],
  10: [
    { key: 'category', label: 'NFR Category', placeholder: 'Performance / Security / Scalability / Availability / Privacy / Maintainability / Audit' },
    { key: 'requirement', label: 'Requirement', multiline: true, rows: 4, placeholder: 'Describe the requirement with measurable targets' },
    { key: 'metric', label: 'Metric / SLA', placeholder: 'e.g., p99 latency < 200ms, 99.9% uptime' },
    { key: 'priority', label: 'Priority', placeholder: 'P0 / P1 / P2' },
  ],
  11: [
    { key: 'frontend', label: 'Frontend Stack', multiline: true, rows: 3, placeholder: 'Framework, version, key libraries' },
    { key: 'backend', label: 'Backend Stack', multiline: true, rows: 3, placeholder: 'Framework, version, key libraries' },
    { key: 'database', label: 'Database', multiline: true, rows: 2, placeholder: 'Database engine, version, ORM' },
    { key: 'infrastructure', label: 'Infrastructure / Cloud', multiline: true, rows: 3, placeholder: 'Cloud provider, services, CDN' },
    { key: 'thirdParty', label: 'Third-Party Services', multiline: true, rows: 3, placeholder: 'Auth, payments, email, analytics, etc.' },
  ],
  12: [
    { key: 'ciCd', label: 'CI/CD Pipeline', multiline: true, rows: 3, placeholder: 'Tooling and workflow' },
    { key: 'containerization', label: 'Containerization', multiline: true, rows: 2, placeholder: 'Docker, Kubernetes, ECS, etc.' },
    { key: 'monitoring', label: 'Monitoring & Alerting', multiline: true, rows: 3, placeholder: 'APM, logging, dashboards' },
    { key: 'deploymentStrategy', label: 'Deployment Strategy', multiline: true, rows: 2, placeholder: 'Blue/green, canary, rolling' },
  ],
  13: [
    { key: 'designSystem', label: 'Design System', multiline: true, rows: 3, placeholder: 'Component library, tokens, style guide' },
    { key: 'breakpoints', label: 'Responsive Breakpoints', placeholder: 'e.g., 320px, 768px, 1024px, 1280px' },
    { key: 'accessibility', label: 'Accessibility Standard', placeholder: 'e.g., WCAG 2.1 Level AA' },
    { key: 'keyScreens', label: 'Key Screens', multiline: true, rows: 6, placeholder: 'Screen name — Description — User Role (one per line)' },
  ],
  14: [
    { key: 'productNameBrand', label: 'Product Name', placeholder: 'Final product/brand name' },
    { key: 'tagline', label: 'Tagline', placeholder: 'Short tagline or catchphrase' },
    { key: 'toneOfVoice', label: 'Tone of Voice', multiline: true, rows: 2, placeholder: 'Professional, friendly, authoritative, etc.' },
    { key: 'colorPalette', label: 'Color Palette', multiline: true, rows: 3, placeholder: 'Primary, secondary, accent colors (hex values)' },
    { key: 'typography', label: 'Typography', placeholder: 'Font families and usage' },
    { key: 'logoGuidelines', label: 'Logo Guidelines', multiline: true, rows: 2, placeholder: 'Logo usage rules or TBD' },
  ],
  15: [
    { key: 'regulations', label: 'Applicable Regulations', multiline: true, rows: 4, placeholder: 'GDPR, HIPAA, PCI-DSS, SOC 2, etc.' },
    { key: 'dataResidency', label: 'Data Residency', multiline: true, rows: 2, placeholder: 'Where data must be stored' },
    { key: 'certifications', label: 'Required Certifications', multiline: true, rows: 2, placeholder: 'ISO 27001, SOC 2 Type II, etc.' },
  ],
  16: [
    { key: 'unitTesting', label: 'Unit Testing', multiline: true, rows: 3, placeholder: 'Framework, scope, coverage target' },
    { key: 'integrationTesting', label: 'Integration Testing', multiline: true, rows: 3, placeholder: 'Framework, scope, API testing' },
    { key: 'e2eTesting', label: 'E2E Testing', multiline: true, rows: 3, placeholder: 'Framework, critical user flows' },
    { key: 'securityTesting', label: 'Security Testing', multiline: true, rows: 2, placeholder: 'SAST, DAST, pen testing' },
    { key: 'performanceTesting', label: 'Performance Testing', multiline: true, rows: 2, placeholder: 'Load testing, stress testing' },
  ],
  17: [
    { key: 'deliverables', label: 'Deliverables List', multiline: true, rows: 8, placeholder: 'Numbered list of deliverable artefacts' },
  ],
  18: [
    { key: 'receivables', label: 'Client Receivables', multiline: true, rows: 8, placeholder: 'Item — Owner — Needed By (one per line)' },
  ],
  19: [
    { key: 'environments', label: 'Environment Tiers', multiline: true, rows: 8, placeholder: 'Tier — Purpose — Managed By — Infrastructure (one per line)' },
  ],
  20: [
    { key: 'milestones', label: 'Milestones', multiline: true, rows: 8, placeholder: 'Phase — Milestone — Target Date — Owner (one per line)' },
  ],
  21: [
    { key: 'criteria', label: 'Success Criteria', multiline: true, rows: 8, placeholder: 'Metric — Target — Measurement Method — Window — Owner (one per line)' },
  ],
  22: [
    { key: 'miscItems', label: 'Miscellaneous Items', multiline: true, rows: 8, placeholder: 'MISC-ID — Summary — Source — Classification — Owner — Status (one per line)' },
  ],
};
