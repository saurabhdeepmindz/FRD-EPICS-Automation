import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { BaDefectService, MAX_DEFECT_ATTACHMENT_BYTES } from './ba-defect.service';
import { BaRcaService } from './ba-rca.service';
import { BaTestRunService } from './ba-test-run.service';
import {
  BulkCreateTestRunDto,
  CreateDefectDto,
  CreateTestRunDto,
  SaveTesterRcaDto,
  UpdateDefectDto,
} from './dto/execution.dto';

/**
 * Phase 2a — execution tracking endpoints.
 *
 * Runs:     /test-cases/:id/runs, /runs/:id, /artifacts/:id/runs
 * Defects:  /test-cases/:id/defects (list), /defects/:id (get/update/delete),
 *           /runs/:id/defects (open one from a failing run),
 *           /defects/:id/attachments (CRUD)
 * RCA:      /defects/:id/rca (list, save tester), /defects/:id/rca/analyze
 */
@Controller('ba')
export class BaExecutionController {
  constructor(
    private readonly runs: BaTestRunService,
    private readonly defects: BaDefectService,
    private readonly rca: BaRcaService,
  ) {}

  // ─── Test runs ──────────────────────────────────────────────────────────

  /** POST /api/ba/test-cases/:id/runs — record a new run. */
  @Post('test-cases/:id/runs')
  createRun(@Param('id') testCaseId: string, @Body() payload: CreateTestRunDto) {
    return this.runs.createRun(testCaseId, payload);
  }

  /** POST /api/ba/test-cases/bulk-runs — same run payload recorded across many TCs. */
  @Post('test-cases/bulk-runs')
  bulkCreateRuns(@Body() payload: BulkCreateTestRunDto) {
    return this.runs.bulkCreateRuns(payload);
  }

  /** GET /api/ba/test-cases/:id/runs — run history for a TC (non-deleted). */
  @Get('test-cases/:id/runs')
  listRunsForTc(@Param('id') testCaseId: string) {
    return this.runs.listRunsForTestCase(testCaseId);
  }

  /** GET /api/ba/artifacts/:id/runs — all runs for an FTC artifact. */
  @Get('artifacts/:id/runs')
  listRunsForArtifact(@Param('id') artifactDbId: string) {
    return this.runs.listRunsForArtifact(artifactDbId);
  }

  /** DELETE /api/ba/runs/:id — soft-delete. */
  @Delete('runs/:id')
  softDeleteRun(@Param('id') runId: string) {
    return this.runs.softDeleteRun(runId);
  }

  // ─── Defects ────────────────────────────────────────────────────────────

  /** GET /api/ba/test-cases/:id/defects — all defects raised for a TC. */
  @Get('test-cases/:id/defects')
  listDefectsForTc(@Param('id') testCaseId: string) {
    return this.defects.listDefectsForTestCase(testCaseId);
  }

  /** GET /api/ba/projects/:id/defects — project-wide defect feed for the global list. */
  @Get('projects/:id/defects')
  listDefectsForProject(@Param('id') projectId: string) {
    return this.defects.listDefectsForProject(projectId);
  }

  /** POST /api/ba/test-cases/:id/defects — open a defect without a triggering run. */
  @Post('test-cases/:id/defects')
  createDefect(@Param('id') testCaseId: string, @Body() payload: CreateDefectDto) {
    return this.defects.createDefect(testCaseId, payload);
  }

  /** GET /api/ba/defects/:id — defect + attachments + RCAs bundle. */
  @Get('defects/:id')
  getDefect(@Param('id') defectId: string) {
    return this.defects.getDefect(defectId);
  }

  /** PATCH /api/ba/defects/:id — update title/status/severity/etc. */
  @Patch('defects/:id')
  updateDefect(@Param('id') defectId: string, @Body() payload: UpdateDefectDto) {
    return this.defects.updateDefect(defectId, payload);
  }

  /**
   * POST /api/ba/defects/:id/attachments — multipart upload.
   * Same 30 MB total cap + pluggable storage as LLD / FTC narrative.
   */
  @Post('defects/:id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_DEFECT_ATTACHMENT_BYTES },
    }),
  )
  async uploadDefectAttachments(
    @Param('id') defectId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files in request');
    return this.defects.uploadAttachments(
      defectId,
      files.map((f) => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        buffer: f.buffer,
      })),
    );
  }

  /** DELETE /api/ba/defects/:id/attachments/:attachmentId */
  @Delete('defects/:id/attachments/:attachmentId')
  deleteDefectAttachment(
    @Param('id') defectId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.defects.deleteAttachment(defectId, attachmentId);
  }

  // ─── RCA dual-track ─────────────────────────────────────────────────────

  /** GET /api/ba/defects/:id/rca — list AI + TESTER RCAs for this defect. */
  @Get('defects/:id/rca')
  listRcas(@Param('id') defectId: string) {
    return this.rca.listRcas(defectId);
  }

  /** POST /api/ba/defects/:id/rca/analyze — run the AI RCA. */
  @Post('defects/:id/rca/analyze')
  analyzeWithAi(@Param('id') defectId: string) {
    return this.rca.analyzeWithAi(defectId);
  }

  /** POST /api/ba/defects/:id/rca — save a tester RCA (can be iterated). */
  @Post('defects/:id/rca')
  saveTesterRca(@Param('id') defectId: string, @Body() payload: SaveTesterRcaDto) {
    return this.rca.saveTesterRca(defectId, payload);
  }
}
