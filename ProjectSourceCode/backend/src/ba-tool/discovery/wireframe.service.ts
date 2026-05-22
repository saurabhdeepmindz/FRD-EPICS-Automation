import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AiService,
  type GenerateWireframesResponse,
  type WireframeScreenPayload,
} from '../../ai/ai.service';
import type {
  BaWireframeSet,
  BaWireframeScreen,
  BaApproachNoteVersion,
} from '@prisma/client';
import type { UpdateWireframeScreenDto } from './dto/update-wireframe-screen.dto';

interface GenerateWireframesOptions {
  projectId: string;
  approachNoteVersionId?: string;
  selectedPatterns?: string[];
  productName?: string;
}

interface CalloutShape {
  n: number | string;
  description: string;
  mappedTo: string;
}

interface CoverageStatus {
  validated: boolean;
  totalScreens: number;
  totalCallouts: number;
  totalFrs: number;
  /** FRs from BRD that don't appear in any screen's callouts. */
  orphanFrs: string[];
  /** Screen sequenceNums that have zero callouts. */
  orphanScreens: number[];
  notes?: string | null;
}

export interface BaWireframeSetWithScreens extends BaWireframeSet {
  screens: BaWireframeScreen[];
}

@Injectable()
export class WireframeService {
  private readonly logger = new Logger(WireframeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Generate a new wireframe set from the specified (or current) AN version.
   * Phase 1 overwrites prior sets — subsequent regenerations create a new set
   * rather than mutating in place, preserving history. The `findLatestForProject`
   * call returns the most-recent set.
   */
  async generate(opts: GenerateWireframesOptions): Promise<BaWireframeSetWithScreens> {
    const version = await this.resolveVersion(opts.projectId, opts.approachNoteVersionId);

    const sections = (version.sections as Record<string, string> | null) ?? {};
    const brandTokens = (version.brandTokens as Record<string, unknown> | null) ?? {
      primary: '#0B1B2E',
      surface: '#FFFFFF',
      cta: '#F97316',
      productName: opts.productName ?? '—',
    };

    // Pull the BRD's structured FR table (via the AN's BRD link) so the AI has
    // canonical FR IDs to map screens against.
    const brd = await this.prisma.baBrd.findFirst({
      where: { id: (await this.prisma.baApproachNote.findUnique({ where: { id: version.approachNoteId } }))?.brdId ?? '' },
      select: { frTable: true },
    });
    const frTable = (brd?.frTable as { id: string; requirement: string; testable: boolean }[] | null) ?? [];

    const ai = await this.aiService.generateWireframes({
      anSections: sections,
      frTable,
      brandTokens: {
        primary: String(brandTokens.primary ?? '#0B1B2E'),
        surface: String(brandTokens.surface ?? '#FFFFFF'),
        cta: String(brandTokens.cta ?? '#F97316'),
        productName: String(brandTokens.productName ?? opts.productName ?? '—'),
      },
      selectedPatterns: opts.selectedPatterns,
      productName: opts.productName,
    });

    if (ai.screens.length === 0) {
      throw new BadRequestException('AI returned no screens — check the AN content / try regenerating');
    }

    const coverage = this.validateCoverage(ai.screens, frTable, ai.coverageNotes);

    // Persist set + screens in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const set = await tx.baWireframeSet.create({
        data: {
          projectId: opts.projectId,
          approachNoteVersionId: version.id,
          brandTokensSnapshot: brandTokens as never,
          coverageStatus: (coverage as unknown) as never,
          meta: {
            audience: opts.productName ?? null,
            model: ai.model ?? null,
            generatedAt: new Date().toISOString(),
            screenCount: ai.screens.length,
          } as never,
          status: 'DRAFT',
        },
      });

      // Insert screens sequentially to honor sequenceNum unique-per-set
      for (const s of ai.screens) {
        await tx.baWireframeScreen.create({
          data: {
            setId: set.id,
            sequenceNum: s.sequenceNum,
            slug: s.slug,
            title: s.title,
            pattern: s.pattern ?? null,
            callouts: ((s.callouts ?? []) as unknown) as never,
            components: ((s.components ?? []) as unknown) as never,
            mdContent: s.mdContent ?? null,
            htmlContent: s.htmlContent ?? null,
            meta: { frRefs: s.frRefs ?? [] } as never,
          },
        });
      }

