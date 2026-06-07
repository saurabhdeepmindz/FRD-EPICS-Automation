/**
 * New Pipeline — Frontend API client.
 * Customer Discovery → PRD+FRD → HLD → Code. Endpoints under /api/ba/projects/:id/*.
 */
import { api, API_BASE } from './api';

// ─── Customer Inputs (Track B) ───────────────────────────────────────────────

export type CustomerInputType =
  | 'AUDIO'
  | 'EXTERNAL_BRD'
  | 'CUSTOMER_WIREFRAME'
  | 'TEXT_CONTEXT'
  | 'DOCUMENT';

export interface CustomerInputFileMeta {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface CustomerInput {
  id: string;
  projectId: string;
  inputType: CustomerInputType;
  label: string;
  fileMetadata: CustomerInputFileMeta | null;
  extractedText: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function listCustomerInputs(projectId: string): Promise<CustomerInput[]> {
  const { data } = await api.get<ApiEnvelope<CustomerInput[]>>(
    `/ba/projects/${projectId}/customer-inputs`,
  );
  return data.data;
}

export async function getCustomerInput(
  projectId: string,
  inputId: string,
): Promise<CustomerInput> {
  const { data } = await api.get<ApiEnvelope<CustomerInput>>(
    `/ba/projects/${projectId}/customer-inputs/${inputId}`,
  );
  return data.data;
}

export interface CreateCustomerInputArgs {
  inputType: CustomerInputType;
  label?: string;
  text?: string; // for TEXT_CONTEXT
  file?: File; // for AUDIO / EXTERNAL_BRD / CUSTOMER_WIREFRAME / DOCUMENT
}

export async function createCustomerInput(
  projectId: string,
  args: CreateCustomerInputArgs,
): Promise<CustomerInput> {
  const fd = new FormData();
  fd.append('inputType', args.inputType);
  if (args.label) fd.append('label', args.label);
  if (args.text) fd.append('text', args.text);
  if (args.file) fd.append('file', args.file);

  const { data } = await api.post<ApiEnvelope<CustomerInput>>(
    `/ba/projects/${projectId}/customer-inputs`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data.data;
}

export async function deleteCustomerInput(
  projectId: string,
  inputId: string,
): Promise<void> {
  await api.delete(`/ba/projects/${projectId}/customer-inputs/${inputId}`);
}

export interface ReExtractResult {
  id: string;
  chars: number;
  note: string | null;
}

/** Re-run text extraction for a file input from its stored blob. */
export async function reExtractCustomerInput(
  projectId: string,
  inputId: string,
): Promise<ReExtractResult> {
  const { data } = await api.post<ApiEnvelope<ReExtractResult>>(
    `/ba/projects/${projectId}/customer-inputs/${inputId}/re-extract`,
    {},
    { timeout: 120_000 },
  );
  return data.data;
}

// ─── Catalogue of input types (drives the Hub cards) ─────────────────────────

export interface InputTypeMeta {
  type: CustomerInputType;
  label: string;
  desc: string;
  /** Whether this type carries a file upload (vs. pure text). */
  file: boolean;
  /** Accepted file extensions/mime for the file picker. */
  accept?: string;
  /** Whether the file picker allows selecting several files at once. */
  multiple?: boolean;
}

export const INPUT_TYPE_CATALOGUE: InputTypeMeta[] = [
  { type: 'AUDIO', label: 'Audio Recording', desc: 'Customer interviews & walkthroughs', file: true, accept: 'audio/*' },
  { type: 'EXTERNAL_BRD', label: 'Customer BRD', desc: 'Business Requirements Document from the customer', file: true, accept: '.pdf,.docx,.txt,.md' },
  { type: 'CUSTOMER_WIREFRAME', label: 'Customer Wireframes', desc: 'Sketches or mockups the customer shared', file: true, accept: 'image/*,.html,.htm', multiple: true },
  { type: 'TEXT_CONTEXT', label: 'Text / Context Notes', desc: 'Free-text requirements or meeting notes', file: false },
  { type: 'DOCUMENT', label: 'Supporting Document', desc: 'Any other PDF / DOCX / TXT with requirements', file: true, accept: '.pdf,.docx,.txt,.md' },
];

// ─── Project PRD + FRD (Track C) ─────────────────────────────────────────────

export type PrdStatus = 'DRAFT' | 'CONFIRMED_PARTIAL' | 'CONFIRMED' | 'APPROVED';

// v7 — authoring status (derived) + review status (draft-review gate)
export type SectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'skipped';
export interface ReviewProgress {
  accepted: number;
  edited: number;
  skipped: number;
  pending: number;
}

export interface ProjectPrd {
  id: string;
  projectId: string;
  version: number;
  status: PrdStatus;
  sections: Record<string, Record<string, unknown>>;
  sourceInputIds: string[];
  triggeredBy: string | null;
  // v7 metadata
  prdCode: string | null;
  clientName: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // v7 — derived/enriched on GET project-prd (optional: absent on older responses)
  sectionStatuses?: Record<string, SectionStatus>;
  review?: Record<string, ReviewStatus>;
  reviewProgress?: ReviewProgress;
}

export interface PrdSourceInput {
  id: string;
  inputType: string;
  label: string;
  textExcerpt: string;
  charCount: number;
  fileName: string | null;
  createdAt: string;
}

export interface PrdVersionRow {
  id: string;
  version: number;
  status: PrdStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PrdGap {
  section: number;
  question: string;
}

/** Section number → human name (Section 6 is the FRD). */
export const PRD_SECTION_NAMES: Record<string, string> = {
  '1': 'Overview / Objective',
  '2': 'High-Level Scope',
  '3': 'Out of Scope',
  '4': 'Assumptions and Constraints',
  '5': 'Actors / User Types',
  '6': 'Functional Requirements (FRD)',
  '7': 'Integration Requirements',
  '8': 'Customer Journeys / Flows',
  '9': 'Functional Landscape',
  '10': 'Non-Functional Requirements',
  '11': 'Technology',
  '12': 'DevOps and Observability',
  '13': 'UI/UX Requirements',
  '14': 'Branding Requirements',
  '15': 'Compliance Requirements',
  '16': 'Testing Requirements',
  '17': 'Key Deliverables',
  '18': 'Receivables',
  '19': 'Environment',
  '20': 'High-Level Timelines',
  '21': 'Success Criteria',
  '22': 'Miscellaneous Requirements',
};

export async function getProjectPrd(projectId: string): Promise<ProjectPrd | null> {
  const { data } = await api.get<ApiEnvelope<ProjectPrd | null>>(
    `/ba/projects/${projectId}/project-prd`,
  );
  return data.data;
}

export async function generateProjectPrd(
  projectId: string,
): Promise<{ id: string; gaps: PrdGap[] }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; gaps: PrdGap[] }>>(
    `/ba/projects/${projectId}/project-prd/generate`,
    {},
    { timeout: 300_000 },
  );
  return data.data;
}

export async function updatePrdSection(
  projectId: string,
  prdId: string,
  sectionKey: string,
  content: unknown,
): Promise<ProjectPrd> {
  const { data } = await api.patch<ApiEnvelope<ProjectPrd>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/section/${sectionKey}`,
    { content },
  );
  return data.data;
}

/** S-07 — per-field AI suggestion (returns suggested text for one section field). */
export async function suggestPrdField(
  projectId: string,
  prdId: string,
  sectionKey: string,
  fieldName: string,
): Promise<string> {
  const { data } = await api.post<ApiEnvelope<{ suggestion: string }>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/suggest-field`,
    { sectionKey, fieldName },
    { timeout: 120_000 },
  );
  return data.data.suggestion;
}

// ─── Gap-answering loop (Track S — S-05) ─────────────────────────────────────

/** One answered gap submitted by the BA. */
export interface GapAnswerInput {
  section: number;
  question: string;
  answer: string;
}

/** The persisted gaps for the latest PRD (survive page refreshes). */
export async function getProjectPrdGaps(projectId: string): Promise<PrdGap[]> {
  const { data } = await api.get<ApiEnvelope<PrdGap[]>>(
    `/ba/projects/${projectId}/project-prd/gaps`,
  );
  return data.data;
}

/** Merge gap answers into the PRD → new version; returns the remaining gaps. */
export async function answerProjectPrdGaps(
  projectId: string,
  answers: GapAnswerInput[],
): Promise<{ id: string; version: number; gaps: PrdGap[] }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; version: number; gaps: PrdGap[] }>>(
    `/ba/projects/${projectId}/project-prd/answer-gaps`,
    { answers },
    { timeout: 300_000 },
  );
  return data.data;
}

