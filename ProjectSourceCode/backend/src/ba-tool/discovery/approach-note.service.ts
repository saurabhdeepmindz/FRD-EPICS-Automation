import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AiService,
  type GenerateApproachNoteResponse,
  type ExtractBrandTokensResponse,
} from '../../ai/ai.service';
import type { BaApproachNote, BaApproachNoteVersion } from '@prisma/client';
import type { UpdateAnVersionDto } from './dto/update-an-version.dto';

interface GenerateAnOptions {
  projectId: string;
  brdId: string;
  productName?: string;
  audience?: 'internal-tool' | 'end-client-product';
}

interface CreateNewVersionOptions {
  approachNoteId: string;
  changesSince: string;
  productName?: string;
  audience?: 'internal-tool' | 'end-client-product';
}

export interface BaApproachNoteWithVersions extends BaApproachNote {
  versions: BaApproachNoteVersion[];
  currentVersion: BaApproachNoteVersion | null;
}

/**
 * Stage 4 of the Discovery Track: takes a BRD and produces an 11-section
 * Approach Note per skill 03. APPEND-ONLY versioning — every regeneration
 * creates a new BaApproachNoteVersion row; prior versions are preserved.
 *
 * The "current" version pointer (BaApproachNote.currentVersionId) updates
 * on each new-version creation; reading the AN returns the current version's
 * sections + brand tokens + decisions.
 */
@Injectable()
export class ApproachNoteService {
  private readonly logger = new Logger(ApproachNoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * First-time generation. Creates BaApproachNote header + version 1.
   * If an AN already exists for this BRD, we instead append a new version
   * (call createNewVersion via the controller) — but generate() is idempotent
   * for the v1 case: if the BRD already has an AN, this throws BadRequest.
   */
  async generate(opts: GenerateAnOptions): Promise<BaApproachNoteWithVersions> {
    const brd = await this.prisma.baBrd.findUnique({ where: { id: opts.brdId } });
    if (!brd) throw new NotFoundException(`BRD ${opts.brdId} not found`);
    if (brd.projectId !== opts.projectId) {
      throw new BadRequestException('BRD does not belong to this project');
    }

    const existing = await this.prisma.baApproachNote.findFirst({
      where: { brdId: opts.brdId },
    });
    if (existing) {
      throw new BadRequestException(
        `An Approach Note already exists for BRD ${opts.brdId}. Create a new version instead.`,
      );
    }

    const ai = await this.callAi(brd, '', opts.productName, opts.audience);

    // Single transaction: create header → create v1 → set currentVersionId.
    const result = await this.prisma.$transaction(async (tx) => {
      const an = await tx.baApproachNote.create({
        data: {
          projectId: opts.projectId,
          brdId: opts.brdId,
        },
      });

      const v1 = await tx.baApproachNoteVersion.create({
        data: {
          approachNoteId: an.id,
          versionNumber: 1,
          sections: (ai.sections ?? {}) as never,
          brandTokens: (ai.brandTokens ?? null) as never,
          decisionsLocked: (ai.decisionsLocked ?? null) as never,
          openQuestions: (ai.openQuestions ?? null) as never,
          prdReadiness: (ai.prdReadiness ?? null) as never,
          changesSince: null,
          supersedesId: null,
          meta: {
            audience: ai.detectedAudience ?? opts.audience ?? null,
            productName: opts.productName ?? null,
            model: ai.model ?? null,
            generatedAt: new Date().toISOString(),
          } as never,
          status: 'DRAFT',
        },
      });

      const updated = await tx.baApproachNote.update({
        where: { id: an.id },
        data: { currentVersionId: v1.id },
      });

      return { an: updated, version: v1 };
    });

    this.logger.log(
      `AN v1 generated: ${result.an.id} from BRD ${opts.brdId} (project=${opts.projectId})`,
    );

    return this.findById(result.an.id);
  }

  /**
   * Append a new version. Captures the "Changes since v(N)" log per skill 03 §8.
   * Re-runs the AI with `changesSince` as a hint so the model updates relevant
   * sections rather than regenerating identically.
   */
  async createNewVersion(opts: CreateNewVersionOptions): Promise<BaApproachNoteWithVersions> {
    const an = await this.prisma.baApproachNote.findUnique({
      where: { id: opts.approachNoteId },
      include: { brd: true, versions: true },
    });
    if (!an) throw new NotFoundException(`Approach Note ${opts.approachNoteId} not found`);

    const latestVersionNum = an.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0);
    const supersedes = an.versions.find((v) => v.versionNumber === latestVersionNum) ?? null;

    const ai = await this.callAi(an.brd, opts.changesSince, opts.productName, opts.audience);

    const result = await this.prisma.$transaction(async (tx) => {
      const newVersion = await tx.baApproachNoteVersion.create({
        data: {
          approachNoteId: an.id,
          versionNumber: latestVersionNum + 1,
          sections: (ai.sections ?? {}) as never,
          brandTokens: (ai.brandTokens ?? null) as never,
          decisionsLocked: (ai.decisionsLocked ?? null) as never,
          openQuestions: (ai.openQuestions ?? null) as never,
          prdReadiness: (ai.prdReadiness ?? null) as never,
          changesSince: opts.changesSince || null,
          supersedesId: supersedes?.id ?? null,
          meta: {
            audience: ai.detectedAudience ?? opts.audience ?? null,
            productName: opts.productName ?? null,
            model: ai.model ?? null,
            generatedAt: new Date().toISOString(),
          } as never,
          status: 'DRAFT',
        },
      });

      await tx.baApproachNote.update({
        where: { id: an.id },
        data: { currentVersionId: newVersion.id },
      });

      return newVersion;
    });

    this.logger.log(
      `AN v${result.versionNumber} appended: ${an.id} (supersedes=${supersedes?.id ?? 'none'})`,
    );

    return this.findById(an.id);
  }

