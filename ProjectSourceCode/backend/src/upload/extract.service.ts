import { Injectable, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class ExtractService {
  private readonly logger = new Logger(ExtractService.name);

  private readonly SUPPORTED_FORMATS = ['pdf', 'docx', 'md', 'txt'];
  private readonly MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

  /** Determine format from MIME type or filename */
  getFormat(mimetype: string, originalname: string): string {
    const ext = originalname.split('.').pop()?.toLowerCase() ?? '';

    if (mimetype === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    )
      return 'docx';
    if (mimetype === 'text/markdown' || ext === 'md') return 'md';
    if (mimetype === 'text/plain' || ext === 'txt') return 'txt';

    throw new BadRequestException(
      `Unsupported file format "${ext}". Please upload PDF, DOCX, MD, or TXT.`,
    );
  }

  /** Validate file size */
  validateSize(size: number): void {
    if (size > this.MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `File size (${Math.round(size / 1024 / 1024)} MB) exceeds maximum of 20 MB.`,
      );
    }
  }

  /** Extract text from a file buffer based on format */
  async extractText(buffer: Buffer, format: string): Promise<string> {
    switch (format) {
      case 'pdf':
        return this.extractPdf(buffer);
      case 'docx':
        return this.extractDocx(buffer);
      case 'md':
      case 'txt':
        return buffer.toString('utf-8');
      default:
        throw new BadRequestException(`Unsupported format: ${format}`);
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      return result.text;
    } catch (error: unknown) {
      this.logger.error('PDF extraction failed', error);
      throw new BadRequestException('Failed to extract text from PDF. Ensure it contains selectable text (not scanned images).');
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error: unknown) {
      this.logger.error('DOCX extraction failed', error);
      throw new BadRequestException('Failed to extract text from DOCX file.');
    }
  }
}
