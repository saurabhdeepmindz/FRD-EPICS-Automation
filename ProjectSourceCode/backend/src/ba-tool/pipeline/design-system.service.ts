import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DesignTokens,
  DEFAULT_TOKENS,
  normalizeTokens,
  renderSamplePreview,
} from './design-tokens';
import { SEED_PRESETS } from './design-presets';

/**
 * Design System / "Look & Feel" Studio (Sprint v9 · Track BB).
 * Per-project active tokens (+ logo), a shared/per-project preset library, and a
 * deterministic sample preview. Tokens are consumed downstream by lo-fi, hi-fi,
 * and the wireframe navigator via the shared `tokensToCss()`.
 */

interface LogoFile {
  originalname: string;
  buffer: Buffer;
  mimetype?: string;
}

export interface DesignLogo {
  dataUri: string;
  fileName: string;
  mimeType: string;
}

const LOGO_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml',
};
const MAX_LOGO_BYTES = 1_500_000;

@Injectable()
export class DesignSystemService {
  private readonly logger = new Logger(DesignSystemService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Latest design system for a project, or null. */
  async getActive(projectId: string) {
    return this.prisma.baDesignSystem.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
  }

  /** Resolve the effective tokens for a project (active system → defaults). */
  async resolveTokens(projectId: string): Promise<DesignTokens> {
    const active = await this.getActive(projectId);
    return normalizeTokens(active?.tokens ?? DEFAULT_TOKENS);
  }

  /** Save a new version of the project's design system (normalized tokens). */
  async save(
    projectId: string,
    tokens: unknown,
    logo?: DesignLogo | null,
    presetId?: string | null,
  ) {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const latest = await this.getActive(projectId);
    const [prd, map] = await Promise.all([
      this.prisma.baProjectPrd.findFirst({ where: { projectId }, orderBy: { version: 'desc' }, select: { version: true } }),
      this.prisma.baScreenMap.findFirst({ where: { projectId }, orderBy: { version: 'desc' }, select: { version: true } }),
    ]);

    return this.prisma.baDesignSystem.create({
      data: {
        projectId,
        version: (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        tokens: normalizeTokens(tokens) as unknown as Prisma.InputJsonValue,
        logo: (logo ?? latest?.logo ?? null) as unknown as Prisma.InputJsonValue,
        presetId: presetId ?? null,
        sourceArtifactVersions: { prdVersion: prd?.version, screenMapVersion: map?.version } as Prisma.InputJsonValue,
      },
    });
  }

  /** Convert an uploaded logo file to a sanitized data-URI (no DB write). */
  processLogo(file: LogoFile): DesignLogo {
    const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
    const mime = LOGO_MIME[ext];
    if (!mime) throw new BadRequestException('Logo must be PNG, JPG, or SVG.');
    if (file.buffer.length > MAX_LOGO_BYTES) {
      throw new BadRequestException(`Logo too large (max ${Math.round(MAX_LOGO_BYTES / 1000)}KB).`);
    }
    let buf = file.buffer;
    if (ext === 'svg') {
      // Strip scripts / event handlers from inline SVG before embedding.
      const cleaned = file.buffer
        .toString('utf-8')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '');
      buf = Buffer.from(cleaned, 'utf-8');
    }
    return { dataUri: `data:${mime};base64,${buf.toString('base64')}`, fileName: file.originalname, mimeType: mime };
  }

  /** Deterministic sample preview HTML for the studio (web | mobile). */
  async preview(projectId: string, platform: 'web' | 'mobile', tokensOverride?: unknown): Promise<string> {
    const active = await this.getActive(projectId);
    const tokens = tokensOverride ?? active?.tokens ?? DEFAULT_TOKENS;
    const logo = (active?.logo as { dataUri?: string } | null) ?? null;
    return renderSamplePreview(tokens, { platform, logo });
  }

  // ── Preset library ─────────────────────────────────────────────────────────

  /** GLOBAL presets + this project's PROJECT presets (seeds the library lazily). */
  async listPresets(projectId: string) {
    await this.ensureSeedPresets();
    return this.prisma.baDesignPreset.findMany({
      where: { OR: [{ scope: 'GLOBAL' }, { scope: 'PROJECT', projectId }] },
      orderBy: [{ isSeed: 'desc' }, { name: 'asc' }],
    });
  }

  /** The tokens of a single preset (frontend loads these into the form). */
  async getPresetTokens(presetId: string): Promise<DesignTokens> {
    const preset = await this.prisma.baDesignPreset.findUnique({ where: { id: presetId } });
    if (!preset) throw new NotFoundException(`Preset ${presetId} not found`);
    return normalizeTokens(preset.tokens);
  }

  /** Save the current tokens as a new preset (GLOBAL or PROJECT). */
  async saveAsPreset(
    name: string,
    tokens: unknown,
    scope: 'GLOBAL' | 'PROJECT',
    projectId?: string | null,
  ) {
    if (!name?.trim()) throw new BadRequestException('Preset name is required.');
    return this.prisma.baDesignPreset.create({
      data: {
        name: name.trim(),
        scope,
        projectId: scope === 'PROJECT' ? projectId ?? null : null,
        tokens: normalizeTokens(tokens) as unknown as Prisma.InputJsonValue,
        isSeed: false,
      },
    });
  }

  /** Idempotently seed the shipped starter presets (by name, isSeed=true). */
  async ensureSeedPresets(): Promise<void> {
    const existing = await this.prisma.baDesignPreset.count({ where: { isSeed: true } });
    if (existing >= SEED_PRESETS.length) return;
    for (const p of SEED_PRESETS) {
      const found = await this.prisma.baDesignPreset.findFirst({ where: { name: p.name, isSeed: true } });
      if (found) continue;
      await this.prisma.baDesignPreset.create({
        data: {
          name: p.name,
          scope: 'GLOBAL',
          tokens: p.tokens as unknown as Prisma.InputJsonValue,
          isSeed: true,
        },
      });
    }
    this.logger.log(`Seeded design presets (${SEED_PRESETS.length} starters)`);
  }
}
