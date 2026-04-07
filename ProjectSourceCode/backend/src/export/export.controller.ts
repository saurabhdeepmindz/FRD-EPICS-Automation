import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrdService } from '../prd/prd.service';
import { PdfService } from './pdf.service';
import { generatePrdHtml } from './templates/prd-html';

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

    let docxBuffer: Buffer;
    try {
      const htmlDocx = require('html-docx-js');
      docxBuffer = htmlDocx.asBlob(html);
    } catch {
      // Fallback: wrap HTML in minimal DOCX-compatible wrapper
      const docxHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>${prd.productName}</title>
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        </head><body>${html}</body></html>`;
      docxBuffer = Buffer.from(docxHtml, 'utf-8');
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
