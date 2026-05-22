import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AiService,
  type GenerateHifiResponse,
  type HifiScreenPayload,
} from '../../ai/ai.service';
import type {
  BaHifiSet,
  BaHifiScreen,
  BaWireframeSet,
  BaWireframeScreen,
} from '@prisma/client';
import type { UpdateHifiScreenDto } from './dto/update-hifi-screen.dto';

interface GenerateHifiOptions {
  projectId: string;
  wireframeSetId?: string;
  productName?: string;
  syntheticDataHint?: string;
}

interface CalloutShape {
  n: number | string;
  description: string;
  mappedTo: string;
}

interface ScreenParity {
  sequenceNum: number;
  /** Lo-fi callout numbers as strings (sorted) */
  lofiCallouts: string[];
  /** Hi-fi callout numbers as strings (sorted) */
  hifiCallouts: string[];
  /** Hi-fi-only annotations (must be letter-suffixed e.g. "3a") */
  hifiOnly: string[];
  /** Lo-fi callouts that the hi-fi failed to reproduce */
  missing: string[];
  /** Hi-fi-only entries that violated the letter-suffix convention */
  invalidExtras: string[];
  ok: boolean;
}

interface ParityStatus {
  validated: boolean;
  totalScreens: number;
  perScreen: ScreenParity[];
  notes?: string | null;
}

export interface BaHifiSetWithScreens extends BaHifiSet {
  screens: BaHifiScreen[];
}

type LofiSetWithScreens = BaWireframeSet & { screens: BaWireframeScreen[] };

@Injectable()
export class HifiService {
  private readonly logger = new Logger(HifiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Generate a new hi-fi mockup set from the specified (or latest) lo-fi
   * wireframe set. Each regeneration creates a new BaHifiSet row rather
   * than mutating in place, preserving history.
   */
  async generate(opts: GenerateHifiOptions): Promise<BaHifiSetWithScreens> {
    const lofi = await this.resolveLofiSet(opts.projectId, opts.wireframeSetId);

    if (lofi.screens.length === 0) {
      throw new BadRequestException(
        'Lo-fi wireframe set has no screens — regenerate Stage 4 first',
      );
    }

    const brandTokens =
      (lofi.brandTokensSnapshot as Record<string, unknown> | null) ?? {
        primary: '#0B1B2E',
        surface: '#FFFFFF',
        cta: '#F97316',
        productName: opts.productName ?? '—',
      };

    // Compose lo-fi screen payload for the AI (light-weight; markdown body
    // truncated to keep token budget sane — full structure is preserved).
    const lofiScreens = lofi.screens.map((s) => ({
      sequenceNum: s.sequenceNum,
      slug: s.slug,
      title: s.title,
      pattern: s.pattern ?? null,
      callouts: ((s.callouts as unknown) as CalloutShape[] | null) ?? [],
      mdContent: s.mdContent ?? null,
    }));

    const ai = await this.aiService.generateHifi({
      lofiScreens,
      brandTokens: {
        primary: String(brandTokens.primary ?? '#0B1B2E'),
        surface: String(brandTokens.surface ?? '#FFFFFF'),
        cta: String(brandTokens.cta ?? '#F97316'),
        productName: String(brandTokens.productName ?? opts.productName ?? '—'),
      },
      syntheticSeed: opts.syntheticDataHint
        ? { hint: opts.syntheticDataHint }
        : null,
      productName: opts.productName,
    });

    if (ai.screens.length === 0) {
      throw new BadRequestException(
        'AI returned no hi-fi screens — try regenerating',
      );
    }

    const parity = this.validateParity(lofi.screens, ai.screens, ai.syntheticDataNotes);

    const result = await this.prisma.$transaction(async (tx) => {
      const set = await tx.baHifiSet.create({
        data: {
          projectId: opts.projectId,
          wireframeSetId: lofi.id,
          brandTokensSnapshot: brandTokens as never,
          syntheticDataSeed: (ai.syntheticDataNotes
            ? { notes: ai.syntheticDataNotes }
            : opts.syntheticDataHint
              ? { hint: opts.syntheticDataHint }
              : null) as never,
          parityStatus: (parity as unknown) as never,
          meta: {
            audience: opts.productName ?? null,
            model: ai.model ?? null,
            generatedAt: new Date().toISOString(),
            screenCount: ai.screens.length,
          } as never,
          status: 'DRAFT',
        },
      });

      for (const s of ai.screens) {
        const perScreen = parity.perScreen.find(
          (p) => p.sequenceNum === s.sequenceNum,
        );
        await tx.baHifiScreen.create({
          data: {
            setId: set.id,
            sequenceNum: s.sequenceNum,
            slug: s.slug,
            title: s.title,
            htmlContent: s.htmlContent ?? '',
            callouts: ((s.callouts ?? []) as unknown) as never,
            parityStatus: (perScreen ?? null) as never,
            meta: {} as never,
          },
        });
      }

      return set;
    });

    this.logger.log(
      `Hi-fi set generated: ${result.id} · ${ai.screens.length} screens · parity=${parity.validated} (project=${opts.projectId})`,
    );
    return this.findById(result.id);
  }

  async findLatestForProject(projectId: string): Promise<BaHifiSetWithScreens | null> {
    const set = await this.prisma.baHifiSet.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!set) return null;
    return this.findById(set.id);
  }

