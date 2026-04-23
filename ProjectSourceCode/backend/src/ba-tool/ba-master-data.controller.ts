import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BaMasterDataCategory } from '@prisma/client';
import {
  BaMasterDataService,
  isTechStackCategory,
  isTemplateCategory,
} from './ba-master-data.service';
import { BaTemplateService } from './ba-template.service';
import { CreateMasterDataEntryDto } from './dto/master-data/create-entry.dto';
import { UpdateMasterDataEntryDto } from './dto/master-data/update-entry.dto';
import { BulkUploadDto } from './dto/master-data/bulk-upload.dto';
import { UploadTemplateDto } from './dto/master-data/upload-template.dto';
import * as AdmZip from 'adm-zip';

/**
 * Master data / Architect Console endpoints.
 * Routes live under /api/ba/master-data and /api/ba/templates.
 */
@Controller('ba')
export class BaMasterDataController {
  constructor(
    private readonly masterData: BaMasterDataService,
    private readonly templateService: BaTemplateService,
  ) {}

  // ─── Master data CRUD ──────────────────────────────────────────────────

  /** GET /api/ba/master-data?category=FRONTEND_STACK&projectId=uuid */
  @Get('master-data')
  list(
    @Query('category') category: BaMasterDataCategory,
    @Query('projectId') projectId?: string,
  ) {
    if (!category) throw new BadRequestException('category query param required');
    return this.masterData.list(category, projectId ?? null);
  }

  @Get('master-data/:id')
  get(@Param('id') id: string) {
    return this.masterData.get(id);
  }

  @Post('master-data')
  create(@Body() dto: CreateMasterDataEntryDto) {
    return this.masterData.create({
      category: dto.category,
      scope: dto.scope,
      projectId: dto.projectId ?? null,
      name: dto.name,
      value: dto.value,
      description: dto.description,
      templateId: dto.templateId ?? null,
      force: dto.force,
    });
  }

  @Patch('master-data/:id')
  update(@Param('id') id: string, @Body() dto: UpdateMasterDataEntryDto) {
    return this.masterData.update(id, dto);
  }

  @Delete('master-data/:id')
  @HttpCode(204)
  async archive(@Param('id') id: string) {
    await this.masterData.archive(id);
  }

  /** POST /api/ba/master-data/:id/promote — move project-scoped entry to GLOBAL */
  @Post('master-data/:id/promote')
  promote(
    @Param('id') id: string,
    @Headers('x-is-admin') isAdmin: string | undefined,
  ) {
    // v4 stub auth — real RBAC is a future sprint
    if (isAdmin !== 'true') {
      throw new ForbiddenException('Admin required to promote entries to global');
    }
    return this.masterData.promoteToGlobal(id);
  }

  /** POST /api/ba/master-data/bulk — bulk insert (tech-stack categories only) */
  @Post('master-data/bulk')
  bulk(@Body() dto: BulkUploadDto) {
    for (const entry of dto.entries) {
      if (!isTechStackCategory(entry.category)) {
        throw new BadRequestException(
          `Bulk insert not supported for template category ${entry.category}`,
        );
      }
    }
    return this.masterData.bulkInsert(dto.entries.map((e) => ({
      category: e.category,
      scope: e.scope,
      projectId: e.projectId ?? null,
      name: e.name,
      value: e.value,
      description: e.description,
      force: true,
    })));
  }

  /** POST /api/ba/master-data/reseed?category=FRONTEND_STACK */
  @Post('master-data/reseed')
  reseed(@Query('category') category: BaMasterDataCategory) {
    if (!category) throw new BadRequestException('category query param required');
    return this.masterData.reseed(category);
  }

  /** POST /api/ba/master-data/dedupe-check */
  @Post('master-data/dedupe-check')
  dedupeCheck(
    @Body() body: { category: BaMasterDataCategory; name: string; projectId?: string },
  ) {
    if (!body.category || !body.name) {
      throw new BadRequestException('category and name required');
    }
    return this.masterData.fuzzyMatch(body.category, body.name, body.projectId ?? null);
  }

  // ─── Template endpoints ────────────────────────────────────────────────

