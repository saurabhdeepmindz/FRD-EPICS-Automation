import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  ParseUUIDPipe,
  BadRequestException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Sse,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { map, type Observable } from 'rxjs';
import { PipelineService } from './pipeline.service';
import {
  CustomerInputService,
  type CreateCustomerInputBody,
} from './customer-input.service';
import { ProjectPrdService, PRD_SECTION_NAMES, type GapAnswerInput } from './project-prd.service';
import { HldService } from './project-hld.service';
import { HldLibraryService } from './hld-library.service';
import { RequirementChangeService } from './requirement-change.service';
import { ArtifactFreshnessService } from './artifact-freshness.service';
import { ScreenMapService, type ScreenAnnotation } from './screen-map.service';
import { PipelineWireframeService } from './pipeline-wireframe.service';
import { DesignSystemService } from './design-system.service';
import { WireframeNavigatorService } from './wireframe-navigator.service';
import type { ReviewStatus } from './section-status';
import { ModuleReadinessService } from './module-readiness.service';
import { CodeTaskPlannerService } from './code-task-planner.service';
import { TestRunnerService, type TestRunKind } from './test-runner.service';
import { UpstreamSyncService } from './upstream-sync.service';
import { RunManagerService } from './agent/run-manager.service';
import type { AgentEvent } from './agent/agent-runner.interface';

/**
 * REST surface for the new Customer Discovery → PRD+FRD → HLD → Code pipeline.
 *
 * Customer Inputs  (Track B — S-03 stub)
 *   GET  /api/ba/projects/:id/customer-inputs
 *   POST /api/ba/projects/:id/customer-inputs
 *   DELETE /api/ba/projects/:id/customer-inputs/:inputId
 *
 * Project PRD + FRD  (Track C — S-03 stub)
 *   GET  /api/ba/projects/:id/project-prd
 *   POST /api/ba/projects/:id/project-prd/generate
 *
 * HLD  (Track E — S-03 stub)
 *   GET  /api/ba/projects/:id/hld
 *   POST /api/ba/projects/:id/hld/generate
 *
 * Project Implementation  (Track H + K — S-03 stub)
 *   GET  /api/ba/projects/:id/implementation
 *   POST /api/ba/projects/:id/implementation/run-prd
 *   POST /api/ba/projects/:id/implementation/run-dev
 */