/** V-02 — canonical PRD markdown for the latest version (for preview/download). */
export async function getProjectPrdMarkdown(
  projectId: string,
): Promise<{ version: number; markdown: string } | null> {
  const { data } = await api.get<ApiEnvelope<{ version: number; markdown: string } | null>>(
    `/ba/projects/${projectId}/project-prd/markdown`,
  );
  return data.data;
}

// ─── v7 Track X/W — source · versions/restore · review gate · metadata ───────

/** Customer inputs the latest PRD was generated from. */
export async function getProjectPrdSource(projectId: string): Promise<PrdSourceInput[]> {
  const { data } = await api.get<ApiEnvelope<PrdSourceInput[]>>(
    `/ba/projects/${projectId}/project-prd/source`,
  );
  return data.data;
}

export async function listProjectPrdVersions(projectId: string): Promise<PrdVersionRow[]> {
  const { data } = await api.get<ApiEnvelope<PrdVersionRow[]>>(
    `/ba/projects/${projectId}/project-prd/versions`,
  );
  return data.data;
}

/** Full content of a specific PRD version (for read-only viewing in history). */
export async function getProjectPrdVersion(projectId: string, prdId: string): Promise<ProjectPrd> {
  const { data } = await api.get<ApiEnvelope<ProjectPrd>>(
    `/ba/projects/${projectId}/project-prd/version/${prdId}`,
  );
  return data.data;
}

/** Clone an earlier version into a new latest version. */
export async function restoreProjectPrdVersion(
  projectId: string,
  prdId: string,
): Promise<{ id: string; version: number }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; version: number }>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/restore`,
    {},
  );
  return data.data;
}

/** Set one section's review status. */
export async function setPrdReviewStatus(
  projectId: string,
  prdId: string,
  sectionKey: string,
  status: ReviewStatus,
): Promise<ProjectPrd> {
  const { data } = await api.patch<ApiEnvelope<ProjectPrd>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/review/${sectionKey}`,
    { status },
  );
  return data.data;
}

export async function acceptAllPrdReview(projectId: string, prdId: string): Promise<ProjectPrd> {
  const { data } = await api.post<ApiEnvelope<ProjectPrd>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/review/accept-all`,
    {},
  );
  return data.data;
}

export async function confirmProjectPrd(projectId: string, prdId: string): Promise<ProjectPrd> {
  const { data } = await api.post<ApiEnvelope<ProjectPrd>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/confirm`,
    {},
  );
  return data.data;
}

export async function updateProjectPrdMeta(
  projectId: string,
  prdId: string,
  fields: { prdCode?: string; clientName?: string; submittedBy?: string },
): Promise<ProjectPrd> {
  const { data } = await api.patch<ApiEnvelope<ProjectPrd>>(
    `/ba/projects/${projectId}/project-prd/${prdId}/meta`,
    fields,
  );
  return data.data;
}

// ─── Forward propagation / freshness (Track T — T-02/T-03) ───────────────────

export interface FreshnessEntry {
  artifactType: 'HLD' | 'E2E_FLOW';
  id: string;
  label: string;
  builtFrom: { prdVersion?: number; hldVersion?: number };
  current: { prdVersion?: number; hldVersion?: number };
  stale: boolean;
  reason: string;
}

export interface FreshnessReport {
  projectId: string;
  computedAt: string;
  currentPrdVersion: number | null;
  currentHldVersion: number | null;
  downstream: FreshnessEntry[];
  staleCount: number;
}

/** Downstream artifact freshness vs the latest PRD/HLD (staleness banner). */
export async function getArtifactFreshness(projectId: string): Promise<FreshnessReport> {
  const { data } = await api.get<ApiEnvelope<FreshnessReport>>(
    `/ba/projects/${projectId}/freshness`,
  );
  return data.data;
}

// ─── HLD (Track E) ───────────────────────────────────────────────────────────

