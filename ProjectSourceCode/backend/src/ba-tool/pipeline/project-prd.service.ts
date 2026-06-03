import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { ArtifactFreshnessService } from './artifact-freshness.service';
import {
  flattenValue,
  flattenSections,
  isStructuredField,
  type StructuredField,
} from './section-normalizer';
import {
  computeSectionStatuses,
  computeReviewProgress,
  emptyReviewMap,
  type ReviewStatus,
} from './section-status';

/**
 * The 22 PRD section names (index = section number). Section 6 is the FRD.
 * Mirrors the existing `/parse` prompt so the project-level PRD is consistent
 * with the rest of the app (RTM, EPIC generation already understand this shape).
 */
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

export interface PrdGap {
  section: number;
  question: string;
}

interface AiPrdResponse {
  sections: Record<string, unknown>;
  gaps: PrdGap[];
}

/** One answered gap submitted by the BA (S-05). */
export interface GapAnswerInput {
  section: number;
  question: string;
  answer: string;
}

/** Shape returned by the AI `/gap-check` endpoint (answer-merge). */
interface AiGapCheckResponse {
  updatedSections: Record<string, unknown>;
  remainingGaps: PrdGap[];
  gapCount: number;
}

/**
 * Combined PRD + FRD generation at the project level (Track C).
 * Consolidates all customer inputs → calls the AI `/project-prd-generate`
 * endpoint → persists a new `BaProjectPrd` version → mirrors a Markdown export
 * to `ProjectArtifacts/02-PRD-FRD/`.
 */
