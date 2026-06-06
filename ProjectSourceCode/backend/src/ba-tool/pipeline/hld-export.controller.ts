import { Controller, Get, Logger, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { HldService } from './project-hld.service';
import { PdfService } from '../../export/pdf.service';
import { generateHldHtml } from '../../export/templates/hld-html';

// html-to-docx is CommonJS with no bundled types — converts an HTML string to a
// real OOXML .docx Buffer in Node. The `margins` object MUST include
// header/footer/gutter or Word refuses to open the file (see PRD export).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToDocx: (
  html: string,
  headerHtml?: string | null,
  options?: Record<string, unknown>,
  footerHtml?: string | null,
) => Promise<Buffer> = require('html-to-docx');

/**
 * HLD export (Sprint v10, HE-05) — PDF + DOCX at full PRD parity, from the shared
 * `generateHldHtml()` template (so Preview, PDF, and DOCX all match). Markdown is
 * served from `GET /ba/projects/:id/hld/markdown` on the main pipeline controller.
 */
@Controller('ba/projects/:id/hld')
export class HldExportController {
  private readonly logger = new Logger(HldExportController.name);

  constructor(
    private readonly hld: HldService,
    private readonly pdf: PdfService,
  ) {}

  /** GET /api/ba/projects/:id/hld/:hldId/export/pdf */
  @Get(':hldId/export/pdf')
  async exportPdf(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Res() res: Response,
  ) {
    const data = await this.hld.getExport(hldId);
    const html = generateHldHtml(data);
    const buffer = await this.pdf.generatePdfFromHtml(html, { headerLabel: 'High-Level Design (HLD)' });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${this.filename(data.productName, data.version, 'pdf')}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /api/ba/projects/:id/hld/:hldId/export/docx */
  @Get(':hldId/export/docx')
  async exportDocx(
    @Param('hldId', ParseUUIDPipe) hldId: string,
    @Res() res: Response,
  ) {
    const data = await this.hld.getExport(hldId);
    const html = generateHldHtml(data);
    let buffer: Buffer;
    try {
      const raw = await htmlToDocx(html, null, {
        orientation: 'portrait',
        margins: { top: 720, right: 720, bottom: 720, left: 720, header: 720, footer: 720, gutter: 0 },
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    } catch (err) {
      this.logger.error(`DOCX generation failed for HLD ${hldId}: ${(err as Error).message}`);
      throw err;
    }
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${this.filename(data.productName, data.version, 'docx')}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  private filename(productName: string, version: number, ext: string): string {
    const safe = productName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project';
    return `HLD-${safe}-v${version}.${ext}`;
  }
}
