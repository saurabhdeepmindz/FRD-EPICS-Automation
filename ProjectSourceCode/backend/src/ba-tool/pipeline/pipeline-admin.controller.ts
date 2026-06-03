import { Controller, Post, Get, Put, Body } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { WireframeExportService } from './wireframe-export.service';
import {
  AgentSettingsService,
  type AgentProvider,
} from './agent-settings.service';
import { SkillRegistry } from './agent/skill-registry.service';

/**
 * Cross-project (non-:id-scoped) pipeline operations.
 * Kept separate from PipelineController because that controller is scoped to
 * `ba/projects/:id`.
 */
@Controller('ba/pipeline')
export class PipelineAdminController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly wireframeExport: WireframeExportService,
    private readonly agentSettings: AgentSettingsService,
    private readonly skills: SkillRegistry,
  ) {}

  // ── Agent skills (K-02) — the UI-invokable skills available ──────────────────

  @Get('skills')
  async listSkills() {
    return { success: true, data: await this.skills.list() };
  }

  // ── Agent settings (K-00) — provider · model · API key (key never returned) ──

  @Get('agent-settings')
  getAgentSettings() {
    return { success: true, data: this.agentSettings.getPublic() };
  }

  @Put('agent-settings')
  updateAgentSettings(
    @Body() body: { provider?: AgentProvider; model?: string; apiKey?: string },
  ) {
    return { success: true, data: this.agentSettings.update(body) };
  }

  /**
   * Backfill the on-disk folder tree for every existing project.
   * Idempotent — safe to run repeatedly.
   *   POST /api/ba/pipeline/backfill-folders
   */
  @Post('backfill-folders')
  async backfillFolders() {
    const data = await this.pipeline.backfillAllFolders();
    return { success: true, ...data };
  }

  /**
   * Backfill wireframe/mockup HTML to disk for every project (latest set each).
   *   POST /api/ba/pipeline/backfill-wireframes
   */
  @Post('backfill-wireframes')
  async backfillWireframes() {
    const data = await this.wireframeExport.backfillAll();
    return { success: true, ...data };
  }
}