      return set;
    });

    this.logger.log(
      `Wireframe set generated: ${result.id} · ${ai.screens.length} screens (project=${opts.projectId})`,
    );
    return this.findById(result.id);
  }

  async findLatestForProject(projectId: string): Promise<BaWireframeSetWithScreens | null> {
    const set = await this.prisma.baWireframeSet.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!set) return null;
    return this.findById(set.id);
  }

  async findById(setId: string): Promise<BaWireframeSetWithScreens> {
    const set = await this.prisma.baWireframeSet.findUnique({
      where: { id: setId },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!set) throw new NotFoundException(`Wireframe set ${setId} not found`);
    return set;
  }

  async findScreenById(screenId: string): Promise<BaWireframeScreen> {
    const screen = await this.prisma.baWireframeScreen.findUnique({
      where: { id: screenId },
    });
    if (!screen) throw new NotFoundException(`Wireframe screen ${screenId} not found`);
    return screen;
  }

  async updateScreen(
    screenId: string,
    dto: UpdateWireframeScreenDto,
  ): Promise<BaWireframeScreen> {
    await this.findScreenById(screenId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.mdContent !== undefined) data.mdContent = dto.mdContent;
    if (dto.htmlContent !== undefined) data.htmlContent = dto.htmlContent;
    if (dto.callouts !== undefined) data.callouts = dto.callouts as never;
    if (dto.components !== undefined) data.components = dto.components as never;

    return this.prisma.baWireframeScreen.update({
      where: { id: screenId },
      data,
    });
  }

  async regenerate(setId: string): Promise<BaWireframeSetWithScreens> {
    const existing = await this.findById(setId);
    return this.generate({
      projectId: existing.projectId,
      approachNoteVersionId: existing.approachNoteVersionId,
    });
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private async resolveVersion(
    projectId: string,
    approachNoteVersionId?: string,
  ): Promise<BaApproachNoteVersion> {
    if (approachNoteVersionId) {
      const v = await this.prisma.baApproachNoteVersion.findUnique({
        where: { id: approachNoteVersionId },
      });
      if (!v) throw new NotFoundException(`AN version ${approachNoteVersionId} not found`);
      return v;
    }
    const an = await this.prisma.baApproachNote.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!an) {
      throw new BadRequestException('No Approach Note exists for this project — generate Stage 3 first');
    }
    if (!an.currentVersionId) {
      throw new BadRequestException('Approach Note has no current version');
    }
    const v = await this.prisma.baApproachNoteVersion.findUnique({
      where: { id: an.currentVersionId },
    });
    if (!v) throw new NotFoundException(`Current AN version ${an.currentVersionId} not found`);
    return v;
  }

  /**
   * Deterministic coverage validation per skill 04 §8 quality criteria.
   * - Every FR has at least one screen callout that maps to it (no orphan FRs)
   * - Every screen has at least one callout (no orphan screens)
   */
  private validateCoverage(
    screens: WireframeScreenPayload[],
    frTable: { id: string }[],
    notes: string | null | undefined,
  ): CoverageStatus {
    const allFrIds = new Set(frTable.map((f) => f.id));
    const calledFrIds = new Set<string>();
    const orphanScreens: number[] = [];
    let totalCallouts = 0;

    for (const s of screens) {
      const callouts = s.callouts ?? [];
      totalCallouts += callouts.length;
      if (callouts.length === 0) orphanScreens.push(s.sequenceNum);
      for (const c of callouts) {
        if (c.mappedTo) {
          // mappedTo can be "FR-1" or "FR-1 · §3.10" — split on common delimiters
          c.mappedTo.split(/[·,;]+/).forEach((token) => {
            const trimmed = token.trim();
            if (allFrIds.has(trimmed)) calledFrIds.add(trimmed);
          });
        }
      }
      // Also honor explicit frRefs from AI
      for (const fr of s.frRefs ?? []) {
        if (allFrIds.has(fr)) calledFrIds.add(fr);
      }
    }

    const orphanFrs = [...allFrIds].filter((fr) => !calledFrIds.has(fr));

    return {
      validated: orphanFrs.length === 0 && orphanScreens.length === 0,
      totalScreens: screens.length,
      totalCallouts,
      totalFrs: allFrIds.size,
      orphanFrs,
      orphanScreens,
      notes: notes ?? null,
    };
  }
}