export interface Hld {
  id: string;
  projectId: string;
  version: number;
  status: PrdStatus;
  sections: Record<string, Record<string, unknown>>;
  mermaidDiagrams: Record<string, string>;
  triggeredBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ordered 17 HLD section keys → names. */
export const HLD_SECTIONS: { key: string; name: string }[] = [
  { key: 'documentControl', name: 'Document Control' },
  { key: 'executiveSummary', name: 'Executive Summary' },
  { key: 'systemView', name: '50,000-ft System View' },
  { key: 'technicalLayersView', name: 'Layered Technical View' },
  { key: 'componentView', name: 'Detailed Component View' },
  { key: 'architectureStyleView', name: 'Architecture Style & Patterns View' },
  { key: 'deploymentView', name: 'Deployment View' },
  { key: 'architectureStyleDecision', name: 'Architecture Style Decision' },
  { key: 'technologyStack', name: 'Technology Stack' },
  { key: 'designPatterns', name: 'Design Patterns Catalogue' },
  { key: 'authDesign', name: 'Auth & Security Design' },
  { key: 'aiLayer', name: 'AI Layer Architecture' },
  { key: 'integrations', name: 'Integration Architecture' },
  { key: 'multiTenancy', name: 'Multi-Tenancy & Data Isolation' },
  { key: 'nfr', name: 'Non-Functional Requirements' },
  { key: 'prdCoverage', name: 'PRD → HLD Coverage Checklist' },
  { key: 'projectStructure', name: 'Project Structure' },
];

export const HLD_DIAGRAM_LABELS: Record<string, string> = {
  systemView: '50,000-ft System View',
  technicalLayers: 'Layered Technical View',
  componentView: 'Component View',
  architectureStyle: 'Architecture Style (Actor → Frontend → Backend → Data)',
  deployment: 'Deployment Topology',
};

export async function getHld(projectId: string): Promise<Hld | null> {
  const { data } = await api.get<ApiEnvelope<Hld | null>>(`/ba/projects/${projectId}/hld`);
  return data.data;
}

// ─── HLD-V2 (Sprint v10) — edit / preview / export (PRD parity) ───────────────

/** HE-02 — persist an edited HLD section → new version (existing PATCH route). */
export async function updateHldSection(
  projectId: string,
  hldId: string,
  sectionKey: string,
  content: unknown,
): Promise<Hld> {
  const { data } = await api.patch<ApiEnvelope<Hld>>(
    `/ba/projects/${projectId}/hld/${hldId}/section/${sectionKey}`,
    { content },
  );
  return data.data;
}

/** Per-field AI Suggest for the HLD section editor (grounded in PRD/FRD/stack). */
export async function suggestHldField(
  projectId: string,
  hldId: string,
  body: { sectionKey: string; fieldName: string; currentValue?: string; provider?: string },
): Promise<{ suggestion: string; model: string }> {
  const { data } = await api.post<ApiEnvelope<{ suggestion: string; model: string }>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/suggest-field`,
    body,
    { timeout: 120_000 },
  );
  return data.data;
}

// ─── 50,000-ft System View — structured band model (Sprint v11) ──────────────

export interface SystemViewModel {
  actors: string[];
  channels: string[];
  coreInfra: string[];
  functionalModules: { name: string; subtitle?: string; phase?: number; thirdParty?: boolean }[];
  rbac?: { title: string; subtitle?: string };
  integrationModules: { name: string; subtitle?: string }[];
  externalGroups: { title: string; items: string[] }[];
  aiLayer?: { capabilities?: string[]; rag?: { title: string; subtitle?: string }; llmProviders?: string[] };
  gatewayNote?: string;
  gaps?: string[];
}

/** Build (cached) the 50,000-ft System View band model for an HLD. */
export async function getHldSystemView(projectId: string, hldId: string): Promise<SystemViewModel> {
  const { data } = await api.get<ApiEnvelope<SystemViewModel>>(
    `/ba/projects/${projectId}/hld/${hldId}/system-view`,
    { timeout: 180_000 },
  );
  return data.data;
}

/** Regenerate the System View band model (re-derives from PRD/FRD/HLD). */
export async function regenerateHldSystemView(projectId: string, hldId: string): Promise<SystemViewModel> {
  const { data } = await api.post<ApiEnvelope<SystemViewModel>>(
    `/ba/projects/${projectId}/hld/${hldId}/system-view/regenerate`,
    {},
    { timeout: 180_000 },
  );
  return data.data;
}

/** HE-06 — canonical HLD markdown for the latest version (preview/download). */
export async function getHldMarkdown(
  projectId: string,
): Promise<{ version: number; markdown: string } | null> {
  const { data } = await api.get<ApiEnvelope<{ version: number; markdown: string } | null>>(
    `/ba/projects/${projectId}/hld/markdown`,
  );
  return data.data;
}

/** HE-06 — direct download URLs for the HLD PDF / DOCX export streams. */
export function hldPdfUrl(projectId: string, hldId: string): string {
  return `${API_BASE}/api/ba/projects/${projectId}/hld/${hldId}/export/pdf`;
}
export function hldDocxUrl(projectId: string, hldId: string): string {
  return `${API_BASE}/api/ba/projects/${projectId}/hld/${hldId}/export/docx`;
}

// ─── HLD Architect Copilot (Sprint v10 / Track C) ─────────────────────────────

export interface HldProvider {
  id: string;
  label: string;
  available: boolean;
}

export interface HldChatMessage {
  id: string;
  threadId?: string;
  role: 'user' | 'assistant';
  model: string | null;
  content: string;
  savedToSection: boolean;
  templateRef?: string | null;
  createdAt: string;
}

export interface HldTemplate {
  id: string;
  name: string;
  summary: string;
  body: string;
  source: 'builtin' | 'library';
}

/** Track D — Architecture console templates (builtin starter patterns + library). */
export async function listHldTemplates(projectId: string): Promise<HldTemplate[]> {
  const { data } = await api.get<ApiEnvelope<HldTemplate[]>>(
    `/ba/projects/${projectId}/hld/copilot/templates`,
  );
  return data.data;
}

/** HD-09 — save this HLD (whole doc or one section) as a reusable ARCHITECTURE template. */
export async function saveHldAsTemplate(
  projectId: string,
  hldId: string,
  body: { name?: string; scope: 'GLOBAL' | 'PROJECT'; sectionKey?: string | null },
): Promise<{ id: string; name: string; scope: string; createdAt: string }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; name: string; scope: string; createdAt: string }>>(
    `/ba/projects/${projectId}/hld/${hldId}/save-as-template`,
    body,
  );
  return data.data;
}

/** Which chat models are available (key-gated) — drives the model picker. */
export async function listHldProviders(projectId: string): Promise<HldProvider[]> {
  const { data } = await api.get<ApiEnvelope<HldProvider[]>>(
    `/ba/projects/${projectId}/hld/copilot/providers`,
  );
  return data.data;
}

/** Full conversation for one section. */
export async function getHldThread(
  projectId: string,
  hldId: string,
  section: string,
): Promise<HldChatMessage[]> {
  const { data } = await api.get<ApiEnvelope<HldChatMessage[]>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/thread`,
    { params: { section } },
  );
  return data.data;
}

/** Saved insights for one section. */
export async function getHldInsights(
  projectId: string,
  hldId: string,
  section: string,
): Promise<HldChatMessage[]> {
  const { data } = await api.get<ApiEnvelope<HldChatMessage[]>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/insights`,
    { params: { section } },
  );
  return data.data;
}

/** Ask the copilot a question (persists both turns); returns the new turns. */
export async function hldCopilotChat(
  projectId: string,
  hldId: string,
  body: { sectionKey: string; provider: string; message: string; template?: string | null },
): Promise<{ userMessage: HldChatMessage; assistantMessage: HldChatMessage }> {
  const { data } = await api.post<ApiEnvelope<{ userMessage: HldChatMessage; assistantMessage: HldChatMessage }>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/chat`,
    body,
    { timeout: 180_000 },
  );
  return data.data;
}

/** HD-01 — stream a copilot chat (SSE). Calls handlers as token deltas arrive. */
export async function streamHldCopilotChat(
  projectId: string,
  hldId: string,
  body: { sectionKey: string; provider: string; message: string; template?: string | null },
  handlers: {
    onDelta?: (text: string) => void;
    onModel?: (model: string) => void;
    onFinal?: (messageId: string, model: string | null) => void;
    onError?: (message: string) => void;
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ba/projects/${projectId}/hld/${hldId}/copilot/chat-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`stream failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const d = line.slice(6).trim();
      if (d === '[DONE]') return;
      try {
        const o = JSON.parse(d) as { delta?: string; model?: string; messageId?: string; error?: string };
        if (o.delta) handlers.onDelta?.(o.delta);
        if (o.model) handlers.onModel?.(o.model);
        if (o.messageId) handlers.onFinal?.(o.messageId, o.model ?? null);
        if (o.error) handlers.onError?.(o.error);
      } catch {
        /* ignore non-JSON keepalives */
      }
    }
  }
}

/** Flag / unflag a message as a saved insight. */
export async function saveHldInsight(
  projectId: string,
  hldId: string,
  messageId: string,
  saved: boolean,
): Promise<HldChatMessage> {
  const { data } = await api.post<ApiEnvelope<HldChatMessage>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/save-insight`,
    { messageId, saved },
  );
  return data.data;
}