  /** GET /api/ba/templates?category=LLD_TEMPLATE&projectId=uuid */
  @Get('templates')
  listTemplates(
    @Query('category') category: BaMasterDataCategory,
    @Query('projectId') projectId?: string,
  ) {
    if (!category) throw new BadRequestException('category query param required');
    return this.templateService.list(category, projectId ?? null);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.templateService.get(id);
  }

  @Get('templates/:id/lineage')
  getTemplateLineage(@Param('id') id: string) {
    return this.templateService.getLineage(id);
  }

  /** PATCH /api/ba/templates/:id — forks a new HUMAN-edited version */
  @Patch('templates/:id')
  forkTemplate(
    @Param('id') id: string,
    @Body() body: { projectId: string; name?: string; content?: string },
  ) {
    if (!body.projectId) {
      throw new BadRequestException('projectId required to fork a template');
    }
    return this.templateService.fork({
      parentTemplateId: id,
      projectId: body.projectId,
      name: body.name,
      content: body.content,
      lastModifiedBy: 'HUMAN',
    });
  }

  // ─── Template upload (single-file + folder/zip) ────────────────────────

  /**
   * POST /api/ba/templates/upload
   * multipart/form-data:
   *   file: File (required) — text file for 4 of the template categories;
   *                           .zip for PROJECT_STRUCTURE
   *   category / name / description / scope / projectId: form fields
   * Creates a BaTemplate row + a linked BaMasterDataEntry.
   */
  @Post('templates/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max (covers 1 MB files and small zips)
    }),
  )
  async uploadTemplate(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadTemplateDto,
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!isTemplateCategory(dto.category)) {
      throw new BadRequestException(`Category ${dto.category} is not a template category`);
    }

    let content: string;
    if (dto.category === 'PROJECT_STRUCTURE' && isZip(file)) {
      content = extractZipToMarkdown(file.buffer);
    } else {
      if (file.size > 1 * 1024 * 1024) {
        throw new BadRequestException('Single-file template uploads are limited to 1 MB');
      }
      content = file.buffer.toString('utf-8');
    }

    const scope = dto.scope ?? 'PROJECT';
    if (scope === 'PROJECT' && !dto.projectId) {
      throw new BadRequestException('projectId required for PROJECT-scoped uploads');
    }

    const template = await this.templateService.create({
      category: dto.category,
      name: dto.name,
      content,
      scope,
      projectId: dto.projectId ?? null,
      lastModifiedBy: 'HUMAN',
    });

    // Create linked master-data entry so it appears in dropdowns
    const entry = await this.masterData.create({
      category: dto.category,
      scope,
      projectId: dto.projectId ?? null,
      name: dto.name,
      value: `template:${template.id}`,
      description: dto.description,
      templateId: template.id,
      force: true, // upload skips fuzzy dedupe — user already named it explicitly
    });

    return { entry, template };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function isZip(file: Express.Multer.File): boolean {
  const n = (file.originalname || '').toLowerCase();
  return n.endsWith('.zip') || file.mimetype === 'application/zip';
}

/**
 * Walk a zip buffer and produce a Markdown representation of its tree.
 * Used when the Architect uploads a Project Structure as a zip — we don't
 * store the zip itself, we store a human-readable tree outline with
 * per-file annotations extracted from any `.meta` companion files.
 */
function extractZipToMarkdown(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  // Sort by path so the tree renders deterministically
  const sorted = [...entries].sort((a, b) => a.entryName.localeCompare(b.entryName));

  const lines: string[] = ['# Project Structure', '', '```'];
  for (const entry of sorted) {
    if (entry.isDirectory) {
      lines.push(entry.entryName);
    } else {
      lines.push(entry.entryName);
    }
  }
  lines.push('```', '');

  // Collect any companion notes from .meta files
  const metas = sorted.filter((e) => !e.isDirectory && e.entryName.endsWith('.meta'));
  if (metas.length > 0) {
    lines.push('## Per-file notes', '');
    for (const m of metas) {
      const paired = m.entryName.replace(/\.meta$/, '');
      lines.push(`### ${paired}`);
      lines.push('');
      lines.push(m.getData().toString('utf-8').trim());
      lines.push('');
    }
  }

  return lines.join('\n');
}
