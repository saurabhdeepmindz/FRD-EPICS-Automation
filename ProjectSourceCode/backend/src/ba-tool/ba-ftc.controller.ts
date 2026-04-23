import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { BaFtcService, FtcConfigPayload } from './ba-ftc.service';
import { BaFtcNarrativeService } from './ba-ftc-narrative.service';
import { MAX_TOTAL_ATTACHMENT_BYTES } from './ba-narrative.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';

@Controller('ba')
export class BaFtcController {
  constructor(
    private readonly ftc: BaFtcService,
    private readonly narrative: BaFtcNarrativeService,
    private readonly orchestrator: BaSkillOrchestratorService,
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
}
