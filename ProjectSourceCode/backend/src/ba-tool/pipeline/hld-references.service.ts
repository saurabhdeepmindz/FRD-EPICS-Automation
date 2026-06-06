import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { TextExtractionService } from '../text-extraction.service';
import { fetchReadablePage, UrlFetchError } from './url-fetch.util';

/**
 * HLD Copilot References (Sprint v11 / Track RR). Ingests reference URLs (fetched
 * + summarized) and documents (extracted + summarized), and exposes the included
 * ones for injection into the /hld-chat context. v1 = summarize-and-inject; deep
 * retrieval is the deferred HD-13 (RAG).
 */
@Injectable()
export class HldReferencesService {
  private readonly logger = new Logger(HldReferencesService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly textExtraction: TextExtractionService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  async list(hldId: string) {
    return this.prisma.baHldReference.findMany({
      where: { hldId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Included, READY references for (whole-HLD + the active section) — for chat context. */
  async getIncludedForContext(hldId: string, sectionKey?: string) {
    const refs = await this.prisma.baHldReference.findMany({
      where: {
        hldId,
        includeInContext: true,
        status: 'READY',
        OR: [{ sectionKey: null }, ...(sectionKey ? [{ sectionKey }] : [])],
      },
      orderBy: { createdAt: 'asc' },
      select: { title: true, summary: true, type: true, sourceUrl: true },
    });
    return refs;
  }

  async setInclude(refId: string, include: boolean) {
    return this.prisma.baHldReference.update({
      where: { id: refId },
      data: { includeInContext: include },
    });
  }

  async remove(refId: string) {
    await this.prisma.baHldReference.delete({ where: { id: refId } });
    return { id: refId };
  }

  /** Add a reference URL: SSRF-guarded fetch → readable text → AI summary. */
  async addUrl(hldId: string, opts: { url: string; sectionKey?: string | null; provider?: string }) {
    const url = (opts.url ?? '').trim();
    if (!url) throw new BadRequestException('URL is required.');
    await this.assertHld(hldId);

    let title = url;
    let text = '';
    let status: 'READY' | 'FAILED' = 'READY';
    let error: string | null = null;
    let summary: string | null = null;
    try {
      const page = await fetchReadablePage(url);
      title = page.title || url;
      text = page.text;
      if (!text.trim()) {
        status = 'FAILED';
        error = 'No readable text could be extracted (the page may be blocked or JavaScript-only).';
      } else {
        summary = await this.summarize(title, text, opts.provider);
      }
    } catch (err) {
      status = 'FAILED';
      error = err instanceof UrlFetchError ? err.message : err instanceof Error ? err.message : 'Fetch failed';
      this.logger.warn(`Reference URL fetch failed (${url}): ${error}`);
    }

    return this.prisma.baHldReference.create({
      data: {
        hldId,
        sectionKey: opts.sectionKey ?? null,
        type: 'URL',
        title: title.slice(0, 250),
        sourceUrl: url,
        extractedText: text,
        summary,
        status,
        error,
      },
    });
  }

  /** Add a reference document: extract text (PDF/DOCX/…) → AI summary. */
  async addDocument(
    hldId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    opts: { sectionKey?: string | null; provider?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('A document file is required.');
    await this.assertHld(hldId);

    let status: 'READY' | 'FAILED' = 'READY';
    let error: string | null = null;
    let summary: string | null = null;
    let text = '';
    try {
      const result = await this.textExtraction.extract(file.buffer, file.mimetype, file.originalname);
      text = result.text ?? '';
      if (!text.trim()) {
        status = 'FAILED';
        error = result.note ?? 'No text could be extracted from this document.';
      } else {
        summary = await this.summarize(file.originalname, text, opts.provider);
      }
    } catch (err) {
      status = 'FAILED';
      error = err instanceof Error ? err.message : 'Extraction failed';
      this.logger.warn(`Reference document extraction failed (${file.originalname}): ${error}`);
    }

    return this.prisma.baHldReference.create({
      data: {
        hldId,
        sectionKey: opts.sectionKey ?? null,
        type: 'DOCUMENT',
        title: file.originalname.slice(0, 250),
        fileName: file.originalname,
        mimeType: file.mimetype,
        extractedText: text,
        summary,
        status,
        error,
      },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async assertHld(hldId: string) {
    const hld = await this.prisma.baHld.findUnique({ where: { id: hldId }, select: { id: true } });
    if (!hld) throw new NotFoundException(`HLD ${hldId} not found`);
  }

  private async summarize(title: string, text: string, provider?: string): Promise<string> {
    try {
      const { data } = await axios.post<{ summary: string; model: string }>(
        `${this.aiServiceUrl}/summarize-reference`,
        { provider: provider ?? 'anthropic', title, text },
        { timeout: 120_000 },
      );
      return data.summary;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.warn(`Reference summarize failed: ${detail}`);
      // Fall back to a truncated excerpt so the reference is still usable.
      return text.slice(0, 1500);
    }
  }
}
