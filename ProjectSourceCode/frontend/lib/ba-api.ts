/**
 * BA Automation Tool — Frontend API client.
 * All BA Tool endpoints under /api/ba/.
 * Follows the same patterns as the existing PRD api.ts.
 */
import { api } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BaProject {
  id: string;
  name: string;
  projectCode: string;
  description: string | null;
  productName: string | null;
  clientName: string | null;
  submittedBy: string | null;
  clientLogo: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  modules: BaModuleSummary[];
}

export interface UpdateBaProjectDto {
  name?: string;
  description?: string;
  productName?: string;
  clientName?: string;
  submittedBy?: string;
  clientLogo?: string;
}

export interface BaModuleSummary {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleStatus: BaModuleStatus;
}

export type BaModuleStatus =
  | 'DRAFT'
  | 'SCREENS_UPLOADED'
  | 'ANALYSIS_COMPLETE'
  | 'FRD_COMPLETE'
  | 'EPICS_COMPLETE'
  | 'STORIES_COMPLETE'
  | 'SUBTASKS_COMPLETE'
  | 'APPROVED';

export interface BaModule {
  id: string;
  projectId: string;
  moduleId: string;
  moduleName: string;
  packageName: string;
  moduleStatus: BaModuleStatus;
  processedAt: string | null;
  approvedAt: string | null;
  lldCompletedAt: string | null;
  lldArtifactId: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Pick<BaProject, 'id' | 'name' | 'projectCode' | 'productName' | 'clientName' | 'submittedBy'>;
  screens: BaScreen[];
  flows: BaFlow[];
  skillExecutions: BaSkillExecution[];
  artifacts: BaArtifact[];
  tbdFutureEntries: BaTbdFutureEntry[];
}

export interface BaScreen {
  id: string;
  screenId: string;
  screenTitle: string;
  screenType: string | null;
  fileData: string;
  fileName: string;
  mimeType: string;
  displayOrder: number;
  textDescription: string | null;
  audioFileData: string | null;
  audioTranscript: string | null;
  transcriptReviewed: boolean;
  aiFormattedTranscript: string | null;
  aiTranscriptReviewed: boolean;
  createdAt: string;
}

export interface BaFlow {
  id: string;
  flowName: string;
  steps: { screenId: string; triggerLabel: string; outcome?: string }[];
  createdAt: string;
}

