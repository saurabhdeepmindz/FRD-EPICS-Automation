import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type {
  BaAudioFile,
  BaBrd,
  BaWft,
  BaApproachNoteVersion,
} from '@prisma/client';
import { AudioService } from './audio.service';
import { WftService } from './wft.service';
import { BrdService } from './brd.service';
import { BrdExportService } from './brd-export.service';
import {
  ApproachNoteService,
  type BaApproachNoteWithVersions,
} from './approach-note.service';
import { AnExportService, type AnEdition } from './an-export.service';
import {
  WireframeService,
  type BaWireframeSetWithScreens,
} from './wireframe.service';
import { GenerateWireframesDto } from './dto/generate-wireframes.dto';
import { UpdateWireframeScreenDto } from './dto/update-wireframe-screen.dto';
import type { BaWireframeScreen, BaHifiScreen } from '@prisma/client';
import {
  HifiService,
  type BaHifiSetWithScreens,
} from './hifi.service';
import {
  ScreenExportService,
  type ScreenExportFormat,
  type ScreenKind,
} from './screen-export.service';
import { GenerateHifiDto } from './dto/generate-hifi.dto';
import { UpdateHifiScreenDto } from './dto/update-hifi-screen.dto';
import { UploadAudioDto } from './dto/audio-upload.dto';
import { GenerateWftDto } from './dto/generate-wft.dto';
import { UpdateWftDto } from './dto/update-wft.dto';
import { GenerateBrdDto } from './dto/generate-brd.dto';
import { UpdateBrdDto } from './dto/update-brd.dto';
import { GenerateAnDto, CreateAnVersionDto } from './dto/generate-an.dto';
import { UpdateAnVersionDto } from './dto/update-an-version.dto';

/**
 * REST surface for the Discovery & Solutioning Track. Stage 1 (this slice):
 *   POST /api/ba/projects/:projectId/discovery/audio                     — upload
 *   GET  /api/ba/projects/:projectId/discovery/audio                     — list
 *   GET  /api/ba/projects/:projectId/discovery/audio/:audioId            — detail
 *   POST /api/ba/projects/:projectId/discovery/audio/:audioId/transcribe — transcribe
 *   DELETE /api/ba/projects/:projectId/discovery/audio/:audioId          — delete
 *   POST /api/ba/projects/:projectId/discovery/wft                       — generate WFT
 *   GET  /api/ba/projects/:projectId/discovery/wft                       — latest
 *   GET  /api/ba/projects/:projectId/discovery/wft/:wftId                — detail
 *   PATCH /api/ba/projects/:projectId/discovery/wft/:wftId               — edit sections
 *   POST  /api/ba/projects/:projectId/discovery/wft/:wftId/regenerate    — regenerate
 *
 * Subsequent stages (BRD, AN, lo-fi, hi-fi) extend this controller in later slices.
 */
@Controller('ba/projects/:projectId/discovery')
export class DiscoveryController {
  constructor(
    private readonly audio: AudioService,
    private readonly wft: WftService,
    private readonly brd: BrdService,
    private readonly brdExport: BrdExportService,
    private readonly an: ApproachNoteService,
    private readonly anExport: AnExportService,
    private readonly wireframes: WireframeService,
    private readonly hifi: HifiService,
    private readonly screenExport: ScreenExportService,
  ) {}

  /** Coerce raw `format` path-segment into the union or throw 400. */
  private resolveScreenFormat(raw: string): ScreenExportFormat {
    if (raw === 'png' || raw === 'html' || raw === 'pdf') return raw;
    throw new BadRequestException(`Unsupported export format: ${raw}`);
  }

