import { Injectable, Logger } from '@nestjs/common';
import { generatePrdHtml, type PrdData } from './templates/prd-html';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Generate a PDF buffer from PRD data.
   * Uses Puppeteer to render the HTML template to PDF.
   */
  async generatePdf(prd: PrdData, history?: unknown[]): Promise<Buffer> {
    const html = generatePrdHtml(prd, history);

    // Dynamic import to avoid hard dependency if puppeteer isn't installed
    let puppeteer: typeof import('puppeteer');
    try {
      puppeteer = await import('puppeteer');
    } catch {
      this.logger.warn('Puppeteer not available, falling back to HTML-to-PDF via basic buffer');
      // Fallback: return the HTML as a buffer (can be opened in browser and printed)
      return Buffer.from(html, 'utf-8');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: true,
        headerTemplate:
          '<div style="font-size:9px;text-align:center;width:100%;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Product Requirements Document</div>',
        footerTemplate:
          '<div style="font-size:9px;text-align:center;width:100%;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:4px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
