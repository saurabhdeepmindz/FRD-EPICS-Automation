import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExtractService } from './extract.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly extractService: ExtractService) {}

  /** POST /api/upload/extract — upload file, extract text */
  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  async extract(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided. Please upload a PDF, DOCX, MD, or TXT file.');
    }

    this.extractService.validateSize(file.size);
    const format = this.extractService.getFormat(file.mimetype, file.originalname);
    const text = await this.extractService.extractText(file.buffer, format);

    return {
      text,
      format,
      charCount: text.length,
      originalName: file.originalname,
    };
  }
}
