import { Module } from '@nestjs/common';
import { BaToolController } from './ba-tool.controller';
import { BaSkillController } from './ba-skill.controller';
import { BaMasterDataController } from './ba-master-data.controller';
import { BaLldController } from './ba-lld.controller';
import { BaFtcController } from './ba-ftc.controller';
import { BaToolService } from './ba-tool.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';
import { BaExportService } from './ba-export.service';
import { BaArtifactExportService } from './ba-artifact-export.service';
import { BaMasterDataService } from './ba-master-data.service';
import { BaTemplateService } from './ba-template.service';
import { BaLldService } from './ba-lld.service';
import { BaLldParserService } from './ba-lld-parser.service';
import { BaLldNarrativeService } from './ba-lld-narrative.service';
import { BaFtcService } from './ba-ftc.service';
import { BaFtcParserService } from './ba-ftc-parser.service';
import { BaFtcNarrativeService } from './ba-ftc-narrative.service';
import { BaAcCoverageService } from './ba-ac-coverage.service';
import { BaPlaywrightExportService } from './ba-playwright-export.service';
import { BaTestRunService } from './ba-test-run.service';
import { BaDefectService } from './ba-defect.service';
import { BaRcaService } from './ba-rca.service';
import { BaExecutionController } from './ba-execution.controller';
import { BaSprintController } from './ba-sprint.controller';
import { BaSprintService } from './ba-sprint.service';
import { BaNarrativeService } from './ba-narrative.service';
import { TextExtractionService } from './text-extraction.service';
import { AttachmentStorageModule } from './storage/storage.module';
import { SubTaskParserService } from './subtask-parser.service';
import { ExportModule } from '../export/export.module';

@Module({
  imports: [ExportModule, AttachmentStorageModule],
  controllers: [BaToolController, BaSkillController, BaMasterDataController, BaLldController, BaFtcController, BaExecutionController, BaSprintController],
  providers: [
    BaToolService,
    BaSkillOrchestratorService,
    BaExportService,
    BaArtifactExportService,
    BaMasterDataService,
    BaTemplateService,
    BaLldService,
    BaLldParserService,
    BaLldNarrativeService,
    BaFtcService,
    BaFtcParserService,
    BaFtcNarrativeService,
    BaAcCoverageService,
    BaPlaywrightExportService,
    BaTestRunService,
    BaDefectService,
    BaRcaService,
    BaSprintService,
    BaNarrativeService,
    TextExtractionService,
    SubTaskParserService,
  ],
  exports: [
    BaToolService,
    BaSkillOrchestratorService,
    BaExportService,
    BaArtifactExportService,
    BaMasterDataService,
    BaTemplateService,
    BaLldService,
    BaLldNarrativeService,
    BaFtcService,
    BaFtcNarrativeService,
    SubTaskParserService,
  ],
})
export class BaToolModule {}
