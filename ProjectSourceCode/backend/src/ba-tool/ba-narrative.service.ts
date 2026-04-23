import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractionService } from './text-extraction.service';
import { ATTACHMENT_STORAGE } from './storage/storage.module';
import type { AttachmentStorage } from './storage/storage.interface';

/**
 * Narrative scope. Each scope is backed by its own Prisma config +
 * attachment tables, Python gap-check endpoint, and suffix conventions.
 */
export type NarrativeScope = 'LLD' | 'FTC';

export interface NarrativeGap {
  id: string;
  category: string;
  question: string;
  suggestion: string;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Hard cap: sum of all attachment sizes per config. The UI enforces this too,
 * but we revalidate server-side so the limit is real.
 */
export const MAX_TOTAL_ATTACHMENT_BYTES = 30 * 1024 * 1024;

interface ScopedConfigRow {
  id: string;
  moduleDbId: string;
  narrative: string | null;
  useAsAdditional: boolean;
  // Stack / template / NFR fields are LLD-only; typed as unknown so FTC configs
  // (which don't have them) can share the same row shape in this service.
  [key: string]: unknown;
}

/**
 * Scope-agnostic narrative service used by both LLD and FTC workbenches.
 * Each call takes the scope so the same business logic reads/writes the right
 * Prisma tables and calls the right Python endpoint.
 */
@Injectable()
export class BaNarrativeService {
  private readonly logger = new Logger(BaNarrativeService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: TextExtractionService,
    private readonly config: ConfigService,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:5000';
  }

  // ─── Scope-aware table dispatch ─────────────────────────────────────────

  private configTable(scope: NarrativeScope) {
    return scope === 'LLD' ? this.prisma.baLldConfig : this.prisma.baFtcConfig;
  }

  private attachmentTable(scope: NarrativeScope) {
    return scope === 'LLD'
      ? this.prisma.baLldConfigAttachment
      : this.prisma.baFtcConfigAttachment;
  }

  private configForeignKey(scope: NarrativeScope): 'lldConfigId' | 'ftcConfigId' {
    return scope === 'LLD' ? 'lldConfigId' : 'ftcConfigId';
  }

  private gapCheckEndpoint(scope: NarrativeScope): string {
    return scope === 'LLD'
      ? `${this.aiServiceUrl}/ba/lld-gap-check`
      : `${this.aiServiceUrl}/ba/ftc-gap-check`;
  }

  private storageScope(scope: NarrativeScope, configId: string): string {
    return scope === 'LLD' ? `lld-config/${configId}` : `ftc-config/${configId}`;
  }

