import { Module } from '@nestjs/common';
import { BaToolController } from './ba-tool.controller';
import { BaSkillController } from './ba-skill.controller';
import { BaToolService } from './ba-tool.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';
import { BaExportService } from './ba-export.service';
import { SubTaskParserService } from './subtask-parser.service';

@Module({
  controllers: [BaToolController, BaSkillController],
  providers: [BaToolService, BaSkillOrchestratorService, BaExportService, SubTaskParserService],
  exports: [BaToolService, BaSkillOrchestratorService, BaExportService, SubTaskParserService],
})
export class BaToolModule {}
