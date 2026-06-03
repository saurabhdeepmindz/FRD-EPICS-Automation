import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, type BaCustomerInputType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TextExtractionService } from '../text-extraction.service';
import { ProjectFolderService } from './project-folder.service';

const VALID_TYPES: BaCustomerInputType[] = [
  'AUDIO',
  'EXTERNAL_BRD',
  'CUSTOMER_WIREFRAME',
  'TEXT_CONTEXT',
  'DOCUMENT',
];

/** Types that carry a file upload (vs. pure-text TEXT_CONTEXT). */
const FILE_TYPES: BaCustomerInputType[] = [
  'AUDIO',
  'EXTERNAL_BRD',
  'CUSTOMER_WIREFRAME',
  'DOCUMENT',
];

/** Types whose file content should be run through text extraction / OCR. */
const EXTRACT_TYPES: BaCustomerInputType[] = [
  'EXTERNAL_BRD',
  'CUSTOMER_WIREFRAME',
  'DOCUMENT',
];

export interface CreateCustomerInputBody {
  inputType: string;
  label?: string;
  text?: string; // for TEXT_CONTEXT
}

/**
 * Customer Input Hub (Track B). Collects every customer-supplied input —
 * audio, external BRD, customer wireframes, free text, or any document — into
 * `BaCustomerInput`, extracts text where possible, and mirrors each input to
 * `ProjectArtifacts/01-CustomerInputs/{TYPE}/` on disk.
 *
 * Adding a new input type = extend `BaCustomerInputType` enum; no code change here
 * beyond (optionally) deciding whether it carries a file or needs extraction.
 */
