import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractionService } from './text-extraction.service';
import { ATTACHMENT_STORAGE } from './storage/storage.module';
import type { AttachmentStorage } from './storage/storage.interface';
import type { UploadedFile } from './ba-narrative.service';

export interface UpdateDefectPayload {
  title?: string;
  description?: string | null;
  severity?: 'P0' | 'P1' | 'P2' | 'P3';
  status?: 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED' | 'WONT_FIX';
  reproductionSteps?: string | null;
  externalRef?: string | null;
  environment?: string | null;
}

const VALID_STATUS = new Set(['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED', 'WONT_FIX']);
const CLOSED_STATUSES = new Set(['FIXED', 'VERIFIED', 'CLOSED', 'WONT_FIX']);
/** Cap matches LLD/FTC narrative attachment limits for consistency. */
export const MAX_DEFECT_ATTACHMENT_BYTES = 30 * 1024 * 1024;

@Injectable()
export class BaDefectService {
  private readonly logger = new Logger(BaDefectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: TextExtractionService,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {}

  async getDefect(defectId: string) {
    const defect = await this.prisma.baDefect.findUnique({
      where: { id: defectId },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        rcas: { orderBy: { createdAt: 'asc' } },
        firstSeenRun: true,
        testCase: { select: { id: true, testCaseId: true, title: true, artifactDbId: true } },
      },
    });
    if (!defect) throw new NotFoundException(`Defect ${defectId} not found`);
    return defect;
  }

  async listDefectsForTestCase(testCaseId: string) {
    return this.prisma.baDefect.findMany({
      where: { testCaseId },
      orderBy: { reportedAt: 'desc' },
      include: {
        attachments: { select: { id: true, fileName: true, sizeBytes: true } },
        rcas: { select: { id: true, source: true } },
      },
    });
  }

  async updateDefect(defectId: string, payload: UpdateDefectPayload) {
    const defect = await this.prisma.baDefect.findUnique({ where: { id: defectId } });
    if (!defect) throw new NotFoundException(`Defect ${defectId} not found`);

    const data: Record<string, unknown> = {};
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.description !== undefined) data.description = payload.description?.trim() || null;
    if (payload.severity && /^P[0-3]$/.test(payload.severity)) data.severity = payload.severity;
    if (payload.reproductionSteps !== undefined) data.reproductionSteps = payload.reproductionSteps?.trim() || null;
    if (payload.externalRef !== undefined) data.externalRef = payload.externalRef?.trim() || null;
    if (payload.environment !== undefined) data.environment = payload.environment?.trim() || null;
    if (payload.status && VALID_STATUS.has(payload.status)) {
      data.status = payload.status;
      // When the status crosses into "closed" territory, stamp closedAt.
      if (CLOSED_STATUSES.has(payload.status) && !defect.closedAt) {
        data.closedAt = new Date();
      } else if (!CLOSED_STATUSES.has(payload.status) && defect.closedAt) {
        data.closedAt = null;
      }
    }

    return this.prisma.baDefect.update({ where: { id: defectId }, data });
  }

  // ─── Attachments ────────────────────────────────────────────────────────

  async uploadAttachments(defectId: string, files: UploadedFile[]) {
    if (!files || files.length === 0) throw new BadRequestException('No files supplied');
    const defect = await this.prisma.baDefect.findUnique({ where: { id: defectId } });
    if (!defect) throw new NotFoundException(`Defect ${defectId} not found`);

    const existing = await this.prisma.baDefectAttachment.aggregate({
      where: { defectId },
      _sum: { sizeBytes: true },
    });
    const currentTotal = existing._sum.sizeBytes ?? 0;
    const incoming = files.reduce((s, f) => s + f.size, 0);
    if (currentTotal + incoming > MAX_DEFECT_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `Total attachments would exceed 30 MB (${((currentTotal + incoming) / 1024 / 1024).toFixed(1)} MB). Delete some first.`,
      );
    }

    const created: { id: string; fileName: string; sizeBytes: number }[] = [];
    for (const f of files) {
      const storageKey = await this.storage.put(
        `defect/${defectId}`,
        f.originalname,
        f.buffer,
        f.mimetype,
      );
      const { text, note } = await this.extractor.extract(f.buffer, f.mimetype, f.originalname);
      const row = await this.prisma.baDefectAttachment.create({
        data: {
          defectId,
          fileName: f.originalname,
          mimeType: f.mimetype,
          sizeBytes: f.size,
          storageBackend: this.storage.backendName,
          storageKey,
          extractedText: text || null,
          extractionNote: note ?? null,
        },
        select: { id: true, fileName: true, sizeBytes: true },
      });
      created.push(row);
    }
    return this.listAttachments(defectId).then((list) => ({ created, attachments: list }));
  }

  async listAttachments(defectId: string) {
    return this.prisma.baDefectAttachment.findMany({
      where: { defectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, fileName: true, mimeType: true, sizeBytes: true,
        extractionNote: true, storageBackend: true, createdAt: true,
      },
    });
  }

  async deleteAttachment(defectId: string, attachmentId: string) {
    const row = await this.prisma.baDefectAttachment.findFirst({
      where: { id: attachmentId, defectId },
    });
    if (!row) throw new NotFoundException(`Attachment ${attachmentId} not found for this defect`);
    try {
      await this.storage.delete(row.storageKey);
    } catch (err: unknown) {
      this.logger.warn(`storage.delete failed (continuing): ${err instanceof Error ? err.message : err}`);
    }
    await this.prisma.baDefectAttachment.delete({ where: { id: attachmentId } });
    return { deleted: attachmentId };
  }
}
