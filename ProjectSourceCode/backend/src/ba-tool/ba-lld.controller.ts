import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Param,
  Body,
  Res,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BaLldService, LldConfigPayload } from './ba-lld.service';
import { BaLldNarrativeService, MAX_TOTAL_ATTACHMENT_BYTES } from './ba-lld-narrative.service';
import { BaLldParserService } from './ba-lld-parser.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';
import { BaUnitTestExportService } from './ba-unit-test-export.service';
import { BaContractTestExportService } from './ba-contract-test-export.service';
import { BaOpenApiExportService } from './ba-openapi-export.service';
import { BaLldRtmService } from './ba-lld-rtm.service';

@Controller('ba')
export class BaLldController {
  constructor(
    private readonly lld: BaLldService,
    private readonly orchestrator: BaSkillOrchestratorService,
    private readonly narrative: BaLldNarrativeService,
    private readonly lldParser: BaLldParserService,
    private readonly unitTestExport: BaUnitTestExportService,
    private readonly contractTestExport: BaContractTestExportService,
    private readonly openapiExport: BaOpenApiExportService,
    private readonly rtm: BaLldRtmService,
  ) {}

  // ─── OpenAPI / Swagger for the customer's target app (derived from LLD) ──

  /** GET /api/ba/lld-artifacts/:id/openapi.json — raw OpenAPI 3.0 JSON for one LLD. */
  @Get('lld-artifacts/:id/openapi.json')
  async openapiJson(@Param('id') lldArtifactDbId: string, @Res() res: Response) {
    const { spec } = await this.openapiExport.buildModuleSpec(lldArtifactDbId);
    res.set({ 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(spec, null, 2));
  }

  /** GET /api/ba/lld-artifacts/:id/openapi.yaml — YAML flavour of the same spec. */
  @Get('lld-artifacts/:id/openapi.yaml')
  async openapiYaml(@Param('id') lldArtifactDbId: string, @Res() res: Response) {
    const { spec, filenameStem } = await this.openapiExport.buildModuleSpec(lldArtifactDbId);
    res.set({
      'Content-Type': 'text/yaml; charset=utf-8',
      'Content-Disposition': `inline; filename="${filenameStem}.yaml"`,
    });
    res.end(this.openapiExport.toYaml(spec));
  }

  /** GET /api/ba/lld-artifacts/:id/swagger — live Swagger UI HTML for one LLD. */
  @Get('lld-artifacts/:id/swagger')
  async swaggerModule(@Param('id') lldArtifactDbId: string, @Res() res: Response) {
    const { spec } = await this.openapiExport.buildModuleSpec(lldArtifactDbId);
    const specUrl = `/api/ba/lld-artifacts/${lldArtifactDbId}/openapi.json`;
    const pageTitle = (spec.info as { title?: string } | undefined)?.title ?? 'API';
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.end(this.openapiExport.swaggerUiHtml(specUrl, pageTitle));
  }

  /**
   * D1 — GET /api/ba/lld-artifacts/:id/unit-tests-zip
   * Download a ZIP of runnable unit-test scaffolds (pytest / Jest / JUnit)
   * derived from the LLD's pseudo-code files. Deterministic codegen, no AI.
   */
  @Get('lld-artifacts/:id/unit-tests-zip')
  async exportUnitTestsZip(@Param('id') lldArtifactDbId: string, @Res() res: Response) {
    const { buffer, filename } = await this.unitTestExport.buildZip(lldArtifactDbId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * D2 — GET /api/ba/lld-artifacts/:id/contract-tests-zip
   * Download contract-test scaffolds between service layers identified in
   * the LLD. Detects provider definitions + consumer callsites, pairs them,
   * flags orphans in UNRESOLVED_CONTRACTS.md. Emits Jest+msw + pytest+respx
   * scaffolds plus an OpenAPI 3.0 stub.
   */
  @Get('lld-artifacts/:id/contract-tests-zip')
  async exportContractTestsZip(@Param('id') lldArtifactDbId: string, @Res() res: Response) {
    const { buffer, filename } = await this.contractTestExport.buildZip(lldArtifactDbId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/modules/:id/lld/config — load saved Architect selections */
  @Get('modules/:id/lld/config')
  getConfig(@Param('id') moduleDbId: string) {
    return this.lld.getConfig(moduleDbId);
  }

  /** PUT /api/ba/modules/:id/lld/config — upsert Architect selections */
  @Put('modules/:id/lld/config')
  saveConfig(@Param('id') moduleDbId: string, @Body() payload: LldConfigPayload) {
    return this.lld.saveConfig(moduleDbId, payload);
  }

  /** POST /api/ba/modules/:id/generate-lld — trigger SKILL-06-LLD */
  @Post('modules/:id/generate-lld')
  async generate(@Param('id') moduleDbId: string) {
    const executionId = await this.orchestrator.executeSkill(moduleDbId, 'SKILL-06-LLD');
    return { executionId, skill: 'SKILL-06-LLD', status: 'RUNNING' };
  }

  /**
   * GET /api/ba/modules/:id/lld/validate — deterministic completeness check.
   * No AI call — scans the stored artifact and reports missing/thin sections,
   * pseudo-file shortfall, and features without pseudo-file coverage. The UI
   * uses this to surface gaps after a generation run and offer per-section
   * regeneration buttons.
   */
  @Get('modules/:id/lld/validate')
  async validateLld(@Param('id') moduleDbId: string) {
    const artifact = await this.lld.getLldArtifact(moduleDbId);
    if (!artifact) {
      throw new BadRequestException(`No LLD artifact for module ${moduleDbId}. Click "Generate LLD" first.`);
    }
    return this.lldParser.validateCompleteness(artifact.id);
  }

  /**
   * POST /api/ba/modules/:id/execute/SKILL-06-LLD/section/:sectionKey — focused
   * AI call to regenerate ONE LLD section without re-running the entire 19-
   * section document. Use this to fill gaps reported by /lld/validate.
   * Idempotent: if the section is human-modified, the call short-circuits.
   * Cost: ~$0.05 per call vs ~$0.50 for a full Generate LLD re-run.
   */
  @Post('modules/:id/execute/SKILL-06-LLD/section/:sectionKey')
  async executeSkill06ForSection(
    @Param('id') moduleDbId: string,
    @Param('sectionKey') sectionKey: string,
  ) {
    return this.orchestrator.executeSkill06ForSection(moduleDbId, sectionKey);
  }

  /**
   * POST /api/ba/modules/:id/execute/SKILL-06-LLD/feature/:featureId — focused
   * AI call to generate the missing pseudo-files for ONE feature on the
   * existing LLD artifact. Mirrors the per-feature pattern used by FTC mode 2c
   * but produces pseudo-files (controller / service / DTOs / entity / SQL
   * migration / TBD stubs / frontend / tests) instead of test cases. Driven
   * by the structured BaSubTask rows for the feature so the AI knows which
   * classes/methods to scaffold. Idempotent — skips when the feature already
   * has comprehensive coverage (≥4 files including a backend service AND
   * controller). Cost: ~$0.10 per call.
   */
  @Post('modules/:id/execute/SKILL-06-LLD/feature/:featureId')
  async executeSkill06ForFeature(
    @Param('id') moduleDbId: string,
    @Param('featureId') featureId: string,
  ) {
    if (!/^F-\d+-\d+$/.test(featureId)) {
      throw new BadRequestException(`Invalid featureId "${featureId}". Expected F-NN-NN.`);
    }
    return this.orchestrator.executeSkill06ForFeature(moduleDbId, featureId);
  }

  /**
   * POST /api/ba/modules/:id/execute/SKILL-06-LLD/diagrams — focused AI call
   * to refresh the four module-level Mermaid diagrams (Module Dependency
   * Graph, Class Diagram, Sequence Diagrams, Schema Diagram) so they reflect
   * the current pseudo-file / data-model surface. Use this after running
   * mode 06c (per-feature pseudo-file regen) to close the drift between
   * pseudo-files and diagrams. Idempotent — sections marked human-modified
   * are preserved; if all four are human-modified the AI call is skipped.
   * Cost: ~$0.05 per call.
   */
  @Post('modules/:id/execute/SKILL-06-LLD/diagrams')
  async executeSkill06ForDiagrams(@Param('id') moduleDbId: string) {
    return this.orchestrator.executeSkill06ForDiagrams(moduleDbId);
  }

  // ─── Narrative + attachments + gap-check ──────────────────────────────

  /** GET /api/ba/modules/:id/lld/attachments — list architect attachments */
  @Get('modules/:id/lld/attachments')
  listAttachments(@Param('id') moduleDbId: string) {
    return this.narrative.listAttachments(moduleDbId);
  }

  /**
   * POST /api/ba/modules/:id/lld/attachments — upload architect attachments.
   * Per-file cap 30 MB (multer), total cap 30 MB across all attachments
   * (re-enforced in the service).
   */
  @Post('modules/:id/lld/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_TOTAL_ATTACHMENT_BYTES },
    }),
  )
  async uploadAttachments(
    @Param('id') moduleDbId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files in request');
    return this.narrative.uploadAttachments(
      moduleDbId,
      files.map((f) => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        buffer: f.buffer,
      })),
    );
  }

  /** DELETE /api/ba/modules/:id/lld/attachments/:attachmentId */
  @Delete('modules/:id/lld/attachments/:attachmentId')
  deleteAttachment(
    @Param('id') moduleDbId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.narrative.deleteAttachment(moduleDbId, attachmentId);
  }

  /** POST /api/ba/modules/:id/lld/gap-check — structured gap list against the current narrative */
  @Post('modules/:id/lld/gap-check')
  gapCheck(@Param('id') moduleDbId: string) {
    return this.narrative.gapCheck(moduleDbId);
  }

  /** GET /api/ba/modules/:id/lld — fetch the current LLD artifact (or null) */
  @Get('modules/:id/lld')
  async getLld(@Param('id') moduleDbId: string) {
    const artifact = await this.lld.getLldArtifact(moduleDbId);
    if (!artifact) return { artifact: null, pseudoFiles: [] };
    const pseudoFiles = await this.lld.listPseudoFiles(artifact.id);
    return { artifact, pseudoFiles };
  }

  /** GET /api/ba/modules/:id/llds — list every LLD artifact (all stacks) for this module */
  @Get('modules/:id/llds')
  listLlds(@Param('id') moduleDbId: string) {
    return this.lld.listLldArtifactsForModule(moduleDbId);
  }

  /** GET /api/ba/modules/:id/lld/pseudo-files — list pseudo-files for this module's LLD */
  @Get('modules/:id/lld/pseudo-files')
  async listPseudoFiles(@Param('id') moduleDbId: string) {
    const artifact = await this.lld.getLldArtifact(moduleDbId);
    if (!artifact) return [];
    return this.lld.listPseudoFiles(artifact.id);
  }

  /** GET /api/ba/artifacts/:id/pseudo-files — list pseudo-files for an LLD artifact */
  @Get('artifacts/:id/pseudo-files')
  listPseudoFilesByArtifact(@Param('id') artifactDbId: string) {
    return this.lld.listPseudoFiles(artifactDbId);
  }

  /** GET /api/ba/pseudo-files/:id — fetch one pseudo-file */
  @Get('pseudo-files/:id')
  getPseudoFile(@Param('id') id: string) {
    return this.lld.getPseudoFile(id);
  }

  /** PUT /api/ba/pseudo-files/:id — save edited content + flag human-modified */
  @Put('pseudo-files/:id')
  updatePseudoFile(
    @Param('id') id: string,
    @Body() body: { editedContent: string },
  ) {
    if (typeof body?.editedContent !== 'string') {
      throw new BadRequestException('editedContent is required');
    }
    return this.lld.updatePseudoFile(id, body.editedContent);
  }

  // ─── Downloads ────────────────────────────────────────────────────────

  /** GET /api/ba/pseudo-files/:id/download — single pseudo-file as attachment */
  @Get('pseudo-files/:id/download')
  async downloadPseudoFile(@Param('id') id: string, @Res() res: Response) {
    const { content, filename, language } = await this.lld.getPseudoFileDownload(id);
    res.set({
      'Content-Type': mimeFor(language),
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(content);
  }

  /** GET /api/ba/artifacts/:id/pseudo-files/zip — all pseudo-files + Section 16 placeholders */
  @Get('artifacts/:id/pseudo-files/zip')
  async downloadPseudoFilesZip(@Param('id') artifactDbId: string, @Res() res: Response) {
    const { buffer, filename } = await this.lld.buildPseudoFilesZip(artifactDbId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/artifacts/:id/project-structure/zip — Section 16 tree as empty placeholders */
  @Get('artifacts/:id/project-structure/zip')
  async downloadProjectStructureZip(@Param('id') artifactDbId: string, @Res() res: Response) {
    const { buffer, filename } = await this.lld.buildProjectStructureZip(artifactDbId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ─── LLD RTM (Module-SubTask-LLD-RTM checklist) ──────────────────────
  //
  // Five endpoints serve the RTM deliverable bundle for an LLD artifact:
  //
  //   GET .../rtm-html               Self-contained Swagger-like explorer
  //   GET .../rtm-csv                Flat one-row-per-(subtask × file) CSV
  //   GET .../rtm-tree               ASCII project tree with annotations
  //   GET .../rtm-schema-sql         Consolidated DB schema (concatenated)
  //   GET .../rtm-impl-status-csv    Developer-facing impl-tracking CSV
  //                                  (workstream 3, Option A: a starter
  //                                  template the dev team fills in)
  //   GET .../rtm-bundle             ZIP of all five (one customer download)
  //
  // All accept an optional ?feature=F-XX-YY query param to scope to one
  // feature for a focused review. All return immediately from in-memory
  // synthesis — no DB writes.

  /** GET /api/ba/artifacts/:id/rtm-html — interactive RTM explorer (download) */
  @Get('artifacts/:id/rtm-html')
  async rtmHtml(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const result = await this.rtm.buildRtm(lldArtifactId, { featureFilter });
    const tree = this.rtm.emitTree(result.rows, result.module.moduleId);
    const html = this.rtm.emitHtml(
      { moduleId: result.module.moduleId, moduleName: result.module.moduleName },
      result.rows,
      tree,
      result.stats,
      { lldArtifactId, apiBase: this.deriveApiBase(res) },
    );
    const stem = this.rtmStem(result.module.moduleId, featureFilter);
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stem}.html"`,
    });
    res.end(html);
  }

  /**
   * GET /api/ba/artifacts/:id/rtm-html-inline — same HTML payload as
   * rtm-html but rendered inline in the browser (no Content-Disposition:
   * attachment). Use this from a "View RTM" link so the page renders
   * same-origin with the backend, sidestepping CORS for the per-row
   * "Generate file" buttons. The downloaded rtm-html bundle works too,
   * thanks to CORS allowing Origin: null + IDs baked into the JS — this
   * inline endpoint is simply the cleaner default for live viewing.
   */
  @Get('artifacts/:id/rtm-html-inline')
  async rtmHtmlInline(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const result = await this.rtm.buildRtm(lldArtifactId, { featureFilter });
    const tree = this.rtm.emitTree(result.rows, result.module.moduleId);
    const html = this.rtm.emitHtml(
      { moduleId: result.module.moduleId, moduleName: result.module.moduleName },
      result.rows,
      tree,
      result.stats,
      { lldArtifactId, apiBase: this.deriveApiBase(res) },
    );
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  /** GET /api/ba/artifacts/:id/rtm-csv — flat tabular RTM */
  @Get('artifacts/:id/rtm-csv')
  async rtmCsv(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const result = await this.rtm.buildRtm(lldArtifactId, { featureFilter });
    const csv = this.rtm.emitCsv(result.rows);
    const stem = this.rtmStem(result.module.moduleId, featureFilter);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stem}.csv"`,
    });
    res.end(csv);
  }

  /** GET /api/ba/artifacts/:id/rtm-tree — ASCII project tree */
  @Get('artifacts/:id/rtm-tree')
  async rtmTree(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const result = await this.rtm.buildRtm(lldArtifactId, { featureFilter });
    const tree = this.rtm.emitTree(result.rows, result.module.moduleId);
    const stem = this.rtmStem(result.module.moduleId, featureFilter);
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stem}-tree.txt"`,
    });
    res.end(tree);
  }

  /** GET /api/ba/artifacts/:id/rtm-schema-sql — consolidated DB schema */
  @Get('artifacts/:id/rtm-schema-sql')
  async rtmSchemaSql(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const result = await this.rtm.buildRtm(lldArtifactId, { featureFilter });
    const stem = `LLD-${result.module.moduleId}-schema`;
    res.set({
      'Content-Type': 'application/sql; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stem}.sql"`,
    });
    res.end(result.consolidatedSchema || '-- (no migration files found for this module)\n');
  }

  /** GET /api/ba/artifacts/:id/rtm-impl-status-csv — developer impl tracker */
  @Get('artifacts/:id/rtm-impl-status-csv')
  async rtmImplStatusCsv(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const result = await this.rtm.buildRtm(lldArtifactId, { featureFilter });
    const csv = this.rtm.emitImplStatusCsv(result.rows);
    const stem = this.rtmStem(result.module.moduleId, featureFilter);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stem}-impl-status.csv"`,
    });
    res.end(csv);
  }

  /** GET /api/ba/artifacts/:id/rtm-bundle — ZIP of all five RTM artifacts */
  @Get('artifacts/:id/rtm-bundle')
  async rtmBundle(@Param('id') lldArtifactId: string, @Res() res: Response): Promise<void> {
    const featureFilter = this.parseFeatureParam(res);
    const { zip, stem } = await this.rtm.buildBundleZip(
      lldArtifactId,
      { featureFilter },
      { apiBase: this.deriveApiBase(res) },
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${stem}-bundle.zip"`,
      'Content-Length': zip.length,
    });
    res.end(zip);
  }

  /**
   * POST /api/ba/artifacts/:id/rtm/generate-missing-file
   *
   * Workstream 4 framework — auto-fix for an RTM ToDo row.
   * Body: { subtaskId: string, filePath: string }
   *
   * v1 implementation: resolves the subtask's featureId and delegates to
   * the existing idempotent `executeSkill06ForFeature` method. That fires
   * the AI for the whole feature but skips any pseudo-files already
   * present — so the net effect is the missing file gets generated
   * (alongside any other gaps in that feature). Over-generates relative
   * to a true per-file fast-path, but keeps the framework working today
   * without bespoke prompt engineering. A focused per-file method can
   * land later if perf becomes a pain point.
   */
  @Post('artifacts/:id/rtm/generate-missing-file')
  async rtmGenerateMissingFile(
    @Param('id') lldArtifactId: string,
    @Body() body: { subtaskId?: string; filePath?: string },
  ): Promise<ReturnType<BaLldRtmService['generateMissingFile']>> {
    try {
      return await this.rtm.generateMissingFile({
        lldArtifactId,
        subtaskId: body?.subtaskId ?? '',
        filePath: body?.filePath ?? '',
      });
    } catch (e: any) {
      // BadRequest/NotFound already carry a useful payload — re-throw them
      // so the UI alert() shows the precise rule that failed. For unknown
      // errors (AI timeout, DB constraint, network), wrap with a 400 that
      // includes the underlying message so users don't see "Internal server
      // error" with no clue.
      const status = e?.status ?? e?.response?.statusCode ?? 500;
      if (status >= 400 && status < 500) throw e;
      const msg = e?.response?.data?.message || e?.message || 'Unknown error';
      // eslint-disable-next-line no-console
      console.error(`[rtmGenerateMissingFile] failed: ${msg}`);
      if (e?.stack) console.error(e.stack.split('\n').slice(0, 8).join('\n'));
      throw new BadRequestException(`generate-missing-file failed: ${msg}`);
    }
  }

  /**
   * Pull `feature` from the request query string. Nest's @Query() decorator
   * would be cleaner but we already use @Res() (manual response) on every
   * endpoint here, so we read directly off res.req.
   */
  private parseFeatureParam(res: Response): string | undefined {
    const raw = (res.req?.query?.feature ?? '') as string;
    const trimmed = String(raw).trim();
    if (!trimmed) return undefined;
    // Accept F-XX-YY format (case-insensitive). Reject anything else so
    // we don't silently embed user input in filenames.
    if (!/^F-\d+-\d+$/i.test(trimmed)) {
      throw new BadRequestException(`feature must match F-XX-YY (got "${trimmed}")`);
    }
    return trimmed.toUpperCase();
  }

  private rtmStem(moduleId: string, featureFilter: string | undefined): string {
    return featureFilter
      ? `LLD-${moduleId}-${featureFilter}-rtm`
      : `LLD-${moduleId}-rtm`;
  }

  /**
   * Construct the backend's public origin (`http://localhost:4000` style)
   * from the inbound request so the RTM HTML's baked-in `__LLD_API_BASE`
   * matches wherever this server is currently reachable. Falls back to
   * the env `PUBLIC_API_URL` or the conventional dev default.
   *
   * Express's `req.protocol` + `req.get('host')` handles localhost AND
   * any reverse-proxy-set Host header — we don't hardcode :4000 because
   * a future Docker / cloud deploy might serve through a different port.
   */
  private deriveApiBase(res: Response): string {
    const req = res.req;
    if (req) {
      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim()
        ?? req.protocol
        ?? 'http';
      const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim()
        ?? req.get?.('host')
        ?? req.headers.host;
      if (host) return `${proto}://${host}`;
    }
    return process.env.PUBLIC_API_URL ?? 'http://localhost:4000';
  }
}

// Language → MIME mapping for per-file downloads. Defaults to text/plain.
function mimeFor(language: string): string {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
    case 'tsx':
    case 'jsx':
      return 'text/javascript; charset=utf-8';
    case 'python':
      return 'text/x-python; charset=utf-8';
    case 'java':
      return 'text/x-java-source; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'yaml':
    case 'yml':
      return 'text/yaml; charset=utf-8';
    case 'html':
      return 'text/html; charset=utf-8';
    case 'css':
      return 'text/css; charset=utf-8';
    case 'sql':
      return 'application/sql; charset=utf-8';
    default:
      return 'text/plain; charset=utf-8';
  }
}
