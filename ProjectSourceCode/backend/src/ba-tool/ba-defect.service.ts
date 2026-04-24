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

export interface CreateDefectPayload {
  title: string;
  description?: string | null;
  severity?: 'P0' | 'P1' | 'P2' | 'P3' | null;
  externalRef?: string | null;
  reproductionSteps?: string | null;
  environment?: string | null;
  reportedBy?: string | null;
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

  /**
   * Open a defect against a TC WITHOUT a triggering run. Use this when a bug is
   * discovered outside a formal test execution (spec review, prod report,
   * ad-hoc exploration). No `firstSeenRunId` is set — the defect lives as a
   * run-less issue until a future run links to it.
   */
  async createDefect(testCaseId: string, payload: CreateDefectPayload) {
    const tc = await this.prisma.baTestCase.findUnique({ where: { id: testCaseId } });
    if (!tc) throw new NotFoundException(`Test case ${testCaseId} not found`);
    if (!payload.title?.trim()) throw new BadRequestException('title is required');

    const defect = await this.prisma.baDefect.create({
      data: {
        testCaseId,
        firstSeenRunId: null,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        severity: this.normalizeSeverity(payload.severity),
        status: 'OPEN',
        externalRef: payload.externalRef?.trim() || null,
        reproductionSteps: payload.reproductionSteps?.trim() || null,
        environment: payload.environment?.trim() || null,
        reportedBy: payload.reportedBy?.trim() || null,
      },
    });

    // Mirror the run-based flow: denormalize the defect ref onto the TC so
    // CSV exports and the RTM "Defects" column stay consistent.
    const ref = payload.externalRef?.trim() || defect.id.slice(0, 8);
    const existing = tc.defectIds ?? [];
    if (!existing.includes(ref)) {
      await this.prisma.baTestCase.update({
        where: { id: testCaseId },
        data: { defectIds: [...existing, ref] },
      });
    }

    return defect;
  }

  private normalizeSeverity(s: string | null | undefined): 'P0' | 'P1' | 'P2' | 'P3' {
    const up = (s ?? 'P2').toUpperCase();
    return /^P[0-3]$/.test(up) ? (up as 'P0' | 'P1' | 'P2' | 'P3') : 'P2';
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

  /**
   * Project-wide defect feed for the global Defect list page. Pulls TC + module
   * context via the artifact→module path since BaTestCase has no direct module
   * relation. Includes the first-seen run's sprintId so the UI can filter by
   * sprint without another round-trip.
   */
  async listDefectsForProject(projectId: string) {
    return this.prisma.baDefect.findMany({
      where: { testCase: { artifact: { module: { projectId } } } },
      orderBy: { reportedAt: 'desc' },
      include: {
        testCase: {
          select: {
            id: true,
            testCaseId: true,
            title: true,
            sprintId: true,
            artifact: {
              select: {
                id: true,
                artifactId: true,
                module: { select: { id: true, moduleId: true, moduleName: true } },
              },
            },
          },
        },
        firstSeenRun: {
          select: { id: true, sprintId: true, environment: true, executedAt: true },
        },
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
