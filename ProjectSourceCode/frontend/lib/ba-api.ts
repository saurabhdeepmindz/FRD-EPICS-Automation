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