/** Synthesize current section + saved insights into a Markdown draft (no write). */
export async function hldCopilotMerge(
  projectId: string,
  hldId: string,
  sectionKey: string,
  provider: string,
): Promise<{ draft: string; model: string }> {
  const { data } = await api.post<ApiEnvelope<{ draft: string; model: string }>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/section/${sectionKey}/merge`,
    { provider },
    { timeout: 180_000 },
  );
  return data.data;
}

// ─── HLD Copilot References (Sprint v11 / Track RR) ───────────────────────────

export interface HldReference {
  id: string;
  hldId: string;
  sectionKey: string | null;
  type: 'URL' | 'DOCUMENT';
  title: string;
  sourceUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  summary: string | null;
  status: 'PENDING' | 'READY' | 'FAILED';
  error: string | null;
  includeInContext: boolean;
  createdAt: string;
}

export async function listHldReferences(projectId: string, hldId: string): Promise<HldReference[]> {
  const { data } = await api.get<ApiEnvelope<HldReference[]>>(
    `/ba/projects/${projectId}/hld/${hldId}/references`,
  );
  return data.data;
}

export async function addHldReferenceUrl(
  projectId: string,
  hldId: string,
  body: { url: string; sectionKey?: string | null; provider?: string },
): Promise<HldReference> {
  const { data } = await api.post<ApiEnvelope<HldReference>>(
    `/ba/projects/${projectId}/hld/${hldId}/references/url`,
    body,
    { timeout: 120_000 },
  );
  return data.data;
}

export async function uploadHldReferenceDocument(
  projectId: string,
  hldId: string,
  file: File,
  opts: { sectionKey?: string | null; provider?: string } = {},
): Promise<HldReference> {
  const form = new FormData();
  form.append('file', file);
  if (opts.sectionKey) form.append('sectionKey', opts.sectionKey);
  if (opts.provider) form.append('provider', opts.provider);
  const { data } = await api.post<ApiEnvelope<HldReference>>(
    `/ba/projects/${projectId}/hld/${hldId}/references/document`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data.data;
}

export async function setHldReferenceInclude(
  projectId: string,
  hldId: string,
  refId: string,
  include: boolean,
): Promise<HldReference> {
  const { data } = await api.patch<ApiEnvelope<HldReference>>(
    `/ba/projects/${projectId}/hld/${hldId}/references/${refId}/include`,
    { include },
  );
  return data.data;
}

export async function deleteHldReference(projectId: string, hldId: string, refId: string): Promise<void> {
  await api.delete(`/ba/projects/${projectId}/hld/${hldId}/references/${refId}`);
}

// ─── HLD Repository / RAG (Sprint v11 / HD-10) ────────────────────────────────

export interface HldSimilarHit {
  hldId: string;
  projectId: string;
  productName: string;
  sectionKey: string;
  sectionName: string;
  snippet: string;
  score: number;
}

export interface HldLibraryEntry {
  hldId: string;
  projectId: string;
  productName: string;
  sections: number;
  chunks: number;
  indexedAt: string | null;
}

/** Index (or re-index) this HLD into the org-wide repository. */
export async function indexHldToLibrary(projectId: string, hldId: string): Promise<{ hldId: string; chunks: number }> {
  const { data } = await api.post<ApiEnvelope<{ hldId: string; chunks: number }>>(
    `/ba/projects/${projectId}/hld/${hldId}/library/index`,
    {},
    { timeout: 180_000 },
  );
  return data.data;
}

/** Find similar HLD sections org-wide (excludes the current HLD). */
export async function findSimilarHlds(
  projectId: string,
  hldId: string,
  query: string,
): Promise<HldSimilarHit[]> {
  const { data } = await api.post<ApiEnvelope<HldSimilarHit[]>>(
    `/ba/projects/${projectId}/hld/${hldId}/library/similar`,
    { query },
    { timeout: 120_000 },
  );
  return data.data;
}

/** List all indexed HLDs (browse page). */
export async function listHldLibrary(): Promise<HldLibraryEntry[]> {
  const { data } = await api.get<ApiEnvelope<HldLibraryEntry[]>>(`/ba/hld-library`);
  return data.data;
}

/** Org-wide semantic search across indexed HLD sections. */
export async function searchHldLibrary(q: string): Promise<HldSimilarHit[]> {
  const { data } = await api.get<ApiEnvelope<HldSimilarHit[]>>(`/ba/hld-library/search`, { params: { q } });
  return data.data;
}

export interface HldLibrarySection {
  key: string;
  name: string;
  preview: string;
  text: string;
}
export interface HldLibraryDetail {
  hldId: string;
  productName: string;
  sections: HldLibrarySection[];
}

/** A source HLD's sections (for the "borrow sections" browser). */
export async function getLibraryHldSections(hldId: string): Promise<HldLibraryDetail> {
  const { data } = await api.get<ApiEnvelope<HldLibraryDetail>>(`/ba/hld-library/${hldId}`);
  return data.data;
}

/** Borrow selected source-HLD sections into the current section's Saved insights. */
export async function saveFromLibrary(
  projectId: string,
  hldId: string,
  body: { sourceHldId: string; sectionKeys: string[]; targetSectionKey: string },
): Promise<{ saved: number }> {
  const { data } = await api.post<ApiEnvelope<{ saved: number }>>(
    `/ba/projects/${projectId}/hld/${hldId}/copilot/save-from-library`,
    body,
  );
  return data.data;
}

// ─── Project structure diagram (v9 Track KK) ─────────────────────────────────

export type StructureLayer = 'frontend' | 'backend' | 'calcEngine' | 'shared' | 'db' | 'config';
export interface StructureGroup {
  key: string;
  title: string;
  layer: StructureLayer;
  items: { name: string; note?: string }[];
}
export interface ProjectStructure {
  productName: string;
  groups: StructureGroup[];
}

export async function getProjectStructure(projectId: string): Promise<ProjectStructure> {
  const { data } = await api.get<ApiEnvelope<ProjectStructure>>(`/ba/projects/${projectId}/hld/project-structure`);
  return data.data;
}

export async function generateHld(
  projectId: string,
): Promise<{ id: string; gaps: PrdGap[] }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; gaps: PrdGap[] }>>(
    `/ba/projects/${projectId}/hld/generate`,
    {},
    { timeout: 300_000 },
  );
  return data.data;
}

// ─── Project Implementation / Source Code (Track H) ──────────────────────────

export interface ProjectImplementation {
  id: string;
  projectId: string;
  folderPath: string;
  scaffoldStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'ERROR';
  contextEngineeringStatus: 'PENDING' | 'GENERATING' | 'COMPLETE' | 'ERROR';
  lldSyncedAt: string | null;
  lastContextRefreshedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FolderStatus {
  projectName: string;
  paths: { root: string; artifacts: string; sourceCode: string; context: string; changelog: string };
  exists: { root: boolean; artifacts: boolean; sourceCode: boolean; context: boolean; changelog: boolean };
}

export interface ScaffoldResult {
  projectName: string;
  folderPath: string;
  filesWritten: number;
  modules: Array<{ moduleId: string; files: number }>;
}

export async function getImplementation(
  projectId: string,
): Promise<ProjectImplementation | null> {
  const { data } = await api.get<ApiEnvelope<ProjectImplementation | null>>(
    `/ba/projects/${projectId}/implementation`,
  );
  return data.data;
}

export async function getFolderStatus(projectId: string): Promise<FolderStatus | null> {
  const { data } = await api.get<ApiEnvelope<FolderStatus | null>>(
    `/ba/projects/${projectId}/folders`,
  );
  return data.data;
}

export async function scaffoldSourceCode(projectId: string): Promise<ScaffoldResult> {
  const { data } = await api.post<ApiEnvelope<ScaffoldResult>>(
    `/ba/projects/${projectId}/implementation/scaffold`,
    {},
    { timeout: 180_000 },
  );
  return data.data;
}

export async function seedContext(
  projectId: string,
): Promise<{ projectName: string; files: string[] } | null> {
  const { data } = await api.post<ApiEnvelope<{ projectName: string; files: string[] } | null>>(
    `/ba/projects/${projectId}/context/seed`,
  );
  return data.data;
}

// ─── Module-scoped code-gen readiness (Track N) ──────────────────────────────

export interface ReadinessGate {
  key: string;
  label: string;
  scope: 'project' | 'module';
  present: boolean;
  mandatory: boolean;
  detail?: string;
}

export interface ModuleReadiness {
  moduleDbId: string;
  moduleId: string;
  moduleName: string;
  ready: boolean;
  gates: ReadinessGate[];
  missing: string[];
}

export interface ProjectReadiness {
  projectId: string;
  projectName: string;
  projectGates: ReadinessGate[];
  modules: ModuleReadiness[];
}

/** N-02 — modules with code-gen readiness; drives the module dropdown. */
export async function listCodeModules(projectId: string): Promise<ProjectReadiness | null> {
  const { data } = await api.get<ApiEnvelope<ProjectReadiness | null>>(
    `/ba/projects/${projectId}/code/modules`,
  );
  return data.data;
}

// ─── Code tasks (Track O — /prd plan) ────────────────────────────────────────

export type CodeTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface CodeTask {
  id: string;
  moduleDbId: string;
  sequence: number;
  taskKey: string;
  title: string;
  description: string | null;
  status: CodeTaskStatus;
  subtaskRefs: string[];
  pseudoFileRefs: string[];
  targetFiles: string[];
  isDynamic: boolean;
  runId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** O-02 — (re)generate the module's /prd task plan (deterministic from sub-tasks). */
export async function planCodeTasks(
  projectId: string,
  moduleDbId: string,
): Promise<CodeTask[]> {
  const { data } = await api.post<ApiEnvelope<CodeTask[]>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tasks/plan`,
    {},
    { timeout: 60_000 },
  );
  return data.data;
}