@Injectable()
export class CustomerInputService {
  private readonly logger = new Logger(CustomerInputService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly textExtraction: TextExtractionService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  async list(projectId: string) {
    return this.prisma.baCustomerInput.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      // Don't ship base64 blobs in the list view — only metadata + extracted text.
      select: {
        id: true,
        projectId: true,
        inputType: true,
        label: true,
        fileMetadata: true,
        extractedText: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async get(inputId: string) {
    const input = await this.prisma.baCustomerInput.findUnique({ where: { id: inputId } });
    if (!input) throw new NotFoundException(`Customer input ${inputId} not found`);
    return input;
  }

  async create(projectId: string, body: CreateCustomerInputBody, file?: Express.Multer.File) {
    const inputType = this.parseType(body.inputType);
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (FILE_TYPES.includes(inputType) && !file) {
      throw new BadRequestException(`Input type ${inputType} requires a file upload`);
    }
    if (inputType === 'TEXT_CONTEXT' && !body.text?.trim()) {
      throw new BadRequestException('TEXT_CONTEXT requires a non-empty "text" field');
    }

    const label =
      body.label?.trim() ||
      file?.originalname ||
      `${inputType} ${new Date().toISOString().slice(0, 10)}`;

    let extractedText: string | null = null;
    let fileData: string | null = null;
    let fileMetadata: Record<string, unknown> | null = null;
    const metadata: Record<string, unknown> = {};

    if (inputType === 'TEXT_CONTEXT') {
      extractedText = body.text!.trim();
    } else if (file) {
      fileData = file.buffer.toString('base64');
      fileMetadata = {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      };
      if (EXTRACT_TYPES.includes(inputType)) {
        const result = await this.textExtraction.extract(
          file.buffer,
          file.mimetype,
          file.originalname,
        );
        extractedText = result.text || null;
        if (result.note) metadata.extractionNote = result.note;
      }
      // AUDIO: stored as-is; transcription reuses the Discovery STT flow later.
      if (inputType === 'AUDIO') {
        metadata.transcriptionStatus = 'pending';
      }
    }

    const record = await this.prisma.baCustomerInput.create({
      data: {
        projectId,
        inputType,
        label,
        fileData,
        fileMetadata: (fileMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
        extractedText,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    // Mirror to disk: ProjectArtifacts/01-CustomerInputs/{TYPE}/
    await this.writeToDisk(project.name, inputType, record.id, label, file, extractedText);

    this.logger.log(`Customer input ${record.id} (${inputType}) created for ${project.name}`);
    return this.stripBlob(record);
  }

  async delete(inputId: string) {
    const input = await this.prisma.baCustomerInput.findUnique({
      where: { id: inputId },
      select: { id: true, metadata: true },
    });
    if (!input) throw new NotFoundException(`Customer input ${inputId} not found`);
    // Best-effort disk cleanup using the recorded paths.
    const meta = (input.metadata ?? {}) as Record<string, unknown>;
    const diskPaths = (meta.diskPaths as string[] | undefined) ?? [];
    await Promise.all(diskPaths.map((p) => this.projectFolders.deleteFile(p)));
    await this.prisma.baCustomerInput.delete({ where: { id: inputId } });
    return { success: true };
  }

  /**
   * Re-run text extraction for a file-based input from its stored blob and
   * persist the result. Recovers inputs whose `extractedText` is empty because
   * extraction failed (or was skipped) at upload time, without re-uploading.
   */
  async reExtract(inputId: string) {
    const input = await this.prisma.baCustomerInput.findUnique({
      where: { id: inputId },
      select: { id: true, inputType: true, fileData: true, fileMetadata: true, metadata: true },
    });
    if (!input) throw new NotFoundException(`Customer input ${inputId} not found`);
    if (!EXTRACT_TYPES.includes(input.inputType)) {
      throw new BadRequestException(
        `Input type ${input.inputType} does not support text extraction`,
      );
    }
    if (!input.fileData) {
      throw new BadRequestException('No stored file to re-extract; re-upload the input');
    }

    const fileMeta = (input.fileMetadata ?? {}) as { mimeType?: string; fileName?: string };
    const buffer = Buffer.from(input.fileData, 'base64');
    const result = await this.textExtraction.extract(
      buffer,
      fileMeta.mimeType ?? 'application/octet-stream',
      fileMeta.fileName ?? 'upload',
    );

    const metadata = {
      ...((input.metadata as Record<string, unknown>) ?? {}),
      ...(result.note ? { extractionNote: result.note } : {}),
    };
    const updated = await this.prisma.baCustomerInput.update({
      where: { id: inputId },
      data: {
        extractedText: result.text || null,
        metadata: metadata as Prisma.InputJsonValue,
      },
      select: { id: true, extractedText: true, metadata: true },
    });

    const chars = updated.extractedText?.length ?? 0;
    this.logger.log(`Re-extracted input ${inputId}: ${chars} chars`);
    return { id: updated.id, chars, note: result.note ?? null };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private parseType(raw: string): BaCustomerInputType {
    const upper = (raw ?? '').toUpperCase() as BaCustomerInputType;
    if (!VALID_TYPES.includes(upper)) {
      throw new BadRequestException(
        `Invalid inputType "${raw}". Allowed: ${VALID_TYPES.join(', ')}`,
      );
    }
    return upper;
  }

  private async writeToDisk(
    projectName: string,
    inputType: BaCustomerInputType,
    inputId: string,
    label: string,
    file: Express.Multer.File | undefined,
    extractedText: string | null,
  ): Promise<void> {
    const diskPaths: string[] = [];
    const idPrefix = inputId.slice(0, 8);
    try {
      if (file) {
        const original = await this.projectFolders.writeArtifactNested(
          projectName,
          '01-CustomerInputs',
          [inputType, `${idPrefix}__${file.originalname}`],
          file.buffer,
        );
        diskPaths.push(original);
      }
      if (extractedText) {
        const textName = file
          ? `${idPrefix}__${file.originalname}.extracted.txt`
          : `${idPrefix}__${this.safe(label)}.txt`;
        const textPath = await this.projectFolders.writeArtifactNested(
          projectName,
          '01-CustomerInputs',
          [inputType, textName],
          extractedText,
        );
        diskPaths.push(textPath);
      }
      // Persist the disk paths so delete() can clean them up — merge into the
      // existing metadata so diagnostic fields (e.g. extractionNote) survive.
      if (diskPaths.length) {
        const existing = await this.prisma.baCustomerInput.findUnique({
          where: { id: inputId },
          select: { metadata: true },
        });
        const merged = {
          ...((existing?.metadata as Record<string, unknown>) ?? {}),
          diskPaths,
        };
        await this.prisma.baCustomerInput.update({
          where: { id: inputId },
          data: { metadata: merged as Prisma.InputJsonValue },
        });
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Disk write for input ${inputId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private safe(s: string): string {
    return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  }

  private stripBlob<T extends { fileData?: string | null }>(record: T): Omit<T, 'fileData'> {
    const { fileData: _omit, ...rest } = record;
    return rest;
  }
}
