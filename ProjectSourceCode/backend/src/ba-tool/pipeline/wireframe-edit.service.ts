import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { WireframeNavigatorService } from './wireframe-navigator.service';
import { WireframeContextService, type WfScreen } from './wireframe-context.service';

export interface ScreenEditResult {
  slug: string;
  kind: 'LOFI' | 'HIFI';
  before: string;
  after: string;
  parityOk: boolean;
  rationale: string;
}

/**
 * v12 · Track WC-06 — AI edit engine for a single screen. Writes a NON-DESTRUCTIVE
 * `edited` variant into the screen's meta (`editedHtml` + `editBaseHtml`) so the
 * original is never lost. Accept promotes the edit to the live HTML; Revert drops it.
 * Numbered callouts are preserved (parity guard).
 */
@Injectable()
export class WireframeEditService {
  private readonly logger = new Logger(WireframeEditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly navigator: WireframeNavigatorService,
    private readonly context: WireframeContextService,
  ) {}

  private async findScreen(projectId: string, slug: string, kind: 'LOFI' | 'HIFI'): Promise<WfScreen> {
    const screen = (await this.context.screensFor(projectId, kind)).find((s) => s.slug === slug);
    if (!screen) throw new NotFoundException(`${kind} screen "${slug}" not found`);
    return screen;
  }

  /** Apply an NL change to one screen → store edited variant; return before/after. */
  async editScreen(
    projectId: string,
    slug: string,
    kind: 'LOFI' | 'HIFI',
    changeRequest: string,
    refSlugs: string[],
  ): Promise<ScreenEditResult> {
    const screen = await this.findScreen(projectId, slug, kind);
    // WC-19 — only HTML screens are AI-editable. Uploaded image/PDF screens (data-URI
    // wrappers) are tracked but not edited; surface a clear, non-destructive error.
    if (!screen.html || !screen.html.includes('<')) {
      throw new BadRequestException(`Screen "${slug}" is not HTML-editable (image/PDF upload) — change tracked, apply manually.`);
    }
    const tokens = await this.context.tokens(projectId);
    const referenceScreens = await this.context.referenceScreens(projectId, refSlugs ?? [], kind);

    const res = await this.ai.wireframeEditScreen({
      htmlContent: screen.html,
      changeRequest,
      designTokens: tokens,
      referenceScreens,
      callouts: screen.callouts,
      fidelity: kind === 'HIFI' ? 'hifi' : 'lofi',
    });

    const parityOk = res.calloutsPreserved !== false && this.calloutsPreserved(screen.callouts, res.editedHtml);
    await this.writeMeta(screen, { ...screen.meta, editedHtml: res.editedHtml, editBaseHtml: screen.html });
    this.logger.log(`Edited ${kind} ${slug} (parityOk=${parityOk})`);
    return { slug, kind, before: screen.html, after: res.editedHtml, parityOk, rationale: res.rationale ?? '' };
  }

  /** Promote the edited variant to the live HTML (drives navigator/export). */
  async accept(projectId: string, slug: string, kind: 'LOFI' | 'HIFI'): Promise<void> {
    const screen = await this.findScreen(projectId, slug, kind);
    const edited = screen.meta.editedHtml;
    if (typeof edited !== 'string' || !edited) return;
    const meta = { ...screen.meta };
    delete meta.editedHtml;
    delete meta.editBaseHtml;
    if (kind === 'LOFI') meta.activeVariant = 'deterministic';
    await this.writeHtmlAndMeta(screen, edited, meta);
    await this.navigator.writeToDisk(projectId, kind === 'HIFI' ? 'hifi' : 'lofi').catch(() => undefined);
  }

  /** Drop the edited variant — the original HTML is untouched. */
  async revert(projectId: string, slug: string, kind: 'LOFI' | 'HIFI'): Promise<void> {
    const screen = await this.findScreen(projectId, slug, kind);
    const meta = { ...screen.meta };
    delete meta.editedHtml;
    delete meta.editBaseHtml;
    await this.writeMeta(screen, meta);
    await this.navigator.writeToDisk(projectId, kind === 'HIFI' ? 'hifi' : 'lofi').catch(() => undefined);
  }

  /** Every base callout number must still appear in the edited HTML. */
  private calloutsPreserved(callouts: unknown[], html: string): boolean {
    const nums = (callouts as Array<{ n?: unknown }>).map((c) => String(c?.n ?? '')).filter(Boolean);
    return nums.every((n) => html.includes(n));
  }

  private async writeMeta(screen: WfScreen, meta: Record<string, unknown>): Promise<void> {
    const data = { meta: meta as unknown as Prisma.InputJsonValue };
    if (screen.kind === 'HIFI') await this.prisma.baHifiScreen.update({ where: { id: screen.id }, data });
    else await this.prisma.baWireframeScreen.update({ where: { id: screen.id }, data });
  }

  private async writeHtmlAndMeta(screen: WfScreen, html: string, meta: Record<string, unknown>): Promise<void> {
    const data = { htmlContent: html, meta: meta as unknown as Prisma.InputJsonValue };
    if (screen.kind === 'HIFI') await this.prisma.baHifiScreen.update({ where: { id: screen.id }, data });
    else await this.prisma.baWireframeScreen.update({ where: { id: screen.id }, data });
  }
}
