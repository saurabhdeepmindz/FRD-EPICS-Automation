import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import type { BaWft } from '@prisma/client';
import type { UpdateWftDto } from './dto/update-wft.dto';

interface GenerateWftOptions {
  projectId: string;
  audioFileIds: string[];
  domainContext?: string;
  languageHint?: string;
}

/**
 * Stage 2 of the Discovery Track: takes one or more transcribed audio files and
 * produces a 7-section Well-formed Text artefact per skill 01.
 */
@Injectable()
export class WftService {
  private readonly logger = new Logger(WftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async generate(opts: GenerateWftOptions): Promise<BaWft> {
    if (opts.audioFileIds.length === 0) {
      throw new BadRequestException('At least one audio file required');
    }

    const audios = await this.prisma.baAudioFile.findMany({
      where: { id: { in: opts.audioFileIds }, projectId: opts.projectId },
    });
    if (audios.length !== opts.audioFileIds.length) {
      throw new NotFoundException('One or more audio files not found in project');
    }
    const untranscribed = audios.filter((a) => !a.rawTranscript);
    if (untranscribed.length > 0) {
      throw new BadRequestException(
        `${untranscribed.length} audio file(s) not yet transcribed`,
      );
    }

    const rawTranscript = audios
      .map((a) => `--- ${a.filename} ---\n${a.rawTranscript ?? ''}`)
      .join('\n\n');

    const ai = await this.aiService.generateWft({
      rawTranscript,
      domainContext: opts.domainContext,
      languageHint: opts.languageHint,
    });

    const wft = await this.prisma.baWft.create({
      data: {
        projectId: opts.projectId,
        rawTranscript,
        cleanedText: ai.cleanedText ?? null,
        paraphrased: ai.paraphrased ?? null,
        // Prisma's Json fields require explicit InputJsonValue cast; `as never`
        // bypasses the strict type check while preserving the actual JSON value.
        concepts: (ai.concepts ?? null) as never,
        actionItems: (ai.actionItems ?? null) as never,
        openQuestions: (ai.openQuestions ?? null) as never,
        meta: {
          language: ai.detectedLanguage ?? null,
          domainContext: opts.domainContext ?? null,
          model: ai.model ?? null,
          generatedAt: new Date().toISOString(),
        } as never,
        status: 'DRAFT',
      },
    });

    // Link audio files to the WFT for traceability
    await this.prisma.baAudioFile.updateMany({
      where: { id: { in: opts.audioFileIds } },
      data: { wftId: wft.id },
    });

    this.logger.log(
      `WFT generated: ${wft.id} from ${audios.length} audio file(s) (project=${opts.projectId})`,
    );
    return wft;
  }

  async findLatestForProject(projectId: string): Promise<BaWft | null> {
    return this.prisma.baWft.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { audioFiles: true },
    });
  }

  async findById(wftId: string): Promise<BaWft> {
    const wft = await this.prisma.baWft.findUnique({
      where: { id: wftId },
      include: { audioFiles: true },
    });
    if (!wft) {
      throw new NotFoundException(`WFT ${wftId} not found`);
    }
    return wft;
  }

  async update(wftId: string, dto: UpdateWftDto): Promise<BaWft> {
    // Make sure target exists; surfaces 404 vs Prisma's generic error
    await this.findById(wftId);

    return this.prisma.baWft.update({
      where: { id: wftId },
      data: {
        cleanedText: dto.cleanedText,
        paraphrased: dto.paraphrased,
        concepts: dto.concepts as never,
        actionItems: dto.actionItems as never,
        openQuestions: dto.openQuestions as never,
        status: dto.status,
      },
    });
  }

  /** Re-run AI generation against the same audio set; overwrites existing WFT (Phase 1). */
  async regenerate(wftId: string, opts: { domainContext?: string; languageHint?: string } = {}): Promise<BaWft> {
    const existing = await this.prisma.baWft.findUnique({
      where: { id: wftId },
      include: { audioFiles: true },
    });
    if (!existing) {
      throw new NotFoundException(`WFT ${wftId} not found`);
    }
    const audioFileIds = existing.audioFiles.map((a) => a.id);
    if (audioFileIds.length === 0) {
      throw new BadRequestException('Original audio files no longer linked to this WFT');
    }

    // Phase 1: regenerate = create new WFT and orphan the old one (no versioning).
    // This matches BRD §6 FR-5 P1 behaviour. Versioning lands in Phase 2.
    return this.generate({
      projectId: existing.projectId,
      audioFileIds,
      domainContext: opts.domainContext,
      languageHint: opts.languageHint,
    });
  }
}
