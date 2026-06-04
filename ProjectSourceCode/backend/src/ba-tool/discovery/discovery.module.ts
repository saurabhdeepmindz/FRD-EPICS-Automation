import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { ExportModule } from '../../export/export.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { DiscoveryController } from './discovery.controller';
import { AudioService } from './audio.service';
import { WftService } from './wft.service';
import { BrdService } from './brd.service';
import { BrdExportService } from './brd-export.service';
import { ApproachNoteService } from './approach-note.service';
import { AnExportService } from './an-export.service';
import { WireframeService } from './wireframe.service';
import { HifiService } from './hifi.service';
import { ScreenExportService } from './screen-export.service';

/**
 * Discovery & Solutioning Track module.
 * Wired via BaToolModule. PrismaService is global (no import needed).
 *
 * Stages shipped: 1 (Audio), 2 (WFT), 3 (BRD + export),
 * 4 (Approach Note + versions + export with internal/client editions),
 * 5 (Lo-fi wireframes), 6 (Hi-fi mockups + parity validator).
 * Stage 7 (EPIC context handoff) lands in the next slice.
 */
@Module({
  imports: [AiModule, ExportModule, forwardRef(() => PipelineModule)],
  controllers: [DiscoveryController],
  providers: [
    AudioService,
    WftService,
    BrdService,
    BrdExportService,
    ApproachNoteService,
    AnExportService,
    WireframeService,
    HifiService,
    ScreenExportService,
  ],
  exports: [
    AudioService,
    WftService,
    BrdService,
    BrdExportService,
    ApproachNoteService,
    AnExportService,
    WireframeService,
    HifiService,
    ScreenExportService,
  ],
})
export class DiscoveryModule {}
