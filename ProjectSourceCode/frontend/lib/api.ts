import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

/* ── PRD endpoints ──────────────────────────────────────────────────────── */

export interface PrdSection {
  id: string;
  prdId: string;
  sectionNumber: number;
  sectionName: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  content: Record<string, unknown>;
  aiSuggested: boolean;
  completedAt: string | null;
}

export interface Prd {
  id: string;
  prdCode: string;
  productName: string;
  version: string;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'BASELINED';
  author: string | null;
  clientName: string | null;
  submittedBy: string | null;
  clientLogo: string | null;
  createdAt: string;
  updatedAt: string;
  sections: PrdSection[];
}

export interface CompletionStats {
  prdId: string;
  productName: string;
  totalSections: number;
  completedSections: number;
  percentComplete: number;
  sections: Pick<PrdSection, 'sectionNumber' | 'sectionName' | 'status' | 'completedAt'>[];
}

export interface CreatePrdPayload {
  prdCode: string;
  productName: string;
  version?: string;
  author?: string;
  clientName?: string;
  submittedBy?: string;
  sourceText?: string;
  sourceFileName?: string;
  sourceFileData?: string;
}

export interface PrdSource {
  sourceText: string | null;
  sourceFileName: string | null;
  sourceFileData: string | null;
  createdAt: string;
}

export async function createPrd(payload: CreatePrdPayload): Promise<Prd> {
  const { data } = await api.post<Prd>('/prd', payload);
  return data;
}

export async function listPrds(): Promise<Prd[]> {
  const { data } = await api.get<Prd[]>('/prd');
  return data;
}

export async function getPrd(id: string): Promise<Prd> {
  const { data } = await api.get<Prd>(`/prd/${id}`);
  return data;
}

export async function updateSection(
  prdId: string,
  sectionNumber: number,
  content: Record<string, unknown>,
  aiSuggested?: boolean,
): Promise<PrdSection> {
  const { data } = await api.put<PrdSection>(
    `/prd/${prdId}/section/${sectionNumber}`,
    { content, aiSuggested },
  );
  return data;
}

export async function getCompletion(prdId: string): Promise<CompletionStats> {
  const { data } = await api.get<CompletionStats>(`/prd/${prdId}/completion`);
  return data;
}

export async function deletePrd(id: string): Promise<void> {
  await api.delete(`/prd/${id}`);
}

export async function getSource(prdId: string): Promise<PrdSource> {
  const { data } = await api.get<PrdSource>(`/prd/${prdId}/source`);
  return data;
}

export async function updatePrdMeta(
  id: string,
  data: { clientName?: string; submittedBy?: string },
): Promise<Prd> {
  const { data: prd } = await api.patch<Prd>(`/prd/${id}/meta`, data);
  return prd;
}

export async function uploadLogo(prdId: string, file: File): Promise<Prd> {
  const formData = new FormData();
  formData.append('logo', file);
  const { data } = await api.post<Prd>(`/prd/${prdId}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30_000,
  });
  return data;
}

/* ── Speech-to-Text ────────────────────────────────────────────────────── */

export interface TranscribeResponse {
  text: string;
  provider: string;
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  const { data } = await api.post<TranscribeResponse>('/ai/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30_000,
  });
  return data;
}

/* ── AI Suggestion ──────────────────────────────────────────────────────── */

export interface SuggestPayload {
  section: number;
  field: string;
  context?: string;
}

export interface SuggestResponse {
  suggestion: string;
  section: number;
  field: string;
  model: string;
}

export async function suggestField(payload: SuggestPayload): Promise<SuggestResponse> {
  const { data } = await api.post<SuggestResponse>('/ai/suggest', payload);
  return data;
}

/* ── AI Parse (v2 — conversational) ────────────────────────────────────── */

export interface GapItem {
  section: number;
  question: string;
}

export interface ParsePayload {
  text: string;
  mode?: 'all_in_one' | 'interactive';
}

export interface ParseResponse {
  sections: Record<string, Record<string, string>>;
  gaps: GapItem[];
}

export async function parseRequirements(payload: ParsePayload): Promise<ParseResponse> {
  const { data } = await api.post<ParseResponse>('/ai/parse', payload, { timeout: 180_000 });
  return data;
}

/* ── AI Gap Check (v2 — conversational) ────────────────────────────────── */

export interface GapCheckPayload {
  sections: Record<string, unknown>;
  answers: string;
}

export interface GapCheckResponse {
  updatedSections: Record<string, Record<string, string>>;
  remainingGaps: GapItem[];
  gapCount: number;
}

export async function gapCheck(payload: GapCheckPayload): Promise<GapCheckResponse> {
  const { data } = await api.post<GapCheckResponse>('/ai/gap-check', payload, { timeout: 180_000 });
  return data;
}

/* ── File Upload (v2) ──────────────────────────────────────────────────── */

export interface ExtractResponse {
  text: string;
  format: string;
  charCount: number;
  originalName: string;
}

export async function uploadAndExtract(file: File): Promise<ExtractResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ExtractResponse>('/upload/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30_000,
  });
  return data;
}

/* ── Audit / Revision History ──────────────────────────────────────────── */

export interface AuditLogEntry {
  id: string;
  prdId: string;
  sectionNumber: number;
  fieldKey: string;
  changeType: 'CREATED' | 'MODIFIED' | 'AI_GENERATED' | 'AI_MODIFIED';
  source: 'AI' | 'MANUAL';
  previousValue: string | null;
  newValue: string | null;
  version: string;
  createdAt: string;
}

export async function getHistory(prdId: string): Promise<AuditLogEntry[]> {
  const { data } = await api.get<AuditLogEntry[]>(`/prd/${prdId}/history`);
  return data;
}
