import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { WireframeExportService } from './wireframe-export.service';
import { HifiService } from '../discovery/hifi.service';
import type { ScreenAnnotation } from './screen-map.service';
import { DesignSystemService } from './design-system.service';
import { WireframeNavigatorService } from './wireframe-navigator.service';
import { type DesignTokens } from './design-tokens';
import { renderLoFi } from './lofi-render';
import { AiService } from '../../ai/ai.service';

/**
 * Pipeline (PRD-sourced) wireframes (Sprint v8 · Track Z). Generates lo-fi screens
 * deterministically from the screen map (callouts = PRD-referenced annotations),
 * reuses the Discovery HifiService for hi-fi, and ingests single/bulk uploaded
 * 3rd-party wireframes. All sets carry `source = PIPELINE`; uploaded screens
 * (`meta.uploaded`) are preserved across regeneration. Discovery wireframes
 * (`source = DISCOVERY`) are untouched.
 */

const DEFAULT_BRAND = { primary: '#0B1B2E', surface: '#FFFFFF', cta: '#F97316', productName: '—' };
const UPLOAD_MIME: Record<string, string> = {
  html: 'text/html', htm: 'text/html', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf',
};

interface UploadFile { originalname: string; buffer: Buffer; mimetype?: string }

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

@Injectable()
export class PipelineWireframeService {
  private readonly logger = new Logger(PipelineWireframeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
    private readonly wireframeExport: WireframeExportService,
    @Inject(forwardRef(() => HifiService)) private readonly hifiService: HifiService,
    private readonly designSystem: DesignSystemService,
    private readonly navigator: WireframeNavigatorService,
    private readonly aiService: AiService,
  ) {}

