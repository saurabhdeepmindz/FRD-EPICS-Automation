import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService } from '../../export/pdf.service';

// `archiver` is published as a CommonJS module with a callable export.
// Using ES default-import would compile to `archiver_1.default(...)`, which
// throws because the package has no `.default` property. CJS require keeps
// it callable.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver: (format: 'zip', opts?: { zlib?: { level?: number } }) => {
  on(event: 'data', cb: (chunk: Buffer) => void): unknown;
  on(event: 'end', cb: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  append(body: Buffer | string, opts: { name: string }): unknown;
  finalize(): Promise<void>;
} = require('archiver');

/**
 * Build a ZIP buffer from a list of in-memory entries. Resolves only after
 * archiver has flushed all data (tied to the underlying stream's 'end' event).
 */
async function buildZip(entries: { name: string; body: Buffer }[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err) => reject(err));
    for (const e of entries) {
      archive.append(e.body, { name: e.name });
    }
    void archive.finalize();
  });
}

export type ScreenKind = 'lofi' | 'hifi';
export type ScreenExportFormat = 'png' | 'html' | 'pdf';

interface ScreenLike {
  id: string;
  sequenceNum: number;
  slug: string;
  title: string;
  htmlContent: string | null;
}

interface SetLike {
  id: string;
  projectId: string;
  screens: ScreenLike[];
  productName: string;
}

/**
 * Export wireframe / hi-fi mockup screens to PNG, standalone HTML, or PDF.
 * Individual or bulk (ZIP for png/html, single combined PDF for pdf).
 *
 * One service handles both kinds because the operation is purely
 * (htmlContent -> rendered artifact). The kind is used only for naming
 * conventions in filenames and the directory layout inside ZIPs.
 */
