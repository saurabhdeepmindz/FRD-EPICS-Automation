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
    return this.generatePdfFromHtml(html, {
      headerLabel: 'Product Requirements Document',
    });
  }

  /**
   * Generic HTML → PDF renderer. Used by PRD export and BA-tool artifact exports.
   * Falls back to returning the raw HTML buffer if Puppeteer is unavailable.
   */
  async generatePdfFromHtml(
    html: string,
    opts: { headerLabel?: string } = {},
  ): Promise<Buffer> {
    let puppeteer: typeof import('puppeteer');
    try {
      puppeteer = await import('puppeteer');
    } catch {
      this.logger.warn('Puppeteer not available, falling back to HTML buffer');
      return Buffer.from(html, 'utf-8');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      // Default 30s page navigation timeout is too tight for large FTC
      // exports that embed 150+ inline screen images. Bump for both the
      // setContent stage and the page-default. A 5-minute ceiling is
      // generous but still much shorter than the express request timeout.
      page.setDefaultNavigationTimeout(300_000);
      page.setDefaultTimeout(300_000);
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 300_000 });

      // If the page has Mermaid diagrams, wait for them to finish rendering
      // so the PDF captures the SVG output, not the raw code blocks.
      const hasMermaid = await page.evaluate(() => {
        return document.querySelectorAll('.mermaid').length > 0;
      });
      if (hasMermaid) {
        try {
          await page.waitForFunction(
            () => {
              const nodes = Array.from(document.querySelectorAll('.mermaid'));
              // Each .mermaid div should have been replaced by or contain an SVG
              return nodes.length === 0 || nodes.every((n) => n.querySelector('svg') !== null);
            },
            { timeout: 10_000 },
          );
        } catch {
          this.logger.warn('Mermaid render timed out — PDF may show diagram source instead of SVG');
        }
      }

      const headerLabel = opts.headerLabel ?? 'Document';
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: true,
        timeout: 300_000,
        headerTemplate:
          `<div style="font-size:9px;text-align:center;width:100%;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">${escapeHtml(headerLabel)}</div>`,
        footerTemplate:
          '<div style="font-size:9px;text-align:center;width:100%;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:4px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      });
      return Buffer.from(pdfBuffer);
    } finally {
      // Windows-only puppeteer race: Chrome holds a lockfile inside its
      // auto-generated temp profile (e.g. `first_party_sets.db`) for a
      // few hundred ms after the browser exits, and `browser.close()`
      // tries to delete the directory immediately and throws EBUSY. The
      // PDF buffer is already produced by the time we hit `finally`, so
      // letting the close error surface would discard a successful
      // export. Swallow + log instead. The orphaned temp dir is cleaned
      // up by Windows TempFileCleaner / next reboot.
      try {
        await browser.close();
      } catch (err) {
        this.logger.warn(`puppeteer cleanup failed (non-fatal, PDF already generated): ${(err as Error).message}`);
      }
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
