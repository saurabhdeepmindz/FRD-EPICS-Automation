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
import { BaOpenApiExportService } from './ba-openapi-export.service';

@Controller('ba')
export class BaSkillController {
  constructor(
    private readonly orchestrator: BaSkillOrchestratorService,
    private readonly exportService: BaExportService,
    private readonly artifactExport: BaArtifactExportService,
    private readonly openapiExport: BaOpenApiExportService,
  ) {}

  // ─── Project-level OpenAPI / Swagger (aggregates all LLDs) ──────────────

  /** GET /api/ba/projects/:id/openapi.json — project-aggregated OpenAPI 3.0 JSON. */
  @Get('projects/:id/openapi.json')
  async projectOpenapiJson(@Param('id') projectId: string, @Res() res: Response) {
    const { spec } = await this.openapiExport.buildProjectSpec(projectId);
    res.set({ 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(spec, null, 2));
  }

  /** GET /api/ba/projects/:id/openapi.yaml — YAML flavour. */
  @Get('projects/:id/openapi.yaml')
  async projectOpenapiYaml(@Param('id') projectId: string, @Res() res: Response) {
    const { spec, filenameStem } = await this.openapiExport.buildProjectSpec(projectId);
    res.set({
      'Content-Type': 'text/yaml; charset=utf-8',
      'Content-Disposition': `inline; filename="${filenameStem}.yaml"`,
    });
    res.end(this.openapiExport.toYaml(spec));
  }

  /** GET /api/ba/projects/:id/swagger — live Swagger UI aggregating all modules. */
  @Get('projects/:id/swagger')
  async projectSwagger(@Param('id') projectId: string, @Res() res: Response) {
    const { spec } = await this.openapiExport.buildProjectSpec(projectId);
    const specUrl = `/api/ba/projects/${projectId}/openapi.json`;
    const pageTitle = (spec.info as { title?: string } | undefined)?.title ?? 'API';
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.end(this.openapiExport.swaggerUiHtml(specUrl, pageTitle));
  }

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

  // ─── SKILL-05 per-story append mode (post-v4) ─────────────────────────
  //
  // Decompose ONE user story at a time. Each call:
  //   - Reuses the module's existing SUBTASK BaArtifact (creating it on
  //     the first call) and APPENDS new sections; does not overwrite.
  //   - Is idempotent: skips when the storyId already has rows.
  //   - Splits the AI response with the defensive clamp (### inside a
  //     `## ST-US...` block stays in body, never becomes a separate row).
  //
  // Workflow: list stories with the GET endpoint below, then drive the
  // per-story endpoint in a loop with a checkpoint between calls.

  /** GET /api/ba/modules/:id/subtask-stories — enumerate stories for SKILL-05 */
  @Get('modules/:id/subtask-stories')
  listSubtaskStories(@Param('id') moduleDbId: string) {
    return this.orchestrator.listUserStoriesForModule(moduleDbId);
  }

  /** POST /api/ba/modules/:id/execute/SKILL-05/story/:storyId — generate SubTasks for one story */
  @Post('modules/:id/execute/SKILL-05/story/:storyId')
  executeSkill05ForStory(
    @Param('id') moduleDbId: string,
    @Param('storyId') storyId: string,
  ) {
    if (!/^US-\d{3,}$/.test(storyId)) {
      throw new BadRequestException(`Invalid storyId "${storyId}". Expected US-NNN.`);
    }
    return this.orchestrator.executeSkill05ForStory(moduleDbId, storyId);
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
