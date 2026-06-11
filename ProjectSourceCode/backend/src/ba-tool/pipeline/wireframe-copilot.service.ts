import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, BaWireframeChangeSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { TextExtractionService } from '../text-extraction.service';
import { WireframeContextService, type WfScreen } from './wireframe-context.service';

export interface WireframeChatDto {
  userMessage: string;
  scope?: { kind: 'ALL' | 'SELECTED'; slugs?: string[] };
  targetKind?: 'LOFI' | 'HIFI';
  provider?: string;
  referenceSlugs?: string[];
  history?: { role: string; content: string }[];
}

export interface FeedbackIngestDto {
  rawText?: string;
  uploadedBy?: string;
  source?: string;
  targetKind?: 'LOFI' | 'HIFI';
}

/**
 * v12 · Track WC-05/21 — conversational chat over wireframes (→ proposed change
 * items) and bulk feedback-document ingestion (→ screen-routed staging payload).
 */
@Injectable()
export class WireframeCopilotService {
  private readonly logger = new Logger(WireframeCopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly textExtraction: TextExtractionService,
    private readonly context: WireframeContextService,
  ) {}

  async chat(projectId: string, dto: WireframeChatDto) {
    if (!dto.userMessage?.trim()) throw new BadRequestException('Empty message.');
    const kind = dto.targetKind ?? 'HIFI';
    const thread = await this.upsertThread(projectId);

    const all = await this.context.screensFor(projectId, kind);
    const selected = dto.scope?.kind === 'SELECTED' && dto.scope.slugs?.length
      ? all.filter((s) => dto.scope!.slugs!.includes(s.slug))
      : all;
    const scopeLabel = dto.scope?.kind === 'SELECTED'
      ? `${selected.length} selected screen(s): ${selected.map((s) => s.slug).join(', ')}`
      : `All ${all.length} ${kind.toLowerCase()} screens`;

    const userMsg = await this.prisma.baWireframeCopilotMessage.create({
      data: {
        threadId: thread.id, role: 'user', content: dto.userMessage,
        targetScope: { kind: dto.scope?.kind ?? 'ALL', slugs: dto.scope?.slugs ?? [] } as unknown as Prisma.InputJsonValue,
      },
    });

    const tokens = await this.context.tokens(projectId);
    const referenceScreens = await this.context.referenceScreens(projectId, dto.referenceSlugs ?? [], kind);
    const screensFull = selected.map((s) => ({ slug: s.slug, title: s.title, module: s.module, callouts: s.callouts, html: s.html }));

    const chat = await this.ai.wireframeChat({
      provider: dto.provider, scope_label: scopeLabel, screens: screensFull,
      design_tokens: tokens, reference_screens: referenceScreens, prd_context: '',
      history: dto.history ?? [], user_message: dto.userMessage,
    });

    const asstMsg = await this.prisma.baWireframeCopilotMessage.create({
      data: { threadId: thread.id, role: 'assistant', content: chat.markdown, model: chat.model },
    });

    const extract = await this.ai.wireframeExtractChanges({
      provider: dto.provider, scope_label: scopeLabel,
      screens: selected.map((s) => ({ slug: s.slug, title: s.title, module: s.module })),
      user_message: dto.userMessage, assistant_reply: chat.markdown,
    });

    return {
      threadId: thread.id,
      messageId: asstMsg.id,
      userMessageId: userMsg.id,
      reply: chat.markdown,
      model: chat.model,
      proposed: extract.items.map((it) => ({ ...it, targetKind: kind })),
    };
  }

  /** WC-21 — ingest an uploaded document or pasted text → screen-routed staging. */
  async ingestFeedback(projectId: string, dto: FeedbackIngestDto, file?: Express.Multer.File) {
    let text = dto.rawText ?? '';
    let fileName: string | null = null;
    if (file) {
      const ex = await this.textExtraction.extract(file.buffer, file.mimetype, file.originalname);
      text = ex.text;
      fileName = file.originalname;
    }
    if (!text.trim()) throw new BadRequestException('No feedback text — upload a document or paste text.');

    const kind = dto.targetKind ?? 'HIFI';
    const screens = await this.context.screensFor(projectId, kind);
    const parsed = await this.ai.wireframeParseFeedback({
      rawText: text,
      screens: screens.map((s) => ({ slug: s.slug, title: s.title, module: s.module })),
    });

    const known = new Set(screens.map((s) => s.slug));
    const routedScreens = (parsed.screens ?? []).map((b) => ({
      ...b,
      slug: b.slug && known.has(b.slug) ? b.slug : this.fuzzy(b.screenRef ?? '', screens),
    }));

    const parsedCount =
      (parsed.general?.length ?? 0) +
      (parsed.designSystem?.length ?? 0) +
      (parsed.screens?.reduce((a, b) => a + (b.items?.length ?? 0), 0) ?? 0) +
      (parsed.unmatched?.length ?? 0);

    const imp = await this.prisma.baWireframeFeedbackImport.create({
      data: {
        projectId, threadId: (await this.upsertThread(projectId)).id, fileName,
        source: (dto.source === 'INTERNAL' ? 'INTERNAL' : 'CUSTOMER') as BaWireframeChangeSource,
        uploadedBy: dto.uploadedBy ?? null, uploadedAt: new Date(),
        rawText: text.slice(0, 100_000), parsedCount,
      },
    });

    this.logger.log(`Feedback import ${imp.id}: ${parsedCount} change(s) parsed`);
    return {
      importId: imp.id,
      fileName,
      uploadedBy: imp.uploadedBy,
      uploadedAt: imp.uploadedAt,
      general: parsed.general ?? [],
      designSystem: parsed.designSystem ?? [],
      screens: routedScreens,
      unmatched: parsed.unmatched ?? [],
      targetKind: kind,
    };
  }

  private async upsertThread(projectId: string) {
    const existing = await this.prisma.baWireframeCopilotThread.findFirst({
      where: { projectId }, orderBy: { createdAt: 'asc' },
    });
    return existing ?? this.prisma.baWireframeCopilotThread.create({ data: { projectId } });
  }

  /** Best-effort "Screen 01 — Landing" → slug match against the current set. */
  private fuzzy(ref: string, screens: WfScreen[]): string | null {
    if (!ref) return null;
    const m = /(\d{1,3})/.exec(ref);
    if (m) {
      const num = m[1].padStart(2, '0');
      const hit = screens.find((s) => s.slug.includes(`-${num}-`) || s.slug.includes(`screen-${num}`));
      if (hit) return hit.slug;
    }
    const lower = ref.toLowerCase();
    const hit = screens.find((s) => lower.includes(s.title.toLowerCase()) || s.title.toLowerCase().includes(lower));
    return hit?.slug ?? null;
  }
}
