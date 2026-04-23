import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface ExtractionResult {
  text: string;
  note?: string; // populated when extraction is partial or falls back
}

/**
 * Best-effort text extraction from architect-supplied attachments.
 *
 * - text/markdown → UTF-8 decode
 * - DOCX           → mammoth (pure JS, no native deps)
 * - PDF            → pdf-parse; flagged as "likely scanned" when yield is trivial
 * - PNG/JPG        → Python AI service `/ba/extract-image-text` (OCR/vision)
 *
 * The OCR provider for images is pluggable via `LLD_OCR_PROVIDER` (openai |
 * gemini | tesseract); the Python service owns the adapter selection.
 */
@Injectable()
export class TextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:5000';
  }

  async extract(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractionResult> {
    const lower = mimeType.toLowerCase();
    try {
      if (lower.startsWith('text/') || lower === 'application/json' || /\.(md|txt)$/i.test(fileName)) {
        return { text: buffer.toString('utf-8') };
      }
      if (lower === 'application/pdf' || /\.pdf$/i.test(fileName)) {
        return await this.extractPdf(buffer);
      }
      if (
        lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.docx$/i.test(fileName)
      ) {
        return await this.extractDocx(buffer);
      }
      if (lower.startsWith('image/') || /\.(png|jpg|jpeg)$/i.test(fileName)) {
        return await this.extractImage(buffer, lower || 'image/png');
      }
      return {
        text: '',
        note: `Unsupported MIME type ${mimeType}; attachment stored but text not extracted.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Text extraction failed for ${fileName}: ${msg}`);
      return { text: '', note: `Extraction error: ${msg}` };
    }
  }

  private async extractPdf(buffer: Buffer): Promise<ExtractionResult> {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? '').trim();
    // < 100 chars for a multi-page PDF almost always means it's image-only / scanned.
    if (text.length < 100 && (parsed.numpages ?? 0) > 0) {
      return {
        text,
        note: `PDF yielded only ${text.length} characters across ${parsed.numpages} pages — likely a scanned document. Re-attach individual pages as PNG/JPG for OCR.`,
      };
    }
    return { text };
  }

  private async extractDocx(buffer: Buffer): Promise<ExtractionResult> {
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: (value ?? '').trim() };
  }

  private async extractImage(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    try {
      const { data } = await axios.post<{ text: string; provider?: string }>(
        `${this.aiServiceUrl}/ba/extract-image-text`,
        { dataUrl },
        { timeout: 60_000 },
      );
      return { text: data.text ?? '', note: data.provider ? `OCR provider: ${data.provider}` : undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      return { text: '', note: `Image OCR unavailable: ${msg}` };
    }
  }
}
