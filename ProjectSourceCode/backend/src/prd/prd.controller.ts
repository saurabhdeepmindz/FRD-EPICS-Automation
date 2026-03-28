import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
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

  /** GET /api/prd/:id/completion — section completion status */
  @Get(':id/completion')
  getCompletion(@Param('id') id: string) {
    return this.prdService.getCompletion(id);
  }

  /** DELETE /api/prd/:id — delete a PRD and all its sections */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prdService.remove(id);
  }
}