/** O-03 — list the module's code tasks in execution order. */
export async function listCodeTasks(
  projectId: string,
  moduleDbId: string,
): Promise<CodeTask[]> {
  const { data } = await api.get<ApiEnvelope<CodeTask[]>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tasks`,
  );
  return data.data;
}

/** P-01 — run ALL pending/failed tasks for a module via /dev (returns a runId to stream). */
export async function runAllCodeTasks(
  projectId: string,
  moduleDbId: string,
): Promise<{ runId: string }> {
  const { data } = await api.post<ApiEnvelope<{ runId: string }>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tasks/run`,
    {},
  );
  return data.data;
}

/** P-01 — run a single task by taskKey via /dev (returns a runId to stream). */
export async function runCodeTask(
  projectId: string,
  moduleDbId: string,
  taskKey: string,
): Promise<{ runId: string }> {
  const { data } = await api.post<ApiEnvelope<{ runId: string }>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tasks/${encodeURIComponent(taskKey)}/run`,
    {},
  );
  return data.data;
}

// ─── Test runs (Track P/Q — two-tier code-gen tests) ─────────────────────────

export type TestRunKind = 'DEV' | 'FTC';
export type TestRunStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';

export interface TestRun {
  id: string;
  moduleDbId: string;
  kind: TestRunKind;
  framework: string;
  status: TestRunStatus;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number | null;
  command: string | null;
  output: string | null;
  artifacts: { dir: string; report: string | null; files: string[] } | null;
  reportPath: string | null;
  createdAt: string;
}

/** P-03 — run the module's DEV unit tests in ProjectSourceCode/. */
export async function runDevTests(projectId: string, moduleDbId: string): Promise<TestRun> {
  const { data } = await api.post<ApiEnvelope<TestRun>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tests/dev/run`,
    {},
    { timeout: 360_000 },
  );
  return data.data;
}

/** Q-02 — run the module's FTC-derived Playwright tests. */
export async function runFtcTests(projectId: string, moduleDbId: string): Promise<TestRun> {
  const { data } = await api.post<ApiEnvelope<TestRun>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tests/ftc/run`,
    {},
    { timeout: 600_000 },
  );
  return data.data;
}

export interface FtcSummary {
  caseCount: number;
  playwrightCases: number;
  frameworks: string[];
}

/** Q-02 — FTC basis (case count + frameworks) for the FTC panel. */
export async function getFtcSummary(projectId: string, moduleDbId: string): Promise<FtcSummary> {
  const { data } = await api.get<ApiEnvelope<FtcSummary>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tests/ftc/summary`,
  );
  return data.data;
}

/** P-03 / Q-03 — test-run history (optionally filtered by kind). */
export async function listTestRuns(
  projectId: string,
  moduleDbId: string,
  kind?: TestRunKind,
): Promise<TestRun[]> {
  const { data } = await api.get<ApiEnvelope<TestRun[]>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/tests${kind ? `?kind=${kind}` : ''}`,
  );
  return data.data;
}

// ─── Upstream sync (Track P-04/P-05 + J — dynamic files → upstream review) ───

export type UpstreamSyncStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UpstreamSync {
  id: string;
  moduleDbId: string;
  status: UpstreamSyncStatus;
  trigger: string;
  filePath: string | null;
  summary: string;
  proposedLld: string | null;
  proposedSubtask: { subtaskId?: string; subtaskName?: string; subtaskType?: string; sourceFileName?: string } | null;
  changelogEntry: string | null;
  rtmRow: unknown;
  resolvedNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listUpstreamSync(
  projectId: string,
  moduleDbId: string,
  pendingOnly = false,
): Promise<UpstreamSync[]> {
  const { data } = await api.get<ApiEnvelope<UpstreamSync[]>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/upstream-sync${pendingOnly ? '?pending=true' : ''}`,
  );
  return data.data;
}

