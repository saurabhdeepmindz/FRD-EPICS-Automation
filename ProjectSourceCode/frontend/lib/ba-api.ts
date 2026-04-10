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
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  modules: BaModuleSummary[];
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
  createdAt: string;
  updatedAt: string;
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
  sections: BaArtifactSection[];
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

export async function uploadBaScreensBatch(
  moduleDbId: string,
  files: File[],
): Promise<BaScreen[]> {
  const formData = new FormData();
  for (const f of files) formData.append('files', f);
  const { data } = await api.post<BaScreen[]>(`/ba/modules/${moduleDbId}/screens/batch`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
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

export const SKILL_LABELS: Record<string, string> = {
  'SKILL-00': 'Screen Analysis',
  'SKILL-01-S': 'FRD Generation',
  'SKILL-02-S': 'EPIC Generation',
  'SKILL-04': 'User Stories',
  'SKILL-05': 'SubTasks',
};
