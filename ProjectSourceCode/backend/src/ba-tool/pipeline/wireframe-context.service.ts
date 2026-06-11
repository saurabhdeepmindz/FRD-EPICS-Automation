import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DesignSystemService } from './design-system.service';

/** A resolved wireframe screen with its currently-active HTML. */
export interface WfScreen {
  id: string;
  setId: string;
  kind: 'LOFI' | 'HIFI';
  slug: string;
  title: string;
  module: string | null;
  callouts: unknown[];
  html: string; // the active variant's HTML
  meta: Record<string, unknown>;
}

/**
 * v12 · Track WC — shared read helpers for the Wireframe Copilot: resolves the
 * latest lo-fi/hi-fi screens (with the active variant's HTML), design tokens, and
 * reference screens. No mutations here.
 */
@Injectable()
export class WireframeContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly designSystem: DesignSystemService,
  ) {}

  /** Screens of the requested fidelity from the latest PIPELINE set (active HTML resolved). */
  async screensFor(projectId: string, kind: 'LOFI' | 'HIFI'): Promise<WfScreen[]> {
    const lofiSet = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!lofiSet) return [];

    if (kind === 'LOFI') {
      return lofiSet.screens.map((s) => {
        const meta = ((s.meta as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        const active =
          meta.activeVariant === 'ai' && typeof meta.aiHtml === 'string'
            ? (meta.aiHtml as string)
            : s.htmlContent ?? '';
        return {
          id: s.id, setId: s.setId, kind: 'LOFI' as const, slug: s.slug, title: s.title,
          module: (meta.module as string) ?? null, callouts: (s.callouts as unknown[]) ?? [],
          html: active, meta,
        };
      });
    }

    const hifiSet = await this.prisma.baHifiSet.findFirst({
      where: { projectId, wireframeSetId: lofiSet.id },
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    return (hifiSet?.screens ?? []).map((s) => {
      const meta = ((s.meta as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      return {
        id: s.id, setId: s.setId, kind: 'HIFI' as const, slug: s.slug, title: s.title,
        module: (meta.module as string) ?? null, callouts: (s.callouts as unknown[]) ?? [],
        html: s.htmlContent ?? '', meta,
      };
    });
  }

  /** Effective Design System tokens for the project (active system → defaults). */
  async tokens(projectId: string): Promise<Record<string, unknown>> {
    return (await this.designSystem.resolveTokens(projectId)) as unknown as Record<string, unknown>;
  }

  /** Up to 2 user-picked reference screens' HTML, as style exemplars. */
  async referenceScreens(
    projectId: string,
    slugs: string[],
    kind: 'LOFI' | 'HIFI',
  ): Promise<{ slug: string; html: string }[]> {
    if (!slugs?.length) return [];
    const all = await this.screensFor(projectId, kind);
    return slugs
      .slice(0, 2)
      .map((slug) => all.find((s) => s.slug === slug))
      .filter((s): s is WfScreen => !!s)
      .map((s) => ({ slug: s.slug, html: s.html }));
  }
}