export async function approveUpstreamSync(
  projectId: string,
  moduleDbId: string,
  syncId: string,
  note?: string,
): Promise<UpstreamSync> {
  const { data } = await api.post<ApiEnvelope<UpstreamSync>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/upstream-sync/${syncId}/approve`,
    { note },
  );
  return data.data;
}

export async function rejectUpstreamSync(
  projectId: string,
  moduleDbId: string,
  syncId: string,
  note?: string,
): Promise<UpstreamSync> {
  const { data } = await api.post<ApiEnvelope<UpstreamSync>>(
    `/ba/projects/${projectId}/code/modules/${moduleDbId}/upstream-sync/${syncId}/reject`,
    { note },
  );
  return data.data;
}

// ─── E2E Flows (Track R — cross-module journeys) ─────────────────────────────

export type E2eNodeType = 'START' | 'STEP' | 'DECISION' | 'JOIN' | 'END';

export interface E2eFlowStep {
  id: string;
  stepId: string;
  sequenceNum: number;
  nodeType: E2eNodeType;
  nextStepIds: string[];
  branchLabels: Record<string, string> | null;
  moduleDbId: string | null;
  screenId: string | null;
  role: string | null;
  triggerLabel: string | null;
  outcome: string | null;
  condition: string | null;
  layer: string | null;
  thirdPartyIntegrationId: string | null;
  screenshotData: string | null;
  screenshotName: string | null;
}

export interface E2eFlow {
  id: string;
  flowKey: string;
  flowName: string;
  journeyType: string | null;
  primaryRole: string | null;
  secondaryRoles: string[];
  status: string;
  spannedModuleIds: string[];
  mermaidDiagrams: Record<string, string>;
  steps?: E2eFlowStep[];
  _count?: { steps: number };
}

export interface E2eFlowConfig {
  id?: string;
  referenceJourneys: string[];
  defaultRoles: string[];
  coverageTarget: string | null;
  targetEnv: string | null;
  baseUrl: string | null;
  narrative: string | null;
  useAsAdditional: boolean;
}

export interface ThirdPartyIntegration {
  id: string;
  vendorName: string;
  category: string;
  endpoint: string | null;
  authScheme: string | null;
  status: string | null;
  source: string | null;
  notes: string | null;
}

const E2E = (projectId: string) => `/ba/projects/${projectId}/e2e-flows`;

export async function listE2eFlows(projectId: string): Promise<E2eFlow[]> {
  const { data } = await api.get<ApiEnvelope<E2eFlow[]>>(E2E(projectId));
  return data.data;
}
export async function getE2eFlow(projectId: string, flowId: string): Promise<E2eFlow> {
  const { data } = await api.get<ApiEnvelope<E2eFlow>>(`${E2E(projectId)}/${flowId}`);
  return data.data;
}
export async function createE2eFlow(projectId: string, body: Partial<E2eFlow>): Promise<E2eFlow> {
  const { data } = await api.post<ApiEnvelope<E2eFlow>>(E2E(projectId), body);
  return data.data;
}
export async function updateE2eFlow(projectId: string, flowId: string, body: Partial<E2eFlow>): Promise<E2eFlow> {
  const { data } = await api.patch<ApiEnvelope<E2eFlow>>(`${E2E(projectId)}/${flowId}`, body);
  return data.data;
}
export async function deleteE2eFlow(projectId: string, flowId: string): Promise<void> {
  await api.delete(`${E2E(projectId)}/${flowId}`);
}
export async function upsertE2eStep(projectId: string, flowId: string, step: Partial<E2eFlowStep>): Promise<E2eFlowStep> {
  const { data } = await api.put<ApiEnvelope<E2eFlowStep>>(`${E2E(projectId)}/${flowId}/steps`, step);
  return data.data;
}
export async function deleteE2eStep(projectId: string, flowId: string, stepId: string): Promise<void> {
  await api.delete(`${E2E(projectId)}/${flowId}/steps/${encodeURIComponent(stepId)}`);
}
export async function getE2eConfig(projectId: string): Promise<E2eFlowConfig | null> {
  const { data } = await api.get<ApiEnvelope<E2eFlowConfig | null>>(`${E2E(projectId)}/config`);
  return data.data;
}
export async function updateE2eConfig(projectId: string, body: Partial<E2eFlowConfig>): Promise<E2eFlowConfig> {
  const { data } = await api.put<ApiEnvelope<E2eFlowConfig>>(`${E2E(projectId)}/config`, body);
  return data.data;
}
export async function generateE2eFlows(projectId: string): Promise<{ flowsCreated: number; gaps: { question: string }[] }> {
  const { data } = await api.post<ApiEnvelope<{ flowsCreated: number; gaps: { question: string }[] }>>(
    `${E2E(projectId)}/generate`, {}, { timeout: 300_000 },
  );
  return data.data;
}
export async function listIntegrations(projectId: string): Promise<ThirdPartyIntegration[]> {
  const { data } = await api.get<ApiEnvelope<ThirdPartyIntegration[]>>(`${E2E(projectId)}/integrations`);
  return data.data;
}
export async function upsertIntegration(projectId: string, body: Partial<ThirdPartyIntegration>): Promise<ThirdPartyIntegration> {
  const { data } = await api.put<ApiEnvelope<ThirdPartyIntegration>>(`${E2E(projectId)}/integrations`, body);
  return data.data;
}
export async function deleteIntegration(projectId: string, intId: string): Promise<void> {
  await api.delete(`${E2E(projectId)}/integrations/${intId}`);
}
export async function seedIntegrationsFromHld(projectId: string): Promise<{ seeded: number }> {
  const { data } = await api.post<ApiEnvelope<{ seeded: number }>>(`${E2E(projectId)}/integrations/seed-from-hld`, {});
  return data.data;
}

export interface E2eImportResult {
  flowsImported: number;
  stepsImported: number;
  integrationsAdded: number;
  errors: string[];
}

/** Bulk-import flows + steps from parsed CSV rows. */
export async function importE2eFlows(projectId: string, rows: Array<Record<string, string>>): Promise<E2eImportResult> {
  const { data } = await api.post<ApiEnvelope<E2eImportResult>>(`${E2E(projectId)}/import`, { rows }, { timeout: 120_000 });
  return data.data;
}

// ─── Step screen picker + screenshot (reuse analyzed screens / custom upload) ──

export interface ModuleScreenRef {
  screenId: string;
  screenTitle: string | null;
  screenType: string | null;
}

/** List a module's analyzed screens (for the step Screen dropdown). */
export async function listModuleScreens(projectId: string, moduleDbId: string): Promise<ModuleScreenRef[]> {
  const { data } = await api.get<ApiEnvelope<ModuleScreenRef[]>>(`${E2E(projectId)}/screens/${moduleDbId}`);
  return data.data;
}

/** Get an analyzed module screen's image as a data-URI (for preview). */
export async function getModuleScreenImage(projectId: string, moduleDbId: string, screenId: string): Promise<string | null> {
  const { data } = await api.get<ApiEnvelope<{ dataUri: string | null }>>(
    `${E2E(projectId)}/screens/${moduleDbId}/${encodeURIComponent(screenId)}/image`,
  );
  return data.data.dataUri;
}

/** Upload a custom screenshot for a step (multipart). */
export async function uploadStepScreenshot(projectId: string, flowId: string, stepId: string, file: File): Promise<{ screenshotName: string | null }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ApiEnvelope<{ screenshotName: string | null }>>(
    `${E2E(projectId)}/${flowId}/steps/${encodeURIComponent(stepId)}/screenshot`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data.data;
}

/** Remove a step's custom screenshot. */
export async function clearStepScreenshot(projectId: string, flowId: string, stepId: string): Promise<void> {
  await api.delete(`${E2E(projectId)}/${flowId}/steps/${encodeURIComponent(stepId)}/screenshot`);
}

export const E2E_STAGES = ['EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC', 'WTC'] as const;
export type E2eStage = (typeof E2E_STAGES)[number];

export interface StepGap {
  stepId: string;
  moduleId: string | null;
  filled: Record<E2eStage, boolean>;
}

export async function elaborateE2eStage(
  projectId: string, flowId: string, stage: E2eStage,
): Promise<{ stage: E2eStage; stepsElaborated: number; gaps: StepGap[] }> {
  const { data } = await api.post<ApiEnvelope<{ stage: E2eStage; stepsElaborated: number; gaps: StepGap[] }>>(
    `${E2E(projectId)}/${flowId}/elaborate/${stage}`, {},
  );
  return data.data;
}

export async function getE2eGaps(projectId: string, flowId: string): Promise<StepGap[]> {
  const { data } = await api.get<ApiEnvelope<StepGap[]>>(`${E2E(projectId)}/${flowId}/gaps`);
  return data.data;
}

export interface E2eMappingResult {
  artifactsStamped: number;
  artifactSectionsRemoved: number;
  rtmRowsUpdated: number;
  modulesAffected: number;
}

/** R-P4 — stamp e2e_flow_mapping sections onto artifacts + RTM columns. */
export async function syncE2eMappings(projectId: string): Promise<E2eMappingResult> {
  const { data } = await api.post<ApiEnvelope<E2eMappingResult>>(`${E2E(projectId)}/sync-mappings`, {});
  return data.data;
}

/** R-P5 — (re)build the 4 Mermaid diagrams deterministically from flow data. */
export async function buildE2eDiagrams(projectId: string, flowId: string): Promise<Record<string, string>> {
  const { data } = await api.post<ApiEnvelope<Record<string, string>>>(`${E2E(projectId)}/${flowId}/build-diagrams`, {});
  return data.data;
}

// ─── E2E test execution (R-P6) ───────────────────────────────────────────────

export interface E2eStepCoverage {
  stepId: string;
  sequenceNum: number;
  moduleId: string | null;
  totalCases: number;
  uiCases: number;
  dbCases: number;
  whiteBoxCases: number;
  covered: boolean;
}
export interface E2eTestPlan {
  flowId: string;
  flowKey: string;
  flowName: string;
  spannedModuleIds: string[];
  steps: E2eStepCoverage[];
  totalCases: number;
  coveredSteps: number;
  gapSteps: number;
}
export interface E2eRunResult {
  moduleId: string | null;
  moduleDbId: string;
  run: TestRun;
}

export async function getE2eTestPlan(projectId: string, flowId: string): Promise<E2eTestPlan> {
  const { data } = await api.get<ApiEnvelope<E2eTestPlan>>(`${E2E(projectId)}/${flowId}/test-plan`);
  return data.data;
}
export async function runE2eTests(projectId: string, flowId: string): Promise<E2eRunResult[]> {
  const { data } = await api.post<ApiEnvelope<E2eRunResult[]>>(`${E2E(projectId)}/${flowId}/run-tests`, {}, { timeout: 600_000 });
  return data.data;
}

// ─── Agent settings + skills (Track K) ───────────────────────────────────────

export type AgentProvider = 'claude' | 'claude-bedrock' | 'claude-vertex';

export interface AgentSettingsPublic {
  provider: AgentProvider;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string | null;
}

export interface AgentSkill {
  id: string;
  label: string;
  description: string;
  needsSubtask: boolean;
}

export async function getAgentSettings(): Promise<AgentSettingsPublic> {
  const { data } = await api.get<ApiEnvelope<AgentSettingsPublic>>(`/ba/pipeline/agent-settings`);
  return data.data;
}

export async function updateAgentSettings(payload: {
  provider?: AgentProvider;
  model?: string;
  apiKey?: string;
}): Promise<AgentSettingsPublic> {
  const { data } = await api.put<ApiEnvelope<AgentSettingsPublic>>(
    `/ba/pipeline/agent-settings`,
    payload,
  );
  return data.data;
}

export async function listAgentSkills(): Promise<AgentSkill[]> {
  const { data } = await api.get<ApiEnvelope<AgentSkill[]>>(`/ba/pipeline/skills`);
  return data.data;
}

// ─── Agent run (K-03 streaming · K-04 permissions) ───────────────────────────

export type AgentRunEvent =
  | { type: 'start'; runId: string; sessionId?: string }
  | { type: 'log'; text: string }
  | { type: 'tool'; tool: string; summary: string }
  | { type: 'file'; path: string; action: 'write' | 'edit' }
  | { type: 'permission'; requestId: string; tool: string; detail: string }
  | { type: 'task'; taskKey: string; sequence: number; status: 'running' | 'completed' | 'failed' | 'skipped'; title?: string; error?: string }
  | { type: 'result'; ok: boolean; summary: string }
  | { type: 'error'; message: string };

const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function startAgentRun(
  projectId: string,
  skillId: string,
  subtask?: string,
  moduleDbId?: string,
): Promise<{ runId: string }> {
  const { data } = await api.post<ApiEnvelope<{ runId: string }>>(
    `/ba/projects/${projectId}/implementation/run`,
    { skillId, subtask, moduleDbId },
  );
  return data.data;
}

/** Full SSE URL for an EventSource connection to a run's event stream. */
export function agentRunStreamUrl(projectId: string, runId: string): string {
  return `${API_ROOT}/api/ba/projects/${projectId}/implementation/run/${runId}/stream`;
}

export async function resolveAgentPermission(
  projectId: string,
  runId: string,
  requestId: string,
  allow: boolean,
  message?: string,
): Promise<void> {
  await api.post(`/ba/projects/${projectId}/implementation/run/${runId}/permission`, {
    requestId,
    allow,
    message,
  });
}

// ─── Screen↔Feature Mapping (Track Y) ────────────────────────────────────────

/** One PRD-grounded annotation on a screen (numbered, or "P" for persona). */
export interface ScreenAnnotation {
  marker: string | number;
  title: string;
  description: string;
  prdRef: string; // PRD §/FR-ID, e.g. "§6 FR-AUTH-001"
}

export interface ScreenMapRow {
  id: string;
  sequenceNum: number;
  screenId: string;
  screenName: string;
  prdSections: string[];
  featureRefs: string[];
  featureDescription: string;
  businessRulesPrd: string;
  businessRulesArchitect: string;
  screenDescription: string;
  annotations: ScreenAnnotation[];
}

export interface ScreenMapCoverage {
  orphanFrs: string[];
  orphanScreens: string[];
}

export interface ScreenMap {
  id: string;
  version: number;
  status: string;
  coverage?: ScreenMapCoverage | null;
  rows: ScreenMapRow[];
}

export async function getScreenMap(projectId: string): Promise<ScreenMap | null> {
  const { data } = await api.get<ApiEnvelope<ScreenMap | null>>(`/ba/projects/${projectId}/screen-map`);
  return data.data;
}

export async function generateScreenMap(projectId: string): Promise<ScreenMap> {
  const { data } = await api.post<ApiEnvelope<ScreenMap>>(
    `/ba/projects/${projectId}/screen-map/generate`,
    {},
    { timeout: 300_000 },
  );
  return data.data;
}

export async function updateScreenMapRow(
  projectId: string,
  rowId: string,
  patch: Partial<Omit<ScreenMapRow, 'id' | 'sequenceNum'>>,
): Promise<ScreenMapRow> {
  const { data } = await api.patch<ApiEnvelope<ScreenMapRow>>(
    `/ba/projects/${projectId}/screen-map/row/${rowId}`,
    patch,
  );
  return data.data;
}

export async function exportScreenMapCsv(projectId: string): Promise<string> {
  const { data } = await api.get<ApiEnvelope<string>>(`/ba/projects/${projectId}/screen-map/export`);
  return data.data;
}

export async function importScreenMapCsv(projectId: string, csv: string): Promise<ScreenMap> {
  const { data } = await api.post<ApiEnvelope<ScreenMap>>(
    `/ba/projects/${projectId}/screen-map/import`,
    { csv },
  );
  return data.data;
}

// ─── PRD-sourced Wireframes (Track Z) ────────────────────────────────────────

export interface PipelineWireframeScreen {
  id: string;
  slug: string;
  title: string;
  htmlContent: string | null; // deterministic variant (always present)
  aiHtmlContent?: string | null; // AI variant (HH-01), or null
  activeVariant?: 'deterministic' | 'ai';
  uploaded: boolean;
}

export interface PipelineWireframes {
  lofi: PipelineWireframeScreen[];
  hifi: PipelineWireframeScreen[];
}

export interface CustomerWireframeRef {
  id: string;
  label: string;
  fileName: string | null;
  createdAt: string;
}

export async function getPipelineWireframes(projectId: string): Promise<PipelineWireframes> {
  const { data } = await api.get<ApiEnvelope<PipelineWireframes>>(`/ba/projects/${projectId}/wireframes`);
  return data.data;
}

export async function getCustomerWireframes(projectId: string): Promise<CustomerWireframeRef[]> {
  const { data } = await api.get<ApiEnvelope<CustomerWireframeRef[]>>(
    `/ba/projects/${projectId}/wireframes/customer`,
  );
  return data.data;
}

export async function generateLoFiWireframes(
  projectId: string,
): Promise<{ id: string; screens: number; preservedUploads: number }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; screens: number; preservedUploads: number }>>(
    `/ba/projects/${projectId}/wireframes/generate-lofi`,
    {},
    { timeout: 300_000 },
  );
  return data.data;
}

/** HH-01 — set which lo-fi variant ('deterministic' | 'ai') is active for a screen. */
export async function setLoFiVariant(
  projectId: string,
  slug: string,
  variant: 'deterministic' | 'ai',
): Promise<{ slug: string; activeVariant: string }> {
  const { data } = await api.post<ApiEnvelope<{ slug: string; activeVariant: string }>>(
    `/ba/projects/${projectId}/wireframes/screen-variant`,
    { slug, variant },
  );
  return data.data;
}

/** AI-regenerate lo-fi for selected screen slugs (or all generated screens if none). */
export async function regenerateLoFiWithAI(
  projectId: string,
  slugs?: string[],
): Promise<{ updated: number; failed: string[] }> {
  const { data } = await api.post<ApiEnvelope<{ updated: number; failed: string[] }>>(
    `/ba/projects/${projectId}/wireframes/regenerate-lofi-ai`,
    { slugs },
    { timeout: 600_000 },
  );
  return data.data;
}

/** Generate hi-fi for the whole set, or only the selected lo-fi screen slugs. */
export async function generateHiFiWireframes(
  projectId: string,
  opts: { slugs?: string[]; limit?: number } = {},
): Promise<{ id: string; screens: number }> {
  const { data } = await api.post<ApiEnvelope<{ id: string; screens: number }>>(
    `/ba/projects/${projectId}/wireframes/generate-hifi`,
    { slugs: opts.slugs, limit: opts.limit },
    { timeout: 600_000 },
  );
  return data.data;
}

export async function uploadWireframes(
  projectId: string,
  files: File[],
  kind: 'lofi' | 'hifi',
): Promise<{ added: number; rejected: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const { data } = await api.post<ApiEnvelope<{ added: number; rejected: string[] }>>(
    `/ba/projects/${projectId}/wireframes/upload?kind=${kind}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data.data;
}

