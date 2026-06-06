import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { HLD_SECTION_NAMES } from './project-hld.service';
import { chunkText, cosine } from './hld-references.service';

export interface SimilarHit {
  hldId: string;
  projectId: string;
  productName: string;
  sectionKey: string;
  sectionName: string;
  snippet: string;
  score: number;
}

/**
 * HLD Repository / RAG (Sprint v11 / HD-10). Indexes HLD sections org-wide into
 * embedded chunks, powers "find similar HLDs" inside the Copilot, and backs the
 * HLD Library browse/search page. App-side cosine retrieval (no pgvector).
 */
@Injectable()
export class HldLibraryService {
  private readonly logger = new Logger(HldLibraryService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  /** (Re)index one HLD's sections into the org-wide repository. */
  async indexHld(hldId: string): Promise<{ hldId: string; chunks: number }> {
    const hld = await this.prisma.baHld.findUnique({ where: { id: hldId } });
    if (!hld) throw new NotFoundException(`HLD ${hldId} not found`);
    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const productName = project?.productName ?? project?.name ?? 'Project';
    const sections = (hld.sections ?? {}) as Record<string, unknown>;

    // Build (sectionKey, chunkText) pairs across all sections.
    const items: { sectionKey: string; text: string }[] = [];
    for (const [key, body] of Object.entries(sections)) {
      const text = `${HLD_SECTION_NAMES[key] ?? key}\n${sectionToText(body)}`.trim();
      for (const c of chunkText(text)) items.push({ sectionKey: key, text: c });
    }

    await this.prisma.baHldIndexChunk.deleteMany({ where: { hldId } });
    if (!items.length) return { hldId, chunks: 0 };

    const embeddings = await this.embed(items.map((i) => i.text));
    if (embeddings.length !== items.length) return { hldId, chunks: 0 };

    await this.prisma.baHldIndexChunk.createMany({
      data: items.map((it, i) => ({
        hldId,
        projectId: hld.projectId,
        productName,
        sectionKey: it.sectionKey,
        idx: i,
        text: it.text,
        embedding: embeddings[i] as unknown as object,
      })),
    });
    this.logger.log(`Indexed HLD ${hldId} (${productName}) — ${items.length} chunks`);
    return { hldId, chunks: items.length };
  }

  /** Find similar HLD sections org-wide (excluding the current HLD). */
  async findSimilar(hldId: string, query: string, k = 6): Promise<SimilarHit[]> {
    const q = (query ?? '').trim();
    if (!q) return [];
    const chunks = await this.prisma.baHldIndexChunk.findMany({
      where: { NOT: { hldId } },
      select: { hldId: true, projectId: true, productName: true, sectionKey: true, text: true, embedding: true },
      take: 4000,
    });
    if (!chunks.length) return [];
    let qVec: number[];
    try {
      [qVec] = await this.embed([q]);
    } catch {
      return [];
    }
    const scored = chunks.map((c) => ({
      hldId: c.hldId,
      projectId: c.projectId,
      productName: c.productName,
      sectionKey: c.sectionKey,
      sectionName: HLD_SECTION_NAMES[c.sectionKey] ?? c.sectionKey,
      snippet: c.text.slice(0, 400),
      score: cosine(qVec, (c.embedding as unknown as number[]) ?? []),
    }));
    // Best chunk per (hldId, sectionKey), then top-k overall.
    const best = new Map<string, SimilarHit>();
    for (const s of scored) {
      const key = `${s.hldId}|${s.sectionKey}`;
      const cur = best.get(key);
      if (!cur || s.score > cur.score) best.set(key, s);
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, k);
  }

  /** List indexed HLDs (one row per HLD) for the browse page. */
  async list(): Promise<{ hldId: string; projectId: string; productName: string; sections: number; chunks: number; indexedAt: Date | null }[]> {
    const grouped = await this.prisma.baHldIndexChunk.groupBy({
      by: ['hldId', 'projectId', 'productName'],
      _count: { _all: true },
      _max: { createdAt: true },
    });
    // distinct sections per hld
    const out = [];
    for (const g of grouped) {
      const secs = await this.prisma.baHldIndexChunk.findMany({
        where: { hldId: g.hldId },
        select: { sectionKey: true },
        distinct: ['sectionKey'],
      });
      out.push({
        hldId: g.hldId,
        projectId: g.projectId,
        productName: g.productName,
        sections: secs.length,
        chunks: g._count._all,
        indexedAt: g._max.createdAt,
      });
    }
    return out.sort((a, b) => (b.indexedAt?.getTime() ?? 0) - (a.indexedAt?.getTime() ?? 0));
  }

  /** Org-wide semantic search across all indexed HLD sections. */
  async search(query: string, k = 12): Promise<SimilarHit[]> {
    const q = (query ?? '').trim();
    if (!q) return [];
    const chunks = await this.prisma.baHldIndexChunk.findMany({
      select: { hldId: true, projectId: true, productName: true, sectionKey: true, text: true, embedding: true },
      take: 5000,
    });
    if (!chunks.length) return [];
    let qVec: number[];
    try {
      [qVec] = await this.embed([q]);
    } catch {
      return [];
    }
    return chunks
      .map((c) => ({
        hldId: c.hldId,
        projectId: c.projectId,
        productName: c.productName,
        sectionKey: c.sectionKey,
        sectionName: HLD_SECTION_NAMES[c.sectionKey] ?? c.sectionKey,
        snippet: c.text.slice(0, 400),
        score: cosine(qVec, (c.embedding as unknown as number[]) ?? []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** Source HLD's non-empty sections (rendered) — for the "borrow sections" browser. */
  async getHldSections(hldId: string): Promise<{
    hldId: string;
    productName: string;
    sections: { key: string; name: string; preview: string; text: string }[];
  }> {
    const hld = await this.prisma.baHld.findUnique({ where: { id: hldId } });
    if (!hld) throw new NotFoundException(`HLD ${hldId} not found`);
    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const productName = project?.productName ?? project?.name ?? 'Project';
    const sections = (hld.sections ?? {}) as Record<string, unknown>;
    const out: { key: string; name: string; preview: string; text: string }[] = [];
    for (const key of Object.keys(HLD_SECTION_NAMES)) {
      const text = sectionToText(sections[key]).trim();
      if (!text) continue;
      const name = HLD_SECTION_NAMES[key];
      out.push({ key, name, preview: text.slice(0, 180), text: `${name}\n${text}` });
    }
    return { hldId, productName, sections: out };
  }

  private async embed(texts: string[]): Promise<number[][]> {
    const { data } = await axios.post<{ embeddings: number[][] }>(
      `${this.aiServiceUrl}/embed`,
      { texts },
      { timeout: 120_000 },
    );
    return data.embeddings;
  }
}

/** Flatten a section value (string / array / object) into plain text. */
function sectionToText(body: unknown): string {
  if (body == null) return '';
  if (typeof body === 'string') return body.replace(/^\[AI\]\s*/, '');
  if (typeof body === 'number' || typeof body === 'boolean') return String(body);
  if (Array.isArray(body)) return body.map(sectionToText).join('; ');
  return Object.entries(body as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${sectionToText(v)}`)
    .join('\n');
}
