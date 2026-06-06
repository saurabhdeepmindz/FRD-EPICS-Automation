import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { HLD_SECTION_NAMES } from './project-hld.service';
import { BUILTIN_ARCH_TEMPLATES, libraryTemplateToHld, type HldTemplate } from './hld-templates';

/**
 * HLD Architect Copilot (Sprint v10 / Track C). Per-section conversational AI:
 * persists threads/messages, proxies the ai-service `/hld-chat` + `/hld-merge`
 * (provider-selectable, key-gated) with auto-injected PRD/FRD/stack context, and
 * tracks saved "insights" (messages flagged savedToSection) for the merge step.
 */
@Injectable()
export class HldCopilotService {
  private readonly logger = new Logger(HldCopilotService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  /** Which chat providers have a key configured (drives the model picker). */
  async providers(): Promise<{ id: string; label: string; available: boolean }[]> {
    try {
      const { data } = await axios.get<{ providers: { id: string; label: string; available: boolean }[] }>(
        `${this.aiServiceUrl}/providers`,
        { timeout: 10_000 },
      );
      return data.providers;
    } catch {
      // If the ai-service is down, report nothing available rather than 500.
      return [];
    }
  }

  /**
   * Track D — the Architecture console. Built-in starter patterns + existing
   * BaTemplate rows (GLOBAL or this project), behind one HldTemplate shape.
   */
  async listTemplates(projectId: string): Promise<HldTemplate[]> {
    let library: HldTemplate[] = [];
    try {
      const rows = await this.prisma.baTemplate.findMany({
        where: { OR: [{ scope: 'GLOBAL' }, { projectId }] },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { id: true, name: true, content: true },
      });
      library = rows.filter((r) => (r.content ?? '').trim()).map(libraryTemplateToHld);
    } catch (err) {
      this.logger.warn(`listTemplates: library source unavailable: ${err instanceof Error ? err.message : err}`);
    }
    return [...BUILTIN_ARCH_TEMPLATES, ...library];
  }

  async listThread(hldId: string, sectionKey: string) {
    const thread = await this.prisma.baHldThread.findUnique({
      where: { hldId_sectionKey: { hldId, sectionKey } },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return thread?.messages ?? [];
  }

  async listInsights(hldId: string, sectionKey: string) {
    const thread = await this.prisma.baHldThread.findUnique({
      where: { hldId_sectionKey: { hldId, sectionKey } },
      include: {
        messages: { where: { savedToSection: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    return thread?.messages ?? [];
  }

  /** Flag (or unflag) a message as a saved insight. */
  async setInsight(messageId: string, saved: boolean) {
    return this.prisma.baHldMessage.update({
      where: { id: messageId },
      data: { savedToSection: saved },
    });
  }

  /** Ask the copilot a question for one section; persists both turns. */
  async chat(
    hldId: string,
    sectionKey: string,
    opts: { provider?: string; message: string; template?: string | null },
  ) {
    const message = (opts.message ?? '').trim();
    if (!message) throw new BadRequestException('Message is required.');

    const hld = await this.prisma.baHld.findUnique({ where: { id: hldId } });
    if (!hld) throw new NotFoundException(`HLD ${hldId} not found`);

    const thread = await this.prisma.baHldThread.upsert({
      where: { hldId_sectionKey: { hldId, sectionKey } },
      create: { hldId, sectionKey },
      update: {},
    });

    const history = await this.prisma.baHldMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    // Persist the user turn before calling the model.
    const userMsg = await this.prisma.baHldMessage.create({
      data: { threadId: thread.id, role: 'user', content: message, templateRef: opts.template ?? null },
    });

    const { prdContext, stack } = await this.buildContext(hld.projectId, hld.sections as Record<string, unknown>);
    const sectionContent = this.sectionText((hld.sections as Record<string, unknown>)[sectionKey]);

    let markdown: string;
    let model: string;
    try {
      const { data } = await axios.post<{ markdown: string; model: string }>(
        `${this.aiServiceUrl}/hld-chat`,
        {
          provider: opts.provider ?? 'anthropic',
          section_name: HLD_SECTION_NAMES[sectionKey] ?? sectionKey,
          section_content: sectionContent,
          prd_context: prdContext,
          stack,
          template: opts.template ?? null,
          history,
          user_message: message,
        },
        { timeout: 180_000 },
      );
      markdown = data.markdown;
      model = data.model;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`HLD chat failed: ${detail}`);
      throw new BadRequestException(`Copilot chat failed: ${detail}`);
    }

    const assistantMsg = await this.prisma.baHldMessage.create({
      data: { threadId: thread.id, role: 'assistant', content: markdown, model },
    });

    return { userMessage: userMsg, assistantMessage: assistantMsg };
  }

  /** Synthesize current section + saved insights into a Markdown draft (no write). */
  async merge(hldId: string, sectionKey: string, provider?: string): Promise<{ draft: string; model: string }> {
    const hld = await this.prisma.baHld.findUnique({ where: { id: hldId } });
    if (!hld) throw new NotFoundException(`HLD ${hldId} not found`);

    const insights = await this.listInsights(hldId, sectionKey);
    if (!insights.length) {
      throw new BadRequestException('No saved insights to synthesize. Save at least one AI answer first.');
    }
    const sectionContent = this.sectionText((hld.sections as Record<string, unknown>)[sectionKey]);

    try {
      const { data } = await axios.post<{ merged_markdown: string; model: string }>(
        `${this.aiServiceUrl}/hld-merge`,
        {
          provider: provider ?? 'anthropic',
          section_name: HLD_SECTION_NAMES[sectionKey] ?? sectionKey,
          section_content: sectionContent,
          insights: insights.map((m) => m.content),
        },
        { timeout: 180_000 },
      );
      return { draft: data.merged_markdown, model: data.model };
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`HLD merge failed: ${detail}`);
      throw new BadRequestException(`Copilot synthesize failed: ${detail}`);
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Render a section value as readable text for the model context. */
  private sectionText(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  /** Build a compact PRD/FRD context + tech stack string for grounding. */
  private async buildContext(
    projectId: string,
    hldSections: Record<string, unknown>,
  ): Promise<{ prdContext: string; stack: string }> {
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });

    let prdContext = '';
    if (prd?.sections) {
      const s = prd.sections as Record<string, unknown>;
      // A few high-signal PRD sections: 1 overview, 2 scope, 5 actors, 6 FRD, 10 NFR, 11 technology.
      const picks: [string, string][] = [
        ['1', 'Overview'],
        ['2', 'Scope'],
        ['5', 'Actors'],
        ['6', 'Functional Requirements (FRD)'],
        ['10', 'Non-Functional Requirements'],
        ['11', 'Technology'],
      ];
      const parts: string[] = [];
      for (const [key, label] of picks) {
        if (s[key]) parts.push(`## ${label}\n${this.sectionText(s[key])}`);
      }
      prdContext = parts.join('\n\n').slice(0, 6000);
    }

    // Prefer the HLD's own technology stack section; fall back to PRD §11.
    const stackSource = hldSections['technologyStack'] ?? (prd?.sections as Record<string, unknown> | undefined)?.['11'];
    const stack = this.sectionText(stackSource).slice(0, 2000);

    return { prdContext, stack };
  }
}