// ─── Design System / Look & Feel Studio (Track CC) ───────────────────────────

export interface DiagramLayer { fill: string; border: string; text: string }

export interface DesignTokens {
  brand: { productName: string; primary: string; cta: string; ctaHover: string; surface: string };
  neutral: { bgPage: string; bgSoft: string; textPrimary: string; textMuted: string; textSubtle: string; border: string; borderMedium: string };
  semantic: { success: string; warning: string; danger: string; info: string; teal: string; purple: string };
  modulePalette: { mode: 'auto' | 'manual'; colors: Record<string, string> };
  personaPalette: { employee: string; manager: string; hrAdmin: string; finance: string; admin: string; visitor: string };
  diagramPalette: {
    frontend: DiagramLayer; backend: DiagramLayer; calcEngine: DiagramLayer;
    shared: DiagramLayer; db: DiagramLayer; config: DiagramLayer; node: DiagramLayer;
  };
  typography: { uiFont: string; monoFont: string; baseSize: number; weightNormal: number; weightBold: number };
  shape: { radiusCard: number; radiusPill: number; density: 'comfortable' | 'compact'; elevation: 'flat' | 'soft' | 'raised' };
  platform: { mobileFrameWidth: number; breakpointMobile: number; breakpointTablet: number; touchTarget: number };
}