  async findLatestForProject(projectId: string): Promise<BaApproachNoteWithVersions | null> {
    const an = await this.prisma.baApproachNote.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!an) return null;
    return this.findById(an.id);
  }

  async findById(approachNoteId: string): Promise<BaApproachNoteWithVersions> {
    const an = await this.prisma.baApproachNote.findUnique({
      where: { id: approachNoteId },
      include: {
        versions: { orderBy: { versionNumber: 'asc' } },
      },
    });
    if (!an) throw new NotFoundException(`Approach Note ${approachNoteId} not found`);

    const currentVersion =
      an.versions.find((v) => v.id === an.currentVersionId) ??
      an.versions.slice(-1)[0] ??
      null;

    return { ...an, currentVersion };
  }

  async findVersion(versionId: string): Promise<BaApproachNoteVersion> {
    const v = await this.prisma.baApproachNoteVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new NotFoundException(`AN version ${versionId} not found`);
    return v;
  }

  /**
   * Extract brand tokens from a reference image and merge them into the
   * specified version's `brandTokens` JSON. The merge is shallow — only fields
   * the AI returned overwrite; other fields (e.g. logo) are preserved.
   */
  async extractBrandTokensFromImage(
    versionId: string,
    file: Express.Multer.File,
  ): Promise<{ extracted: ExtractBrandTokensResponse; updated: BaApproachNoteVersion }> {
    const existing = await this.findVersion(versionId);

    const extracted = await this.aiService.extractBrandTokens(file);

    const current = (existing.brandTokens as Record<string, unknown> | null) ?? {};
    const merged = {
      ...current,
      primary: extracted.primary,
      surface: extracted.surface,
      cta: extracted.cta,
      productName: extracted.productName,
    };

    const updated = await this.prisma.baApproachNoteVersion.update({
      where: { id: versionId },
      data: { brandTokens: merged as never },
    });

    this.logger.log(
      `Brand tokens extracted from image for AN version ${versionId}: ${extracted.primary} / ${extracted.surface} / ${extracted.cta}`,
    );

    return { extracted, updated };
  }

  /** In-place edits on a specific version (typically the current draft). */
  async updateVersion(
    versionId: string,
    dto: UpdateAnVersionDto,
  ): Promise<BaApproachNoteVersion> {
    const existing = await this.findVersion(versionId);

    const data: Record<string, unknown> = {};

    if (dto.sections) {
      const current = (existing.sections as Record<string, string> | null) ?? {};
      data.sections = { ...current, ...dto.sections } as never;
    }
    if (dto.brandTokens !== undefined) {
      const current = (existing.brandTokens as Record<string, unknown> | null) ?? {};
      data.brandTokens = { ...current, ...dto.brandTokens } as never;
    }
    if (dto.decisionsLocked !== undefined) {
      data.decisionsLocked = dto.decisionsLocked as never;
    }
    if (dto.openQuestions !== undefined) {
      data.openQuestions = dto.openQuestions as never;
    }
    if (dto.prdReadiness !== undefined) {
      // Shallow merge — editor sends only sub-sections that changed.
      const current = (existing.prdReadiness as Record<string, unknown> | null) ?? {};
      data.prdReadiness = { ...current, ...dto.prdReadiness } as never;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.baApproachNoteVersion.update({
      where: { id: versionId },
      data,
    });
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private async callAi(
    brd: { sections: unknown; frTable: unknown; openItems: unknown },
    changesRequested: string,
    productName?: string,
    audience?: 'internal-tool' | 'end-client-product',
  ): Promise<GenerateApproachNoteResponse> {
    const brdSections = (brd.sections as Record<string, string> | null) ?? {};
    const brdFrTable = (brd.frTable as { id: string; requirement: string; testable: boolean }[] | null) ?? [];
    const brdOpenItems = (brd.openItems as string[] | null) ?? [];

    return this.aiService.generateApproachNote({
      brdSections,
      brdFrTable,
      brdOpenItems,
      productName,
      audience,
      changesRequested,
    });
  }
}
