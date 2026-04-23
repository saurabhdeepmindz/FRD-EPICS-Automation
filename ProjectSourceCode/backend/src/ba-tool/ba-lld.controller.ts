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
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';

@Controller('ba')
export class BaLldController {
  constructor(
    private readonly lld: BaLldService,
    private readonly orchestrator: BaSkillOrchestratorService,
    private readonly narrative: BaLldNarrativeService,
  ) {}

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
