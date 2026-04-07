import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { SuggestDto } from './dto/suggest.dto';
import { ParseDto } from './dto/parse.dto';
import { GapCheckDto } from './dto/gap-check.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** POST /api/ai/suggest — proxy to Python AI service */
  @Post('suggest')
  suggest(@Body() dto: SuggestDto) {
    return this.aiService.suggest(dto);
  }

  /** POST /api/ai/parse — parse raw text into 22-section PRD */
  @Post('parse')
  parse(@Body() dto: ParseDto) {
    return this.aiService.parse(dto);
  }

  /** POST /api/ai/gap-check — run gap analysis on PRD sections */
  @Post('gap-check')
  gapCheck(@Body() dto: GapCheckDto) {
    return this.aiService.gapCheck(dto);
  }

  /** POST /api/ai/transcribe — speech-to-text via configured provider */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No audio file provided');
    return this.aiService.transcribe(file);
  }
}
