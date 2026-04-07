import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import { SuggestDto } from './dto/suggest.dto';
import { ParseDto } from './dto/parse.dto';
import { GapCheckDto } from './dto/gap-check.dto';

export interface SuggestResponse {
  suggestion: string;
  section: number;
  field: string;
  model: string;
}

export interface ParseResponse {
  sections: Record<string, unknown>;
  gaps: { section: number; question: string }[];
}

export interface GapCheckResponse {
  updatedSections: Record<string, unknown>;
  remainingGaps: { section: number; question: string }[];
  gapCount: number;
}

export interface TranscribeResponse {
  text: string;
  provider: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  async suggest(dto: SuggestDto): Promise<SuggestResponse> {
    try {
      const { data } = await axios.post<SuggestResponse>(
        `${this.aiServiceUrl}/suggest`,
        {
          section: dto.section,
          field: dto.field,
          context: dto.context ?? '',
        },
        { timeout: 30_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          `AI service returned ${error.response.status}: ${JSON.stringify(error.response.data)}`,
        );
        throw new HttpException(
          error.response.data?.detail ?? 'AI service error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy to Python /parse endpoint */
  async parse(dto: ParseDto): Promise<ParseResponse> {
    try {
      const { data } = await axios.post<ParseResponse>(
        `${this.aiServiceUrl}/parse`,
        { text: dto.text, mode: dto.mode ?? 'all_in_one' },
        { timeout: 180_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /parse returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'AI parse error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /parse', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy to Python /gap-check endpoint */
  async gapCheck(dto: GapCheckDto): Promise<GapCheckResponse> {
    try {
      const { data } = await axios.post<GapCheckResponse>(
        `${this.aiServiceUrl}/gap-check`,
        { sections: dto.sections, answers: dto.answers ?? '' },
        { timeout: 180_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /gap-check returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'AI gap-check error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /gap-check', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy audio to Python /transcribe endpoint */
  async transcribe(file: Express.Multer.File): Promise<TranscribeResponse> {
    const form = new FormData();
    form.append('audio', file.buffer, {
      filename: file.originalname || 'audio.webm',
      contentType: file.mimetype || 'audio/webm',
    });

    try {
      const { data } = await axios.post<TranscribeResponse>(
        `${this.aiServiceUrl}/transcribe`,
        form,
        {
          timeout: 30_000,
          headers: form.getHeaders(),
        },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /transcribe returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'Transcription error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /transcribe', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }
}