@Injectable()
export class ScreenExportService {
  private readonly logger = new Logger(ScreenExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  // ─── Loaders ──────────────────────────────────────────────────────────────

  private async loadLofiScreen(screenId: string): Promise<{ screen: ScreenLike; productName: string }> {
    const row = await this.prisma.baWireframeScreen.findUnique({
      where: { id: screenId },
      include: { set: { include: { project: true } } },
    });
    if (!row) throw new NotFoundException(`Wireframe screen ${screenId} not found`);
    return {
      screen: {
        id: row.id,
        sequenceNum: row.sequenceNum,
        slug: row.slug,
        title: row.title,
        htmlContent: row.htmlContent,
      },
      productName: row.set.project.productName ?? row.set.project.name,
    };
  }

  private async loadHifiScreen(screenId: string): Promise<{ screen: ScreenLike; productName: string }> {
    const row = await this.prisma.baHifiScreen.findUnique({
      where: { id: screenId },
      include: { set: { include: { project: true } } },
    });
    if (!row) throw new NotFoundException(`Hi-fi screen ${screenId} not found`);
    return {
      screen: {
        id: row.id,
        sequenceNum: row.sequenceNum,
        slug: row.slug,
        title: row.title,
        htmlContent: row.htmlContent,
      },
      productName: row.set.project.productName ?? row.set.project.name,
    };
  }

  private async loadLofiSet(setId: string): Promise<SetLike> {
    const row = await this.prisma.baWireframeSet.findUnique({
      where: { id: setId },
      include: {
        project: true,
        screens: { orderBy: { sequenceNum: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException(`Wireframe set ${setId} not found`);
    return {
      id: row.id,
      projectId: row.projectId,
      productName: row.project.productName ?? row.project.name,
      screens: row.screens.map((s) => ({
        id: s.id,
        sequenceNum: s.sequenceNum,
        slug: s.slug,
        title: s.title,
        htmlContent: s.htmlContent,
      })),
    };
  }

  private async loadHifiSet(setId: string): Promise<SetLike> {
    const row = await this.prisma.baHifiSet.findUnique({
      where: { id: setId },
      include: {
        project: true,
        screens: { orderBy: { sequenceNum: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException(`Hi-fi set ${setId} not found`);
    return {
      id: row.id,
      projectId: row.projectId,
      productName: row.project.productName ?? row.project.name,
      screens: row.screens.map((s) => ({
        id: s.id,
        sequenceNum: s.sequenceNum,
        slug: s.slug,
        title: s.title,
        htmlContent: s.htmlContent,
      })),
    };
  }

  // ─── Single-screen renderers ─────────────────────────────────────────────

  async renderScreenHtml(
    kind: ScreenKind,
    screenId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { screen, productName } = await this.loadScreen(kind, screenId);
    if (!screen.htmlContent) {
      throw new BadRequestException(`Screen ${screen.slug} has no rendered HTML to export`);
    }
    const html = wrapStandaloneHtml(screen.htmlContent, screen.title);
    return {
      buffer: Buffer.from(html, 'utf-8'),
      filename: buildScreenFilename(kind, productName, screen, 'html'),
    };
  }

  async renderScreenPng(
    kind: ScreenKind,
    screenId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { screen, productName } = await this.loadScreen(kind, screenId);
    if (!screen.htmlContent) {
      throw new BadRequestException(`Screen ${screen.slug} has no rendered HTML to export`);
    }
    const buffer = await renderHtmlToPng(wrapStandaloneHtml(screen.htmlContent, screen.title), this.logger);
    return {
      buffer,
      filename: buildScreenFilename(kind, productName, screen, 'png'),
    };
  }

  async renderScreenPdf(
    kind: ScreenKind,
    screenId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { screen, productName } = await this.loadScreen(kind, screenId);
    if (!screen.htmlContent) {
      throw new BadRequestException(`Screen ${screen.slug} has no rendered HTML to export`);
    }
    const html = wrapStandaloneHtml(screen.htmlContent, screen.title);
    const buffer = await this.pdfService.generatePdfFromHtml(html, {
      headerLabel: `${productName} — ${kind === 'hifi' ? 'Hi-fi' : 'Lo-fi'} · ${screen.title}`,
    });
    return {
      buffer,
      filename: buildScreenFilename(kind, productName, screen, 'pdf'),
    };
  }

  // ─── Bulk (set-level) renderers ─────────────────────────────────────────

  async renderSetHtmlZip(
    kind: ScreenKind,
    setId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const set = await this.loadSet(kind, setId);
    if (set.screens.length === 0) {
      throw new BadRequestException('Set has no screens to export');
    }
    const entries = set.screens
      .filter((s) => !!s.htmlContent)
      .map((s) => ({
        name: buildZipEntryName(s, 'html'),
        body: Buffer.from(wrapStandaloneHtml(s.htmlContent ?? '', s.title), 'utf-8'),
      }));
    return {
      buffer: await buildZip(entries),
      filename: buildSetFilename(kind, set.productName, 'html.zip'),
    };
  }

  async renderSetPngZip(
    kind: ScreenKind,
    setId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const set = await this.loadSet(kind, setId);
    if (set.screens.length === 0) {
      throw new BadRequestException('Set has no screens to export');
    }
    // Render PNGs serially (Puppeteer browsers are heavy — running them in
    // parallel for 7-14 screens regularly OOMs on the dev machine; serial
    // takes ~2-4s per screen, well within the request budget).
    const entries: { name: string; body: Buffer }[] = [];
    for (const s of set.screens) {
      if (!s.htmlContent) continue;
      const png = await renderHtmlToPng(wrapStandaloneHtml(s.htmlContent, s.title), this.logger);
      entries.push({ name: buildZipEntryName(s, 'png'), body: png });
    }
    return {
      buffer: await buildZip(entries),
      filename: buildSetFilename(kind, set.productName, 'png.zip'),
    };
  }

  async renderSetPdf(
    kind: ScreenKind,
    setId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const set = await this.loadSet(kind, setId);
    if (set.screens.length === 0) {
      throw new BadRequestException('Set has no screens to export');
    }
    const combined = buildCombinedScreensHtml(kind, set);
    const buffer = await this.pdfService.generatePdfFromHtml(combined, {
      headerLabel: `${set.productName} — ${kind === 'hifi' ? 'Hi-fi mockups' : 'Lo-fi wireframes'}`,
    });
    return {
      buffer,
      filename: buildSetFilename(kind, set.productName, 'pdf'),
    };
  }

  // ─── Internal dispatch ───────────────────────────────────────────────────

  private async loadScreen(kind: ScreenKind, screenId: string) {
    return kind === 'hifi' ? this.loadHifiScreen(screenId) : this.loadLofiScreen(screenId);
  }

  private async loadSet(kind: ScreenKind, setId: string) {
    return kind === 'hifi' ? this.loadHifiSet(setId) : this.loadLofiSet(setId);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wrap a screen's body HTML so it renders standalone (Tailwind-style minimal
 * defaults; the AI-generated htmlContent typically already includes its own
 * <html><head><style>, so we only inject when the content is a body fragment).
 */
function wrapStandaloneHtml(content: string, title: string): string {
  const looksComplete = /<html[\s>]/i.test(content) || /<!doctype/i.test(content);
  if (looksComplete) return content;
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}</style>
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * Build a single PDF-friendly HTML document with one screen per page.
 * Uses CSS page-break so each screen lands on its own A4 sheet.
 */
function buildCombinedScreensHtml(kind: ScreenKind, set: SetLike): string {
  const label = kind === 'hifi' ? 'Hi-fi mockups' : 'Lo-fi wireframes';
  const safeProduct = escapeHtml(set.productName);
  const sections = set.screens
    .filter((s) => !!s.htmlContent)
    .map((s) => {
      const seq = String(s.sequenceNum).padStart(2, '0');
      const safeTitle = escapeHtml(s.title);
      // Strip any outer <html>/<body> wrapper if the AI emitted a full doc
      // for an individual screen — inside the combined doc we want just the
      // body fragment so each screen sits in its own page-break section.
      const inner = stripHtmlWrapper(s.htmlContent ?? '');
      return `<section class="screen-page">
  <div class="screen-header">
    <span class="screen-seq">${seq}</span>
    <span class="screen-title">${safeTitle}</span>
  </div>
  <div class="screen-body">${inner}</div>
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeProduct} — ${label}</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color: #0B1B2E; }
  .cover { padding: 60px 50px; }
  .cover h1 { font-size: 28px; margin: 0 0 8px 0; }
  .cover .subtitle { color: #64748b; font-size: 14px; }
  .screen-page { page-break-before: always; padding: 20px 24px; }
  .screen-header { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
  .screen-seq { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #94a3b8; font-size: 12px; }
  .screen-title { font-size: 16px; font-weight: 600; }
  .screen-body { font-size: 12px; }
  .screen-body img, .screen-body svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<div class="cover">
  <h1>${safeProduct}</h1>
  <div class="subtitle">${label} · ${set.screens.length} screens</div>
</div>
${sections}
</body>
</html>`;
}

function stripHtmlWrapper(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  return html;
}

function buildScreenFilename(
  kind: ScreenKind,
  productName: string,
  screen: ScreenLike,
  ext: 'png' | 'html' | 'pdf',
): string {
  const product = sanitizeForFilename(productName);
  const seq = String(screen.sequenceNum).padStart(2, '0');
  const slug = sanitizeForFilename(screen.slug);
  const tag = kind === 'hifi' ? 'hifi' : 'lofi';
  return `${product}-${tag}-${seq}-${slug}.${ext}`;
}

function buildSetFilename(kind: ScreenKind, productName: string, suffix: string): string {
  const product = sanitizeForFilename(productName);
  const tag = kind === 'hifi' ? 'hifi-mockups' : 'lofi-wireframes';
  return `${product}-${tag}.${suffix}`;
}

function buildZipEntryName(screen: ScreenLike, ext: 'png' | 'html'): string {
  const seq = String(screen.sequenceNum).padStart(2, '0');
  const slug = sanitizeForFilename(screen.slug);
  return `${seq}-${slug}.${ext}`;
}

function sanitizeForFilename(raw: string): string {
  return raw
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'screen';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render an HTML string to a full-page PNG via Puppeteer. Falls back to a
 * tiny text-only PNG if Puppeteer is unavailable (matching pdf.service.ts's
 * graceful degradation).
 */
async function renderHtmlToPng(html: string, logger: Logger): Promise<Buffer> {
  let puppeteer: typeof import('puppeteer');
  try {
    puppeteer = await import('puppeteer');
  } catch {
    logger.warn('Puppeteer not available — returning HTML buffer in place of PNG');
    return Buffer.from(html, 'utf-8');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    page.setDefaultNavigationTimeout(120_000);
    page.setDefaultTimeout(120_000);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120_000 });
    const png = await page.screenshot({ fullPage: true, type: 'png' });
    return Buffer.from(png);
  } finally {
    try {
      await browser.close();
    } catch (err) {
      logger.warn(`puppeteer cleanup failed (PNG already produced): ${(err as Error).message}`);
    }
  }
}