@Controller('ba/projects/:id')
export class PipelineController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly customerInputs: CustomerInputService,
    private readonly projectPrd: ProjectPrdService,
    private readonly hld: HldService,
    private readonly hldLibrary: HldLibraryService,
    private readonly requirementChange: RequirementChangeService,
    private readonly freshness: ArtifactFreshnessService,
    private readonly screenMap: ScreenMapService,
    private readonly pipelineWireframes: PipelineWireframeService,
    private readonly designSystem: DesignSystemService,
    private readonly wireframeNavigator: WireframeNavigatorService,
    private readonly readiness: ModuleReadinessService,
    private readonly codeTasks: CodeTaskPlannerService,
    private readonly testRunner: TestRunnerService,
    private readonly upstreamSync: UpstreamSyncService,
    private readonly runManager: RunManagerService,
  ) {}

  // ── Customer Inputs (Track B) ───────────────────────────────────────────────

  @Get('customer-inputs')
  async listCustomerInputs(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.customerInputs.list(id);
    return { success: true, data };
  }

  @Get('customer-inputs/:inputId')
  async getCustomerInput(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('inputId', ParseUUIDPipe) inputId: string,
  ) {
    const data = await this.customerInputs.get(inputId);
    return { success: true, data };
  }

  /**
   * Create a customer input. Accepts an optional multipart `file` (for AUDIO,
   * EXTERNAL_BRD, CUSTOMER_WIREFRAME, DOCUMENT) plus body fields
   * { inputType, label?, text? }. TEXT_CONTEXT uses `text` and no file.
   */
  @Post('customer-inputs')
  @UseInterceptors(FileInterceptor('file'))
  async createCustomerInput(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCustomerInputBody,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.customerInputs.create(id, body, file);
    return { success: true, data };
  }

  /**
   * Re-run text extraction for a file-based input from its stored blob.
   * Recovers inputs whose `extractedText` is empty after a failed upload-time
   * extraction, so PRD generation can proceed without re-uploading.
   */
  @Post('customer-inputs/:inputId/re-extract')
  async reExtractCustomerInput(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('inputId', ParseUUIDPipe) inputId: string,
  ) {
    const data = await this.customerInputs.reExtract(inputId);
    return { success: true, data };
  }

  @Delete('customer-inputs/:inputId')
  async deleteCustomerInput(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('inputId', ParseUUIDPipe) inputId: string,
  ) {
    return this.customerInputs.delete(inputId);
  }

  // ── Project PRD + FRD (Track C) ─────────────────────────────────────────────

  @Get('project-prd')
  async getProjectPrd(@Param('id', ParseUUIDPipe) id: string) {
    // v7 — enriched with derived sectionStatuses + review map/progress.
    const data = await this.projectPrd.getLatestEnriched(id);
    return { success: true, data: data ?? null };
  }

  // ── v7 Track X — source (customer inputs the PRD was generated from) ──

  @Get('project-prd/source')
  async getProjectPrdSource(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.projectPrd.getSource(id);
    return { success: true, data };
  }

  @Get('project-prd/versions')
  async listProjectPrdVersions(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.projectPrd.list(id);
    return { success: true, data };
  }

  @Get('project-prd/version/:prdId')
  async getProjectPrdVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
  ) {
    const data = await this.projectPrd.get(prdId);
    return { success: true, data };
  }

  @Post('project-prd/generate')
  async generateProjectPrd(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.projectPrd.generate(id);
    return { success: true, data };
  }

  // ── S-05: gap-answering loop ────────────────────────────────────────────────

  @Get('project-prd/gaps')
  async getProjectPrdGaps(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.projectPrd.getGaps(id);
    return { success: true, data };
  }

  // ── V-02: canonical PRD markdown (for in-browser preview/download) ──

  @Get('project-prd/markdown')
  async getProjectPrdMarkdown(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.projectPrd.getMarkdown(id);
    return { success: true, data };
  }

  // ── T-02: forward-propagation freshness (downstream staleness vs latest PRD/HLD) ──

  @Get('freshness')
  async getFreshness(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.freshness.check(id);
    return { success: true, data };
  }

  @Post('project-prd/answer-gaps')
  async answerProjectPrdGaps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { answers: GapAnswerInput[] },
  ) {
    const data = await this.projectPrd.answerGaps(id, body.answers ?? []);
    return { success: true, data };
  }

  @Post('project-prd/:prdId/suggest-field')
  async suggestPrdField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
    @Body() body: { sectionKey: string; fieldName: string },
  ) {
    const data = await this.projectPrd.suggestField(prdId, body.sectionKey, body.fieldName);
    return { success: true, data };
  }

  // ── v7 Track W — version restore, review gate, confirm, metadata ──

  @Post('project-prd/:prdId/restore')
  async restoreProjectPrd(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
  ) {
    const data = await this.projectPrd.restore(prdId);
    return { success: true, data };
  }

  @Post('project-prd/:prdId/review/accept-all')
  async acceptAllPrdReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
  ) {
    const data = await this.projectPrd.acceptAllReview(prdId);
    return { success: true, data };
  }

  @Patch('project-prd/:prdId/review/:sectionKey')
  async setPrdReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
    @Param('sectionKey') sectionKey: string,
    @Body() body: { status: ReviewStatus },
  ) {
    const data = await this.projectPrd.setReviewStatus(prdId, sectionKey, body.status);
    return { success: true, data };
  }

  @Post('project-prd/:prdId/confirm')
  async confirmProjectPrd(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
  ) {
    const data = await this.projectPrd.confirm(prdId);
    return { success: true, data };
  }

  @Patch('project-prd/:prdId/meta')
  async updateProjectPrdMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
    @Body() body: { prdCode?: string; clientName?: string; submittedBy?: string },
  ) {
    const data = await this.projectPrd.updateMeta(prdId, body);
    return { success: true, data };
  }

  @Patch('project-prd/:prdId/section/:sectionKey')
  async updatePrdSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prdId', ParseUUIDPipe) prdId: string,
    @Param('sectionKey') sectionKey: string,
    @Body() body: { content: unknown },
  ) {
    const data = await this.projectPrd.updateSection(prdId, sectionKey, body.content);
    // I-01/I-02 — flag downstream impact of this requirement change.
    const impact = await this.requirementChange
      .analyzeChange(id, 'PRD', sectionKey, PRD_SECTION_NAMES[sectionKey] ?? `Section ${sectionKey}`, new Date().toISOString())
      .catch(() => null);
    return { success: true, data, impact };
  }

  // ── Screen ↔ Feature Mapping (Track Y — v8) ─────────────────────────────────

  @Get('screen-map')
  async getScreenMap(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.screenMap.getLatest(id);
    return { success: true, data: data ?? null };
  }

  @Get('screen-map/versions')
  async listScreenMapVersions(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.screenMap.list(id);
    return { success: true, data };
  }

  @Post('screen-map/generate')
  async generateScreenMap(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.screenMap.generate(id);
    return { success: true, data };
  }

  @Get('screen-map/export')
  async exportScreenMap(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.screenMap.toCsvString(id);
    return { success: true, data };
  }

  @Post('screen-map/import')
  async importScreenMap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { csv: string },
  ) {
    const data = await this.screenMap.importCsv(id, body.csv ?? '');
    return { success: true, data };
  }

  @Patch('screen-map/row/:rowId')
  async updateScreenMapRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body()
    body: Partial<{
      screenId: string;
      screenName: string;
      prdSections: string[];
      featureRefs: string[];
      featureDescription: string;
      businessRulesPrd: string;
      businessRulesArchitect: string;
      screenDescription: string;
      annotations: ScreenAnnotation[];
    }>,
  ) {
    const data = await this.screenMap.updateRow(rowId, body);
    return { success: true, data };
  }

  // ── PRD-sourced Wireframes (Track Z) ────────────────────────────────────────

  @Get('wireframes')
  async listPipelineWireframes(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipelineWireframes.listScreens(id);
    return { success: true, data };
  }

  @Get('wireframes/customer')
  async customerWireframes(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipelineWireframes.customerWireframes(id);
    return { success: true, data };
  }

  @Post('wireframes/generate-lofi')
  async generateLoFiWireframes(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipelineWireframes.generateLoFi(id);
    return { success: true, data };
  }

  @Post('wireframes/generate-hifi')
  async generateHiFiWireframes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { slugs?: string[]; limit?: number } = {},
    @Query('limit') limit?: string,
  ) {
    const q = limit ? Number(limit) : undefined;
    const n = body.limit ?? (q && Number.isFinite(q) && q > 0 ? Math.floor(q) : undefined);
    const data = await this.pipelineWireframes.generateHiFi(id, {
      slugs: Array.isArray(body.slugs) && body.slugs.length ? body.slugs : undefined,
      limit: n,
    });
    return { success: true, data };
  }

  @Post('wireframes/regenerate-lofi-ai')
  async regenerateLoFiAi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { slugs?: string[] } = {},
  ) {
    const data = await this.pipelineWireframes.regenerateLoFiWithAI(
      id,
      Array.isArray(body.slugs) && body.slugs.length ? body.slugs : undefined,
    );
    return { success: true, data };
  }

  @Post('wireframes/screen-variant')
  async setWireframeScreenVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { slug: string; variant: 'deterministic' | 'ai' },
  ) {
    if (!body?.slug) throw new BadRequestException('slug is required.');
    const data = await this.pipelineWireframes.setScreenVariant(
      id,
      body.slug,
      body.variant === 'ai' ? 'ai' : 'deterministic',
    );
    return { success: true, data };
  }

  @Post('wireframes/upload')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadWireframes(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('kind') kind?: string,
  ) {
    const data = await this.pipelineWireframes.upload(
      id,
      (files ?? []).map((f) => ({ originalname: f.originalname, buffer: f.buffer, mimetype: f.mimetype })),
      kind === 'hifi' ? 'hifi' : 'lofi',
    );
    return { success: true, data };
  }

  @Get('wireframes/navigator')
  async getWireframeNavigator(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('kind') kind?: string,
  ) {
    const data = await this.wireframeNavigator.buildHtml(id, kind === 'hifi' ? 'hifi' : 'lofi');
    return { success: true, data };
  }

  @Get('wireframes/export-zip')
  async exportWireframeZip(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @Query('kind') kind?: string,
  ) {
    const { fileName, buffer } = await this.wireframeNavigator.buildZip(id, kind === 'hifi' ? 'hifi' : 'lofi');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  // ── Design System / Look & Feel Studio (Track BB) ───────────────────────────

  @Get('design-system')
  async getDesignSystem(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.designSystem.getActive(id);
    return { success: true, data: data ?? null };
  }

  @Put('design-system')
  async saveDesignSystem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { tokens: unknown; logo?: { dataUri: string; fileName: string; mimeType: string } | null; presetId?: string | null },
  ) {
    const data = await this.designSystem.save(id, body.tokens, body.logo ?? null, body.presetId ?? null);
    return { success: true, data };
  }

  @Post('design-system/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDesignLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No logo file uploaded.');
    const data = this.designSystem.processLogo({ originalname: file.originalname, buffer: file.buffer, mimetype: file.mimetype });
    return { success: true, data };
  }

  @Post('design-system/preview')
  async previewDesignSystem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { tokens?: unknown; platform?: string },
  ) {
    const html = await this.designSystem.preview(
      id,
      body.platform === 'mobile' ? 'mobile' : 'web',
      body.tokens,
    );
    return { success: true, data: html };
  }

  @Get('design-presets')
  async listDesignPresets(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.designSystem.listPresets(id);
    return { success: true, data };
  }

  @Get('design-presets/:presetId')
  async getDesignPreset(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('presetId', ParseUUIDPipe) presetId: string,
  ) {
    const data = await this.designSystem.getPresetTokens(presetId);
    return { success: true, data };
  }

  @Post('design-presets')
  async saveDesignPreset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name: string; tokens: unknown; scope?: string },
  ) {
    const data = await this.designSystem.saveAsPreset(
      body.name,
      body.tokens,
      body.scope === 'PROJECT' ? 'PROJECT' : 'GLOBAL',
      id,
    );
    return { success: true, data };
  }

  @Post('design-system/import-references')
  @UseInterceptors(FilesInterceptor('files', 60))
  async importDesignReferences(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const data = await this.designSystem.importReferences(
      id,
      (files ?? []).map((f) => ({ originalname: f.originalname, buffer: f.buffer, mimetype: f.mimetype })),
    );
    return { success: true, data };
  }

  // ── HLD (Track E) ───────────────────────────────────────────────────────────

  @Get('hld')
  async getHld(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.hld.getLatest(id);
    return { success: true, data: data ?? null };
  }

  @Get('hld/versions')
  async listHldVersions(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.hld.list(id);
    return { success: true, data };
  }

  @Get('hld/project-structure')
  async getProjectStructure(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.hld.buildProjectStructure(id);
    return { success: true, data };
  }

  // HE-05 — canonical HLD markdown (for in-browser preview/download, mirrors PRD)
  @Get('hld/markdown')
  async getHldMarkdown(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.hld.getMarkdown(id);
    return { success: true, data };
  }

  @Post('hld/generate')
  async generateHld(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.hld.generate(id);
    // HD-10 — best-effort: index the new HLD into the org-wide repository.
    void this.hldLibrary.indexHld(data.id).catch(() => undefined);
    return { success: true, data };
  }

  @Patch('hld/:hldId/section/:sectionKey')
  async updateHldSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Param('sectionKey') sectionKey: string,
    @Body() body: { content: unknown },
  ) {
    const data = await this.hld.updateSection(hldId, sectionKey, body.content);
    // I-01/I-02 — flag downstream impact of this requirement change.
    const impact = await this.requirementChange
      .analyzeChange(id, 'HLD', sectionKey, humanizeKey(sectionKey), new Date().toISOString())
      .catch(() => null);
    return { success: true, data, impact };
  }

  // ── Project Folders (A-06) ──────────────────────────────────────────────────

  @Get('folders')
  async getFolderStatus(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipeline.getFolderStatus(id);
    return { success: true, data: data ?? null };
  }

  @Post('folders/ensure')
  async ensureFolders(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipeline.ensureFolders(id);
    return { success: true, data: data ?? null };
  }

  // ── Context Engineering ─────────────────────────────────────────────────────

  @Post('context/seed')
  async seedContext(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipeline.seedContext(id);
    return { success: true, data: data ?? null };
  }

  // ── Module-scoped code-gen readiness (Track N) ──────────────────────────────

  /**
   * N-02 — list every module with its code-gen readiness. Only modules whose
   * `ready` flag is true may run `/prd` `/dev`; the rest carry a `missing` list
   * so the UI can explain why they're disabled.
   */
  @Get('code/modules')
  async listCodeModules(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.readiness.getProjectReadiness(id);
    return { success: true, data: data ?? null };
  }

  /**
   * O-02 — (re)generate a module's code-task plan from its sub-tasks. Tasks are
   * topologically ordered by subtask prerequisites and linked to subtask(s) +
   * pseudo file(s). This is the "Generate Plan" (`/prd`) action.
   */
  @Post('code/modules/:moduleDbId/tasks/plan')
  async planCodeTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
  ) {
    const data = await this.codeTasks.generatePlan(id, moduleDbId);
    return { success: true, data };
  }

  /** O-03 — list a module's code tasks in execution order. */
  @Get('code/modules/:moduleDbId/tasks')
  async listCodeTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
  ) {
    const data = await this.codeTasks.listTasks(id, moduleDbId);
    return { success: true, data };
  }

  /**
   * P-01 — run ALL pending/failed tasks for a module via /dev, in sequence.
   * Returns a runId; open the SSE stream to watch per-task status live.
   */
  @Post('code/modules/:moduleDbId/tasks/run')
  async runAllCodeTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
  ) {
    const runId = await this.runManager.startCodeRun(id, moduleDbId, 'all');
    return { success: true, data: { runId } };
  }

  /** P-01 — run a SINGLE task by its taskKey (e.g. TASK-MOD-01-003) via /dev. */
  @Post('code/modules/:moduleDbId/tasks/:taskKey/run')
  async runSingleCodeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
    @Param('taskKey') taskKey: string,
  ) {
    const runId = await this.runManager.startCodeRun(id, moduleDbId, 'single', taskKey);
    return { success: true, data: { runId } };
  }

  // ── Tests (Track P/Q — two-tier code-gen tests + history) ───────────────────

  /** P-03 — run the module's DEV unit tests in ProjectSourceCode/, record result. */
  @Post('code/modules/:moduleDbId/tests/dev/run')
  async runDevTests(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
    @Body() body: { command?: string },
  ) {
    const data = await this.testRunner.runDevTests(id, moduleDbId, { command: body?.command });
    return { success: true, data };
  }

  /** P-03 / Q-03 — test-run history for a module (optionally filtered by kind). */
  @Get('code/modules/:moduleDbId/tests')
  async listTestRuns(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
    @Query('kind') kind?: string,
  ) {
    const k = kind === 'DEV' || kind === 'FTC' ? (kind as TestRunKind) : undefined;
    const data = await this.testRunner.listRuns(id, moduleDbId, k);
    return { success: true, data };
  }

  /** Q-02 — run the module's FTC-derived Playwright tests, record result. */
  @Post('code/modules/:moduleDbId/tests/ftc/run')
  async runFtcTests(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
    @Body() body: { command?: string },
  ) {
    const data = await this.testRunner.runFtcTests(id, moduleDbId, { command: body?.command });
    return { success: true, data };
  }

  /** Q-02 — FTC basis (case count + frameworks) for the module's FTC panel. */
  @Get('code/modules/:moduleDbId/tests/ftc/summary')
  async ftcSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
  ) {
    const data = await this.testRunner.getFtcSummary(id, moduleDbId);
    return { success: true, data };
  }

  // ── Upstream sync (Track P-04/P-05 + J — dynamic files → upstream review) ────

  /** List the module's downstream→upstream drafts (optionally only PENDING). */
  @Get('code/modules/:moduleDbId/upstream-sync')
  async listUpstreamSync(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
    @Query('pending') pending?: string,
  ) {
    const data = await this.upstreamSync.list(id, moduleDbId, pending === 'true');
    return { success: true, data };
  }

  /** Approve a draft → apply upstream (LLD + sub-task + CHANGELOG + RTM). */
  @Post('code/modules/:moduleDbId/upstream-sync/:syncId/approve')
  async approveUpstreamSync(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('moduleDbId', ParseUUIDPipe) _moduleDbId: string,
    @Param('syncId', ParseUUIDPipe) syncId: string,
    @Body() body: { note?: string },
  ) {
    const data = await this.upstreamSync.approve(syncId, body?.note);
    return { success: true, data };
  }

  /** Reject a draft (no upstream change applied). */
  @Post('code/modules/:moduleDbId/upstream-sync/:syncId/reject')
  async rejectUpstreamSync(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('moduleDbId', ParseUUIDPipe) _moduleDbId: string,
    @Param('syncId', ParseUUIDPipe) syncId: string,
    @Body() body: { note?: string },
  ) {
    const data = await this.upstreamSync.reject(syncId, body?.note);
    return { success: true, data };
  }

  // ── Source Code Scaffold (Track H) ──────────────────────────────────────────

  @Post('implementation/scaffold')
  async scaffoldSourceCode(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipeline.scaffoldSourceCode(id);
    return { success: true, data };
  }

  // ── Agentic skill runs (K-03 streaming · K-04 permissions) ───────────────────

  /** Start a skill run; returns a runId. Open the SSE stream below to watch it. */
  @Post('implementation/run')
  async startRun(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { skillId: string; subtask?: string; moduleDbId?: string },
  ) {
    const runId = await this.runManager.start(id, body.skillId, body.subtask, body.moduleDbId);
    return { success: true, data: { runId } };
  }

  /** SSE stream of live agent events (logs, tool calls, file edits, permissions). */
  @Sse('implementation/run/:runId/stream')
  streamRun(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Observable<{ data: AgentEvent }> {
    return this.runManager.stream(runId).pipe(map((e) => ({ data: e })));
  }

  /** Resolve a permission request raised mid-run (UI approve/deny). */
  @Post('implementation/run/:runId/permission')
  resolvePermission(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() body: { requestId: string; allow: boolean; message?: string },
  ) {
    this.runManager.resolvePermission(runId, body.requestId, {
      allow: body.allow,
      message: body.message,
    });
    return { success: true };
  }

  // ── Project Implementation ─────────────────────────────────────────────────

  @Get('implementation')
  async getImplementation(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.pipeline.getImplementation(id);
    return { success: true, data: data ?? null };
  }

  @Post('implementation/run-prd')
  async runPrd(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'stub — /prd skill invocation not yet wired',
      projectId: id,
    };
  }

  @Post('implementation/run-dev')
  async runDev(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return {
      success: true,
      message: 'stub — /dev skill invocation not yet wired',
      projectId: id,
      subtaskId: body.subtaskId ?? null,
    };
  }
}

/** camelCase HLD section key → "Title Case" label (e.g. "authDesign" → "Auth Design"). */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}