@Injectable()
export class ProjectPrdService {
  private readonly logger = new Logger(ProjectPrdService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly projectFolders: ProjectFolderService,
    private readonly freshness: ArtifactFreshnessService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  /**
   * T-04 — recompute downstream freshness after a PRD change and, when something is
   * now stale, log a "forward sync" CHANGELOG entry. Best-effort, never throws.
   */
  private async firePropagation(projectName: string, projectId: string, reasonLabel: string): Promise<void> {
    try {
      const report = await this.freshness.check(projectId);
      if (report.staleCount > 0) {
        await this.projectFolders.appendChangelog(projectName, {
          summary: `Forward sync — ${reasonLabel}: ${report.staleCount} downstream artifact(s) (HLD/E2E) may be stale and need review.`,
          affectedArtifacts: report.downstream.filter((d) => d.stale).map((d) => `${d.artifactType}: ${d.label}`),
          source: 'forward propagation',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      this.logger.warn(`forward propagation failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async list(projectId: string) {
    return this.prisma.baProjectPrd.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  async getLatest(projectId: string) {
    return this.prisma.baProjectPrd.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
  }

  async get(prdId: string) {
    const prd = await this.prisma.baProjectPrd.findUnique({ where: { id: prdId } });
    if (!prd) throw new NotFoundException(`Project PRD ${prdId} not found`);
    return prd;
  }

  // ── v7 Track X/W — guided editor + review gate ───────────────────────────────

  /** Latest PRD enriched with derived authoring status + review map/progress (Task 2/5). */
  async getLatestEnriched(projectId: string) {
    const prd = await this.getLatest(projectId);
    if (!prd) return null;
    const sections = (prd.sections as Record<string, unknown>) ?? {};
    const meta = (prd.metadata as Record<string, unknown> | null) ?? {};
    const review = (meta.review && typeof meta.review === 'object' ? meta.review : {}) as Record<string, unknown>;
    return {
      ...prd,
      sectionStatuses: computeSectionStatuses(sections),
      review,
      reviewProgress: computeReviewProgress(review),
    };
  }

  /** Task 3 (D6) — the customer inputs the latest PRD was generated from. */
  async getSource(projectId: string) {
    const latest = await this.getLatest(projectId);
    const ids = Array.isArray(latest?.sourceInputIds) ? latest!.sourceInputIds : [];
    if (!ids.length) return [];
    const inputs = await this.prisma.baCustomerInput.findMany({
      where: { id: { in: ids } },
      select: { id: true, inputType: true, label: true, extractedText: true, fileMetadata: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return inputs.map((i) => ({
      id: i.id,
      inputType: i.inputType,
      label: i.label,
      textExcerpt: (i.extractedText ?? '').slice(0, 1000),
      charCount: (i.extractedText ?? '').length,
      fileName: (i.fileMetadata as { fileName?: string } | null)?.fileName ?? null,
      createdAt: i.createdAt,
    }));
  }

  /** Task 4 (D5) — clone a version into a new version (non-destructive restore). */
  async restore(prdId: string): Promise<{ id: string; version: number }> {
    const src = await this.get(prdId);
    const project = await this.prisma.baProject.findUnique({
      where: { id: src.projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException(`Project ${src.projectId} not found`);
    const latest = await this.getLatest(src.projectId);
    const nextVersion = (latest?.version ?? src.version) + 1;
    const srcMeta = (src.metadata as Record<string, unknown> | null) ?? {};
    const record = await this.prisma.baProjectPrd.create({
      data: {
        projectId: src.projectId,
        version: nextVersion,
        status: 'DRAFT',
        sections: src.sections as Prisma.InputJsonValue,
        sourceInputIds: src.sourceInputIds,
        triggeredBy: 'MANUAL_EDIT',
        prdCode: src.prdCode,
        clientName: src.clientName,
        submittedBy: src.submittedBy,
        sourceArtifactVersions: (src.sourceArtifactVersions ?? {}) as Prisma.InputJsonValue,
        metadata: { ...srcMeta, restoredFrom: src.version } as unknown as Prisma.InputJsonValue,
      },
    });
    await this.exportMarkdown(
      project.name,
      record.version,
      src.sections as Record<string, unknown>,
      `Restored PRD from v${src.version} → v${record.version}`,
    ).catch((e) => this.logger.warn(`PRD markdown export failed: ${e instanceof Error ? e.message : e}`));
    await this.firePropagation(project.name, src.projectId, `PRD restored from v${src.version} → v${record.version}`);
    return { id: record.id, version: record.version };
  }

  /** Task 5 — set one section's review status. */
  async setReviewStatus(prdId: string, sectionKey: string, status: ReviewStatus) {
    const valid: ReviewStatus[] = ['pending', 'accepted', 'edited', 'skipped'];
    if (!valid.includes(status)) throw new BadRequestException(`Invalid review status: ${status}`);
    const n = Number(sectionKey);
    if (!Number.isInteger(n) || n < 1 || n > 22) throw new BadRequestException(`Invalid section: ${sectionKey}`);
    return this.patchReview(prdId, (review) => ({ ...review, [sectionKey]: status }));
  }

  /** Task 5 — flip every pending section to accepted. */
  async acceptAllReview(prdId: string) {
    return this.patchReview(prdId, (review) => {
      const out = { ...review };
      for (let i = 1; i <= 22; i++) {
        const k = String(i);
        if ((out[k] ?? 'pending') === 'pending') out[k] = 'accepted';
      }
      return out;
    });
  }

  /** Task 5 (D4) — confirm: CONFIRMED when nothing pending, else CONFIRMED_PARTIAL. */
  async confirm(prdId: string) {
    const prd = await this.get(prdId);
    const meta = (prd.metadata as Record<string, unknown> | null) ?? {};
    const review = (meta.review && typeof meta.review === 'object' ? meta.review : {}) as Record<string, unknown>;
    const progress = computeReviewProgress(review);
    const status = progress.pending === 0 ? 'CONFIRMED' : 'CONFIRMED_PARTIAL';
    return this.prisma.baProjectPrd.update({ where: { id: prdId }, data: { status } });
  }

  /** Task 12 — update PRD-level metadata fields (prdCode / clientName / submittedBy). */
  async updateMeta(
    prdId: string,
    fields: { prdCode?: string; clientName?: string; submittedBy?: string },
  ) {
    await this.get(prdId);
    return this.prisma.baProjectPrd.update({
      where: { id: prdId },
      data: {
        ...(fields.prdCode !== undefined ? { prdCode: fields.prdCode } : {}),
        ...(fields.clientName !== undefined ? { clientName: fields.clientName } : {}),
        ...(fields.submittedBy !== undefined ? { submittedBy: fields.submittedBy } : {}),
      },
    });
  }

  private async patchReview(
    prdId: string,
    fn: (r: Record<string, unknown>) => Record<string, unknown>,
  ) {
    const prd = await this.get(prdId);
    const meta = (prd.metadata as Record<string, unknown> | null) ?? {};
    const review = (meta.review && typeof meta.review === 'object'
      ? { ...(meta.review as Record<string, unknown>) }
      : emptyReviewMap()) as Record<string, unknown>;
    return this.prisma.baProjectPrd.update({
      where: { id: prdId },
      data: { metadata: { ...meta, review: fn(review) } as unknown as Prisma.InputJsonValue },
    });
  }

  private todayDDMMYYYY(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  /**
   * Generate a new PRD+FRD version from the project's customer inputs.
   */
  async generate(projectId: string): Promise<{ id: string; gaps: AiPrdResponse['gaps'] }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true, productName: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const inputs = await this.prisma.baCustomerInput.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, inputType: true, extractedText: true },
    });
    const consolidated = this.consolidateInputs(inputs);
    if (!consolidated.trim()) {
      throw new BadRequestException(
        'No usable text in customer inputs. Add inputs with text/extractable content first.',
      );
    }

    // Call the AI service (reuses the 22-section parse prompt; Section 6 = FRD).
    let ai: AiPrdResponse;
    try {
      const { data } = await axios.post<AiPrdResponse>(
        `${this.aiServiceUrl}/project-prd-generate`,
        {
          project_id: projectId,
          consolidated_input: consolidated,
          product_name: project.productName ?? project.name,
          mode: 'interactive',
        },
        { timeout: 300_000 },
      );
      ai = data;
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`AI PRD generation failed: ${msg}`);
      throw new BadRequestException(`AI PRD generation failed: ${msg}`);
    }

    const latest = await this.getLatest(projectId);
    // S-09b — preserve locked fields from the previous version through regeneration.
    const sections = latest
      ? (this.mergeLocked(latest.sections, ai.sections) as Record<string, unknown>)
      : ai.sections;
    // v7 W-02 (D7) — carry PRD metadata forward; default a PRD code on first generate.
    const prdCode = latest?.prdCode ?? `PRD${this.todayDDMMYYYY()}`;
    const record = await this.prisma.baProjectPrd.create({
      data: {
        projectId,
        version: latest ? latest.version + 1 : 1,
        status: 'DRAFT',
        sections: sections as Prisma.InputJsonValue,
        sourceInputIds: inputs.map((i) => i.id),
        triggeredBy: latest ? 'MANUAL_EDIT' : 'INITIAL_GENERATION',
        prdCode,
        clientName: latest?.clientName ?? null,
        submittedBy: latest?.submittedBy ?? null,
        // M-06 — PRD sits at the top of the chain (built from customer inputs, not
        // upstream artifacts); record the input count as its provenance signal.
        sourceArtifactVersions: { inputCount: inputs.length } as Prisma.InputJsonValue,
        // S-05 gaps + v7 W-01 fresh review map (all 22 sections pending on a new generation).
        metadata: { gaps: ai.gaps ?? [], review: emptyReviewMap() } as unknown as Prisma.InputJsonValue,
      },
    });

    // Mirror a Markdown export to disk (C-03) + changelog entry.
    await this.exportMarkdown(project.name, record.version, sections).catch((e) =>
      this.logger.warn(`PRD markdown export failed: ${e instanceof Error ? e.message : e}`),
    );

    // T-04 — flag any downstream HLD/E2E now superseded by this new PRD version.
    if (latest) await this.firePropagation(project.name, projectId, `PRD regenerated to v${record.version}`);

    this.logger.log(`Generated Project PRD v${record.version} for ${project.name}`);
    return { id: record.id, gaps: ai.gaps ?? [] };
  }

  /** S-05 — the persisted AI gaps for the latest PRD (survive page refreshes). */
  async getGaps(projectId: string): Promise<PrdGap[]> {
    const latest = await this.getLatest(projectId);
    if (!latest) return [];
    const meta = (latest.metadata as Record<string, unknown> | null) ?? {};
    const gaps = meta.gaps;
    return Array.isArray(gaps) ? (gaps as PrdGap[]) : [];
  }

  /**
   * S-05 — answer one or more AI-flagged gaps. Consolidates the answers, calls the
   * AI `/gap-check` endpoint to merge them into the sections, and persists a NEW
   * PRD version with the remaining gaps + an answer audit trail. Fail-safe: on a
   * malformed AI response the prior version is left untouched.
   *
   * Forward propagation (RequirementChangeService + ArtifactFreshnessService) is
   * wired centrally in Phase 4 (T-04); a CHANGELOG entry is written here meanwhile.
   */
  async answerGaps(
    projectId: string,
    answers: GapAnswerInput[],
  ): Promise<{ id: string; version: number; gaps: PrdGap[] }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const latest = await this.getLatest(projectId);
    if (!latest) {
      throw new BadRequestException('No PRD to answer gaps on. Generate the PRD first.');
    }

    const answered = (answers ?? []).filter((a) => a && typeof a.answer === 'string' && a.answer.trim());
    if (!answered.length) {
      // Nothing to merge — return current state unchanged.
      return { id: latest.id, version: latest.version, gaps: await this.getGaps(projectId) };
    }

    const consolidated = answered
      .map((a) => `Section ${a.section}: ${a.answer.trim()}`)
      .join('\n\n');
    const flatSections = flattenSections(latest.sections as Record<string, unknown>);

    let ai: AiGapCheckResponse;
    try {
      const { data } = await axios.post<AiGapCheckResponse>(
        `${this.aiServiceUrl}/gap-check`,
        { sections: flatSections, answers: consolidated },
        { timeout: 300_000 },
      );
      ai = data;
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`AI gap-check failed: ${msg}`);
      throw new BadRequestException(`AI gap-check failed: ${msg}`);
    }

    // Fail-safe — reject a malformed merge so we never persist a broken PRD.
    if (!ai || typeof ai !== 'object' || !ai.updatedSections || typeof ai.updatedSections !== 'object') {
      throw new BadRequestException('Gap-check returned a malformed result; PRD left unchanged.');
    }
    const remainingGaps = Array.isArray(ai.remainingGaps) ? ai.remainingGaps : [];
    // S-09b — locked fields survive the gap-merge too.
    const mergedSections = this.mergeLocked(
      latest.sections,
      ai.updatedSections,
    ) as Record<string, unknown>;

    const prevMeta = (latest.metadata as Record<string, unknown> | null) ?? {};
    const prevAnswers = Array.isArray(prevMeta.gapAnswers) ? prevMeta.gapAnswers : [];
    const answeredAt = new Date().toISOString();
    const newAnswers = answered.map((a) => ({
      section: a.section,
      question: a.question,
      answer: a.answer.trim(),
      answeredAt,
    }));

    const prevSrc = (latest.sourceArtifactVersions as Record<string, unknown> | null) ?? {};
    const record = await this.prisma.baProjectPrd.create({
      data: {
        projectId,
        version: latest.version + 1,
        status: 'DRAFT',
        sections: mergedSections as Prisma.InputJsonValue,
        sourceInputIds: latest.sourceInputIds,
        triggeredBy: 'MANUAL_EDIT',
        prdCode: latest.prdCode,
        clientName: latest.clientName,
        submittedBy: latest.submittedBy,
        sourceArtifactVersions: { ...prevSrc, answeredFromVersion: latest.version } as Prisma.InputJsonValue,
        // v7 — preserve the existing review map across a gap-merge (don't reset to pending).
        metadata: {
          gaps: remainingGaps,
          gapAnswers: [...prevAnswers, ...newAnswers],
          review: (prevMeta.review && typeof prevMeta.review === 'object' ? prevMeta.review : emptyReviewMap()),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.exportMarkdown(
      project.name,
      record.version,
      mergedSections,
      `Answered ${answered.length} gap(s) → PRD v${record.version}; ${remainingGaps.length} gap(s) remaining`,
    ).catch((e) => this.logger.warn(`PRD markdown export failed: ${e instanceof Error ? e.message : e}`));

    // T-04 — flag any downstream HLD/E2E now superseded by this new PRD version.
    await this.firePropagation(project.name, projectId, `gaps answered → PRD v${record.version}`);

    this.logger.log(
      `Answered ${answered.length} gaps for ${project.name} → PRD v${record.version} (${remainingGaps.length} remaining)`,
    );
    return { id: record.id, version: record.version, gaps: remainingGaps };
  }

  /**
   * S-07 (F3) — edit one section's content in place. The incoming content carries
   * structured fields (`{aiContent, editedContent, lockedAt}`); human-edited fields
   * get a `lastEditedAt` stamp. No new version is created for a plain section edit;
   * the controller fires downstream impact analysis afterwards.
   */
  async updateSection(prdId: string, sectionKey: string, content: unknown) {
    const prd = await this.get(prdId);
    const sections = { ...(prd.sections as Record<string, unknown>) };
    sections[sectionKey] = this.stampEditedFields(content);
    // v7 — an inline edit counts as reviewed for this section.
    const meta = (prd.metadata as Record<string, unknown> | null) ?? {};
    const review = (meta.review && typeof meta.review === 'object'
      ? { ...(meta.review as Record<string, unknown>) }
      : emptyReviewMap()) as Record<string, unknown>;
    review[sectionKey] = 'edited';
    return this.prisma.baProjectPrd.update({
      where: { id: prdId },
      data: {
        sections: sections as Prisma.InputJsonValue,
        metadata: { ...meta, review } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** Stamp `lastEditedAt` on any top-level structured field that carries a human edit. */
  private stampEditedFields(content: unknown): unknown {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return content;
    const now = new Date().toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(content as Record<string, unknown>)) {
      if (isStructuredField(v)) {
        const f = v as StructuredField;
        out[k] =
          f.editedContent != null && f.editedContent !== ''
            ? { ...f, lastEditedAt: now }
            : f;
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /**
   * S-09b — carry LOCKED fields (those with `lockedAt` set) forward from the
   * previous version into freshly generated/merged sections, at any depth. A locked
   * field keeps its prior value; everything else takes the new (AI) value. Fields
   * present only in the previous version are preserved (never silently dropped).
   */
  private mergeLocked(prev: unknown, next: unknown): unknown {
    if (isStructuredField(prev) && (prev as StructuredField).lockedAt != null) {
      return prev; // locked → keep the prior value, ignore the new one
    }
    if (Array.isArray(prev) && Array.isArray(next)) {
      return next.map((nextEl) => {
        const fid = (nextEl as Record<string, unknown>)?.featureId;
        const prevEl =
          typeof fid === 'string'
            ? prev.find((p) => (p as Record<string, unknown>)?.featureId === fid)
            : undefined;
        return prevEl !== undefined ? this.mergeLocked(prevEl, nextEl) : nextEl;
      });
    }
    if (
      prev && next &&
      typeof prev === 'object' && typeof next === 'object' &&
      !Array.isArray(prev) && !Array.isArray(next)
    ) {
      const p = prev as Record<string, unknown>;
      const out: Record<string, unknown> = { ...(next as Record<string, unknown>) };
      for (const key of Object.keys(p)) {
        const merged = this.mergeLocked(p[key], (next as Record<string, unknown>)[key]);
        out[key] = merged !== undefined ? merged : p[key];
      }
      return out;
    }
    return next;
  }

  /**
   * S-07 — per-field AI suggestion. Proxies the AI `/suggest` endpoint with the
   * section's current (flattened) content as context. Returns the suggested text;
   * the UI writes it into the field's `editedContent`.
   */
  async suggestField(
    prdId: string,
    sectionKey: string,
    fieldName: string,
  ): Promise<{ suggestion: string }> {
    const prd = await this.get(prdId);
    const sections = (prd.sections as Record<string, unknown>) ?? {};
    const sectionNum = Number(sectionKey);
    const section = Number.isFinite(sectionNum) ? Math.min(Math.max(sectionNum, 1), 22) : 1;
    const context = JSON.stringify(flattenValue(sections[sectionKey] ?? {})).slice(0, 6000);

    try {
      const { data } = await axios.post<{ suggestion?: string }>(
        `${this.aiServiceUrl}/suggest`,
        { section, field: fieldName, context },
        { timeout: 120_000 },
      );
      return { suggestion: data.suggestion ?? '' };
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`AI suggest-field failed: ${msg}`);
      throw new BadRequestException(`AI suggestion failed: ${msg}`);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private consolidateInputs(
    inputs: Array<{ label: string; inputType: string; extractedText: string | null }>,
  ): string {
    return inputs
      .filter((i) => i.extractedText?.trim())
      .map((i) => `=== ${i.label} (${i.inputType}) ===\n${i.extractedText!.trim()}`)
      .join('\n\n');
  }

  /** V-02 — the rendered canonical Markdown for the latest PRD (for in-browser download). */
  async getMarkdown(projectId: string): Promise<{ version: number; markdown: string } | null> {
    const latest = await this.getLatest(projectId);
    if (!latest) return null;
    return {
      version: latest.version,
      markdown: this.renderMarkdown(latest.version, latest.sections as Record<string, unknown>),
    };
  }

  /** Render the 22-section PRD to canonical Markdown (F2 seam flattens structured fields). */
  private renderMarkdown(version: number, sections: Record<string, unknown>): string {
    const lines: string[] = [`# Product Requirements Document (PRD + FRD)`, ``, `_Version ${version}_`, ``];
    for (let n = 1; n <= 22; n++) {
      const key = String(n);
      const name = PRD_SECTION_NAMES[key] ?? `Section ${n}`;
      lines.push(`## ${n}. ${name}`, ``);
      const body = sections[key];
      if (body == null) {
        lines.push('_Not generated._', '');
        continue;
      }
      lines.push('```json', JSON.stringify(flattenValue(body), null, 2), '```', '');
    }
    return lines.join('\n');
  }

  /** Render the 22-section PRD to Markdown and write it to 02-PRD-FRD/. */
  private async exportMarkdown(
    projectName: string,
    version: number,
    sections: Record<string, unknown>,
    changeSummary?: string,
  ): Promise<void> {
    await this.projectFolders.writeArtifactFile(
      projectName,
      '02-PRD-FRD',
      `PRD-FRD-v${version}.md`,
      this.renderMarkdown(version, sections),
    );
    await this.projectFolders.appendChangelog(projectName, {
      summary: changeSummary ?? `Generated PRD + FRD v${version}`,
      affectedArtifacts: [`02-PRD-FRD/PRD-FRD-v${version}.md`],
      source: changeSummary ? 'PRD gap resolution' : 'PRD generation',
      timestamp: new Date().toISOString(),
    });
  }
}
