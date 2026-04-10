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

@Controller('ba')
export class BaSkillController {
  constructor(
    private readonly orchestrator: BaSkillOrchestratorService,
    private readonly exportService: BaExportService,
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

  // ─── Export ────────────────────────────────────────────────────────────

  /** GET /api/ba/projects/:id/export/json — get all export data as JSON */
  @Get('projects/:id/export/json')
  getExportData(@Param('id') projectId: string) {
    return this.orchestrator.getExportData(projectId);
  }

  /** GET /api/ba/projects/:id/export/zip — download all artifacts as ZIP */
  @Get('projects/:id/export/zip')
  async exportZip(@Param('id') projectId: string, @Res() res: Response) {
    const { stream, fileName } = await this.exportService.generateExportZip(projectId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    stream.pipe(res);
  }
}