  async findById(setId: string): Promise<BaHifiSetWithScreens> {
    const set = await this.prisma.baHifiSet.findUnique({
      where: { id: setId },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!set) throw new NotFoundException(`Hi-fi set ${setId} not found`);
    return set;
  }

  async findScreenById(screenId: string): Promise<BaHifiScreen> {
    const screen = await this.prisma.baHifiScreen.findUnique({
      where: { id: screenId },
    });
    if (!screen) throw new NotFoundException(`Hi-fi screen ${screenId} not found`);
    return screen;
  }

  async updateScreen(
    screenId: string,
    dto: UpdateHifiScreenDto,
  ): Promise<BaHifiScreen> {
    const existing = await this.findScreenById(screenId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.htmlContent !== undefined) data.htmlContent = dto.htmlContent;
    if (dto.callouts !== undefined) {
      // Re-validate parity for this single screen against its lo-fi parent.
      const set = await this.prisma.baHifiSet.findUnique({
        where: { id: existing.setId },
      });
      if (set) {
        const lofiSet = await this.prisma.baWireframeSet.findUnique({
          where: { id: set.wireframeSetId },
          include: { screens: true },
        });
        const lofiScreen = lofiSet?.screens.find(
          (ls) => ls.sequenceNum === existing.sequenceNum,
        );
        if (lofiScreen) {
          const lofiCallouts = ((lofiScreen.callouts as unknown) as CalloutShape[]) ?? [];
          const parity = this.computeScreenParity(
            existing.sequenceNum,
            lofiCallouts,
            dto.callouts,
          );
          data.parityStatus = parity as never;
        }
      }
      data.callouts = dto.callouts as never;
    }

    return this.prisma.baHifiScreen.update({
      where: { id: screenId },
      data,
    });
  }

  async regenerate(setId: string): Promise<BaHifiSetWithScreens> {
    const existing = await this.findById(setId);
    return this.generate({
      projectId: existing.projectId,
      wireframeSetId: existing.wireframeSetId,
    });
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private async resolveLofiSet(
    projectId: string,
    wireframeSetId?: string,
  ): Promise<LofiSetWithScreens> {
    if (wireframeSetId) {
      const set = await this.prisma.baWireframeSet.findUnique({
        where: { id: wireframeSetId },
        include: { screens: { orderBy: { sequenceNum: 'asc' } } },
      });
      if (!set) {
        throw new NotFoundException(`Wireframe set ${wireframeSetId} not found`);
      }
      return set;
    }
    const set = await this.prisma.baWireframeSet.findFirst({
      where: { projectId },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!set) {
      throw new BadRequestException(
        'No lo-fi wireframe set exists for this project — generate Stage 4 first',
      );
    }
    return set;
  }

  /**
   * Skill 05 §7 callout-parity invariant.
   * Hi-fi callouts MUST equal the lo-fi parent's 1:1 (no renumbering).
   * Hi-fi-only annotations are allowed only as letter-suffixed extras
   * (e.g. "3a", "5b") — never plain new integers.
   */
  private validateParity(
    lofiScreens: BaWireframeScreen[],
    hifiScreens: HifiScreenPayload[],
    notes: string | null | undefined,
  ): ParityStatus {
    const perScreen: ScreenParity[] = [];

    const lofiBySeq = new Map<number, BaWireframeScreen>();
    for (const ls of lofiScreens) lofiBySeq.set(ls.sequenceNum, ls);

    for (const hs of hifiScreens) {
      const lofi = lofiBySeq.get(hs.sequenceNum);
      const lofiCallouts =
        ((lofi?.callouts as unknown) as CalloutShape[] | null) ?? [];
      perScreen.push(this.computeScreenParity(hs.sequenceNum, lofiCallouts, hs.callouts));
    }

    return {
      validated: perScreen.every((p) => p.ok),
      totalScreens: hifiScreens.length,
      perScreen,
      notes: notes ?? null,
    };
  }

  private computeScreenParity(
    sequenceNum: number,
    lofiCallouts: CalloutShape[],
    hifiCallouts: CalloutShape[],
  ): ScreenParity {
    const lofiNums = lofiCallouts.map((c) => String(c.n));
    const hifiNums = hifiCallouts.map((c) => String(c.n));

    const lofiSet = new Set(lofiNums);
    const hifiSet = new Set(hifiNums);

    const missing = lofiNums.filter((n) => !hifiSet.has(n));
    const hifiOnly = hifiNums.filter((n) => !lofiSet.has(n));

    // Letter-suffix rule: hi-fi-only entries must be of the form `<lofiNum><letters>`,
    // e.g. "3a", "5b" — where `<lofiNum>` exists in the lo-fi parent.
    const invalidExtras = hifiOnly.filter((extra) => {
      const m = /^(\d+)([a-zA-Z]+)$/.exec(extra);
      if (!m) return true;
      return !lofiSet.has(m[1]);
    });

    return {
      sequenceNum,
      lofiCallouts: [...lofiNums].sort(),
      hifiCallouts: [...hifiNums].sort(),
      hifiOnly: hifiOnly.sort(),
      missing: missing.sort(),
      invalidExtras: invalidExtras.sort(),
      ok: missing.length === 0 && invalidExtras.length === 0,
    };
  }
}
