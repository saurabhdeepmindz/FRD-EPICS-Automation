import { Controller, Get, Logger, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrdService } from '../prd/prd.service';
import { PdfService } from './pdf.service';
import { generatePrdHtml } from './templates/prd-html';

// html-to-docx is CommonJS with no bundled types. It converts an HTML string to
// a real OOXML .docx Buffer in Node (magic bytes `PK\x03\x04`), unlike the old
// html-docx-js whose asBlob() returns a browser Blob on modern Node — which the
// previous code mistakenly treated as a Buffer, producing corrupt files.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToDocx: (
  html: string,
  headerHtml?: string | null,
  options?: Record<string, unknown>,
  footerHtml?: string | null,
) => Promise<Buffer> = require('html-to-docx');

function buildPrdData(prd: Awaited<ReturnType<PrdService['findOne']>>) {
  return {
    prdCode: prd.prdCode,
    productName: prd.productName,
    version: prd.version,
    status: prd.status,
    author: prd.author,
    clientName: prd.clientName,
    submittedBy: prd.submittedBy,
    clientLogo: prd.clientLogo,
    createdAt: prd.createdAt,
    sections: prd.sections.map((s) => ({
      sectionNumber: s.sectionNumber,
      sectionName: s.sectionName,
      content: s.content as Record<string, unknown>,
      status: s.status,
    })),
  };
}

@Controller('prd')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(
    private readonly prdService: PrdService,
    private readonly pdfService: PdfService,
  ) {}

  /** GET /api/prd/:id/export/pdf — download PRD as PDF */
  @Get(':id/export/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const prd = await this.prdService.findOne(id);
    const history = await this.prdService.getHistory(id);
    const pdfBuffer = await this.pdfService.generatePdf(buildPrdData(prd), history);
    const filename = `${prd.prdCode}-${prd.productName.replace(/\s+/g, '_')}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  /** GET /api/prd/:id/export/docx — download PRD as DOCX */
  @Get(':id/export/docx')
  async exportDocx(@Param('id') id: string, @Res() res: Response) {
    const prd = await this.prdService.findOne(id);
    const history = await this.prdService.getHistory(id);
    const html = generatePrdHtml(buildPrdData(prd), history);

    // Produce a genuine OOXML .docx (a ZIP) from the rendered HTML. html-to-docx
    // returns a Buffer in Node; coerce defensively in case a future version
    // hands back an ArrayBuffer/Blob-like value.
    //
    // IMPORTANT: the `margins` object MUST include header/footer/gutter. If they
    // are omitted, html-to-docx writes `undefined` into the section's <w:pgMar>
    // (e.g. w:header="undefined"), producing invalid OOXML that Word refuses to
    // open ("We found a problem with its contents") even though the ZIP itself
    // is well-formed. Verified against Word (Office 2019).
    let docxBuffer: Buffer;
    try {
      const raw = await htmlToDocx(html, null, {
        orientation: 'portrait',
        margins: {
          top: 720,
          right: 720,
          bottom: 720,
          left: 720,
          header: 720,
          footer: 720,
          gutter: 0,
        },
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      docxBuffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    } catch (err) {
      this.logger.error(
        `DOCX generation failed for PRD ${id}: ${(err as Error).message}`,
      );
      throw err;
    }

    const filename = `${prd.prdCode}-${prd.productName.replace(/\s+/g, '_')}.docx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': docxBuffer.length,
    });
    res.end(docxBuffer);
  }
}
