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

    const ref = await this.prisma.baHldReference.create({
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
    if (status === 'READY' && text.trim()) await this.indexReference(ref.id, hldId, opts.sectionKey ?? null, text);
    return ref;
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

    const ref = await this.prisma.baHldReference.create({
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
    if (status === 'READY' && text.trim()) await this.indexReference(ref.id, hldId, opts.sectionKey ?? null, text);
    return ref;
  }

  // ── RAG (HD-13) — chunk + embed on ingest; cosine top-k at query time ────────

  /** Chunk text, embed each chunk, and persist as BaHldReferenceChunk rows. */
  private async indexReference(refId: string, hldId: string, sectionKey: string | null, text: string) {
    try {
      const chunks = chunkText(text);
      if (!chunks.length) return;
      const embeddings = await this.embed(chunks);
      if (embeddings.length !== chunks.length) return;
      await this.prisma.baHldReferenceChunk.createMany({
        data: chunks.map((c, i) => ({
          referenceId: refId,
          hldId,
          sectionKey,
          idx: i,
          text: c,
          embedding: embeddings[i] as unknown as object,
        })),
      });
    } catch (err) {
      this.logger.warn(`Reference indexing failed (${refId}): ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Embed texts via the ai-service. Returns one vector per input. */
  private async embed(texts: string[]): Promise<number[][]> {
    const { data } = await axios.post<{ embeddings: number[][] }>(
      `${this.aiServiceUrl}/embed`,
      { texts },
      { timeout: 120_000 },
    );
    return data.embeddings;
  }

  /**
   * RAG retrieval: embed the query and return the top-k most relevant reference
   * chunks for (whole-HLD + section) among INCLUDED, READY references.
   */
  async retrieve(
    hldId: string,
    sectionKey: string | undefined,
    query: string,
    k = 6,
  ): Promise<{ title: string; text: string; score: number }[]> {
    const q = (query ?? '').trim();
    if (!q) return [];
    const chunks = await this.prisma.baHldReferenceChunk.findMany({
      where: {
        hldId,
        OR: [{ sectionKey: null }, ...(sectionKey ? [{ sectionKey }] : [])],
        reference: { includeInContext: true, status: 'READY' },
      },
      select: { text: true, embedding: true, reference: { select: { title: true } } },
      take: 800,
    });
    if (!chunks.length) return [];
    let queryVec: number[];
    try {
      [queryVec] = await this.embed([q]);
    } catch (err) {
      this.logger.warn(`Query embed failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
    return chunks
      .map((c) => ({
        title: c.reference.title,
        text: c.text,
        score: cosine(queryVec, (c.embedding as unknown as number[]) ?? []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
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

// ── RAG helpers (module-level, pure) ──────────────────────────────────────────

/** Split text into ~size-char chunks with overlap (sentence-ish boundaries). */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      // prefer to break at a paragraph/sentence/space boundary near the end
      const slice = clean.slice(start, end);
      const brk = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
      if (brk > size * 0.5) end = start + brk + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter(Boolean).slice(0, 200); // cap chunks per reference
}

/** Cosine similarity of two equal-length vectors (0 if degenerate). */
export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