export interface BaSkillExecution {
  id: string;
  skillName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'AWAITING_REVIEW' | 'APPROVED' | 'FAILED';
  humanDocument: string | null;
  handoffPacket: unknown;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BaArtifact {
  id: string;
  artifactType: string;
  artifactId: string;
  status: 'DRAFT' | 'CONFIRMED_PARTIAL' | 'CONFIRMED' | 'APPROVED';
  approvedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  sections: BaArtifactSection[];
  module?: {
    id: string;
    moduleId: string;
    moduleName: string;
    packageName: string;
    project?: BaProject;
    screens?: BaScreenLite[];
  };
}

/** Lightweight screen shape attached to artifacts/subtasks — no audio/raw files. */
export interface BaScreenLite {
  id: string;
  screenId: string;
  screenTitle: string;
  screenType: string | null;
  fileData: string;
  displayOrder: number;
  textDescription: string | null;
}

export interface BaArtifactSection {
  id: string;
  sectionKey: string;
  sectionLabel: string;
  aiGenerated: boolean;
  content: string;
  editedContent: string | null;
  isHumanModified: boolean;
  isLocked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BaTbdFutureEntry {
  id: string;
  registryId: string;
  integrationName: string;
  classification: string;
  referencedModule: string | null;
  assumedInterface: string;
  resolutionTrigger: string;
  appearsInFeatures: string[];
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedInterface: string | null;
}

export interface BaRtmRow {
  id: string;
  moduleId: string;
  moduleName: string;
  packageName: string;
  featureId: string;
  featureName: string;
  featureStatus: string;
  priority: string;
  screenRef: string;
  epicId: string | null;
  epicName: string | null;
  storyId: string | null;
  storyName: string | null;
  storyType: string | null;
  storyStatus: string | null;
  primaryClass: string | null;
  sourceFile: string | null;
  subtaskId: string | null;
  subtaskTeam: string | null;
  methodName: string | null;
  testCaseIds: string[];
  integrationStatus: string | null;
  tbdFutureRef: string | null;
  tbdResolved: boolean;
  // LLD linkage — populated after SKILL-06-LLD runs
  lldArtifactId: string | null;
  layer: string | null;              // Frontend / Backend / Database / Integration / Testing
  pseudoFileIds: string[];
  pseudoFilePaths: string[];
  // FTC linkage — populated after SKILL-07-FTC runs
  ftcArtifactId: string | null;
  ftcTestCaseIds: string[];
  ftcTestCaseRefs: string[];         // human-readable TC-001, TC-002-INT-01, …
  owaspWebCategories: string[];      // A01, A03, …
  owaspLlmCategories: string[];      // LLM01, LLM06, …
  // Execution roll-up (denormalized from BaTestCase.executionStatus)
  execCounts?: {
    PASS: number;
    FAIL: number;
    BLOCKED: number;
    SKIPPED: number;
    NOT_RUN: number;
  };
  execVerdict?: 'PASS' | 'FAIL' | 'BLOCKED' | 'MIXED' | 'NOT_RUN';
  // B4 — aggregated sprint refs across the linked TCs
  sprintDbIds?: string[];
  sprintCodes?: string[];
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createBaProject(payload: {
  name: string;
  projectCode: string;
  description?: string;
}): Promise<BaProject> {
  const { data } = await api.post<BaProject>('/ba/projects', payload);
  return data;
}

export async function listBaProjects(): Promise<BaProject[]> {
  const { data } = await api.get<BaProject[]>('/ba/projects');
  return data;
}

export async function getBaProject(id: string): Promise<BaProject> {
  const { data } = await api.get<BaProject>(`/ba/projects/${id}`);
  return data;
}

export async function archiveBaProject(id: string): Promise<BaProject> {
  const { data } = await api.post<BaProject>(`/ba/projects/${id}/archive`);
  return data;
}

export async function updateBaProject(id: string, payload: UpdateBaProjectDto): Promise<BaProject> {
  const { data } = await api.patch<BaProject>(`/ba/projects/${id}`, payload);
  return data;
}

// ─── Modules ─────────────────────────────────────────────────────────────────

export async function createBaModule(
  projectId: string,
  payload: { moduleId: string; moduleName: string; packageName: string },
): Promise<BaModuleSummary> {
  const { data } = await api.post<BaModuleSummary>(`/ba/projects/${projectId}/modules`, payload);
  return data;
}

export async function getBaModule(moduleDbId: string): Promise<BaModule> {
  const { data } = await api.get<BaModule>(`/ba/modules/${moduleDbId}`);
  return data;
}

// ─── Screens ─────────────────────────────────────────────────────────────────

export async function uploadBaScreen(
  moduleDbId: string,
  file: File,
  screenTitle?: string,
  screenType?: string,
): Promise<BaScreen> {
  const formData = new FormData();
  formData.append('file', file);
  if (screenTitle) formData.append('screenTitle', screenTitle);
  if (screenType) formData.append('screenType', screenType);
  const { data } = await api.post<BaScreen>(`/ba/modules/${moduleDbId}/screens`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Upload screens in chunks to avoid:
 *   (a) hitting any single-request multipart size limit
 *   (b) the frontend 30s timeout bailing while the backend is still
 *       decoding+storing base64 images (user sees "Failed" even though
 *       rows actually got inserted).
 *
 * Uploads up to CHUNK_SIZE files per request with a 5-minute per-request
 * timeout. Returns all uploaded screens in order.
 */
export async function uploadBaScreensBatch(
  moduleDbId: string,
  files: File[],
  onProgress?: (uploaded: number, total: number) => void,
): Promise<BaScreen[]> {
  const CHUNK_SIZE = 5;
  const TIMEOUT_MS = 300_000;
  const uploaded: BaScreen[] = [];
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const formData = new FormData();
    for (const f of chunk) formData.append('files', f);
    const { data } = await api.post<BaScreen[]>(
      `/ba/modules/${moduleDbId}/screens/batch`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: TIMEOUT_MS },
    );
    uploaded.push(...data);
    onProgress?.(Math.min(i + CHUNK_SIZE, files.length), files.length);
  }
  return uploaded;
}

export async function updateBaScreen(
  screenDbId: string,
  payload: {
    screenTitle?: string;
    screenType?: string;
    displayOrder?: number;
    textDescription?: string;
    audioTranscript?: string;
    transcriptReviewed?: boolean;
  },
): Promise<BaScreen> {
  const { data } = await api.put<BaScreen>(`/ba/screens/${screenDbId}`, payload);
  return data;
}

export async function deleteBaScreen(screenDbId: string): Promise<void> {
  await api.delete(`/ba/screens/${screenDbId}`);
}

export async function reorderBaScreens(
  moduleDbId: string,
  screenIds: string[],
): Promise<void> {
  await api.put(`/ba/modules/${moduleDbId}/screens/reorder`, { screenIds });
}

export async function uploadBaScreenAudio(
  screenDbId: string,
  audioBlob: Blob,
): Promise<BaScreen> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  const { data } = await api.post<BaScreen>(`/ba/screens/${screenDbId}/audio`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function saveBaTranscript(
  screenDbId: string,
  transcript: string,
  reviewed: boolean,
): Promise<BaScreen> {
  const { data } = await api.put<BaScreen>(`/ba/screens/${screenDbId}/transcript`, {
    transcript,
    reviewed,
  });
  return data;
}

export async function formatBaTranscript(
  screenDbId: string,
): Promise<{ formattedText: string }> {
  const { data } = await api.post<{ formattedText: string }>(
    `/ba/screens/${screenDbId}/format-transcript`,
    {},
    { timeout: 30_000 },
  );
  return data;
}

export async function saveAiFormattedTranscript(
  screenDbId: string,
  text: string,
  reviewed: boolean,
): Promise<BaScreen> {
  const { data } = await api.put<BaScreen>(`/ba/screens/${screenDbId}/ai-transcript`, {
    text,
    reviewed,
  });
  return data;
}

// ─── Flows ───────────────────────────────────────────────────────────────────

export async function createBaFlow(
  moduleDbId: string,
  payload: { flowName: string; steps: { screenId: string; triggerLabel: string; outcome?: string }[] },
): Promise<BaFlow> {
  const { data } = await api.post<BaFlow>(`/ba/modules/${moduleDbId}/flows`, payload);
  return data;
}

export async function listBaFlows(moduleDbId: string): Promise<BaFlow[]> {
  const { data } = await api.get<BaFlow[]>(`/ba/modules/${moduleDbId}/flows`);
  return data;
}

export async function updateBaFlow(
  flowId: string,
  payload: { flowName: string; steps: { screenId: string; triggerLabel: string; outcome?: string }[] },
): Promise<BaFlow> {
  const { data } = await api.put<BaFlow>(`/ba/flows/${flowId}`, payload);
  return data;
}

export async function deleteBaFlow(flowId: string): Promise<void> {
  await api.delete(`/ba/flows/${flowId}`);
}

// ─── Skill Execution ─────────────────────────────────────────────────────────

export async function executeSkill(
  moduleDbId: string,
  skillName: string,
): Promise<{ executionId: string; skill: string; status: string }> {
  const { data } = await api.post(`/ba/modules/${moduleDbId}/execute/${skillName}`, {}, { timeout: 10_000 });
  return data;
}

export async function getExecution(moduleDbId: string, executionId: string): Promise<BaSkillExecution> {
  const { data } = await api.get<BaSkillExecution>(`/ba/modules/${moduleDbId}/execution/${executionId}`);
  return data;
}

export async function approveExecution(executionId: string): Promise<BaSkillExecution> {
  const { data } = await api.post<BaSkillExecution>(`/ba/executions/${executionId}/approve`);
  return data;
}

export async function retrySkill(
  moduleDbId: string,
  skillName: string,
): Promise<{ executionId: string }> {
  const { data } = await api.post(`/ba/modules/${moduleDbId}/retry/${skillName}`);
  return data;
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

export async function getArtifact(artifactId: string): Promise<BaArtifact> {
  const { data } = await api.get<BaArtifact>(`/ba/artifacts/${artifactId}`);
  return data;
}

export async function updateArtifactSection(
  sectionDbId: string,
  editedContent: string,
): Promise<BaArtifactSection> {
  const { data } = await api.put<BaArtifactSection>(`/ba/artifacts/${sectionDbId}/section`, { editedContent });
  return data;
}

export async function approveArtifact(artifactDbId: string): Promise<BaArtifact> {
  const { data } = await api.post<BaArtifact>(`/ba/artifacts/${artifactDbId}/approve`);
  return data;
}

// ─── AI refine-section ──────────────────────────────────────────────────────

export interface BaRefineSectionPayload {
  artifactType: string;
  sectionLabel: string;
  currentText: string;
  moduleContext?: string;
  instruction?: string;
}

export async function baRefineSection(payload: BaRefineSectionPayload): Promise<{ suggestion: string; model: string }> {
  const { data } = await api.post<{ suggestion: string; model: string }>(`/ai/ba-refine-section`, payload);
  return data;
}

// ─── TBD-Future Registry ─────────────────────────────────────────────────────

export async function listTbdEntries(projectId: string): Promise<BaTbdFutureEntry[]> {
  const { data } = await api.get<BaTbdFutureEntry[]>(`/ba/projects/${projectId}/tbd-registry`);
  return data;
}

export async function resolveTbdEntry(
  entryId: string,
  resolvedInterface: string,
): Promise<BaTbdFutureEntry> {
  const { data } = await api.put<BaTbdFutureEntry>(`/ba/tbd-entries/${entryId}/resolve`, { resolvedInterface });
  return data;
}

// ─── RTM ─────────────────────────────────────────────────────────────────────

export async function getProjectRtm(projectId: string): Promise<BaRtmRow[]> {
  const { data } = await api.get<BaRtmRow[]>(`/ba/projects/${projectId}/rtm`);
  return data;
}

// ─── Execution Health (dashboard tile) ────────────────────────────────────

export interface BaExecutionHealth {
  total: number;
  executed: number;
  passRate: number;
  counts: {
    PASS: number;
    FAIL: number;
    BLOCKED: number;
    SKIPPED: number;
    NOT_RUN: number;
  };
  openDefects: number;
  criticalOpenDefects: number;
  lastRunAt: string | null;
  failingTcs: Array<{
    id: string;
    testCaseId: string;
    title: string;
    moduleId: string;
    moduleName: string;
    moduleDbId: string;
  }>;
  blockedTcs: Array<{
    id: string;
    testCaseId: string;
    title: string;
    moduleId: string;
    moduleName: string;
    moduleDbId: string;
  }>;
}

export async function getProjectExecutionHealth(projectId: string): Promise<BaExecutionHealth> {
  const { data } = await api.get<BaExecutionHealth>(`/ba/projects/${projectId}/execution-health`);
  return data;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export const MODULE_STATUS_LABELS: Record<BaModuleStatus, string> = {
  DRAFT: 'Draft',
  SCREENS_UPLOADED: 'Screens Uploaded',
  ANALYSIS_COMPLETE: 'Analysis Complete',
  FRD_COMPLETE: 'FRD Complete',
  EPICS_COMPLETE: 'EPICs Complete',
  STORIES_COMPLETE: 'Stories Complete',
  SUBTASKS_COMPLETE: 'SubTasks Complete',
  APPROVED: 'Approved',
};

export const MODULE_STATUS_COLORS: Record<BaModuleStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCREENS_UPLOADED: 'bg-blue-100 text-blue-700',
  ANALYSIS_COMPLETE: 'bg-indigo-100 text-indigo-700',
  FRD_COMPLETE: 'bg-violet-100 text-violet-700',
  EPICS_COMPLETE: 'bg-purple-100 text-purple-700',
  STORIES_COMPLETE: 'bg-fuchsia-100 text-fuchsia-700',
  SUBTASKS_COMPLETE: 'bg-emerald-100 text-emerald-700',
  APPROVED: 'bg-green-100 text-green-700',
};

export const SKILL_NAMES = ['SKILL-00', 'SKILL-01-S', 'SKILL-02-S', 'SKILL-04', 'SKILL-05'] as const;

// ─── SubTasks ────────────────────────────────────────────────────────────────

export interface BaSubTask {
  id: string;
  subtaskId: string;
  subtaskName: string;
  subtaskType: string | null;
  team: string | null;
  userStoryId: string | null;
  epicId: string | null;
  featureId: string | null;
  moduleId: string | null;
  packageName: string | null;
  assignedTo: string | null;
  estimatedEffort: string | null;
  prerequisites: string[];
  status: 'DRAFT' | 'APPROVED' | 'IMPLEMENTED';
  priority: string | null;
  tbdFutureRefs: string[];
  sourceFileName: string | null;
  className: string | null;
  methodName: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: BaSubTaskSection[];
  module?: {
    id: string;
    moduleId: string;
    moduleName: string;
    packageName: string;
    project?: BaProject;
    screens?: BaScreenLite[];
  };
}

export interface BaSubTaskSection {
  id: string;
  sectionNumber: number;
  sectionKey: string;
  sectionLabel: string;
  aiContent: string;
  editedContent: string | null;
  isHumanModified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SprintSequence {
  priorities: { P0: string[]; P1: string[]; P2: string[]; P3: string[] };
  dependencies: { from: string; to: string }[];
  subtasks: (BaSubTask & { computedPriority: string })[];
}

export async function listBaSubTasks(moduleDbId: string): Promise<BaSubTask[]> {
  const { data } = await api.get<BaSubTask[]>(`/ba/modules/${moduleDbId}/subtasks`);
  return data;
}

export async function getBaSubTask(subtaskDbId: string): Promise<BaSubTask> {
  const { data } = await api.get<BaSubTask>(`/ba/subtasks/${subtaskDbId}`);
  return data;
}

export async function updateBaSubTaskSection(
  subtaskDbId: string,
  sectionKey: string,
  editedContent: string,
): Promise<BaSubTaskSection> {
  const { data } = await api.put<BaSubTaskSection>(`/ba/subtasks/${subtaskDbId}/sections/${sectionKey}`, { editedContent });
  return data;
}

export async function approveBaSubTask(subtaskDbId: string): Promise<BaSubTask> {
  const { data } = await api.post<BaSubTask>(`/ba/subtasks/${subtaskDbId}/approve`);
  return data;
}

export async function getSprintSequence(moduleDbId: string): Promise<SprintSequence> {
  const { data } = await api.get<SprintSequence>(`/ba/modules/${moduleDbId}/sprint-sequence`);
  return data;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export const TEAM_COLORS: Record<string, string> = {
  FE: 'bg-blue-100 text-blue-700',
  BE: 'bg-purple-100 text-purple-700',
  IN: 'bg-orange-100 text-orange-700',
  QA: 'bg-green-100 text-green-700',
};

export const SKILL_LABELS: Record<string, string> = {
  'SKILL-00': 'Screen Analysis',
  'SKILL-01-S': 'FRD Generation',
  'SKILL-02-S': 'EPIC Generation',
  'SKILL-04': 'User Stories',
  'SKILL-05': 'SubTasks',
  'SKILL-06-LLD': 'Low-Level Design',
  'SKILL-07-FTC': 'Functional Test Cases',
};

// ─── v4: Architect Console (master data + templates) ─────────────────────────

export type BaMasterDataCategory =
  | 'FRONTEND_STACK'
  | 'BACKEND_STACK'
  | 'DATABASE'
  | 'STREAMING'
  | 'CACHING'
  | 'STORAGE'
  | 'CLOUD'
  | 'ARCHITECTURE'
  | 'PROJECT_STRUCTURE'
  | 'BACKEND_TEMPLATE'
  | 'FRONTEND_TEMPLATE'
  | 'LLD_TEMPLATE'
  | 'FTC_TEMPLATE'
  | 'CODING_GUIDELINES';

export type BaMasterDataScope = 'GLOBAL' | 'PROJECT';
export type BaTemplateModifier = 'AI' | 'HUMAN';

export const TECH_STACK_CATEGORIES: BaMasterDataCategory[] = [
  'FRONTEND_STACK',
  'BACKEND_STACK',
  'DATABASE',
  'STREAMING',
  'CACHING',
  'STORAGE',
  'CLOUD',
  'ARCHITECTURE',
];

export const TEMPLATE_CATEGORIES: BaMasterDataCategory[] = [
  'PROJECT_STRUCTURE',
  'BACKEND_TEMPLATE',
  'FRONTEND_TEMPLATE',
  'LLD_TEMPLATE',
  'FTC_TEMPLATE',
  'CODING_GUIDELINES',
];

export const CATEGORY_LABELS: Record<BaMasterDataCategory, string> = {
  FRONTEND_STACK: 'Frontend Stack',
  BACKEND_STACK: 'Backend Stack',
  DATABASE: 'Database',
  STREAMING: 'Streaming',
  CACHING: 'Caching',
  STORAGE: 'Storage',
  CLOUD: 'Cloud',
  ARCHITECTURE: 'Architecture',
  PROJECT_STRUCTURE: 'Project Structure',
  BACKEND_TEMPLATE: 'Backend Template',
  FRONTEND_TEMPLATE: 'Frontend Template',
  LLD_TEMPLATE: 'LLD Document Template',
  FTC_TEMPLATE: 'FTC Document Template',
  CODING_GUIDELINES: 'Coding Guidelines',
};

export function isTechStackCategory(c: BaMasterDataCategory): boolean {
  return TECH_STACK_CATEGORIES.includes(c);
}

export function isTemplateCategory(c: BaMasterDataCategory): boolean {
  return TEMPLATE_CATEGORIES.includes(c);
}

export interface BaTemplate {
  id: string;
  category: BaMasterDataCategory;
  name: string;
  version: number;
  parentTemplateId: string | null;
  lastModifiedBy: BaTemplateModifier;
  scope: BaMasterDataScope;
  projectId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface BaMasterDataEntry {
  id: string;
  category: BaMasterDataCategory;
  scope: BaMasterDataScope;
  projectId: string | null;
  name: string;
  value: string;
  description: string | null;
  templateId: string | null;
  template?: BaTemplate | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FuzzyMatchCandidate {
  id: string;
  name: string;
  scope: BaMasterDataScope;
  distance: number;
}

export interface CreateMasterDataEntryInput {
  category: BaMasterDataCategory;
  scope?: BaMasterDataScope;
  projectId?: string | null;
  name: string;
  value: string;
  description?: string;
  templateId?: string | null;
  force?: boolean;
}

export async function listMasterData(
  category: BaMasterDataCategory,
  projectId?: string,
): Promise<BaMasterDataEntry[]> {
  const { data } = await api.get<BaMasterDataEntry[]>('/ba/master-data', {
    params: { category, ...(projectId ? { projectId } : {}) },
  });
  return data;
}

export async function createMasterDataEntry(
  input: CreateMasterDataEntryInput,
): Promise<BaMasterDataEntry> {
  const { data } = await api.post<BaMasterDataEntry>('/ba/master-data', input);
  return data;
}

export async function updateMasterDataEntry(
  id: string,
  patch: Partial<Pick<BaMasterDataEntry, 'name' | 'value' | 'description' | 'isArchived'>>,
): Promise<BaMasterDataEntry> {
  const { data } = await api.patch<BaMasterDataEntry>(`/ba/master-data/${id}`, patch);
  return data;
}

export async function archiveMasterDataEntry(id: string): Promise<void> {
  await api.delete(`/ba/master-data/${id}`);
}

export async function promoteMasterDataEntry(id: string): Promise<BaMasterDataEntry> {
  const { data } = await api.post<BaMasterDataEntry>(`/ba/master-data/${id}/promote`, null, {
    headers: { 'x-is-admin': 'true' },
  });
  return data;
}

export async function bulkUploadMasterData(
  entries: CreateMasterDataEntryInput[],
): Promise<{ ok: number; skipped: number; errors: string[] }> {
  const { data } = await api.post<{ ok: number; skipped: number; errors: string[] }>(
    '/ba/master-data/bulk',
    { entries },
  );
  return data;
}

export async function reseedMasterDataCategory(
  category: BaMasterDataCategory,
): Promise<{ category: BaMasterDataCategory; seeded: number }> {
  const { data } = await api.post<{ category: BaMasterDataCategory; seeded: number }>(
    '/ba/master-data/reseed',
    {},
    { params: { category } },
  );
  return data;
}

export async function dedupeCheck(
  category: BaMasterDataCategory,
  name: string,
  projectId?: string,
): Promise<FuzzyMatchCandidate[]> {
  const { data } = await api.post<FuzzyMatchCandidate[]>('/ba/master-data/dedupe-check', {
    category,
    name,
    ...(projectId ? { projectId } : {}),
  });
  return data;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(
  category: BaMasterDataCategory,
  projectId?: string,
): Promise<BaTemplate[]> {
  const { data } = await api.get<BaTemplate[]>('/ba/templates', {
    params: { category, ...(projectId ? { projectId } : {}) },
  });
  return data;
}

export async function getTemplate(id: string): Promise<BaTemplate> {
  const { data } = await api.get<BaTemplate>(`/ba/templates/${id}`);
  return data;
}

export async function getTemplateLineage(id: string): Promise<BaTemplate[]> {
  const { data } = await api.get<BaTemplate[]>(`/ba/templates/${id}/lineage`);
  return data;
}

export async function forkTemplate(
  id: string,
  payload: { projectId: string; name?: string; content?: string },
): Promise<BaTemplate> {
  const { data } = await api.patch<BaTemplate>(`/ba/templates/${id}`, payload);
  return data;
}

export async function uploadTemplate(params: {
  file: File;
  category: BaMasterDataCategory;
  name: string;
  description?: string;
  scope?: BaMasterDataScope;
  projectId?: string;
}): Promise<{ entry: BaMasterDataEntry; template: BaTemplate }> {
  const form = new FormData();
  form.append('file', params.file);
  form.append('category', params.category);
  form.append('name', params.name);
  if (params.description) form.append('description', params.description);
  if (params.scope) form.append('scope', params.scope);
  if (params.projectId) form.append('projectId', params.projectId);
  const { data } = await api.post<{ entry: BaMasterDataEntry; template: BaTemplate }>(
    '/ba/templates/upload',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    },
  );
  return data;
}

// ─── v4.1: LLD config + pseudo files + generate ──────────────────────────────

export interface BaLldConfig {
  id: string;
  moduleDbId: string;
  frontendStackId: string | null;
  backendStackId: string | null;
  databaseId: string | null;
  streamingId: string | null;
  cachingId: string | null;
  storageId: string | null;
  cloudId: string | null;
  architectureId: string | null;
  cloudServices: string | null;
  projectStructureId: string | null;
  backendTemplateId: string | null;
  frontendTemplateId: string | null;
  lldTemplateId: string | null;
  codingGuidelinesId: string | null;
  nfrValues: Record<string, string> | null;
  customNotes: string | null;
  // Narrative-driven LLD (additive)
  narrative: string | null;
  useAsAdditional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BaLldAttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractionNote: string | null;
  storageBackend: string;
  createdAt: string;
}

export interface BaLldAttachmentList {
  attachments: BaLldAttachmentMeta[];
  totalBytes: number;
  maxTotalBytes: number;
}

export interface BaLldGap {
  id: string;
  category: string;
  question: string;
  suggestion: string;
}

export interface LldConfigBundle {
  config: BaLldConfig | null;
  moduleStatus: BaModuleStatus;
  lldCompletedAt: string | null;
  lldArtifactId: string | null;
}

export interface BaPseudoFile {
  id: string;
  artifactDbId: string;
  path: string;
  language: string;
  aiContent: string;
  editedContent: string | null;
  isHumanModified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LldBundle {
  artifact: (BaArtifact & { sections: BaArtifactSection[] }) | null;
  pseudoFiles: BaPseudoFile[];
}

export async function getLldConfig(moduleDbId: string): Promise<LldConfigBundle> {
  const { data } = await api.get<LldConfigBundle>(`/ba/modules/${moduleDbId}/lld/config`);
  return data;
}

export async function saveLldConfig(moduleDbId: string, payload: Partial<Omit<BaLldConfig, 'id' | 'moduleDbId' | 'createdAt' | 'updatedAt'>>): Promise<BaLldConfig> {
  const { data } = await api.put<BaLldConfig>(`/ba/modules/${moduleDbId}/lld/config`, payload);
  return data;
}

export async function generateLld(moduleDbId: string): Promise<{ executionId: string; skill: string; status: string }> {
  const { data } = await api.post<{ executionId: string; skill: string; status: string }>(
    `/ba/modules/${moduleDbId}/generate-lld`,
    {},
    { timeout: 10_000 },
  );
  return data;
}

/**
 * Per-section completeness verdict for the LLD validator. Mirrors the
 * `BaLldParserService.validateCompleteness` return shape.
 */
export interface LldSectionValidation {
  sectionKey: string;
  sectionLabel: string;
  present: boolean;
  contentLen: number;
  thin: boolean;
  isHumanModified: boolean;
}

/**
 * Frontend coverage breakdown — present only when the architect picked a
 * frontend stack in BaLldConfig. Backend-only modules return null.
 */
export interface LldFrontendCoverage {
  stackName: string | null;
  pagesCount: number;
  pagesExpected: number;
  routeHandlersCount: number;
  routeHandlersExpected: number;
  componentsCount: number;
  componentsExpected: number;
  frontendTestsCount: number;
  frontendTestsExpected: number;
  featuresWithoutPage: string[];
  isComplete: boolean;
}

/**
 * Result of GET /api/ba/modules/:id/lld/validate. Deterministic — the
 * backend reads BaArtifactSection + BaPseudoFile rows and returns gaps;
 * no AI call is made.
 */
export interface LldValidationReport {
  artifactId: string;
  sections: LldSectionValidation[];
  sectionsPresent: number;
  sectionsExpected: number;
  pseudoFilesCount: number;
  pseudoFilesExpected: number;
  featuresWithoutPseudoFiles: string[];
  frontendCoverage: LldFrontendCoverage | null;
  gaps: string[];
  isComplete: boolean;
}

/** Result of per-section regeneration. */
export interface LldSectionRegenResult {
  sectionKey: string;
  sectionLabel: string;
  artifactId: string;
  sectionWritten: boolean;
  skipped: boolean;
  reason?: string;
}

/**
 * Run the deterministic LLD completeness check. Throws when no LLD
 * artifact exists for the module (the architect hasn't clicked Generate
 * LLD yet). Cheap and fast — DB-only, no AI.
 */
export async function validateLld(moduleDbId: string): Promise<LldValidationReport> {
  const { data } = await api.get<LldValidationReport>(
    `/ba/modules/${moduleDbId}/lld/validate`,
    { timeout: 30_000 },
  );
  return data;
}

/**
 * Re-generate ONE canonical LLD section via a focused AI call. Used to
 * fill gaps surfaced by `validateLld`. Idempotent — skips when the
 * target section is human-modified. ~30-60s per call, ~$0.05 in tokens.
 */
export async function regenerateLldSection(
  moduleDbId: string,
  sectionKey: string,
): Promise<LldSectionRegenResult> {
  const { data } = await api.post<LldSectionRegenResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-06-LLD/section/${sectionKey}`,
    {},
    // 2 min — focused single-section AI call typically returns in 30-60 s
    { timeout: 2 * 60 * 1000 },
  );
  return data;
}

/**
 * Result of POST /ba/modules/:id/execute/SKILL-04/feature/:featureId —
 * per-feature User Story regeneration (mode 04b). Reports how many stories
 * the AI added to the existing USER_STORY artifact, their US-NNN ids, or
 * `skipped` when the feature already has ≥3 stories.
 */
export interface Skill04FeatureRegenResult {
  featureId: string;
  artifactId: string;
  storiesAdded: number;
  storyIds: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Generate User Stories for ONE feature on the existing USER_STORY artifact.
 * Use when SKILL-04's single-shot per-feature loop missed a feature (because
 * the upstream FRD/RTM was sparse) or when one feature came back with too
 * few stories. Idempotent — skips when the feature already has ≥3 stories.
 * ~$0.10 per call, ~60-90 s wall time.
 */
export async function regenerateUserStoriesForFeature(
  moduleDbId: string,
  featureId: string,
): Promise<Skill04FeatureRegenResult> {
  const { data } = await api.post<Skill04FeatureRegenResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-04/feature/${featureId}`,
    {},
    // 3 min — single AI call producing 2-3 user stories; ~60-90 s typical
    { timeout: 3 * 60 * 1000 },
  );
  return data;
}

/**
 * Result of POST /ba/modules/:id/execute/SKILL-06-LLD/feature/:featureId —
 * per-feature pseudo-file regeneration. Reports how many new pseudo-files
 * the AI added (or `skipped` when the feature already has comprehensive
 * coverage).
 */
export interface LldFeatureRegenResult {
  featureId: string;
  artifactId: string;
  pseudoFilesAdded: number;
  skipped: boolean;
  reason?: string;
  /**
   * Result of the diagram-refresh chain that auto-fires whenever this run
   * actually added pseudo-files (mode 06d). `null` when the chain didn't
   * run (no new pseudo-files, or this run was skipped). When `error` is
   * set the chain failed transiently — the pseudo-file result is still
   * valid; the four diagrams can be retried later via
   * `regenerateLldDiagrams`.
   */
  diagramsRefreshed: {
    sectionsRefreshed: string[];
    sectionsSkippedHuman: string[];
    sectionsFailed: string[];
    skipped: boolean;
    reason?: string;
    error?: string;
  } | null;
}

/**
 * Generate the missing pseudo-files for ONE feature on the existing LLD
 * artifact. Driven by the structured `BaSubTask` rows for the feature so
 * the AI knows which classes/methods to scaffold (controller / service /
 * DTOs / entity / SQL migration / TBD stubs / frontend / tests).
 * Idempotent — skips when the feature already has ≥4 pseudo-files
 * including a backend service AND controller. ~$0.10 per call,
 * ~60-90 s wall time.
 */
export async function regenerateLldForFeature(
  moduleDbId: string,
  featureId: string,
): Promise<LldFeatureRegenResult> {
  const { data } = await api.post<LldFeatureRegenResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-06-LLD/feature/${featureId}`,
    {},
    // 5 min — per-feature regen (60-90 s) auto-chains a diagram refresh
    // (30-60 s) when pseudo-files are actually added; budget covers both.
    { timeout: 5 * 60 * 1000 },
  );
  return data;
}

/**
 * Result of POST /ba/modules/:id/execute/SKILL-06-LLD/diagrams — diagram
 * refresh (mode 06d). Reports which of the four module-level diagrams
 * (Module Dependency Graph, Class Diagram, Sequence Diagrams, Schema
 * Diagram) were actually rewritten in this run, which were preserved
 * because they are human-modified, and which the AI failed to emit.
 */
export interface LldDiagramsRegenResult {
  artifactId: string;
  sectionsRefreshed: string[];
  sectionsSkippedHuman: string[];
  sectionsFailed: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Refresh the four module-level Mermaid diagrams (Module Dependency Graph,
 * Class Diagram, Sequence Diagrams, Schema Diagram) so they reflect the
 * current pseudo-file / data-model surface. Use after running per-feature
 * regen (mode 06c) to close drift between pseudo-files and diagrams.
 * Idempotent — human-modified diagrams are preserved. ~$0.05 per call,
 * ~30-60 s wall time.
 */
export async function regenerateLldDiagrams(
  moduleDbId: string,
): Promise<LldDiagramsRegenResult> {
  const { data } = await api.post<LldDiagramsRegenResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-06-LLD/diagrams`,
    {},
    // 2 min — focused AI call covering four diagrams in one shot, ~30-60 s typical
    { timeout: 2 * 60 * 1000 },
  );
  return data;
}

// ─── Narrative attachments + gap-check ─────────────────────────────────────

export async function listLldAttachments(moduleDbId: string): Promise<BaLldAttachmentList> {
  const { data } = await api.get<BaLldAttachmentList>(`/ba/modules/${moduleDbId}/lld/attachments`);
  return data;
}

export async function uploadLldAttachments(moduleDbId: string, files: File[]): Promise<BaLldAttachmentList> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await api.post<BaLldAttachmentList>(
    `/ba/modules/${moduleDbId}/lld/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data;
}

export async function deleteLldAttachment(moduleDbId: string, attachmentId: string): Promise<{ deleted: string }> {
  const { data } = await api.delete<{ deleted: string }>(
    `/ba/modules/${moduleDbId}/lld/attachments/${attachmentId}`,
  );
  return data;
}

export async function lldGapCheck(moduleDbId: string): Promise<{ gaps: BaLldGap[]; model: string }> {
  const { data } = await api.post<{ gaps: BaLldGap[]; model: string }>(
    `/ba/modules/${moduleDbId}/lld/gap-check`,
    {},
    { timeout: 120_000 },
  );
  return data;
}

export async function getLld(moduleDbId: string): Promise<LldBundle> {
  const { data } = await api.get<LldBundle>(`/ba/modules/${moduleDbId}/lld`);
  return data;
}

/** Summary row per LLD artifact attached to a module (one per stack combination). */
export interface LldArtifactSummary {
  id: string;
  artifactId: string;          // e.g. LLD-MOD-01-langchain
  status: 'DRAFT' | 'CONFIRMED_PARTIAL' | 'CONFIRMED' | 'APPROVED';
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  pseudoFileCount: number;
  languages: string[];
  isCurrent: boolean;          // true if this is the module's active LLD
}

export async function listLldsForModule(moduleDbId: string): Promise<LldArtifactSummary[]> {
  const { data } = await api.get<LldArtifactSummary[]>(`/ba/modules/${moduleDbId}/llds`);
  return data;
}

export async function listPseudoFilesByArtifact(artifactDbId: string): Promise<BaPseudoFile[]> {
  const { data } = await api.get<BaPseudoFile[]>(`/ba/artifacts/${artifactDbId}/pseudo-files`);
  return data;
}

export async function getPseudoFile(id: string): Promise<BaPseudoFile> {
  const { data } = await api.get<BaPseudoFile>(`/ba/pseudo-files/${id}`);
  return data;
}

/** Trigger a browser download of a blob returned by an API endpoint. */
async function downloadBlob(path: string, filename: string): Promise<void> {
  const response = await api.get(path, { responseType: 'blob', timeout: 120_000 });
  const blob = new Blob([response.data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPseudoFile(id: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/pseudo-files/${id}/download`, filename);
}

export function downloadPseudoFilesZip(artifactDbId: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/artifacts/${artifactDbId}/pseudo-files/zip`, filename);
}

export function downloadProjectStructureZip(artifactDbId: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/artifacts/${artifactDbId}/project-structure/zip`, filename);
}

export async function savePseudoFile(id: string, editedContent: string): Promise<BaPseudoFile> {
  const { data } = await api.put<BaPseudoFile>(`/ba/pseudo-files/${id}`, { editedContent });
  return data;
}

// ─── v4.2: FTC — Functional Test Cases ──────────────────────────────────────

export interface BaFtcConfig {
  id: string;
  moduleDbId: string;
  /** Multi-select since v4.3. */
  testingFrameworks: string[];
  /** Multi-select since v4.3 — filters which TC categories the skill emits. */
  testTypes: string[];
  coverageTarget: string | null;
  owaspWebEnabled: boolean;
  owaspLlmEnabled: boolean;
  excludedOwaspWeb: string[];
  excludedOwaspLlm: string[];
  includeLldReferences: boolean;
  ftcTemplateId: string | null;
  customNotes: string | null;
  narrative: string | null;
  useAsAdditional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FtcConfigBundle {
  config: BaFtcConfig | null;
  moduleStatus: BaModuleStatus;
  ftcCompletedAt: string | null;
  ftcArtifactId: string | null;
}

export interface BaTestCase {
  id: string;
  artifactDbId: string;
  testCaseId: string;
  title: string;
  category: string | null;
  scope: 'black_box' | 'white_box';
  testKind: 'positive' | 'negative' | 'edge';
  priority: string | null;
  sprintId: string | null;
  sprintDbId: string | null;
  executionStatus: string; // NOT_RUN | PASS | FAIL | BLOCKED | SKIPPED
  lastRunAt: string | null;
  lastRunBy: string | null;
  defectIds: string[];
  scenarioGroup: string | null;
  testData: string | null;
  e2eFlow: string | null;
  preconditions: string | null;
  steps: string;
  expected: string;
  postValidation: string | null;
  supportingDocs: string[];
  sqlSetup: string | null;
  sqlVerify: string | null;
  isIntegrationTest: boolean;
  parentTestCaseId: string | null;
  owaspCategory: string | null;
  playwrightHint: string | null;
  developerHints: string | null;
  linkedFeatureIds: string[];
  linkedEpicIds: string[];
  linkedStoryIds: string[];
  linkedSubtaskIds: string[];
  linkedPseudoFileIds: string[];
  linkedLldArtifactId: string | null;
  tags: string[];
  aiContent: string;
  editedContent: string | null;
  isHumanModified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FtcBundle {
  artifact: (BaArtifact & { sections: BaArtifactSection[] }) | null;
  testCases: BaTestCase[];
}

export interface FtcArtifactSummary {
  id: string;
  artifactId: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  testCaseCount: number;
  whiteBoxCount: number;
  owaspCategories: string[];
  isCurrent: boolean;
}

export async function getFtcConfig(moduleDbId: string): Promise<FtcConfigBundle> {
  const { data } = await api.get<FtcConfigBundle>(`/ba/modules/${moduleDbId}/ftc/config`);
  return data;
}

export async function saveFtcConfig(
  moduleDbId: string,
  payload: Partial<Omit<BaFtcConfig, 'id' | 'moduleDbId' | 'createdAt' | 'updatedAt'>>,
): Promise<BaFtcConfig> {
  const { data } = await api.put<BaFtcConfig>(`/ba/modules/${moduleDbId}/ftc/config`, payload);
  return data;
}

export async function generateFtc(moduleDbId: string): Promise<{ executionId: string; skill: string; status: string }> {
  const { data } = await api.post<{ executionId: string; skill: string; status: string }>(
    `/ba/modules/${moduleDbId}/generate-ftc`,
    {},
    { timeout: 10_000 },
  );
  return data;
}

/**
 * Result shape from POST /ba/modules/:id/execute/SKILL-07-FTC/complete —
 * the one-button pipeline that runs per-feature black-box loop → per-
 * category passes for selected `testTypes` → per-feature white-box loop
 * (only when an LLD exists for the module) → narrative + structural
 * sections. Each step is idempotent so re-running fills only the missing
 * pieces.
 */
export interface FtcCompleteResult {
  artifactId: string;
  perFeature: Array<{ featureId: string; tcsAdded: number; skipped: boolean }>;
  perCategory: Array<{ category: string; tcsAdded: number; skipped: boolean }>;
  /**
   * Per-feature white-box pass results. Empty array when no LLD artifact
   * exists for the module (white-box requires the LLD as its surface).
   */
  perFeatureWhiteBox: Array<{ featureId: string; tcsAdded: number; skipped: boolean }>;
  narrative: { sectionsAdded: number; skipped: boolean };
  totalTcs: number;
}

/**
 * Result of POST /ba/modules/:id/execute/SKILL-07-FTC/white-box/:featureId
 * — single-feature white-box generation. Mirrors the per-feature mode 2
 * result shape.
 */
export interface FtcWhiteBoxResult {
  featureId: string;
  artifactId: string;
  tcsAdded: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Run the complete SKILL-07-FTC pipeline (per-feature black-box → per-
 * category → per-feature white-box → narrative + structural sections) in
 * one call. Long-running — the backend may run for several minutes
 * (~30-60 s per AI call × features + categories + white-box features + 1
 * narrative). Use with a generous timeout.
 */
export async function generateFtcComplete(moduleDbId: string): Promise<FtcCompleteResult> {
  const { data } = await api.post<FtcCompleteResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-07-FTC/complete`,
    {},
    // Allow up to 25 min for the full pipeline (was 15 min before
    // white-box loop was added). ~9 features × 60 s × 2 (black + white)
    // + ~5 categories × 90 s + 60 s narrative ≈ 24 min worst case.
    { timeout: 25 * 60 * 1000 },
  );
  return data;
}

/**
 * Run a single-feature WHITE-BOX pass without re-running the entire
 * pipeline. Useful when adding white-box coverage to a feature retro-
 * actively (e.g. after the LLD was generated). Idempotent — skips when
 * the feature already has white-box TCs. Cost: ~$0.05, ~30-60 s.
 */
export async function generateFtcWhiteBoxForFeature(
  moduleDbId: string,
  featureId: string,
): Promise<FtcWhiteBoxResult> {
  const { data } = await api.post<FtcWhiteBoxResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-07-FTC/white-box/${featureId}`,
    {},
    { timeout: 3 * 60 * 1000 },
  );
  return data;
}

/**
 * Feature row returned by GET /ba/modules/:id/ftc-features. The
 * orchestrator filters RTM rows to clean F-NN-NN ids and returns one row
 * per unique feature.
 */
export interface FtcFeatureRow {
  featureId: string;
  featureName: string;
  featureStatus: string;
}

/**
 * List all features for a module, used by the per-feature white-box loop
 * driver. Returns the same shape the per-feature mode-2 endpoint loops
 * over.
 */
export async function listFtcFeaturesForModule(moduleDbId: string): Promise<FtcFeatureRow[]> {
  const { data } = await api.get<FtcFeatureRow[]>(
    `/ba/modules/${moduleDbId}/ftc-features`,
  );
  return data;
}

/**
 * Result of POST /ba/modules/:id/execute/SKILL-07-FTC/narrative —
 * narrative-only mode (mode 3). Always runs the deterministic structural-
 * sections render at the start, then either generates the canonical
 * narrative sections (Summary / Test Strategy / OWASP Coverage / etc.)
 * via AI or short-circuits if those already exist on the artifact. Used
 * after per-feature / per-category / white-box loops to refresh §6 / §7 /
 * §8 body sections that re-render the latest TC catalogue.
 */
export interface FtcNarrativeResult {
  artifactId: string;
  sectionsAdded: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Trigger the narrative + structural-sections refresh on the module's
 * FTC artifact. Idempotent: when the canonical narrative already exists,
 * only the structural sections (§5 Test Cases Index / §6 Functional /
 * §7 Integration / §8 White-Box) are re-rendered to reflect the latest
 * BaTestCase rows. Cheap: structural-sections refresh is deterministic
 * (no AI). Narrative AI call only fires when narrative is genuinely
 * missing.
 */
export async function refreshFtcNarrative(moduleDbId: string): Promise<FtcNarrativeResult> {
  const { data } = await api.post<FtcNarrativeResult>(
    `/ba/modules/${moduleDbId}/execute/SKILL-07-FTC/narrative`,
    {},
    { timeout: 3 * 60 * 1000 },
  );
  return data;
}

export async function getFtc(moduleDbId: string): Promise<FtcBundle> {
  const { data } = await api.get<FtcBundle>(`/ba/modules/${moduleDbId}/ftc`);
  return data;
}

export async function listFtcsForModule(moduleDbId: string): Promise<FtcArtifactSummary[]> {
  const { data } = await api.get<FtcArtifactSummary[]>(`/ba/modules/${moduleDbId}/ftcs`);
  return data;
}

export async function listTestCasesByArtifact(artifactDbId: string): Promise<BaTestCase[]> {
  const { data } = await api.get<BaTestCase[]>(`/ba/artifacts/${artifactDbId}/test-cases`);
  return data;
}

export async function saveTestCase(id: string, editedContent: string): Promise<BaTestCase> {
  const { data } = await api.put<BaTestCase>(`/ba/test-cases/${id}`, { editedContent });
  return data;
}

export function downloadFtcCsv(artifactDbId: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/artifacts/${artifactDbId}/test-cases/csv`, filename);
}

export function downloadPlaywrightZip(artifactDbId: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/artifacts/${artifactDbId}/playwright-zip`, filename);
}

/**
 * D1 — Download runnable unit-test scaffolds derived from an LLD's pseudo-code
 * files. Deterministic template codegen: pytest / Jest / JUnit per language.
 */
export function downloadUnitTestsZip(lldArtifactDbId: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/lld-artifacts/${lldArtifactDbId}/unit-tests-zip`, filename);
}

/**
 * D2 — Download contract-test scaffolds + OpenAPI stub between service
 * layers detected in the LLD. Flags orphan consumers (no matching provider)
 * in UNRESOLVED_CONTRACTS.md.
 */
export function downloadContractTestsZip(lldArtifactDbId: string, filename: string): Promise<void> {
  return downloadBlob(`/ba/lld-artifacts/${lldArtifactDbId}/contract-tests-zip`, filename);
}

/**
 * OpenAPI / Swagger — live spec for the customer's target application,
 * derived from the LLD pseudo-code. Returns the backend URL (suitable for
 * `window.open(...)` / `<a href=…>`). We need absolute URLs because the
 * Swagger UI page is served by the Node backend, not by Next.js.
 */
const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function lldSwaggerUrl(lldArtifactDbId: string): string {
  return `${BACKEND_BASE}/api/ba/lld-artifacts/${lldArtifactDbId}/swagger`;
}
export function lldOpenapiJsonUrl(lldArtifactDbId: string): string {
  return `${BACKEND_BASE}/api/ba/lld-artifacts/${lldArtifactDbId}/openapi.json`;
}
export function lldOpenapiYamlUrl(lldArtifactDbId: string): string {
  return `${BACKEND_BASE}/api/ba/lld-artifacts/${lldArtifactDbId}/openapi.yaml`;
}

export function projectSwaggerUrl(projectId: string): string {
  return `${BACKEND_BASE}/api/ba/projects/${projectId}/swagger`;
}
export function projectOpenapiJsonUrl(projectId: string): string {
  return `${BACKEND_BASE}/api/ba/projects/${projectId}/openapi.json`;
}
export function projectOpenapiYamlUrl(projectId: string): string {
  return `${BACKEND_BASE}/api/ba/projects/${projectId}/openapi.yaml`;
}

/**
 * F3: Re-verify AC coverage first, then stream the Playwright ZIP. Returns
 * the fresh coverage bundle so the UI can show "X uncovered" etc. before the
 * download completes. The ZIP itself is always fresh server-side (it reads
 * current DB state), but without re-verifying ACs the gap count shown to the
 * user could be stale.
 */
export async function reverifyAndExportPlaywright(
  artifactDbId: string,
  filename: string,
): Promise<AcCoverageBundle> {
  const coverage = await analyzeAcCoverage(artifactDbId);
  await downloadPlaywrightZip(artifactDbId, filename);
  return coverage;
}

// ─── AC Coverage ────────────────────────────────────────────────────────────

export interface BaAcCoverage {
  id: string;
  artifactDbId: string;
  acSource: string;
  acSourceType: 'EPIC' | 'USER_STORY' | 'SUBTASK' | 'FEATURE';
  acText: string;
  coveringTcIds: string[];
  coveringTcRefs: string[];
  status: 'COVERED' | 'PARTIAL' | 'UNCOVERED';
  rationale: string | null;
  analyzedAt: string;
  source: 'AI_SKILL' | 'POST_GEN_CHECK';
}

export interface AcCoverageBundle {
  rows: BaAcCoverage[];
  summary: { covered: number; partial: number; uncovered: number; total: number };
  model?: string | null;
}

export async function listAcCoverage(artifactDbId: string): Promise<AcCoverageBundle> {
  const { data } = await api.get<AcCoverageBundle>(`/ba/artifacts/${artifactDbId}/ac-coverage`);
  return data;
}

export async function analyzeAcCoverage(artifactDbId: string): Promise<AcCoverageBundle> {
  const { data } = await api.post<AcCoverageBundle>(
    `/ba/artifacts/${artifactDbId}/ac-coverage/analyze`,
    {},
    { timeout: 180_000 },
  );
  return data;
}

// ─── Phase 2a — Execution tracking + defects + RCA ────────────────────────

export interface BaTestRun {
  id: string;
  testCaseId: string;
  sprintId: string | null;
  executor: string | null;
  executedAt: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  notes: string | null;
  durationSec: number | null;
  environment: string | null;
  deletedAt: string | null;
  defects?: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    externalRef?: string | null;
  }>;
  testCase?: { id: string; testCaseId: string; title: string };
  createdAt: string;
  updatedAt: string;
}

export type DefectSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED' | 'WONT_FIX';

export interface BaDefectAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractionNote: string | null;
  storageBackend: string;
  createdAt: string;
}

export interface BaRcaRow {
  id: string;
  defectId: string;
  source: 'AI' | 'TESTER';
  rootCause: string;
  contributingFactors: string[];
  proposedFix: string | null;
  confidence: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaDefect {
  id: string;
  testCaseId: string;
  firstSeenRunId: string | null;
  externalRef: string | null;
  title: string;
  description: string | null;
  severity: DefectSeverity;
  status: DefectStatus;
  reproductionSteps: string | null;
  environment: string | null;
  reportedBy: string | null;
  reportedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: BaDefectAttachment[];
  rcas?: BaRcaRow[];
  testCase?: { id: string; testCaseId: string; title: string; artifactDbId: string };
}

export interface CreateTestRunPayload {
  status: BaTestRun['status'];
  notes?: string | null;
  executor?: string | null;
  durationSec?: number | null;
  environment?: string | null;
  sprintId?: string | null;
  sprintDbId?: string | null;
  defect?: {
    title: string;
    description?: string | null;
    severity?: DefectSeverity | null;
    externalRef?: string | null;
    reproductionSteps?: string | null;
    reportedBy?: string | null;
  } | null;
}

// ── Runs

export async function createTestRun(
  testCaseId: string,
  payload: CreateTestRunPayload,
): Promise<{ run: BaTestRun; defectId: string | null }> {
  const { data } = await api.post<{ run: BaTestRun; defectId: string | null }>(
    `/ba/test-cases/${testCaseId}/runs`,
    payload,
    { timeout: 30_000 },
  );
  return data;
}

export interface BulkCreateTestRunPayload {
  testCaseIds: string[];
  status: BaTestRun['status'];
  notes?: string | null;
  executor?: string | null;
  environment?: string | null;
  sprintId?: string | null;
  sprintDbId?: string | null;
  executedAt?: string | null;
}

export interface BulkRunResult {
  requested: number;
  created: number;
  missingCount: number;
  missingIds: string[];
  runs: Array<{ testCaseId: string; runId: string }>;
}

export async function bulkCreateTestRuns(payload: BulkCreateTestRunPayload): Promise<BulkRunResult> {
  const { data } = await api.post<BulkRunResult>(`/ba/test-cases/bulk-runs`, payload, { timeout: 60_000 });
  return data;
}

export async function listTestRunsForTc(testCaseId: string): Promise<BaTestRun[]> {
  const { data } = await api.get<BaTestRun[]>(`/ba/test-cases/${testCaseId}/runs`);
  return data;
}

export async function deleteTestRun(runId: string): Promise<{ deleted?: string; alreadyDeleted?: boolean }> {
  const { data } = await api.delete<{ deleted?: string; alreadyDeleted?: boolean }>(`/ba/runs/${runId}`);
  return data;
}

// ── Defects

export async function listDefectsForTc(testCaseId: string): Promise<BaDefect[]> {
  const { data } = await api.get<BaDefect[]>(`/ba/test-cases/${testCaseId}/defects`);
  return data;
}

export interface BaProjectDefect extends Omit<BaDefect, 'testCase'> {
  testCase: {
    id: string;
    testCaseId: string;
    title: string;
    sprintId: string | null;
    sprintDbId: string | null;
    sprint: { id: string; sprintCode: string; name: string; status: BaSprintStatus } | null;
    artifact: {
      id: string;
      artifactId: string;
      module: { id: string; moduleId: string; moduleName: string };
    };
  };
  firstSeenRun?: {
    id: string;
    sprintId: string | null;
    sprintDbId: string | null;
    sprint: { id: string; sprintCode: string; name: string; status: BaSprintStatus } | null;
    environment: string | null;
    executedAt: string;
  } | null;
}

export async function listDefectsForProject(projectId: string): Promise<BaProjectDefect[]> {
  const { data } = await api.get<BaProjectDefect[]>(`/ba/projects/${projectId}/defects`);
  return data;
}

// ─── Sprints (B1) ────────────────────────────────────────────────────────────

export type BaSprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface BaSprint {
  id: string;
  projectId: string;
  sprintCode: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: BaSprintStatus;
  createdAt: string;
  updatedAt: string;
  // Populated by list endpoint only
  runCount?: number;
  legacyRunCount?: number;
}

export interface CreateSprintPayload {
  sprintCode: string;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: BaSprintStatus;
}

export interface UpdateSprintPayload {
  sprintCode?: string;
  name?: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: BaSprintStatus;
}

export async function listSprints(projectId: string): Promise<BaSprint[]> {
  const { data } = await api.get<BaSprint[]>(`/ba/projects/${projectId}/sprints`);
  return data;
}

export async function createSprint(projectId: string, payload: CreateSprintPayload): Promise<BaSprint> {
  const { data } = await api.post<BaSprint>(`/ba/projects/${projectId}/sprints`, payload);
  return data;
}

export async function updateSprint(sprintId: string, payload: UpdateSprintPayload): Promise<BaSprint> {
  const { data } = await api.patch<BaSprint>(`/ba/sprints/${sprintId}`, payload);
  return data;
}

export async function deleteSprint(sprintId: string): Promise<{ deleted: string }> {
  const { data } = await api.delete<{ deleted: string }>(`/ba/sprints/${sprintId}`);
  return data;
}

export async function backfillSprints(
  projectId: string,
): Promise<{ found: number; created: number; sprints: Array<{ id: string; sprintCode: string }> }> {
  const { data } = await api.post<{
    found: number;
    created: number;
    sprints: Array<{ id: string; sprintCode: string }>;
  }>(`/ba/projects/${projectId}/sprints/backfill`, {});
  return data;
}

export interface BaBurndown {
  sprint: BaSprint;
  totalScope: number;
  days: Array<{ date: string; remaining: number; tested: number }>;
  ideal: Array<{ date: string; remaining: number }> | null;
  totals: { pass: number; fail: number; blocked: number; skipped: number; notRun: number };
  note?: string;
}

export async function getSprintBurndown(sprintId: string): Promise<BaBurndown> {
  const { data } = await api.get<BaBurndown>(`/ba/sprints/${sprintId}/burndown`);
  return data;
}

export interface CreateDefectPayload {
  title: string;
  description?: string | null;
  severity?: DefectSeverity | null;
  externalRef?: string | null;
  reproductionSteps?: string | null;
  environment?: string | null;
  reportedBy?: string | null;
}

export async function createDefectForTc(testCaseId: string, payload: CreateDefectPayload): Promise<BaDefect> {
  const { data } = await api.post<BaDefect>(`/ba/test-cases/${testCaseId}/defects`, payload);
  return data;
}

export async function getDefect(defectId: string): Promise<BaDefect> {
  const { data } = await api.get<BaDefect>(`/ba/defects/${defectId}`);
  return data;
}

export async function updateDefect(
  defectId: string,
  payload: Partial<Pick<BaDefect, 'title' | 'description' | 'severity' | 'status' | 'reproductionSteps' | 'externalRef' | 'environment'>>,
): Promise<BaDefect> {
  const { data } = await api.patch<BaDefect>(`/ba/defects/${defectId}`, payload);
  return data;
}

export async function uploadDefectAttachments(
  defectId: string,
  files: File[],
): Promise<{ created: Array<{ id: string; fileName: string; sizeBytes: number }>; attachments: BaDefectAttachment[] }> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await api.post(
    `/ba/defects/${defectId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data;
}

export async function deleteDefectAttachment(defectId: string, attachmentId: string): Promise<{ deleted: string }> {
  const { data } = await api.delete<{ deleted: string }>(`/ba/defects/${defectId}/attachments/${attachmentId}`);
  return data;
}

// ── RCA

export async function listRcasForDefect(defectId: string): Promise<BaRcaRow[]> {
  const { data } = await api.get<BaRcaRow[]>(`/ba/defects/${defectId}/rca`);
  return data;
}

export async function analyzeDefectWithAi(defectId: string): Promise<{ rca: BaRcaRow; classification: string }> {
  const { data } = await api.post<{ rca: BaRcaRow; classification: string }>(
    `/ba/defects/${defectId}/rca/analyze`,
    {},
    { timeout: 120_000 },
  );
  return data;
}

export async function saveTesterRca(
  defectId: string,
  payload: { rootCause: string; contributingFactors?: string[]; proposedFix?: string | null; createdBy?: string | null },
): Promise<BaRcaRow> {
  const { data } = await api.post<BaRcaRow>(`/ba/defects/${defectId}/rca`, payload);
  return data;
}

// FTC narrative + attachments + gap-check (reuses the shared shapes)

export async function listFtcAttachments(moduleDbId: string): Promise<BaLldAttachmentList> {
  const { data } = await api.get<BaLldAttachmentList>(`/ba/modules/${moduleDbId}/ftc/attachments`);
  return data;
}

export async function uploadFtcAttachments(moduleDbId: string, files: File[]): Promise<BaLldAttachmentList> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await api.post<BaLldAttachmentList>(
    `/ba/modules/${moduleDbId}/ftc/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return data;
}

export async function deleteFtcAttachment(moduleDbId: string, attachmentId: string): Promise<{ deleted: string }> {
  const { data } = await api.delete<{ deleted: string }>(
    `/ba/modules/${moduleDbId}/ftc/attachments/${attachmentId}`,
  );
  return data;
}

export async function ftcGapCheck(moduleDbId: string): Promise<{ gaps: BaLldGap[]; model: string }> {
  const { data } = await api.post<{ gaps: BaLldGap[]; model: string }>(
    `/ba/modules/${moduleDbId}/ftc/gap-check`,
    {},
    { timeout: 120_000 },
  );
  return data;
}

// ─── Discovery & Solutioning Track (Stage 1: Audio + WFT) ───────────────────

export type BaAudioFileStatus = 'UPLOADED' | 'TRANSCRIBING' | 'TRANSCRIBED' | 'FAILED';

export interface BaAudioFile {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  fileData: string; // base64; '' on list/detail responses (server strips for performance)
  rawTranscript: string | null;
  detectedLang: string | null;
  sttProvider: string | null;
  status: BaAudioFileStatus;
  errorMessage: string | null;
  retentionUntil: string | null;
  uploadedById: string | null;
  wftId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BaWftStatus = 'DRAFT' | 'COMPLETE' | 'APPROVED';

export interface BaWftConcept {
  name: string;
  context: string;
}

export interface BaWftMeta {
  language?: string | null;
  domainContext?: string | null;
  model?: string | null;
  generatedAt?: string;
}

export interface BaWft {
  id: string;
  projectId: string;
  rawTranscript: string;
  cleanedText: string | null;
  paraphrased: string | null;
  concepts: BaWftConcept[] | null;
  actionItems: string[] | null;
  openQuestions: string[] | null;
  meta: BaWftMeta | null;
  status: BaWftStatus;
  createdAt: string;
  updatedAt: string;
  audioFiles?: BaAudioFile[];
}

// Audio operations

export async function uploadDiscoveryAudio(
  projectId: string,
  file: File,
  retentionDays?: number,
): Promise<BaAudioFile> {
  const formData = new FormData();
  formData.append('audio', file);
  if (retentionDays != null) formData.append('retentionDays', String(retentionDays));
  const { data } = await api.post<BaAudioFile>(
    `/ba/projects/${projectId}/discovery/audio`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 },
  );
  return data;
}

export async function listDiscoveryAudio(projectId: string): Promise<BaAudioFile[]> {
  const { data } = await api.get<BaAudioFile[]>(`/ba/projects/${projectId}/discovery/audio`);
  return data;
}

export async function transcribeDiscoveryAudio(
  projectId: string,
  audioId: string,
): Promise<BaAudioFile> {
  const { data } = await api.post<BaAudioFile>(
    `/ba/projects/${projectId}/discovery/audio/${audioId}/transcribe`,
    {},
    { timeout: 120_000 },
  );
  return data;
}

export async function deleteDiscoveryAudio(projectId: string, audioId: string): Promise<void> {
  await api.delete(`/ba/projects/${projectId}/discovery/audio/${audioId}`);
}

// WFT operations

export async function generateDiscoveryWft(
  projectId: string,
  audioFileIds: string[],
  domainContext?: string,
  languageHint?: string,
): Promise<BaWft> {
  const { data } = await api.post<BaWft>(
    `/ba/projects/${projectId}/discovery/wft`,
    { audioFileIds, domainContext, languageHint },
    { timeout: 180_000 },
  );
  return data;
}

export async function getLatestDiscoveryWft(projectId: string): Promise<BaWft | null> {
  const { data } = await api.get<BaWft | null>(`/ba/projects/${projectId}/discovery/wft`);
  return data;
}

export interface UpdateBaWftDto {
  cleanedText?: string;
  paraphrased?: string;
  concepts?: BaWftConcept[];
  actionItems?: string[];
  openQuestions?: string[];
  status?: BaWftStatus;
}

export async function updateDiscoveryWft(
  projectId: string,
  wftId: string,
  updates: UpdateBaWftDto,
): Promise<BaWft> {
  const { data } = await api.patch<BaWft>(
    `/ba/projects/${projectId}/discovery/wft/${wftId}`,
    updates,
  );
  return data;
}

export async function regenerateDiscoveryWft(
  projectId: string,
  wftId: string,
  domainContext?: string,
  languageHint?: string,
): Promise<BaWft> {
  const { data } = await api.post<BaWft>(
    `/ba/projects/${projectId}/discovery/wft/${wftId}/regenerate`,
    { domainContext, languageHint },
    { timeout: 180_000 },
  );
  return data;
}

// BRD operations (Stage 2)

export type BaBrdStatus = 'DRAFT' | 'COMPLETE' | 'APPROVED';
export type BaBrdAudience = 'internal-tool' | 'end-client-product';

export interface BaFrTableRow {
  id: string;
  requirement: string;
  testable: boolean;
}

export interface BaBrdMeta {
  audience?: string | null;
  productName?: string | null;
  model?: string | null;
  generatedAt?: string;
}

export interface BaBrd {
  id: string;
  projectId: string;
  wftId: string;
  /** Map of section number ('1' to '15') → markdown body. */
  sections: Record<string, string>;
  frTable: BaFrTableRow[] | null;
  openItems: string[] | null;
  meta: BaBrdMeta | null;
  status: BaBrdStatus;
  createdAt: string;
  updatedAt: string;
}

/** Section titles per skill 02 — matched on the Python side too. */
export const BRD_SECTION_TITLES: Record<string, string> = {
  '1': 'Background',
  '2': 'Problem Statement',
  '3': 'Business Objectives',
  '4': 'Scope',
  '5': 'Stakeholders',
  '6': 'Functional Requirements',
  '7': 'Data Requirements',
  '8': 'Non-Functional Requirements',
  '9': 'Success Metrics',
  '10': 'Assumptions',
  '11': 'Constraints',
  '12': 'Risks & Mitigation',
  '13': 'High-Level Solution Architecture',
  '14': 'Next Steps',
  '15': 'Open Items',
};

export async function generateDiscoveryBrd(
  projectId: string,
  wftId: string,
  productName?: string,
  audience?: BaBrdAudience,
): Promise<BaBrd> {
  const { data } = await api.post<BaBrd>(
    `/ba/projects/${projectId}/discovery/brd`,
    { wftId, productName, audience },
    { timeout: 240_000 },
  );
  return data;
}

export async function getLatestDiscoveryBrd(projectId: string): Promise<BaBrd | null> {
  const { data } = await api.get<BaBrd | null>(`/ba/projects/${projectId}/discovery/brd`);
  return data;
}

export interface UpdateBaBrdDto {
  /** Partial section map — only the keys present overwrite. */
  sections?: Record<string, string>;
  frTable?: BaFrTableRow[];
  openItems?: string[];
  status?: BaBrdStatus;
}

export async function updateDiscoveryBrd(
  projectId: string,
  brdId: string,
  updates: UpdateBaBrdDto,
): Promise<BaBrd> {
  const { data } = await api.patch<BaBrd>(
    `/ba/projects/${projectId}/discovery/brd/${brdId}`,
    updates,
  );
  return data;
}

export async function regenerateDiscoveryBrd(
  projectId: string,
  brdId: string,
  productName?: string,
  audience?: BaBrdAudience,
): Promise<BaBrd> {
  const { data } = await api.post<BaBrd>(
    `/ba/projects/${projectId}/discovery/brd/${brdId}/regenerate`,
    { productName, audience },
    { timeout: 240_000 },
  );
  return data;
}

// Approach Note operations (Stage 3)

export type BaAnVersionStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';
export type BaAnAudience = 'internal-tool' | 'end-client-product';

export interface BaAnBrandTokens {
  primary: string;
  surface: string;
  cta: string;
  logo: string | null;
  productName: string;
}

export interface BaAnDecision {
  question: string;
  decision: string;
}

export interface BaAnOpenQuestion {
  number: number;
  question: string;
  default: string;
}

export interface BaAnVersionMeta {
  audience?: string | null;
  productName?: string | null;
  model?: string | null;
  generatedAt?: string;
}

export interface BaApproachNoteVersion {
  id: string;
  approachNoteId: string;
  versionNumber: number;
  /** Map of section number ('1' to '11') → markdown body. */
  sections: Record<string, string>;
  brandTokens: BaAnBrandTokens | null;
  decisionsLocked: BaAnDecision[] | null;
  openQuestions: BaAnOpenQuestion[] | null;
  /** Required v2+, null on v1. */
  changesSince: string | null;
  /** FK to prior version this one supersedes; null on v1. */
  supersedesId: string | null;
  meta: BaAnVersionMeta | null;
  status: BaAnVersionStatus;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BaApproachNote {
  id: string;
  projectId: string;
  brdId: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: BaApproachNoteVersion[];
  currentVersion: BaApproachNoteVersion | null;
}

/** Section titles per skill 03 — matched on the Python side too. */
export const AN_SECTION_TITLES: Record<string, string> = {
  '1': 'Executive Verdict',
  '2': 'Feature / Model Palette',
  '3': 'Requirement-by-Requirement Fit',
  '4': 'Solution Architecture',
  '5': 'Model Routing Strategy',
  '6': 'Coverage Summary',
  '7': 'Decision Inputs vs Alternatives',
  '8': 'Decisions Locked & Open Questions',
  '9': 'Phase 1 (PoC) Scope',
  '10': 'Open Items for Next Version',
  '11': 'Phase 2 Roadmap',
};

export async function generateDiscoveryAn(
  projectId: string,
  brdId: string,
  productName?: string,
  audience?: BaAnAudience,
): Promise<BaApproachNote> {
  const { data } = await api.post<BaApproachNote>(
    `/ba/projects/${projectId}/discovery/approach-note`,
    { brdId, productName, audience },
    { timeout: 360_000 },
  );
  return data;
}

export async function getLatestDiscoveryAn(
  projectId: string,
): Promise<BaApproachNote | null> {
  const { data } = await api.get<BaApproachNote | null>(
    `/ba/projects/${projectId}/discovery/approach-note`,
  );
  return data;
}

export async function getDiscoveryAn(
  projectId: string,
  approachNoteId: string,
): Promise<BaApproachNote> {
  const { data } = await api.get<BaApproachNote>(
    `/ba/projects/${projectId}/discovery/approach-note/${approachNoteId}`,
  );
  return data;
}

export async function createDiscoveryAnVersion(
  projectId: string,
  approachNoteId: string,
  changesSince: string,
  productName?: string,
  audience?: BaAnAudience,
): Promise<BaApproachNote> {
  const { data } = await api.post<BaApproachNote>(
    `/ba/projects/${projectId}/discovery/approach-note/${approachNoteId}/versions`,
    { changesSince, productName, audience },
    { timeout: 360_000 },
  );
  return data;
}

export interface UpdateBaAnVersionDto {
  /** Partial section map — only the keys present overwrite. */
  sections?: Record<string, string>;
  brandTokens?: Partial<BaAnBrandTokens>;
  decisionsLocked?: BaAnDecision[];
  openQuestions?: BaAnOpenQuestion[];
  status?: BaAnVersionStatus;
}

export async function updateDiscoveryAnVersion(
  projectId: string,
  versionId: string,
  updates: UpdateBaAnVersionDto,
): Promise<BaApproachNoteVersion> {
  const { data } = await api.patch<BaApproachNoteVersion>(
    `/ba/projects/${projectId}/discovery/approach-note/versions/${versionId}`,
    updates,
  );
  return data;
}

export interface ExtractAnBrandTokensResult {
  extracted: { primary: string; surface: string; cta: string; productName: string; model?: string };
  updated: BaApproachNoteVersion;
}

/** Multipart upload of a reference image; AI extracts brand tokens and merges them into the version. */
export async function extractAnBrandTokens(
  projectId: string,
  versionId: string,
  file: File,
): Promise<ExtractAnBrandTokensResult> {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post<ExtractAnBrandTokensResult>(
    `/ba/projects/${projectId}/discovery/approach-note/versions/${versionId}/extract-brand-tokens`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90_000 },
  );
  return data;
}

// Wireframes operations (Stage 4)

export type BaWireframeSetStatus = 'DRAFT' | 'COMPLETE' | 'APPROVED';

export interface BaWireframeCallout {
  n: number | string;
  description: string;
  mappedTo: string;
}

export interface BaWireframeComponent {
  file: string;
  purpose: string;
}

export interface BaWireframeScreen {
  id: string;
  setId: string;
  sequenceNum: number;
  slug: string;
  title: string;
  pattern: string | null;
  callouts: BaWireframeCallout[];
  components: BaWireframeComponent[] | null;
  mdContent: string | null;
  htmlContent: string | null;
  meta: { frRefs?: string[] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaWireframeCoverageStatus {
  validated: boolean;
  totalScreens: number;
  totalCallouts: number;
  totalFrs: number;
  orphanFrs: string[];
  orphanScreens: number[];
  notes?: string | null;
}

export interface BaWireframeSet {
  id: string;
  projectId: string;
  approachNoteVersionId: string;
  brandTokensSnapshot: BaAnBrandTokens;
  coverageStatus: BaWireframeCoverageStatus | null;
  meta: { audience?: string | null; model?: string | null; generatedAt?: string; screenCount?: number } | null;
  status: BaWireframeSetStatus;
  createdAt: string;
  updatedAt: string;
  screens: BaWireframeScreen[];
}

/** Skill 04 §4 — 13-pattern catalogue used for the screen-picker UI. */
export const WIREFRAME_PATTERNS: { id: string; label: string }[] = [
  { id: '§4.1 Landing', label: 'Landing / entry' },
  { id: '§4.2 Conversational chat', label: 'Conversational / chat surface' },
  { id: '§4.3 Read-only browse', label: 'Read-only browse / list' },
  { id: '§4.4 Detail / drill-down', label: 'Detail / drill-down' },
  { id: '§4.5 Search / catalogue', label: 'Search / filter / catalogue' },
  { id: '§4.6 Setup wizard', label: 'One-time setup wizard' },
  { id: '§4.7 Admin home', label: 'Admin / dashboard home' },
  { id: '§4.8 CRUD form', label: 'CRUD form (create / edit)' },
  { id: '§4.9 Audio-assisted form', label: 'Audio-assisted form' },
  { id: '§4.10 Modal', label: 'Modal / quick-add overlay' },
  { id: '§4.11 Configuration', label: 'Configuration / settings' },
  { id: '§4.12 Observability', label: 'Observability dashboard' },
  { id: '§4.13 Analytics', label: 'Analytics / business-impact' },
];

export async function generateDiscoveryWireframes(
  projectId: string,
  approachNoteVersionId?: string,
  selectedPatterns?: string[],
  productName?: string,
): Promise<BaWireframeSet> {
  const { data } = await api.post<BaWireframeSet>(
    `/ba/projects/${projectId}/discovery/wireframes`,
    { approachNoteVersionId, selectedPatterns, productName },
    { timeout: 480_000 },
  );
  return data;
}

export async function getLatestDiscoveryWireframeSet(
  projectId: string,
): Promise<BaWireframeSet | null> {
  const { data } = await api.get<BaWireframeSet | null>(
    `/ba/projects/${projectId}/discovery/wireframes`,
  );
  return data;
}

export async function regenerateDiscoveryWireframes(
  projectId: string,
  setId: string,
): Promise<BaWireframeSet> {
  const { data } = await api.post<BaWireframeSet>(
    `/ba/projects/${projectId}/discovery/wireframes/${setId}/regenerate`,
    {},
    { timeout: 480_000 },
  );
  return data;
}

export async function getDiscoveryWireframeScreen(
  projectId: string,
  screenId: string,
): Promise<BaWireframeScreen> {
  const { data } = await api.get<BaWireframeScreen>(
    `/ba/projects/${projectId}/discovery/wireframes/screens/${screenId}`,
  );
  return data;
}

export interface UpdateWireframeScreenDto {
  title?: string;
  mdContent?: string;
  htmlContent?: string;
  callouts?: BaWireframeCallout[];
  components?: BaWireframeComponent[];
}

export async function updateDiscoveryWireframeScreen(
  projectId: string,
  screenId: string,
  updates: UpdateWireframeScreenDto,
): Promise<BaWireframeScreen> {
  const { data } = await api.patch<BaWireframeScreen>(
    `/ba/projects/${projectId}/discovery/wireframes/screens/${screenId}`,
    updates,
  );
  return data;
}

// Hi-fi mockup operations (Stage 5)

export type BaHifiSetStatus = 'DRAFT' | 'COMPLETE' | 'APPROVED';

export interface BaHifiCallout {
  n: number | string;
  description: string;
  mappedTo: string;
}

/** Per-screen parity status; populated by the deterministic validator on the backend. */
export interface BaHifiScreenParity {
  sequenceNum: number;
  lofiCallouts: string[];
  hifiCallouts: string[];
  hifiOnly: string[];
  missing: string[];
  invalidExtras: string[];
  ok: boolean;
}

export interface BaHifiScreen {
  id: string;
  setId: string;
  sequenceNum: number;
  slug: string;
  title: string;
  htmlContent: string;
  callouts: BaHifiCallout[];
  parityStatus: BaHifiScreenParity | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaHifiParityStatus {
  validated: boolean;
  totalScreens: number;
  perScreen: BaHifiScreenParity[];
  notes?: string | null;
}

export interface BaHifiSet {
  id: string;
  projectId: string;
  wireframeSetId: string;
  brandTokensSnapshot: BaAnBrandTokens;
  syntheticDataSeed: { hint?: string; notes?: string } | null;
  parityStatus: BaHifiParityStatus | null;
  meta: { audience?: string | null; model?: string | null; generatedAt?: string; screenCount?: number } | null;
  status: BaHifiSetStatus;
  createdAt: string;
  updatedAt: string;
  screens: BaHifiScreen[];
}

export async function generateDiscoveryHifi(
  projectId: string,
  options: { wireframeSetId?: string; productName?: string; syntheticDataHint?: string } = {},
): Promise<BaHifiSet> {
  const { data } = await api.post<BaHifiSet>(
    `/ba/projects/${projectId}/discovery/hifi`,
    options,
    { timeout: 600_000 },
  );
  return data;
}

export async function getLatestDiscoveryHifi(
  projectId: string,
): Promise<BaHifiSet | null> {
  const { data } = await api.get<BaHifiSet | null>(
    `/ba/projects/${projectId}/discovery/hifi`,
  );
  return data;
}

export async function regenerateDiscoveryHifi(
  projectId: string,
  setId: string,
): Promise<BaHifiSet> {
  const { data } = await api.post<BaHifiSet>(
    `/ba/projects/${projectId}/discovery/hifi/${setId}/regenerate`,
    {},
    { timeout: 600_000 },
  );
  return data;
}

export async function getDiscoveryHifiScreen(
  projectId: string,
  screenId: string,
): Promise<BaHifiScreen> {
  const { data } = await api.get<BaHifiScreen>(
    `/ba/projects/${projectId}/discovery/hifi/screens/${screenId}`,
  );
  return data;
}

export interface UpdateHifiScreenDto {
  title?: string;
  htmlContent?: string;
  callouts?: BaHifiCallout[];
}

export async function updateDiscoveryHifiScreen(
  projectId: string,
  screenId: string,
  updates: UpdateHifiScreenDto,
): Promise<BaHifiScreen> {
  const { data } = await api.patch<BaHifiScreen>(
    `/ba/projects/${projectId}/discovery/hifi/screens/${screenId}`,
    updates,
  );
  return data;
}
