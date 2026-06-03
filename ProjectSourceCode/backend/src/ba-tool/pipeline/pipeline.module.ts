import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineAdminController } from './pipeline-admin.controller';
import { E2eFlowController } from './e2e-flow.controller';
import { PipelineService } from './pipeline.service';
import { ProjectFolderService } from './project-folder.service';
import { ContextEngineeringService } from './context-engineering.service';
import { CustomerInputService } from './customer-input.service';
import { ProjectPrdService } from './project-prd.service';
import { HldService } from './project-hld.service';
import { WireframeExportService } from './wireframe-export.service';
import { ModuleReadinessService } from './module-readiness.service';
import { ModuleContextService } from './module-context.service';
import { CodeTaskPlannerService } from './code-task-planner.service';
import { TestRunnerService } from './test-runner.service';
import { UpstreamSyncService } from './upstream-sync.service';
import { RequirementChangeService } from './requirement-change.service';
import { ArtifactFreshnessService } from './artifact-freshness.service';
import { ScreenMapService } from './screen-map.service';
import { E2eFlowService } from './e2e-flow.service';
import { E2eElaborationService } from './e2e-elaboration.service';
import { E2eMappingService } from './e2e-mapping.service';
import { E2eDiagramService } from './e2e-diagram.service';
import { E2eTestService } from './e2e-test.service';
import { SourceCodeScaffoldService } from './source-code-scaffold.service';
import { AgentSettingsService } from './agent-settings.service';
import { SkillRegistry } from './agent/skill-registry.service';
import { ClaudeAgentRunner } from './agent/claude-agent-runner.service';
import { RunManagerService } from './agent/run-manager.service';
import { AGENT_RUNNER } from './agent/agent-runner.interface';
import { TextExtractionService } from '../text-extraction.service';

/**
 * New Pipeline Track module — Customer Discovery → PRD+FRD → HLD → Code.
 * Wired via BaToolModule. PrismaService is global (no import needed).
 *
 * Tracks implemented here (skeleton → real):
 *   B — Customer Input Hub
 *   C — Combined PRD + FRD
 *   E — High Level Design (HLD)
 *   H — ProjectSourceCode Folder + Context Engineering
 *   K — Incremental Code Development (/prd + /dev skills)
 *
 * ProjectFolderService (A-06) is exported so BaToolService can create the
 * on-disk folder tree when a project is created.
 */
@Module({
  controllers: [PipelineController, PipelineAdminController, E2eFlowController],
  providers: [
    PipelineService,
    ProjectFolderService,
    ContextEngineeringService,
    CustomerInputService,
    ProjectPrdService,
    HldService,
    WireframeExportService,
    ModuleReadinessService,
    ModuleContextService,
    CodeTaskPlannerService,
    TestRunnerService,
    UpstreamSyncService,
    RequirementChangeService,
    ArtifactFreshnessService,
    ScreenMapService,
    E2eFlowService,
    E2eElaborationService,
    E2eMappingService,
    E2eDiagramService,
    E2eTestService,
    SourceCodeScaffoldService,
    AgentSettingsService,
    SkillRegistry,
    ClaudeAgentRunner,
    { provide: AGENT_RUNNER, useExisting: ClaudeAgentRunner },
    RunManagerService,
    TextExtractionService,
  ],
  exports: [
    PipelineService,
    ProjectFolderService,
    ContextEngineeringService,
    WireframeExportService,
    SourceCodeScaffoldService,
    AgentSettingsService,
  ],
})
export class PipelineModule {}
