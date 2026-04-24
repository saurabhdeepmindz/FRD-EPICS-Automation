import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { BaSkillOrchestratorService, SKILL_ORDER, type SkillName } from './ba-skill-orchestrator.service';
import { BaExportService } from './ba-export.service';
import { BaArtifactExportService } from './ba-artifact-export.service';

@Controller('ba')
export class BaSkillController {
  constructor(
    private readonly orchestrator: BaSkillOrchestratorService,
    private readonly exportService: BaExportService,
    private readonly artifactExport: BaArtifactExportService,
  ) {}

  // ─── Skill Execution ───────────────────────────────────────────────────

  /** POST /api/ba/modules/:id/execute/:skill — trigger a skill execution */
  @Post('modules/:id/execute/:skill')
  async executeSkill(
    @Param('id') moduleDbId: string,
    @Param('skill') skill: string,
  ) {
    if (!SKILL_ORDER.includes(skill as SkillName)) {
      throw new BadRequestException(
        `Invalid skill name: ${skill}. Valid skills: ${SKILL_ORDER.join(', ')}`,
      );
    }
    const executionId = await this.orchestrator.executeSkill(moduleDbId, skill as SkillName);
    return { executionId, skill, status: 'RUNNING' };
  }

  /** GET /api/ba/modules/:id/execution/:execId — poll execution status */
  @Get('modules/:modId/execution/:execId')
  getExecution(@Param('execId') execId: string) {
    return this.orchestrator.getExecution(execId);
  }

  /** POST /api/ba/executions/:id/approve — approve an execution */
  @Post('executions/:id/approve')
  approveExecution(@Param('id') execId: string) {
    return this.orchestrator.approveExecution(execId);
  }

  /** POST /api/ba/modules/:id/retry/:skill — retry a failed skill */
  @Post('modules/:id/retry/:skill')
  retrySkill(
    @Param('id') moduleDbId: string,
    @Param('skill') skill: string,
  ) {
    if (!SKILL_ORDER.includes(skill as SkillName)) {
      throw new BadRequestException(`Invalid skill: ${skill}`);
    }
    return this.orchestrator.retryExecution(moduleDbId, skill as SkillName);
  }

  // ─── Artifacts ─────────────────────────────────────────────────────────

  /** GET /api/ba/artifacts/:id — get an artifact with sections */
  @Get('artifacts/:id')
  getArtifact(@Param('id') artifactId: string) {
    return this.orchestrator.getArtifact(artifactId);
  }

  /** PUT /api/ba/artifacts/:id/section — update an artifact section */
  @Put('artifacts/:sectionId/section')
  updateArtifactSection(
    @Param('sectionId') sectionDbId: string,
    @Body() body: { editedContent: string },
  ) {
    return this.orchestrator.updateArtifactSection(sectionDbId, body.editedContent);
  }

  /** POST /api/ba/artifacts/:id/approve — approve an artifact */
  @Post('artifacts/:id/approve')
  approveArtifact(@Param('id') artifactDbId: string) {
    return this.orchestrator.approveArtifact(artifactDbId);
  }

  // ─── TBD-Future Registry ───────────────────────────────────────────────

  /** GET /api/ba/projects/:id/tbd-registry — list TBD-Future entries */
  @Get('projects/:id/tbd-registry')
  listTbdEntries(@Param('id') projectId: string) {
    return this.orchestrator.listTbdEntries(projectId);
  }

  /** POST /api/ba/tbd-entries/:id/resolve — resolve a TBD-Future entry */
  @Post('tbd-entries/:id/resolve')
  resolveTbdEntry(
    @Param('id') entryId: string,
    @Body() body: { resolvedInterface: string },
  ) {
    return this.orchestrator.resolveTbdEntry(entryId, body.resolvedInterface);
  }

  // ─── RTM ───────────────────────────────────────────────────────────────

  /** GET /api/ba/projects/:id/rtm — get full RTM for a project */
  @Get('projects/:id/rtm')
  getProjectRtm(@Param('id') projectId: string) {
    return this.orchestrator.getProjectRtm(projectId);
  }

  /** POST /api/ba/projects/:id/rtm/backfill — populate RTM from existing artifacts */
  @Post('projects/:id/rtm/backfill')
  backfillRtm(@Param('id') projectId: string) {
    return this.orchestrator.backfillProjectRtm(projectId);
  }

  // ─── Execution Health ──────────────────────────────────────────────────

  /** GET /api/ba/projects/:id/execution-health — PASS/FAIL/BLOCK roll-up for dashboard tile */
  @Get('projects/:id/execution-health')
  getExecutionHealth(@Param('id') projectId: string) {
    return this.orchestrator.getProjectExecutionHealth(projectId);
  }

  // ─── Export ────────────────────────────────────────────────────────────

  /** GET /api/ba/projects/:id/export/json — get all export data as JSON */
  @Get('projects/:id/export/json')
  getExportData(@Param('id') projectId: string) {
    return this.orchestrator.getExportData(projectId);
  }

  /** GET /api/ba/projects/:id/export/zip — download all artifacts as ZIP */
  @Get('projects/:id/export/zip')
  async exportZip(@Param('id') projectId: string, @Res() res: Response) {
    try {
      const { stream, fileName } = await this.exportService.generateExportZip(projectId);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      stream.pipe(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      res.status(500).json({ statusCode: 500, message });
    }
  }

  // ─── Per-artifact preview / PDF / DOCX ────────────────────────────────

  /** GET /api/ba/artifacts/:id/preview — inline HTML preview of an artifact */
  @Get('artifacts/:id/preview')
  async previewArtifact(@Param('id') artifactId: string, @Res() res: Response) {
    const { html } = await this.artifactExport.renderHtml(artifactId);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  /** GET /api/ba/artifacts/:id/export/pdf — download artifact as PDF */
  @Get('artifacts/:id/export/pdf')
  async exportArtifactPdf(@Param('id') artifactId: string, @Res() res: Response) {
    const { buffer, filename } = await this.artifactExport.renderPdf(artifactId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/artifacts/:id/export/docx — download artifact as DOCX */
  @Get('artifacts/:id/export/docx')
  async exportArtifactDocx(@Param('id') artifactId: string, @Res() res: Response) {
    const { buffer, filename } = await this.artifactExport.renderDocx(artifactId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/subtasks/:id/preview — inline HTML preview of a subtask */
  @Get('subtasks/:id/preview')
  async previewSubtask(@Param('id') subtaskId: string, @Res() res: Response) {
    const { html } = await this.artifactExport.renderSubTaskHtml(subtaskId);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  /** GET /api/ba/subtasks/:id/export/pdf — download subtask as PDF */
  @Get('subtasks/:id/export/pdf')
  async exportSubtaskPdf(@Param('id') subtaskId: string, @Res() res: Response) {
    const { buffer, filename } = await this.artifactExport.renderSubTaskPdf(subtaskId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/subtasks/:id/export/docx — download subtask as DOCX */
  @Get('subtasks/:id/export/docx')
  async exportSubtaskDocx(@Param('id') subtaskId: string, @Res() res: Response) {
    const { buffer, filename } = await this.artifactExport.renderSubTaskDocx(subtaskId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/projects/:id/export/subtasks?format=md|json — export SubTasks */
  @Get('projects/:id/export/subtasks')
  async exportSubTasks(
    @Param('id') projectId: string,
    @Res() res: Response,
  ) {
    const format = 'md'; // Default to markdown; could read from query
    const { content, contentType, fileName } = await this.exportService.exportSubTasks(projectId, format as 'md' | 'json');
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(content);
  }
}
