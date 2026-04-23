import { Module } from '@nestjs/common';
import { BaToolController } from './ba-tool.controller';
import { BaSkillController } from './ba-skill.controller';
import { BaMasterDataController } from './ba-master-data.controller';
import { BaLldController } from './ba-lld.controller';
import { BaToolService } from './ba-tool.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';
import { BaExportService } from './ba-export.service';
import { BaArtifactExportService } from './ba-artifact-export.service';
import { BaMasterDataService } from './ba-master-data.service';
import { BaTemplateService } from './ba-template.service';
import { BaLldService } from './ba-lld.service';
import { BaLldParserService } from './ba-lld-parser.service';
import { BaLldNarrativeService } from './ba-lld-narrative.service';
import { TextExtractionService } from './text-extraction.service';
import { AttachmentStorageModule } from './storage/storage.module';
import { SubTaskParserService } from './subtask-parser.service';
import { ExportModule } from '../export/export.module';

@Module({
  imports: [ExportModule, AttachmentStorageModule],
  controllers: [BaToolController, BaSkillController, BaMasterDataController, BaLldController],
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
    SubTaskParserService,
  ],
})
export class BaToolModule {}