  /** Send a binary export payload with proper headers. */
  private sendBinary(
    res: Response,
    buffer: Buffer,
    filename: string,
    format: ScreenExportFormat | 'html.zip' | 'png.zip',
  ): void {
    const contentTypes: Record<string, string> = {
      png: 'image/png',
      html: 'text/html; charset=utf-8',
      pdf: 'application/pdf',
      'html.zip': 'application/zip',
      'png.zip': 'application/zip',
    };
    res.set({
      'Content-Type': contentTypes[format] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Coerce a `?edition=` query string into the `AnEdition` union, defaulting to internal. */
  private resolveEdition(raw: string | undefined): AnEdition {
    return raw === 'client' ? 'client' : 'internal';
  }

  // ─── Audio (Stage 1a) ─────────────────────────────────────────────────────

  @Post('audio')
  @UseInterceptors(FileInterceptor('audio'))
  async uploadAudio(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadAudioDto,
  ): Promise<BaAudioFile> {
    return this.audio.upload(file, {
      projectId,
      retentionDays: body.retentionDays,
    });
  }

  @Get('audio')
  async listAudio(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<BaAudioFile[]> {
    return this.audio.listForProject(projectId);
  }

  @Get('audio/:audioId')
  async getAudio(
    @Param('audioId', new ParseUUIDPipe({ version: '4' })) audioId: string,
  ): Promise<BaAudioFile> {
    return this.audio.findById(audioId);
  }

  @Post('audio/:audioId/transcribe')
  async transcribeAudio(
    @Param('audioId', new ParseUUIDPipe({ version: '4' })) audioId: string,
  ): Promise<BaAudioFile> {
    return this.audio.transcribe(audioId);
  }

  @Delete('audio/:audioId')
  async deleteAudio(
    @Param('audioId', new ParseUUIDPipe({ version: '4' })) audioId: string,
  ): Promise<{ deleted: true }> {
    await this.audio.delete(audioId);
    return { deleted: true };
  }

  // ─── WFT (Stage 1b) ───────────────────────────────────────────────────────

  @Post('wft')
  async generateWft(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: GenerateWftDto,
  ): Promise<BaWft> {
    return this.wft.generate({
      projectId,
      audioFileIds: body.audioFileIds,
      domainContext: body.domainContext,
      languageHint: body.languageHint,
    });
  }

  @Get('wft')
  async getLatestWft(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<BaWft | null> {
    return this.wft.findLatestForProject(projectId);
  }

  @Get('wft/:wftId')
  async getWft(
    @Param('wftId', new ParseUUIDPipe({ version: '4' })) wftId: string,
  ): Promise<BaWft> {
    return this.wft.findById(wftId);
  }

  @Patch('wft/:wftId')
  async updateWft(
    @Param('wftId', new ParseUUIDPipe({ version: '4' })) wftId: string,
    @Body() body: UpdateWftDto,
  ): Promise<BaWft> {
    return this.wft.update(wftId, body);
  }

  @Post('wft/:wftId/regenerate')
  async regenerateWft(
    @Param('wftId', new ParseUUIDPipe({ version: '4' })) wftId: string,
    @Body() body: Pick<GenerateWftDto, 'domainContext' | 'languageHint'>,
  ): Promise<BaWft> {
    return this.wft.regenerate(wftId, body);
  }

  // ─── BRD (Stage 3) ────────────────────────────────────────────────────────

  @Post('brd')
  async generateBrd(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: GenerateBrdDto,
  ): Promise<BaBrd> {
    return this.brd.generate({
      projectId,
      wftId: body.wftId,
      productName: body.productName,
      audience: body.audience,
    });
  }

  @Get('brd')
  async getLatestBrd(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<BaBrd | null> {
    return this.brd.findLatestForProject(projectId);
  }

  @Get('brd/:brdId')
  async getBrd(
    @Param('brdId', new ParseUUIDPipe({ version: '4' })) brdId: string,
  ): Promise<BaBrd> {
    return this.brd.findById(brdId);
  }

  @Patch('brd/:brdId')
  async updateBrd(
    @Param('brdId', new ParseUUIDPipe({ version: '4' })) brdId: string,
    @Body() body: UpdateBrdDto,
  ): Promise<BaBrd> {
    return this.brd.update(brdId, body);
  }

  @Post('brd/:brdId/regenerate')
  async regenerateBrd(
    @Param('brdId', new ParseUUIDPipe({ version: '4' })) brdId: string,
    @Body() body: Pick<GenerateBrdDto, 'productName' | 'audience'>,
  ): Promise<BaBrd> {
    return this.brd.regenerate(brdId, body);
  }

  // ─── BRD Preview / Export ──────────────────────────────────────────────────

  /** GET /api/ba/projects/:projectId/discovery/brd/:brdId/preview — inline HTML */
  @Get('brd/:brdId/preview')
  async previewBrd(
    @Param('brdId', new ParseUUIDPipe({ version: '4' })) brdId: string,
    @Res() res: Response,
  ) {
    const { html } = await this.brdExport.renderHtml(brdId);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  /** GET /api/ba/projects/:projectId/discovery/brd/:brdId/export/pdf — download PDF */
  @Get('brd/:brdId/export/pdf')
  async exportBrdPdf(
    @Param('brdId', new ParseUUIDPipe({ version: '4' })) brdId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.brdExport.renderPdf(brdId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/projects/:projectId/discovery/brd/:brdId/export/docx — download DOCX */
  @Get('brd/:brdId/export/docx')
  async exportBrdDocx(
    @Param('brdId', new ParseUUIDPipe({ version: '4' })) brdId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.brdExport.renderDocx(brdId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ─── Approach Note (Stage 4) ─────────────────────────────────────────────

  @Post('approach-note')
  async generateAn(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: GenerateAnDto,
  ): Promise<BaApproachNoteWithVersions> {
    return this.an.generate({
      projectId,
      brdId: body.brdId,
      productName: body.productName,
      audience: body.audience,
    });
  }

  @Get('approach-note')
  async getLatestAn(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<BaApproachNoteWithVersions | null> {
    return this.an.findLatestForProject(projectId);
  }

  @Get('approach-note/:approachNoteId')
  async getAn(
    @Param('approachNoteId', new ParseUUIDPipe({ version: '4' })) approachNoteId: string,
  ): Promise<BaApproachNoteWithVersions> {
    return this.an.findById(approachNoteId);
  }

  /** Append a new version. Body provides the mandatory "Changes since v(N)" log. */
  @Post('approach-note/:approachNoteId/versions')
  async createAnVersion(
    @Param('approachNoteId', new ParseUUIDPipe({ version: '4' })) approachNoteId: string,
    @Body() body: CreateAnVersionDto,
  ): Promise<BaApproachNoteWithVersions> {
    return this.an.createNewVersion({
      approachNoteId,
      changesSince: body.changesSince,
      productName: body.productName,
      audience: body.audience,
    });
  }

  @Patch('approach-note/versions/:versionId')
  async updateAnVersion(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Body() body: UpdateAnVersionDto,
  ): Promise<BaApproachNoteVersion> {
    return this.an.updateVersion(versionId, body);
  }

  /**
   * POST /api/ba/projects/:projectId/discovery/approach-note/versions/:versionId/extract-brand-tokens
   * Multipart upload of a reference image; returns extracted tokens + the
   * persisted version (tokens are merged into the version's brandTokens JSON).
   */
  @Post('approach-note/versions/:versionId/extract-brand-tokens')
  @UseInterceptors(FileInterceptor('image'))
  async extractAnBrandTokens(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ extracted: { primary: string; surface: string; cta: string; productName: string; model?: string }; updated: BaApproachNoteVersion }> {
    return this.an.extractBrandTokensFromImage(versionId, file);
  }

  // ─── AN preview / export ──────────────────────────────────────────────────

  /** GET /preview?edition=client|internal — inline HTML preview of a version */
  @Get('approach-note/versions/:versionId/preview')
  async previewAnVersion(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Res() res: Response,
  ) {
    const edition = this.resolveEdition((res.req.query.edition as string | undefined));
    const { html } = await this.anExport.renderHtml(versionId, edition);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  /** GET /export/pdf?edition=client|internal — download PDF */
  @Get('approach-note/versions/:versionId/export/pdf')
  async exportAnPdf(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Res() res: Response,
  ) {
    const edition = this.resolveEdition((res.req.query.edition as string | undefined));
    const { buffer, filename } = await this.anExport.renderPdf(versionId, edition);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /export/docx?edition=client|internal — download DOCX */
  @Get('approach-note/versions/:versionId/export/docx')
  async exportAnDocx(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Res() res: Response,
  ) {
    const edition = this.resolveEdition((res.req.query.edition as string | undefined));
    const { buffer, filename } = await this.anExport.renderDocx(versionId, edition);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /export/md?edition=client|internal — download Markdown */
  @Get('approach-note/versions/:versionId/export/md')
  async exportAnMarkdown(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Res() res: Response,
  ) {
    const edition = this.resolveEdition((res.req.query.edition as string | undefined));
    const { buffer, filename } = await this.anExport.renderMarkdown(versionId, edition);
    res.set({
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ─── Wireframes (Stage 4) ─────────────────────────────────────────────────

  @Post('wireframes')
  async generateWireframes(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: GenerateWireframesDto,
  ): Promise<BaWireframeSetWithScreens> {
    return this.wireframes.generate({
      projectId,
      approachNoteVersionId: body.approachNoteVersionId,
      selectedPatterns: body.selectedPatterns,
      productName: body.productName,
    });
  }

  @Get('wireframes')
  async getLatestWireframeSet(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<BaWireframeSetWithScreens | null> {
    return this.wireframes.findLatestForProject(projectId);
  }

  @Get('wireframes/:setId')
  async getWireframeSet(
    @Param('setId', new ParseUUIDPipe({ version: '4' })) setId: string,
  ): Promise<BaWireframeSetWithScreens> {
    return this.wireframes.findById(setId);
  }

  @Post('wireframes/:setId/regenerate')
  async regenerateWireframeSet(
    @Param('setId', new ParseUUIDPipe({ version: '4' })) setId: string,
  ): Promise<BaWireframeSetWithScreens> {
    return this.wireframes.regenerate(setId);
  }

  @Get('wireframes/screens/:screenId')
  async getWireframeScreen(
    @Param('screenId', new ParseUUIDPipe({ version: '4' })) screenId: string,
  ): Promise<BaWireframeScreen> {
    return this.wireframes.findScreenById(screenId);
  }

  @Patch('wireframes/screens/:screenId')
  async updateWireframeScreen(
    @Param('screenId', new ParseUUIDPipe({ version: '4' })) screenId: string,
    @Body() body: UpdateWireframeScreenDto,
  ): Promise<BaWireframeScreen> {
    return this.wireframes.updateScreen(screenId, body);
  }

  // ─── Hi-fi mockups (Stage 5) ──────────────────────────────────────────────

  @Post('hifi')
  async generateHifi(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: GenerateHifiDto,
  ): Promise<BaHifiSetWithScreens> {
    return this.hifi.generate({
      projectId,
      wireframeSetId: body.wireframeSetId,
      productName: body.productName,
      syntheticDataHint: body.syntheticDataHint,
    });
  }

  @Get('hifi')
  async getLatestHifiSet(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<BaHifiSetWithScreens | null> {
    return this.hifi.findLatestForProject(projectId);
  }

  @Get('hifi/:setId')
  async getHifiSet(
    @Param('setId', new ParseUUIDPipe({ version: '4' })) setId: string,
  ): Promise<BaHifiSetWithScreens> {
    return this.hifi.findById(setId);
  }

  @Post('hifi/:setId/regenerate')
  async regenerateHifiSet(
    @Param('setId', new ParseUUIDPipe({ version: '4' })) setId: string,
  ): Promise<BaHifiSetWithScreens> {
    return this.hifi.regenerate(setId);
  }

  @Get('hifi/screens/:screenId')
  async getHifiScreen(
    @Param('screenId', new ParseUUIDPipe({ version: '4' })) screenId: string,
  ): Promise<BaHifiScreen> {
    return this.hifi.findScreenById(screenId);
  }

  @Patch('hifi/screens/:screenId')
  async updateHifiScreen(
    @Param('screenId', new ParseUUIDPipe({ version: '4' })) screenId: string,
    @Body() body: UpdateHifiScreenDto,
  ): Promise<BaHifiScreen> {
    return this.hifi.updateScreen(screenId, body);
  }

  // ─── Wireframe / Hi-fi screen exports (download) ──────────────────────────
  // Format: png | html | pdf
  // Scope:  individual screen (/screens/:screenId/export/:format)
  //          set-level bulk (/:setId/export/:format) — png/html return ZIP,
  //          pdf returns one combined PDF (one screen per page).

  @Get('wireframes/screens/:screenId/export/:format')
  async exportLofiScreen(
    @Param('screenId', new ParseUUIDPipe({ version: '4' })) screenId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleScreenExport(res, 'lofi', screenId, format);
  }

  @Get('hifi/screens/:screenId/export/:format')
  async exportHifiScreen(
    @Param('screenId', new ParseUUIDPipe({ version: '4' })) screenId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleScreenExport(res, 'hifi', screenId, format);
  }

  @Get('wireframes/:setId/export/:format')
  async exportLofiSet(
    @Param('setId', new ParseUUIDPipe({ version: '4' })) setId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleSetExport(res, 'lofi', setId, format);
  }

  @Get('hifi/:setId/export/:format')
  async exportHifiSet(
    @Param('setId', new ParseUUIDPipe({ version: '4' })) setId: string,
    @Param('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleSetExport(res, 'hifi', setId, format);
  }

  private async handleScreenExport(
    res: Response,
    kind: ScreenKind,
    screenId: string,
    rawFormat: string,
  ): Promise<void> {
    const format = this.resolveScreenFormat(rawFormat);
    const result =
      format === 'png'
        ? await this.screenExport.renderScreenPng(kind, screenId)
        : format === 'html'
          ? await this.screenExport.renderScreenHtml(kind, screenId)
          : await this.screenExport.renderScreenPdf(kind, screenId);
    this.sendBinary(res, result.buffer, result.filename, format);
  }

  private async handleSetExport(
    res: Response,
    kind: ScreenKind,
    setId: string,
    rawFormat: string,
  ): Promise<void> {
    const format = this.resolveScreenFormat(rawFormat);
    if (format === 'png') {
      const r = await this.screenExport.renderSetPngZip(kind, setId);
      this.sendBinary(res, r.buffer, r.filename, 'png.zip');
      return;
    }
    if (format === 'html') {
      const r = await this.screenExport.renderSetHtmlZip(kind, setId);
      this.sendBinary(res, r.buffer, r.filename, 'html.zip');
      return;
    }
    const r = await this.screenExport.renderSetPdf(kind, setId);
    this.sendBinary(res, r.buffer, r.filename, 'pdf');
  }
}