  private async ensureConfig(moduleDbId: string, scope: NarrativeScope): Promise<{
    module: { id: string; moduleId: string; moduleName: string; packageName: string };
    config: ScopedConfigRow;
  }> {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const table = this.configTable(scope);
    // Prisma delegate types differ per scope, so we use a runtime branch rather
    // than trying to unify the generic types.
    let cfg: ScopedConfigRow | null;
    if (scope === 'LLD') {
      cfg = (await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } })) as ScopedConfigRow | null;
      if (!cfg) cfg = (await this.prisma.baLldConfig.create({ data: { moduleDbId } })) as ScopedConfigRow;
    } else {
      cfg = (await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } })) as ScopedConfigRow | null;
      if (!cfg) cfg = (await this.prisma.baFtcConfig.create({ data: { moduleDbId } })) as ScopedConfigRow;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void table;
    return {
      module: { id: mod.id, moduleId: mod.moduleId, moduleName: mod.moduleName, packageName: mod.packageName },
      config: cfg!,
    };
  }

  // ─── Attachments ────────────────────────────────────────────────────────

  async listAttachments(moduleDbId: string, scope: NarrativeScope) {
    const { config } = await this.ensureConfig(moduleDbId, scope);
    const fk = this.configForeignKey(scope);
    const rows = scope === 'LLD'
      ? await this.prisma.baLldConfigAttachment.findMany({
          where: { [fk]: config.id } as never,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, fileName: true, mimeType: true, sizeBytes: true,
            extractionNote: true, storageBackend: true, createdAt: true,
          },
        })
      : await this.prisma.baFtcConfigAttachment.findMany({
          where: { [fk]: config.id } as never,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, fileName: true, mimeType: true, sizeBytes: true,
            extractionNote: true, storageBackend: true, createdAt: true,
          },
        });
    const totalBytes = rows.reduce((sum, r) => sum + r.sizeBytes, 0);
    return { attachments: rows, totalBytes, maxTotalBytes: MAX_TOTAL_ATTACHMENT_BYTES };
  }

  async uploadAttachments(moduleDbId: string, scope: NarrativeScope, files: UploadedFile[]) {
    if (!files || files.length === 0) throw new BadRequestException('No files supplied');
    const { config } = await this.ensureConfig(moduleDbId, scope);
    const fk = this.configForeignKey(scope);

    const existing = scope === 'LLD'
      ? await this.prisma.baLldConfigAttachment.aggregate({
          where: { [fk]: config.id } as never,
          _sum: { sizeBytes: true },
        })
      : await this.prisma.baFtcConfigAttachment.aggregate({
          where: { [fk]: config.id } as never,
          _sum: { sizeBytes: true },
        });
    const currentTotal = existing._sum.sizeBytes ?? 0;
    const incoming = files.reduce((s, f) => s + f.size, 0);
    if (currentTotal + incoming > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `Total attachments would exceed 30 MB (${((currentTotal + incoming) / 1024 / 1024).toFixed(1)} MB). Delete some first.`,
      );
    }

    const created: { id: string; fileName: string; extractionNote?: string | null }[] = [];
    for (const f of files) {
      const storageKey = await this.storage.put(
        this.storageScope(scope, config.id),
        f.originalname,
        f.buffer,
        f.mimetype,
      );
      const { text, note } = await this.extractor.extract(f.buffer, f.mimetype, f.originalname);
      const data = {
        [fk]: config.id,
        fileName: f.originalname,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        storageBackend: this.storage.backendName,
        storageKey,
        extractedText: text || null,
        extractionNote: note ?? null,
      };
      const row = scope === 'LLD'
        ? await this.prisma.baLldConfigAttachment.create({
            data: data as never,
            select: { id: true, fileName: true, extractionNote: true },
          })
        : await this.prisma.baFtcConfigAttachment.create({
            data: data as never,
            select: { id: true, fileName: true, extractionNote: true },
          });
      created.push(row);
    }
    return this.listAttachments(moduleDbId, scope).then((state) => ({ created, ...state }));
  }

  async deleteAttachment(moduleDbId: string, scope: NarrativeScope, attachmentId: string) {
    const { config } = await this.ensureConfig(moduleDbId, scope);
    const fk = this.configForeignKey(scope);
    const row = scope === 'LLD'
      ? await this.prisma.baLldConfigAttachment.findFirst({ where: { id: attachmentId, [fk]: config.id } as never })
      : await this.prisma.baFtcConfigAttachment.findFirst({ where: { id: attachmentId, [fk]: config.id } as never });
    if (!row) throw new NotFoundException(`Attachment ${attachmentId} not found for this module`);
    try {
      await this.storage.delete(row.storageKey);
    } catch (err: unknown) {
      this.logger.warn(`storage.delete failed (continuing): ${err instanceof Error ? err.message : err}`);
    }
    if (scope === 'LLD') {
      await this.prisma.baLldConfigAttachment.delete({ where: { id: attachmentId } });
    } else {
      await this.prisma.baFtcConfigAttachment.delete({ where: { id: attachmentId } });
    }
    return { deleted: attachmentId };
  }

  // ─── Gap-check ──────────────────────────────────────────────────────────

  async gapCheck(
    moduleDbId: string,
    scope: NarrativeScope,
    extraContext: Record<string, unknown> = {},
  ): Promise<{ gaps: NarrativeGap[]; model: string }> {
    const { module: mod, config } = await this.ensureConfig(moduleDbId, scope);
    const narrative = (config.narrative as string | null) ?? '';
    if (!narrative.trim()) {
      throw new BadRequestException('Narrative is empty — write or dictate before running gap-check.');
    }

    const fk = this.configForeignKey(scope);
    const attachments = scope === 'LLD'
      ? await this.prisma.baLldConfigAttachment.findMany({
          where: { [fk]: config.id } as never,
          select: { fileName: true, extractedText: true },
        })
      : await this.prisma.baFtcConfigAttachment.findMany({
          where: { [fk]: config.id } as never,
          select: { fileName: true, extractedText: true },
        });
    const attachmentText = attachments
      .filter((a) => a.extractedText && a.extractedText.trim())
      .map((a) => `--- ${a.fileName} ---\n${a.extractedText}`)
      .join('\n\n')
      .slice(0, 40_000);

    const moduleContext = this.buildModuleContextSummary(mod, config);

    try {
      const { data } = await axios.post<{ gaps: NarrativeGap[]; model: string }>(
        this.gapCheckEndpoint(scope),
        {
          moduleContext,
          narrative,
          attachmentText,
          useAsAdditional: config.useAsAdditional,
          ...extraContext,
        },
        { timeout: 90_000 },
      );
      return { gaps: data.gaps ?? [], model: data.model };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      throw new BadRequestException(`Gap-check failed: ${msg}`);
    }
  }

  /**
   * Build an assembled context block for the orchestrator to append or use as
   * primary input. Returns an empty string when no narrative is configured so
   * the standard flow is left untouched.
   */
  async buildNarrativeContextBlock(moduleDbId: string, scope: NarrativeScope): Promise<{
    text: string;
    useAsAdditional: boolean;
    hasNarrative: boolean;
  }> {
    const config = scope === 'LLD'
      ? await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } })
      : await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });
    if (!config || !config.narrative || !config.narrative.trim()) {
      return { text: '', useAsAdditional: true, hasNarrative: false };
    }
    const fk = this.configForeignKey(scope);
    const attachments = scope === 'LLD'
      ? await this.prisma.baLldConfigAttachment.findMany({
          where: { [fk]: config.id } as never,
          select: { fileName: true, extractedText: true },
        })
      : await this.prisma.baFtcConfigAttachment.findMany({
          where: { [fk]: config.id } as never,
          select: { fileName: true, extractedText: true },
        });
    const header = scope === 'LLD' ? 'Architect Narrative' : 'Tester / Architect Narrative';
    const attachmentHeader = scope === 'LLD'
      ? 'Architect Attachments (extracted text)'
      : 'Test Plan Attachments (extracted text)';
    const parts: string[] = [];
    parts.push(`### ${header}`);
    parts.push(config.narrative.trim());
    const attachmentBlocks = attachments
      .filter((a) => a.extractedText && a.extractedText.trim())
      .map((a) => `#### ${a.fileName}\n${a.extractedText}`);
    if (attachmentBlocks.length > 0) {
      parts.push(`### ${attachmentHeader}`);
      parts.push(attachmentBlocks.join('\n\n'));
    }
    return {
      text: parts.join('\n\n'),
      useAsAdditional: config.useAsAdditional,
      hasNarrative: true,
    };
  }

  private buildModuleContextSummary(
    mod: { moduleId: string; moduleName: string; packageName: string },
    config: ScopedConfigRow,
  ): string {
    const bits = [
      `Module: ${mod.moduleId} — ${mod.moduleName} (${mod.packageName})`,
      config.frontendStackId ? `Frontend stack: ${config.frontendStackId}` : null,
      config.backendStackId ? `Backend stack: ${config.backendStackId}` : null,
      config.databaseId ? `Database: ${config.databaseId}` : null,
      config.architectureId ? `Architecture: ${config.architectureId}` : null,
      config.streamingId ? `Streaming: ${config.streamingId}` : null,
      config.cachingId ? `Caching: ${config.cachingId}` : null,
      config.storageId ? `Storage: ${config.storageId}` : null,
      config.cloudId ? `Cloud: ${config.cloudId}` : null,
      // FTC-specific fields (absent on LLD configs). testingFrameworks is an
      // array since v4.3; we emit a single comma-separated line.
      Array.isArray(config.testingFrameworks) && (config.testingFrameworks as unknown[]).length > 0
        ? `Testing frameworks: ${(config.testingFrameworks as string[]).join(', ')}`
        : null,
      Array.isArray(config.testTypes) && (config.testTypes as unknown[]).length > 0
        ? `Test types: ${(config.testTypes as string[]).join(', ')}`
        : null,
      config.coverageTarget ? `Coverage target: ${config.coverageTarget}` : null,
    ].filter(Boolean);
    return bits.join('\n');
  }
}
