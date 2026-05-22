import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import type { BaBrd } from '@prisma/client';
import type { UpdateBrdDto } from './dto/update-brd.dto';

interface GenerateBrdOptions {
  projectId: string;
  wftId: string;
  productName?: string;
  audience?: 'internal-tool' | 'end-client-product';
}

/**
 * Stage 3 of the Discovery Track: takes a Well-formed Text artefact and
 * produces a 15-section BRD per skill 02. Phase 1 overwrites on regenerate;
 * Phase 2 introduces append-only versioning per BRD §1.1.
 */
@Injectable()
export class BrdService {
  private readonly logger = new Logger(BrdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async generate(opts: GenerateBrdOptions): Promise<BaBrd> {
    const wft = await this.prisma.baWft.findUnique({
      where: { id: opts.wftId },
    });
    if (!wft) {
      throw new NotFoundException(`WFT ${opts.wftId} not found`);
    }
    if (wft.projectId !== opts.projectId) {
      throw new BadRequestException('WFT does not belong to this project');
    }
    if (!wft.paraphrased && !wft.cleanedText) {
      throw new BadRequestException(
        'Source WFT lacks both paraphrased and cleaned text — generate Stage 1 output first',
      );
    }

    const concepts = (wft.concepts as { name: string; context: string }[] | null) ?? [];
    const actionItems = (wft.actionItems as string[] | null) ?? [];
    const openQuestions = (wft.openQuestions as string[] | null) ?? [];

    const ai = await this.aiService.generateBrd({
      wftParaphrased: wft.paraphrased ?? wft.cleanedText ?? '',
      wftConcepts: concepts,
      wftActionItems: actionItems,
      wftOpenQuestions: openQuestions,
      productName: opts.productName,
      audience: opts.audience,
    });

    const brd = await this.prisma.baBrd.create({
      data: {
        projectId: opts.projectId,
        wftId: opts.wftId,
        sections: (ai.sections ?? {}) as never,
        frTable: (ai.frTable ?? null) as never,
        openItems: (ai.openItems ?? null) as never,
        meta: {
          audience: ai.detectedAudience ?? opts.audience ?? null,
          productName: opts.productName ?? null,
          model: ai.model ?? null,
          generatedAt: new Date().toISOString(),
        } as never,
        status: 'DRAFT',
      },
    });

    this.logger.log(
      `BRD generated: ${brd.id} from WFT ${opts.wftId} (project=${opts.projectId})`,
    );
    return brd;
  }

  async findLatestForProject(projectId: string): Promise<BaBrd | null> {
    return this.prisma.baBrd.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(brdId: string): Promise<BaBrd> {
    const brd = await this.prisma.baBrd.findUnique({
      where: { id: brdId },
    });
    if (!brd) {
      throw new NotFoundException(`BRD ${brdId} not found`);
    }
    return brd;
  }

  async update(brdId: string, dto: UpdateBrdDto): Promise<BaBrd> {
    const existing = await this.findById(brdId);

    const data: Record<string, unknown> = {};

    if (dto.sections) {
      // Merge: keep existing keys, overwrite only the ones the caller sent.
      const current = (existing.sections as Record<string, string> | null) ?? {};
      data.sections = { ...current, ...dto.sections } as never;
    }
    if (dto.frTable !== undefined) {
      data.frTable = dto.frTable as never;
    }
    if (dto.openItems !== undefined) {
      data.openItems = dto.openItems as never;
    }
    if (dto.productName !== undefined || dto.audience !== undefined) {
      // Merge into meta — never replace the whole object (model + generatedAt
      // are also kept there).
      const currentMeta = (existing.meta as Record<string, unknown> | null) ?? {};
      const nextMeta = { ...currentMeta };
      if (dto.productName !== undefined) {
        nextMeta.productName = dto.productName.trim() || null;
      }
      if (dto.audience !== undefined) {
        nextMeta.audience = dto.audience;
      }
      data.meta = nextMeta as never;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.baBrd.update({
      where: { id: brdId },
      data,
    });
  }

  /** Regenerate a BRD by re-running the AI on the same WFT (overwrites — Phase 1). */
  async regenerate(
    brdId: string,
    opts: { productName?: string; audience?: 'internal-tool' | 'end-client-product' } = {},
  ): Promise<BaBrd> {
    const existing = await this.findById(brdId);
    return this.generate({
      projectId: existing.projectId,
      wftId: existing.wftId,
      productName: opts.productName,
      audience: opts.audience,
    });
  }
}
