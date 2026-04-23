import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractionService } from './text-extraction.service';
import { ATTACHMENT_STORAGE } from './storage/storage.module';
import type { AttachmentStorage } from './storage/storage.interface';

export interface LldGap {
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
 * Hard cap: sum of all attachment sizes per LLD config. The UI enforces this
 * too, but we revalidate server-side before persisting so the limit is real.
 */
export const MAX_TOTAL_ATTACHMENT_BYTES = 30 * 1024 * 1024;

@Injectable()
export class BaLldNarrativeService {
  private readonly logger = new Logger(BaLldNarrativeService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: TextExtractionService,
    private readonly config: ConfigService,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:5000';
  }

  private async ensureConfig(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    let cfg = await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } });
    if (!cfg) {
      cfg = await this.prisma.baLldConfig.create({ data: { moduleDbId } });
    }
    return { module: mod, config: cfg };
  }

  // ─── Attachments ────────────────────────────────────────────────────────

  async listAttachments(moduleDbId: string) {
    const { config } = await this.ensureConfig(moduleDbId);
    const rows = await this.prisma.baLldConfigAttachment.findMany({
      where: { lldConfigId: config.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        extractionNote: true,
        storageBackend: true,
        createdAt: true,
      },
    });
    const totalBytes = rows.reduce((sum, r) => sum + r.sizeBytes, 0);
    return { attachments: rows, totalBytes, maxTotalBytes: MAX_TOTAL_ATTACHMENT_BYTES };
  }

  async uploadAttachments(moduleDbId: string, files: UploadedFile[]) {
    if (!files || files.length === 0) throw new BadRequestException('No files supplied');
    const { config } = await this.ensureConfig(moduleDbId);

    // Enforce the 30 MB TOTAL cap: existing + incoming must fit.
    const existing = await this.prisma.baLldConfigAttachment.aggregate({
      where: { lldConfigId: config.id },
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
        `lld-config/${config.id}`,
        f.originalname,
        f.buffer,
        f.mimetype,
      );
      const { text, note } = await this.extractor.extract(f.buffer, f.mimetype, f.originalname);
      const row = await this.prisma.baLldConfigAttachment.create({
        data: {
          lldConfigId: config.id,
          fileName: f.originalname,
          mimeType: f.mimetype,
          sizeBytes: f.size,
          storageBackend: this.storage.backendName,
          storageKey,
          extractedText: text || null,
          extractionNote: note ?? null,
        },
        select: { id: true, fileName: true, extractionNote: true },
      });
      created.push(row);
    }
    return this.listAttachments(moduleDbId).then((state) => ({ created, ...state }));
  }

  async deleteAttachment(moduleDbId: string, attachmentId: string) {
    const { config } = await this.ensureConfig(moduleDbId);
    const row = await this.prisma.baLldConfigAttachment.findFirst({
      where: { id: attachmentId, lldConfigId: config.id },
    });
    if (!row) throw new NotFoundException(`Attachment ${attachmentId} not found for this module`);
    try {
      await this.storage.delete(row.storageKey);
    } catch (err: unknown) {
      this.logger.warn(`storage.delete failed (continuing): ${err instanceof Error ? err.message : err}`);
    }
    await this.prisma.baLldConfigAttachment.delete({ where: { id: attachmentId } });
    return { deleted: attachmentId };
  }

  // ─── Gap-check ──────────────────────────────────────────────────────────

  /**
   * Call the Python AI service with the current narrative + attachment extracts
   * and the module's tech-stack context. Returns a structured list of gaps for
   * the architect to answer before final LLD generation.
   */
  async gapCheck(moduleDbId: string): Promise<{ gaps: LldGap[]; model: string }> {
    const { module: mod, config } = await this.ensureConfig(moduleDbId);
    if (!config.narrative || !config.narrative.trim()) {
      throw new BadRequestException('Narrative is empty — write or dictate before running gap-check.');
    }

    const attachments = await this.prisma.baLldConfigAttachment.findMany({
      where: { lldConfigId: config.id },
      select: { fileName: true, extractedText: true },
    });
    const attachmentText = attachments
      .filter((a) => a.extractedText && a.extractedText.trim())
      .map((a) => `--- ${a.fileName} ---\n${a.extractedText}`)
      .join('\n\n')
      .slice(0, 40_000); // hard cap matches Python Field max_length

    const moduleContext = this.buildModuleContextSummary(mod, config);

    try {
      const { data } = await axios.post<{ gaps: LldGap[]; model: string }>(
        `${this.aiServiceUrl}/ba/lld-gap-check`,
        {
          moduleContext,
          narrative: config.narrative,
          attachmentText,
          useAsAdditional: config.useAsAdditional,
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
  async buildNarrativeContextBlock(moduleDbId: string): Promise<{
    text: string;
    useAsAdditional: boolean;
    hasNarrative: boolean;
  }> {
    const config = await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } });
    if (!config || !config.narrative || !config.narrative.trim()) {
      return { text: '', useAsAdditional: true, hasNarrative: false };
    }
    const attachments = await this.prisma.baLldConfigAttachment.findMany({
      where: { lldConfigId: config.id },
      select: { fileName: true, extractedText: true },
    });
    const parts: string[] = [];
    parts.push('### Architect Narrative');
    parts.push(config.narrative.trim());
    const attachmentBlocks = attachments
      .filter((a) => a.extractedText && a.extractedText.trim())
      .map((a) => `#### ${a.fileName}\n${a.extractedText}`);
    if (attachmentBlocks.length > 0) {
      parts.push('### Architect Attachments (extracted text)');
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
    config: {
      frontendStackId: string | null;
      backendStackId: string | null;
      databaseId: string | null;
      streamingId: string | null;
      cachingId: string | null;
      storageId: string | null;
      cloudId: string | null;
      architectureId: string | null;
    },
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
    ].filter(Boolean);
    return bits.join('\n');
  }
}