  /** Z-02 — deterministic lo-fi from the latest screen map (callouts = annotations). */
  async generateLoFi(projectId: string): Promise<{ id: string; screens: number; preservedUploads: number }> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const map = await this.prisma.baScreenMap.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: { rows: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!map || !map.rows.length) {
      throw new BadRequestException('No screen map found. Generate the screen map first (Step 1).');
    }
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId }, orderBy: { version: 'desc' }, select: { version: true },
    });

    // v9 — apply the project's Design System tokens (falls back to defaults).
    const tokens = await this.designSystem.resolveTokens(projectId);
    const ds = await this.designSystem.getActive(projectId);

    // Preserve uploaded lo-fi screens from the latest PIPELINE set (merge, not overwrite).
    const prevSet = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
      include: { screens: true },
    });
    const uploaded = (prevSet?.screens ?? []).filter(
      (s) => (s.meta as { uploaded?: boolean } | null)?.uploaded,
    );

    let seq = 0;
    const generated = map.rows.map((r) => {
      seq += 1;
      const annotations = (r.annotations as unknown as ScreenAnnotation[]) ?? [];
      return {
        sequenceNum: seq,
        slug: r.screenId.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: r.screenName,
        pattern: null as string | null,
        callouts: annotations.map((a) => ({
          n: a.marker, description: `${a.title} — ${a.description}`, mappedTo: a.prdRef,
        })) as unknown as Prisma.InputJsonValue,
        mdContent: null as string | null,
        htmlContent: renderLoFi(r.screenName, r.screenDescription, annotations, tokens),
        meta: { frRefs: r.featureRefs, generatedFromScreenMap: true } as unknown as Prisma.InputJsonValue,
      };
    });
    const preserved = uploaded.map((u, i) => ({
      sequenceNum: seq + i + 1,
      slug: u.slug, title: u.title, pattern: u.pattern,
      callouts: u.callouts as Prisma.InputJsonValue,
      mdContent: u.mdContent, htmlContent: u.htmlContent,
      meta: u.meta as Prisma.InputJsonValue,
    }));

    const set = await this.prisma.baWireframeSet.create({
      data: {
        projectId,
        source: 'PIPELINE',
        screenMapId: map.id,
        designSystemId: ds?.id ?? null,
        approachNoteVersionId: null,
        sourceArtifactVersions: {
          prdVersion: prd?.version,
          screenMapVersion: map.version,
          designSystemVersion: ds?.version,
        } as Prisma.InputJsonValue,
        // Legacy keys (primary/surface/cta/productName) keep HifiService working;
        // the full design tokens ride along for richer downstream use.
        brandTokensSnapshot: {
          primary: tokens.brand.primary,
          surface: tokens.brand.surface,
          cta: tokens.brand.cta,
          productName: tokens.brand.productName !== '—' ? tokens.brand.productName : project.name,
          designTokens: tokens,
        } as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        screens: { create: [...generated, ...preserved] },
      },
      include: { screens: true },
    });

    await this.wireframeExport
      .exportLoFi(projectId, set.screens.map((s) => ({ sequenceNum: s.sequenceNum, slug: s.slug, title: s.title, htmlContent: s.htmlContent ?? '' })))
      .catch((e) => this.logger.warn(`lo-fi export failed: ${e instanceof Error ? e.message : e}`));

    // v9 — (re)build the stitched index.html navigator for the lo-fi set.
    await this.navigator.writeToDisk(projectId, 'lofi').catch((e) => this.logger.warn(`navigator (lofi) failed: ${e}`));

    this.logger.log(`Generated PIPELINE lo-fi for ${project.name}: ${generated.length} from map + ${preserved.length} preserved uploads`);
    return { id: set.id, screens: generated.length, preservedUploads: preserved.length };
  }

  /**
   * Z-02 — hi-fi from the latest PIPELINE lo-fi set (reuses the Discovery HifiService).
   * `limit` enables sample mode (only the first N screens — e.g. one batch).
   */
  async generateHiFi(
    projectId: string,
    opts: { limit?: number; slugs?: string[] } = {},
  ): Promise<{ id: string; screens: number }> {
    const set = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!set) throw new BadRequestException('No pipeline lo-fi wireframes yet. Generate lo-fi first.');
    const hifi = await this.hifiService.generate({ projectId, wireframeSetId: set.id, limit: opts.limit, slugs: opts.slugs });
    // v9 — (re)build the stitched index.html navigator for the hi-fi set.
    await this.navigator.writeToDisk(projectId, 'hifi').catch((e) => this.logger.warn(`navigator (hifi) failed: ${e}`));
    return { id: hifi.id, screens: hifi.screens.length };
  }

  /**
   * GG-03 — AI-regenerate lo-fi (grey-box, Claude) for selected screen slugs (or
   * all map-generated screens if none). Updates `htmlContent` in place on the
   * latest PIPELINE lo-fi set; uploaded screens are never touched. Per-screen,
   * bounded concurrency, tolerant of per-screen failure.
   */
  async regenerateLoFiWithAI(projectId: string, slugs?: string[]): Promise<{ updated: number; failed: string[] }> {
    const set = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!set) throw new BadRequestException('No pipeline lo-fi wireframes yet. Generate lo-fi first.');

    const targets = set.screens.filter((s) => {
      const meta = (s.meta as { uploaded?: boolean } | null) ?? {};
      if (meta.uploaded) return false; // never overwrite uploaded screens
      return slugs?.length ? slugs.includes(s.slug) : true;
    });
    if (!targets.length) throw new BadRequestException('No matching generated lo-fi screens to regenerate.');

    const brand = (set.brandTokensSnapshot as Record<string, unknown> | null) ?? {};
    const brandTokens = {
      primary: String(brand.primary ?? '#0B1B2E'),
      surface: String(brand.surface ?? '#FFFFFF'),
      cta: String(brand.cta ?? '#F97316'),
      productName: String(brand.productName ?? '—'),
    };

    const failed: string[] = [];
    let updated = 0;
    const concurrency = Math.max(1, Number(process.env.HIFI_BATCH_CONCURRENCY) || 2);
    let next = 0;
    const worker = async (): Promise<void> => {
      for (let i = next++; i < targets.length; i = next++) {
        const s = targets[i];
        try {
          const ai = await this.aiService.generateHifi({
            lofiScreens: [{
              sequenceNum: s.sequenceNum, slug: s.slug, title: s.title, pattern: s.pattern ?? null,
              callouts: (s.callouts as unknown as { n: number | string; description: string; mappedTo: string }[]) ?? [],
              mdContent: s.mdContent ?? null,
            }],
            brandTokens,
            productName: brandTokens.productName,
            fidelity: 'lofi',
          });
          const html = ai.screens?.[0]?.htmlContent;
          if (!html) { failed.push(s.slug); continue; }
          await this.prisma.baWireframeScreen.update({
            where: { id: s.id },
            data: { htmlContent: html, meta: { ...(s.meta as object), aiLoFi: true } as unknown as Prisma.InputJsonValue },
          });
          updated += 1;
        } catch (e) {
          this.logger.warn(`AI lo-fi failed for ${s.slug}: ${e instanceof Error ? e.message : e}`);
          failed.push(s.slug);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));

    // Navigator rewrites index.html + each screen file fresh from the DB.
    await this.navigator.writeToDisk(projectId, 'lofi').catch((e) => this.logger.warn(`navigator (lofi) failed: ${e}`));
    this.logger.log(`AI lo-fi regenerated ${updated}/${targets.length} screens (project=${projectId})`);
    return { updated, failed };
  }

  /** Z-03 — ingest single/bulk uploaded wireframes (HTML/PNG/JPG/PDF/SVG) into a PIPELINE set. */
  async upload(projectId: string, files: UploadFile[], kind: 'lofi' | 'hifi'): Promise<{ added: number; rejected: string[] }> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!files?.length) throw new BadRequestException('No files uploaded.');

    const rejected: string[] = [];
    const accepted = files.filter((f) => {
      const ext = (f.originalname.split('.').pop() ?? '').toLowerCase();
      if (!UPLOAD_MIME[ext]) {
        rejected.push(`${f.originalname} (unsupported${ext === 'fig' ? ' — export from Figma as PDF/SVG/PNG first' : ''})`);
        return false;
      }
      return true;
    });
    if (!accepted.length) throw new BadRequestException(`No supported files. Rejected: ${rejected.join('; ')}`);

    if (kind === 'lofi') {
      const set = await this.ensurePipelineLoFiSet(projectId, project.name);
      const start = await this.prisma.baWireframeScreen.count({ where: { setId: set.id } });
      await this.prisma.baWireframeScreen.createMany({
        data: accepted.map((f, i) => ({
          setId: set.id, sequenceNum: start + i + 1,
          slug: this.slug(f.originalname), title: f.originalname,
          callouts: [] as unknown as Prisma.InputJsonValue,
          htmlContent: this.fileToHtml(f),
          meta: { uploaded: true, originalName: f.originalname } as unknown as Prisma.InputJsonValue,
        })),
      });
      await this.mirrorUploads(project.name, '03-Wireframes-LoFi', accepted);
      return { added: accepted.length, rejected };
    }

    // hi-fi upload needs a parent lo-fi PIPELINE set
    const lofi = await this.ensurePipelineLoFiSet(projectId, project.name);
    const hset = await this.prisma.baHifiSet.create({
      data: { projectId, wireframeSetId: lofi.id, brandTokensSnapshot: { ...DEFAULT_BRAND, productName: project.name } as Prisma.InputJsonValue, status: 'DRAFT' },
    });
    await this.prisma.baHifiScreen.createMany({
      data: accepted.map((f, i) => ({
        setId: hset.id, sequenceNum: i + 1, slug: this.slug(f.originalname), title: f.originalname,
        htmlContent: this.fileToHtml(f), callouts: [] as unknown as Prisma.InputJsonValue,
        meta: { uploaded: true, originalName: f.originalname } as unknown as Prisma.InputJsonValue,
      })),
    });
    await this.mirrorUploads(project.name, '04-Wireframes-HiFi', accepted);
    return { added: accepted.length, rejected };
  }

  /** List the PIPELINE lo-fi + hi-fi screens for the gallery. */
  async listScreens(projectId: string) {
    const lofiSet = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
      include: { screens: { orderBy: { sequenceNum: 'asc' } } },
    });
    const hifiSet = lofiSet
      ? await this.prisma.baHifiSet.findFirst({
          where: { projectId, wireframeSetId: lofiSet.id },
          orderBy: { createdAt: 'desc' },
          include: { screens: { orderBy: { sequenceNum: 'asc' } } },
        })
      : null;
    return {
      lofi: (lofiSet?.screens ?? []).map((s) => ({
        id: s.id, slug: s.slug, title: s.title, htmlContent: s.htmlContent,
        uploaded: !!(s.meta as { uploaded?: boolean } | null)?.uploaded,
      })),
      hifi: (hifiSet?.screens ?? []).map((s) => ({
        id: s.id, slug: s.slug, title: s.title, htmlContent: s.htmlContent,
        uploaded: !!(s.meta as { uploaded?: boolean } | null)?.uploaded,
      })),
    };
  }

  /** Reflect wireframes the customer uploaded in the Inputs section. */
  async customerWireframes(projectId: string) {
    const inputs = await this.prisma.baCustomerInput.findMany({
      where: { projectId, inputType: 'CUSTOMER_WIREFRAME' },
      select: { id: true, label: true, fileMetadata: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return inputs.map((i) => ({
      id: i.id, label: i.label,
      fileName: (i.fileMetadata as { fileName?: string } | null)?.fileName ?? null,
      createdAt: i.createdAt,
    }));
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async ensurePipelineLoFiSet(projectId: string, projectName: string) {
    const existing = await this.prisma.baWireframeSet.findFirst({
      where: { projectId, source: 'PIPELINE' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.baWireframeSet.create({
      data: {
        projectId, source: 'PIPELINE', approachNoteVersionId: null,
        brandTokensSnapshot: { ...DEFAULT_BRAND, productName: projectName } as Prisma.InputJsonValue,
        status: 'DRAFT',
      },
    });
  }

  private async mirrorUploads(projectName: string, sub: '03-Wireframes-LoFi' | '04-Wireframes-HiFi', files: UploadFile[]) {
    for (const f of files) {
      await this.projectFolders
        .writeArtifactFile(projectName, sub, `uploaded-${this.slug(f.originalname)}.${(f.originalname.split('.').pop() ?? 'bin')}`, f.buffer)
        .catch(() => undefined);
    }
    await this.projectFolders.appendChangelog(projectName, {
      summary: `Uploaded ${files.length} wireframe file(s) to ${sub}`,
      affectedArtifacts: files.map((f) => f.originalname),
      source: 'wireframe upload', timestamp: new Date().toISOString(),
    }).catch(() => undefined);
  }

  private fileToHtml(f: UploadFile): string {
    const ext = (f.originalname.split('.').pop() ?? '').toLowerCase();
    const mime = UPLOAD_MIME[ext] ?? 'application/octet-stream';
    if (ext === 'html' || ext === 'htm') return f.buffer.toString('utf-8');
    const b64 = f.buffer.toString('base64');
    if (ext === 'pdf') return `<embed src="data:${mime};base64,${b64}" type="application/pdf" style="width:100%;height:100vh">`;
    return `<div style="margin:0;display:flex;justify-content:center"><img alt="${esc(f.originalname)}" src="data:${mime};base64,${b64}" style="max-width:100%;height:auto"></div>`;
  }

  private slug(name: string): string {
    return name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screen';
  }

}
