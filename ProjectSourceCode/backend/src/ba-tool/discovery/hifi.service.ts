import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AiService,
  type GenerateHifiRequest,
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
import { WireframeExportService } from '../pipeline/wireframe-export.service';

interface GenerateHifiOptions {
  projectId: string;
  wireframeSetId?: string;
  productName?: string;
  syntheticDataHint?: string;
  /** Sample mode — only generate hi-fi for the first N lo-fi screens (e.g. one batch). */
  limit?: number;
  /** Selection mode — only generate hi-fi for the lo-fi screens with these slugs. */
  slugs?: string[];
}

/**
 * Hi-fi is generated in batches so large sets (e.g. a 40-screen PRD-sourced
 * pipeline set) don't truncate against the model's output budget. Each batch is
 * an independent AI call sharing the same brand tokens + synthetic seed for
 * cross-screen coherence. Tunable via env; defaults suit Sonnet 4.6.
 */
// Hi-fi HTML is dense — a single screen's branded markup can approach the model's
// per-response output budget, so even 2–3 screens in one JSON envelope truncate
// (→ invalid JSON). Generate ONE screen per call by default; raise concurrency to
// recover throughput, with retry/backoff for transient rate limits.
const HIFI_BATCH_SIZE = Math.max(1, Number(process.env.HIFI_BATCH_SIZE) || 1);
const HIFI_BATCH_CONCURRENCY = Math.max(1, Number(process.env.HIFI_BATCH_CONCURRENCY) || 2);
const HIFI_BATCH_RETRIES = Math.max(0, Number(process.env.HIFI_BATCH_RETRIES) || 2);

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
    private readonly wireframeExport: WireframeExportService,
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

    // Selection mode (explicit slugs) takes precedence; else sample mode (first N);
    // else the whole set. Lets the BA pick exactly which lo-fi screens become hi-fi.
    const sourceScreens = opts.slugs?.length
      ? lofi.screens.filter((s) => opts.slugs!.includes(s.slug))
      : opts.limit && opts.limit > 0
        ? lofi.screens.slice(0, opts.limit)
        : lofi.screens;
    if (opts.slugs?.length || (opts.limit && opts.limit > 0)) {
      this.logger.log(
        `Hi-fi ${opts.slugs?.length ? 'SELECTION' : 'SAMPLE'} mode: generating ${sourceScreens.length}/${lofi.screens.length} screens (project=${opts.projectId})`,
      );
    }
    if (!sourceScreens.length) {
      throw new BadRequestException('No matching lo-fi screens selected for hi-fi generation.');
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
    const lofiScreens = sourceScreens.map((s) => ({
      sequenceNum: s.sequenceNum,
      slug: s.slug,
      title: s.title,
      pattern: s.pattern ?? null,
      callouts: ((s.callouts as unknown) as CalloutShape[] | null) ?? [],
      mdContent: s.mdContent ?? null,
    }));

    const ai = await this.generateHifiInBatches(lofiScreens, {
      brandTokens: {
        primary: String(brandTokens.primary ?? '#0B1B2E'),
        surface: String(brandTokens.surface ?? '#FFFFFF'),
        cta: String(brandTokens.cta ?? '#F97316'),
        productName: String(brandTokens.productName ?? opts.productName ?? '—'),
      },
      syntheticSeed: opts.syntheticDataHint ? { hint: opts.syntheticDataHint } : null,
      productName: opts.productName,
    });

    if (ai.screens.length === 0) {
      throw new BadRequestException(
        'AI returned no hi-fi screens — try regenerating',
      );
    }
    if (ai.screens.length < lofiScreens.length) {
      this.logger.warn(
        `Hi-fi partial: ${ai.screens.length}/${lofiScreens.length} screens returned ` +
          `(some batches may have failed) — project=${opts.projectId}`,
      );
    }

    const parity = this.validateParity(sourceScreens, ai.screens, ai.syntheticDataNotes);

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
    const full = await this.findById(result.id);
    // Track D — mirror hi-fi screens to ProjectArtifacts/04-Wireframes-HiFi/
    await this.wireframeExport.exportHiFi(opts.projectId, full.screens);
    return full;
  }

  /**
   * Generate hi-fi screens in batches to avoid output-budget truncation on large
   * sets. Batches share brand tokens + synthetic seed for coherence, run with
   * bounded concurrency, and a failed batch yields no screens (logged) rather
   * than aborting the whole set. Results are merged, de-duplicated by
   * `sequenceNum`, and sorted. A single-batch set takes the direct path.
   */
  private async generateHifiInBatches(
    lofiScreens: GenerateHifiRequest['lofiScreens'],
    base: Omit<GenerateHifiRequest, 'lofiScreens'>,
  ): Promise<GenerateHifiResponse> {
    const chunks: GenerateHifiRequest['lofiScreens'][] = [];
    for (let i = 0; i < lofiScreens.length; i += HIFI_BATCH_SIZE) {
      chunks.push(lofiScreens.slice(i, i + HIFI_BATCH_SIZE));
    }

    if (chunks.length <= 1) {
      return this.generateBatchWithRetry(lofiScreens, base, 0, 1);
    }

    this.logger.log(
      `Hi-fi batching: ${lofiScreens.length} screens → ${chunks.length} batches ` +
        `(size ${HIFI_BATCH_SIZE}, concurrency ${HIFI_BATCH_CONCURRENCY})`,
    );

    const results: GenerateHifiResponse[] = new Array(chunks.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      for (let idx = next++; idx < chunks.length; idx = next++) {
        results[idx] = await this.generateBatchWithRetry(chunks[idx], base, idx, chunks.length);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(HIFI_BATCH_CONCURRENCY, chunks.length) }, () => worker()),
    );

    const failed = results.filter((r) => !r?.screens?.length).length;
    if (failed) {
      this.logger.warn(`Hi-fi batching: ${failed}/${chunks.length} batches yielded no screens`);
    }

    // Merge — first occurrence per sequenceNum wins; preserve lo-fi order.
    const bySeq = new Map<number, HifiScreenPayload>();
    for (const r of results) {
      for (const s of r?.screens ?? []) {
        if (!bySeq.has(s.sequenceNum)) bySeq.set(s.sequenceNum, s);
      }
    }
    const screens = Array.from(bySeq.values()).sort((a, b) => a.sequenceNum - b.sequenceNum);
    return {
      screens,
      syntheticDataNotes: results.map((r) => r?.syntheticDataNotes).find(Boolean) ?? null,
      model: results.find((r) => r?.model)?.model,
    };
  }

  /**
   * One batch with bounded retry + exponential backoff. Retries transient
   * failures (rate limits, truncated/invalid JSON) before giving up; an
   * exhausted batch returns no screens (logged) so siblings still persist.
   */
  private async generateBatchWithRetry(
    lofiScreens: GenerateHifiRequest['lofiScreens'],
    base: Omit<GenerateHifiRequest, 'lofiScreens'>,
    idx: number,
    total: number,
  ): Promise<GenerateHifiResponse> {
    for (let attempt = 0; attempt <= HIFI_BATCH_RETRIES; attempt++) {
      try {
        return await this.aiService.generateHifi({ lofiScreens, ...base });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const last = attempt === HIFI_BATCH_RETRIES;
        this.logger.error(
          `Hi-fi batch ${idx + 1}/${total} attempt ${attempt + 1}/${HIFI_BATCH_RETRIES + 1} failed: ${msg}` +
            (last ? ' — giving up' : ' — retrying'),
        );
        if (last) break;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); // 2s, 4s, …
      }
    }
    return { screens: [], syntheticDataNotes: null, model: undefined };
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
