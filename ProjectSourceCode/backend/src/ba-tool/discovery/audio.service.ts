import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import type { BaAudioFile } from '@prisma/client';

const AUDIO_RETENTION_DAYS_DEFAULT = 90;
const ACCEPTED_MIME_PREFIX = 'audio/';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — matches existing /transcribe upper bound

interface UploadAudioOptions {
  projectId: string;
  uploadedById?: string;
  retentionDays?: number;
}

/**
 * Stage 1 of the Discovery Track: manage uploaded audio files and trigger
 * transcription via the existing `/api/ai/transcribe` endpoint (Whisper default,
 * 5 STT providers configured). Reuse-heavy by design — no new STT abstraction.
 */
@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /** Persist an uploaded audio file as base64 in the DB (Phase 1 storage). */
  async upload(
    file: Express.Multer.File | undefined,
    opts: UploadAudioOptions,
  ): Promise<BaAudioFile> {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }
    if (!file.mimetype || !file.mimetype.startsWith(ACCEPTED_MIME_PREFIX)) {
      throw new BadRequestException(
        `Unexpected mimetype: ${file.mimetype}. Expected audio/*.`,
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new BadRequestException(
        `File too large (${file.size} bytes). Max ${MAX_AUDIO_BYTES} bytes (25 MB).`,
      );
    }

    const project = await this.prisma.baProject.findUnique({
      where: { id: opts.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${opts.projectId} not found`);
    }

    const retentionDays = opts.retentionDays ?? AUDIO_RETENTION_DAYS_DEFAULT;
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

    const fileData = file.buffer.toString('base64');

    const audioFile = await this.prisma.baAudioFile.create({
      data: {
        projectId: opts.projectId,
        filename: file.originalname || 'audio',
        mimeType: file.mimetype,
        sizeBytes: file.size,
        fileData,
        status: 'UPLOADED',
        retentionUntil,
        uploadedById: opts.uploadedById,
      },
    });

    this.logger.log(
      `Audio uploaded: ${audioFile.id} (${file.size} bytes, project=${opts.projectId})`,
    );
    return this.stripFileData(audioFile);
  }

  /**
   * Transcribe a previously-uploaded audio file. Synchronous in Phase 1 — caller
   * blocks until done. Phase 2 may move this to a queue (see AN §11).
   */
  async transcribe(audioId: string): Promise<BaAudioFile> {
    const audio = await this.prisma.baAudioFile.findUnique({
      where: { id: audioId },
    });
    if (!audio) {
      throw new NotFoundException(`Audio file ${audioId} not found`);
    }
    if (audio.status === 'TRANSCRIBING') {
      throw new BadRequestException('Already transcribing');
    }

    await this.prisma.baAudioFile.update({
      where: { id: audioId },
      data: { status: 'TRANSCRIBING', errorMessage: null },
    });

    try {
      const buffer = Buffer.from(audio.fileData, 'base64');
      const fakeFile = {
        buffer,
        originalname: audio.filename,
        mimetype: audio.mimeType,
        size: audio.sizeBytes,
      } as Express.Multer.File;

      const result = await this.aiService.transcribe(fakeFile);

      const updated = await this.prisma.baAudioFile.update({
        where: { id: audioId },
        data: {
          rawTranscript: result.text,
          sttProvider: result.provider,
          status: 'TRANSCRIBED',
        },
      });

      this.logger.log(
        `Audio transcribed: ${audioId} (${result.text.length} chars via ${result.provider})`,
      );
      return this.stripFileData(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Transcription failed';
      await this.prisma.baAudioFile.update({
        where: { id: audioId },
        data: { status: 'FAILED', errorMessage: message },
      });
      throw error;
    }
  }

  async listForProject(projectId: string): Promise<BaAudioFile[]> {
    const audios = await this.prisma.baAudioFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return audios.map((a) => this.stripFileData(a));
  }

  async findById(audioId: string, includeFileData = false): Promise<BaAudioFile> {
    const audio = await this.prisma.baAudioFile.findUnique({
      where: { id: audioId },
    });
    if (!audio) {
      throw new NotFoundException(`Audio file ${audioId} not found`);
    }
    return includeFileData ? audio : this.stripFileData(audio);
  }

  async delete(audioId: string): Promise<void> {
    await this.prisma.baAudioFile.delete({ where: { id: audioId } });
  }

  /**
   * Purge audio files past their retention deadline. Designed to be called by a
   * scheduled job (introduced in a later slice). Returns the count purged.
   */
  async purgeExpired(now: Date = new Date()): Promise<{ purged: number }> {
    const result = await this.prisma.baAudioFile.deleteMany({
      where: { retentionUntil: { lte: now } },
    });
    if (result.count > 0) {
      this.logger.log(`Purged ${result.count} expired audio file(s)`);
    }
    return { purged: result.count };
  }

  /** Avoid shipping multi-MB base64 blobs to the wire on list/view endpoints. */
  private stripFileData(audio: BaAudioFile): BaAudioFile {
    return { ...audio, fileData: '' };
  }
}