export interface DesignLogo {
  dataUri: string;
  fileName: string;
  mimeType: string;
}

export interface DesignSystem {
  id: string;
  version: number;
  status: string;
  tokens: DesignTokens;
  logo: DesignLogo | null;
  presetId: string | null;
  sourceArtifactVersions: { prdVersion?: number; screenMapVersion?: number } | null;
}

export interface DesignPreset {
  id: string;
  name: string;
  scope: 'GLOBAL' | 'PROJECT';
  tokens: DesignTokens;
  isSeed: boolean;
}

export async function getDesignSystem(projectId: string): Promise<DesignSystem | null> {
  const { data } = await api.get<ApiEnvelope<DesignSystem | null>>(`/ba/projects/${projectId}/design-system`);
  return data.data;
}

export async function saveDesignSystem(
  projectId: string,
  tokens: DesignTokens,
  logo?: DesignLogo | null,
  presetId?: string | null,
): Promise<DesignSystem> {
  const { data } = await api.put<ApiEnvelope<DesignSystem>>(
    `/ba/projects/${projectId}/design-system`,
    { tokens, logo: logo ?? null, presetId: presetId ?? null },
  );
  return data.data;
}

export async function uploadDesignLogo(projectId: string, file: File): Promise<DesignLogo> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ApiEnvelope<DesignLogo>>(
    `/ba/projects/${projectId}/design-system/logo`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

/** Live preview HTML for a (possibly unsaved) token set. */
export async function getDesignPreview(
  projectId: string,
  tokens: DesignTokens,
  platform: 'web' | 'mobile',
): Promise<string> {
  const { data } = await api.post<ApiEnvelope<string>>(
    `/ba/projects/${projectId}/design-system/preview`,
    { tokens, platform },
  );
  return data.data;
}

export async function listDesignPresets(projectId: string): Promise<DesignPreset[]> {
  const { data } = await api.get<ApiEnvelope<DesignPreset[]>>(`/ba/projects/${projectId}/design-presets`);
  return data.data;
}

export async function getDesignPresetTokens(projectId: string, presetId: string): Promise<DesignTokens> {
  const { data } = await api.get<ApiEnvelope<DesignTokens>>(`/ba/projects/${projectId}/design-presets/${presetId}`);
  return data.data;
}

export async function saveDesignPreset(
  projectId: string,
  name: string,
  tokens: DesignTokens,
  scope: 'GLOBAL' | 'PROJECT',
): Promise<DesignPreset> {
  const { data } = await api.post<ApiEnvelope<DesignPreset>>(
    `/ba/projects/${projectId}/design-presets`,
    { name, tokens, scope },
  );
  return data.data;
}

/** Track FF — import reference screens/templates (multi-file or folder) → presets. */
export async function importDesignReferences(
  projectId: string,
  files: File[],
): Promise<{ created: { id: string; name: string }[]; rejected: string[] }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const { data } = await api.post<ApiEnvelope<{ created: { id: string; name: string }[]; rejected: string[] }>>(
    `/ba/projects/${projectId}/design-system/import-references`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
  );
  return data.data;
}

// ─── Wireframe Navigator (Track DD) ──────────────────────────────────────────

export async function getWireframeNavigator(projectId: string, kind: 'lofi' | 'hifi'): Promise<string> {
  const { data } = await api.get<ApiEnvelope<string>>(`/ba/projects/${projectId}/wireframes/navigator?kind=${kind}`);
  return data.data;
}

/** Direct download URL for the wireframe zip (index.html + all screens). */
export function wireframeZipUrl(projectId: string, kind: 'lofi' | 'hifi'): string {
  return `${API_BASE}/api/ba/projects/${projectId}/wireframes/export-zip?kind=${kind}`;
}
