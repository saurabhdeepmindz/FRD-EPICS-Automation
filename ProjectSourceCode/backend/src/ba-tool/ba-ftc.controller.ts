import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { BaFtcService, FtcConfigPayload } from './ba-ftc.service';
import { BaFtcNarrativeService } from './ba-ftc-narrative.service';
import { BaAcCoverageService } from './ba-ac-coverage.service';
import { BaPlaywrightExportService } from './ba-playwright-export.service';
import { MAX_TOTAL_ATTACHMENT_BYTES } from './ba-narrative.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';

@Controller('ba')
export class BaFtcController {
  constructor(
    private readonly ftc: BaFtcService,
    private readonly narrative: BaFtcNarrativeService,
    private readonly orchestrator: BaSkillOrchestratorService,
    private readonly acCoverage: BaAcCoverageService,
    private readonly playwrightExport: BaPlaywrightExportService,
  ) {}

  /** GET /api/ba/modules/:id/ftc/config — load saved FTC selections */
  @Get('modules/:id/ftc/config')
  getConfig(@Param('id') moduleDbId: string) {
    return this.ftc.getConfig(moduleDbId);
  }

  /** PUT /api/ba/modules/:id/ftc/config — upsert FTC selections */
  @Put('modules/:id/ftc/config')
  saveConfig(@Param('id') moduleDbId: string, @Body() payload: FtcConfigPayload) {
    return this.ftc.saveConfig(moduleDbId, payload);
  }

  /** POST /api/ba/modules/:id/generate-ftc — trigger SKILL-07-FTC */
  @Post('modules/:id/generate-ftc')
  async generate(@Param('id') moduleDbId: string) {
    const executionId = await this.orchestrator.executeSkill(moduleDbId, 'SKILL-07-FTC');
    return { executionId, skill: 'SKILL-07-FTC', status: 'RUNNING' };
  }

  // ─── Per-feature FTC append-mode (mirrors SKILL-05 per-story) ─────
  //
  // Single-shot SKILL-07-FTC consistently caps at ~10-15 test cases for
  // one feature group due to the AI's output token budget. To get full
  // module coverage (~80-100 TCs across all features), drive this loop:
  //   1. GET .../ftc-features  → list of feature IDs
  //   2. POST .../execute/SKILL-07-FTC/feature/:featureId  per feature
  // Each call appends parsed TCs to the same FTC artifact.

  /** GET /api/ba/modules/:id/ftc-features — enumerate features for the per-feature loop */
  @Get('modules/:id/ftc-features')
  listFeaturesForFtc(@Param('id') moduleDbId: string) {
    return this.orchestrator.listFeaturesForFtc(moduleDbId);
  }

  /** POST /api/ba/modules/:id/execute/SKILL-07-FTC/feature/:featureId — generate TCs for one feature */
  @Post('modules/:id/execute/SKILL-07-FTC/feature/:featureId')
  executeSkill07ForFeature(
    @Param('id') moduleDbId: string,
    @Param('featureId') featureId: string,
  ) {
    if (!/^F-\d+-\d+$/.test(featureId)) {
      throw new BadRequestException(`Invalid featureId "${featureId}". Expected F-NN-NN.`);
    }
    return this.orchestrator.executeSkill07ForFeature(moduleDbId, featureId);
  }

  /** GET /api/ba/modules/:id/ftc — fetch the current FTC artifact (or null) */
  @Get('modules/:id/ftc')
  async getFtc(@Param('id') moduleDbId: string) {
    const artifact = await this.ftc.getFtcArtifact(moduleDbId);
    if (!artifact) return { artifact: null, testCases: [] };
    const testCases = await this.ftc.listTestCases(artifact.id);
    return { artifact, testCases };
  }

  /** GET /api/ba/modules/:id/ftcs — list every FTC artifact for this module */
  @Get('modules/:id/ftcs')
  listFtcs(@Param('id') moduleDbId: string) {
    return this.ftc.listFtcArtifactsForModule(moduleDbId);
  }

  /** GET /api/ba/artifacts/:id/test-cases — list TCs for an FTC artifact */
  @Get('artifacts/:id/test-cases')
  listTestCasesByArtifact(@Param('id') artifactDbId: string) {
    return this.ftc.listTestCases(artifactDbId);
  }

  /** GET /api/ba/artifacts/:id/test-cases/csv — export FTC test cases in the
   *  QA-team CSV template (same columns as the supplied reference sheet).
   */
  @Get('artifacts/:id/test-cases/csv')
  async exportTestCasesCsv(@Param('id') artifactDbId: string, @Res() res: Response) {
    const { csv, filename } = await this.ftc.exportTestCasesCsv(artifactDbId);
    // Prefix with BOM so Excel opens UTF-8 correctly on Windows.
    const body = `﻿${csv}`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(body);
  }

  /** GET /api/ba/test-cases/:id — fetch one test case */
  @Get('test-cases/:id')
  getTestCase(@Param('id') id: string) {
    return this.ftc.getTestCase(id);
  }

  /** PUT /api/ba/test-cases/:id — save edited TC body + flag human-modified */
  @Put('test-cases/:id')
  updateTestCase(@Param('id') id: string, @Body() body: { editedContent: string }) {
    if (typeof body?.editedContent !== 'string') {
      throw new BadRequestException('editedContent is required');
    }
    return this.ftc.updateTestCase(id, body.editedContent);
  }

  // ─── Narrative + attachments + gap-check ──────────────────────────────

  @Get('modules/:id/ftc/attachments')
  listAttachments(@Param('id') moduleDbId: string) {
    return this.narrative.listAttachments(moduleDbId);
  }

  @Post('modules/:id/ftc/attachments')
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

  @Delete('modules/:id/ftc/attachments/:attachmentId')
  deleteAttachment(
    @Param('id') moduleDbId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.narrative.deleteAttachment(moduleDbId, attachmentId);
  }

  @Post('modules/:id/ftc/gap-check')
  gapCheck(@Param('id') moduleDbId: string) {
    return this.narrative.gapCheck(moduleDbId);
  }

  // ─── AC Coverage Verifier ─────────────────────────────────────────────

  /** GET /api/ba/artifacts/:id/ac-coverage — list stored AC coverage rows */
  @Get('artifacts/:id/ac-coverage')
  listAcCoverage(@Param('id') artifactDbId: string) {
    return this.acCoverage.listForArtifact(artifactDbId);
  }

  /** POST /api/ba/artifacts/:id/ac-coverage/analyze — re-run the check via AI */
  @Post('artifacts/:id/ac-coverage/analyze')
  analyzeAcCoverage(@Param('id') artifactDbId: string) {
    return this.acCoverage.analyze(artifactDbId);
  }

  // ─── Playwright suite export ──────────────────────────────────────────

  /**
   * GET /api/ba/artifacts/:id/playwright-zip — stream a runnable
   * Playwright suite (config + fixtures + one spec per scenarioGroup)
   * as a ZIP. Deterministic template codegen, no AI call.
   */
  @Get('artifacts/:id/playwright-zip')
  async exportPlaywrightZip(@Param('id') artifactDbId: string, @Res() res: Response) {
    const { buffer, filename } = await this.playwrightExport.buildZip(artifactDbId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
