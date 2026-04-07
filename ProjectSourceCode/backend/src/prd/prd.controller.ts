import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrdService } from './prd.service';
import { CreatePrdDto } from './dto/create-prd.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Controller('prd')
export class PrdController {
  constructor(private readonly prdService: PrdService) {}

  /** POST /api/prd — create a new PRD */
  @Post()
  create(@Body() dto: CreatePrdDto) {
    return this.prdService.create(dto);
  }

  /** GET /api/prd — list all PRDs (summary) */
  @Get()
  findAll() {
    return this.prdService.findAll();
  }

  /** GET /api/prd/:id — fetch single PRD with all sections */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prdService.findOne(id);
  }

  /** PUT /api/prd/:id/section/:sectionNumber — update a section's content */
  @Put(':id/section/:sectionNumber')
  updateSection(
    @Param('id') id: string,
    @Param('sectionNumber', ParseIntPipe) sectionNumber: number,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.prdService.updateSection(id, sectionNumber, dto);
  }

  /** PATCH /api/prd/:id/meta — update PRD metadata (clientName, submittedBy) */
  @Patch(':id/meta')
  updateMeta(
    @Param('id') id: string,
    @Body() body: { clientName?: string; submittedBy?: string },
  ) {
    return this.prdService.updateMeta(id, body);
  }

  /** POST /api/prd/:id/logo — upload client logo as base64 */
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No logo file provided');
    const mimeType = file.mimetype;
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('Logo must be an image file (PNG, JPG, SVG)');
    }
    const base64 = `data:${mimeType};base64,${file.buffer.toString('base64')}`;
    return this.prdService.updateMeta(id, { clientLogo: base64 });
  }

  /** GET /api/prd/:id/source — get original source text/file */
  @Get(':id/source')
  getSource(@Param('id') id: string) {
    return this.prdService.getSource(id);
  }

  /** GET /api/prd/:id/completion — section completion status */
  @Get(':id/completion')
  getCompletion(@Param('id') id: string) {
    return this.prdService.getCompletion(id);
  }

  /** GET /api/prd/:id/history — audit trail / revision history */
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.prdService.getHistory(id);
  }

  /** DELETE /api/prd/:id — delete a PRD and all its sections */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prdService.remove(id);
  }
}
