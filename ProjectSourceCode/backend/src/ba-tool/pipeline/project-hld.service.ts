import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { flattenSections, flattenValue } from './section-normalizer';

/** The 17 HLD section keys → human names (must match the AI prompt + frontend). */
export const HLD_SECTION_NAMES: Record<string, string> = {
  documentControl: 'Document Control',
  executiveSummary: 'Executive Summary',
  systemView: '50,000-ft System View',
  technicalLayersView: 'Layered Technical View',
  componentView: 'Detailed Component View',
  architectureStyleView: 'Architecture Style & Patterns View',
  deploymentView: 'Deployment View',
  architectureStyleDecision: 'Architecture Style Decision',
  technologyStack: 'Technology Stack',
  designPatterns: 'Design Patterns Catalogue',
  authDesign: 'Auth & Security Design',
  aiLayer: 'AI Layer Architecture',
  integrations: 'Integration Architecture',
  multiTenancy: 'Multi-Tenancy & Data Isolation',
  nfr: 'Non-Functional Requirements',
  prdCoverage: 'PRD → HLD Coverage Checklist',
  projectStructure: 'Project Structure',
};

export const HLD_SECTION_ORDER = Object.keys(HLD_SECTION_NAMES);

interface AiHldResponse {
  sections: Record<string, unknown>;
  mermaid_diagrams: Record<string, string>;
  gaps: Array<{ section: number; question: string }>;
}

/**
 * High-Level Design generation (Track E). Pulls the latest PRD+FRD (+ wireframe
 * screen context), calls the AI `/hld-generate` endpoint, persists a versioned
 * `BaHld` (17 sections + Mermaid diagrams), and mirrors a Markdown export to
 * `ProjectArtifacts/05-HLD/`.
 */
@Injectable()
export class HldService {
  private readonly logger = new Logger(HldService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly projectFolders: ProjectFolderService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  async list(projectId: string) {
    return this.prisma.baHld.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  /**
   * v9 KK — deterministically derive a monorepo "project structure" from the
   * project's modules (or §6 FR-ID prefixes), grouped by layer. Rendered as the
   * pastel structure grid under HLD §17. Structure is deterministic (not LLM) so
   * it's accurate + instant; layer keys map to the design system's diagramPalette.
   */
  async buildProjectStructure(projectId: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true, productName: true, modules: { select: { moduleName: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    let modules = project.modules.map((m) => m.moduleName).filter(Boolean);
    if (!modules.length) {
      const map = await this.prisma.baScreenMap.findFirst({
        where: { projectId }, orderBy: { version: 'desc' }, include: { rows: { select: { featureRefs: true } } },
      });
      const prefixes = new Set<string>();
      for (const r of map?.rows ?? []) for (const fr of r.featureRefs) {
        const m = /^FR-([A-Za-z0-9]+)-/.exec(fr);
        if (m) prefixes.add(tc(m[1]));
      }
      modules = [...prefixes];
    }
    if (!modules.length) modules = ['Core'];
    const top = modules.slice(0, 10);
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mod';
    const table = (s: string) => `${slug(s).replace(/-/g, '_')}s`;

    const groups = [
      {
        key: 'frontend', title: 'apps/frontend/ (Next.js)', layer: 'frontend',
        items: [
          { name: 'app/', note: 'routes' }, { name: 'components/' }, { name: 'hooks/' },
          { name: 'services/' }, { name: 'types/' },
          ...top.map((m) => ({ name: `app/${slug(m)}/`, note: 'route' })),
        ],
      },
      {
        key: 'backend', title: 'apps/backend/ (NestJS)', layer: 'backend',
        items: [
          { name: 'modules/', note: 'controller + service + model + dto' },
          ...top.map((m) => ({ name: `modules/${slug(m)}/` })),
          { name: 'database/' }, { name: 'migrations/' }, { name: 'common/' }, { name: 'config/' },
        ],
      },
      {
        key: 'db', title: 'database tables (PostgreSQL)', layer: 'db',
        items: [...top.map((m) => ({ name: table(m) })), { name: 'users' }, { name: 'audit_log' }],
      },
      {
        key: 'shared', title: 'packages/ (shared)', layer: 'shared',
        items: [{ name: 'shared-types/' }, { name: 'shared-utils/' }, { name: 'ui-components/' }, { name: 'eslint-config/' }, { name: 'tsconfig/' }],
      },
      {
        key: 'config', title: 'root config files', layer: 'config',
        items: [{ name: 'package.json' }, { name: 'turbo.json' }, { name: 'docker-compose.yml' }, { name: '.env.example' }, { name: 'README.md' }],
      },
    ];
    return { productName: project.productName ?? project.name, groups };
  }

  async getLatest(projectId: string) {
    return this.prisma.baHld.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
  }

  async get(hldId: string) {
    const hld = await this.prisma.baHld.findUnique({ where: { id: hldId } });
    if (!hld) throw new NotFoundException(`HLD ${hldId} not found`);
    return hld;
  }

  /** HE-05 — gather the data needed to render an HLD export (PDF/DOCX/Preview). */
  async getExport(hldId: string) {
    const hld = await this.get(hldId);
    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    return {
      productName: project?.productName ?? project?.name ?? 'Project',
      version: hld.version,
      status: hld.status,
      createdAt: hld.createdAt,
      sections: (hld.sections ?? {}) as Record<string, unknown>,
      mermaidDiagrams: (hld.mermaidDiagrams ?? {}) as Record<string, string>,
    };
  }

  /** HE-05 — canonical Markdown for the latest HLD (in-browser download, mirrors PRD). */
  async getMarkdown(projectId: string): Promise<{ version: number; markdown: string } | null> {
    const latest = await this.getLatest(projectId);
    if (!latest) return null;
    return {
      version: latest.version,
      markdown: this.renderMarkdown(
        latest.version,
        (latest.sections ?? {}) as Record<string, unknown>,
        (latest.mermaidDiagrams ?? {}) as Record<string, string>,
      ),
    };
  }

  /** Generate a new HLD version from the project's latest PRD+FRD. */
  async generate(projectId: string): Promise<{ id: string; gaps: AiHldResponse['gaps'] }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true, productName: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, sections: true },
    });
    if (!prd) {
      throw new BadRequestException('No PRD+FRD found. Generate the PRD first (Stage 2).');
    }

    const wireframeContext = await this.buildWireframeContext(projectId);

    let ai: AiHldResponse;
    try {
      const { data } = await axios.post<AiHldResponse>(
        `${this.aiServiceUrl}/hld-generate`,
        {
          project_id: projectId,
          prd_sections: flattenSections(prd.sections as Record<string, unknown>),
          wireframe_context: wireframeContext,
          product_name: project.productName ?? project.name,
        },
        { timeout: 300_000 },
      );
      ai = data;
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`AI HLD generation failed: ${msg}`);
      throw new BadRequestException(`AI HLD generation failed: ${msg}`);
    }

    const latest = await this.getLatest(projectId);
    const record = await this.prisma.baHld.create({
      data: {
        projectId,
        version: latest ? latest.version + 1 : 1,
        status: 'DRAFT',
        sections: ai.sections as Prisma.InputJsonValue,
        mermaidDiagrams: (ai.mermaid_diagrams ?? {}) as Prisma.InputJsonValue,
        sourceArtifactVersions: { prdVersion: prd.version } as Prisma.InputJsonValue,
        triggeredBy: latest ? 'MANUAL_EDIT' : 'INITIAL_GENERATION',
      },
    });

    await this.exportMarkdown(project.name, record.version, ai.sections, ai.mermaid_diagrams).catch(
      (e) => this.logger.warn(`HLD markdown export failed: ${e instanceof Error ? e.message : e}`),
    );

    this.logger.log(`Generated HLD v${record.version} for ${project.name}`);
    return { id: record.id, gaps: ai.gaps ?? [] };
  }

  async updateSection(hldId: string, sectionKey: string, content: unknown) {
    const hld = await this.get(hldId);
    const sections = { ...(hld.sections as Record<string, unknown>) };
    sections[sectionKey] = content;
    return this.prisma.baHld.update({
      where: { id: hldId },
      data: { sections: sections as Prisma.InputJsonValue },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Build a compact screen-context string from the latest wireframe set. */
  private async buildWireframeContext(projectId: string): Promise<string> {
    // Prefer the PRD-sourced (PIPELINE) wireframe set so the HLD is grounded in the
    // screen↔feature mapping; fall back to any latest set (e.g. Discovery) otherwise.
    const screensSelect = {
      orderBy: { sequenceNum: 'asc' as const },
      select: { title: true, slug: true, pattern: true, meta: true },
    };
    const set =
      (await this.prisma.baWireframeSet.findFirst({
        where: { projectId, source: 'PIPELINE' },
        orderBy: { createdAt: 'desc' },
        include: { screens: screensSelect },
      })) ??
      (await this.prisma.baWireframeSet.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        include: { screens: screensSelect },
      }));
    if (!set || !set.screens.length) return '';
    return set.screens
      .map((s) => {
        const frRefs = (s.meta as { frRefs?: string[] } | null)?.frRefs ?? [];
        const refs = frRefs.length ? ` · FRs: ${frRefs.join(', ')}` : '';
        return `- ${s.title} (${s.slug})${s.pattern ? ` · pattern: ${s.pattern}` : ''}${refs}`;
      })
      .join('\n');
  }

  /** Render the 17-section HLD + Mermaid diagrams to canonical Markdown. */
  private renderMarkdown(
    version: number,
    sections: Record<string, unknown>,
    diagrams: Record<string, string>,
  ): string {
    const lines: string[] = [`# High-Level Design (HLD)`, ``, `_Version ${version}_`, ``];
    HLD_SECTION_ORDER.forEach((key, i) => {
      lines.push(`## ${i + 1}. ${HLD_SECTION_NAMES[key]}`, ``);
      const body = sections[key];
      if (body == null) {
        lines.push('_Not generated._', '');
        return;
      }
      lines.push('```json', JSON.stringify(flattenValue(body), null, 2), '```', '');
    });
    if (diagrams && Object.keys(diagrams).length) {
      lines.push(`## Architecture Diagrams (Mermaid)`, ``);
      for (const [name, src] of Object.entries(diagrams)) {
        lines.push(`### ${name}`, ``, '```mermaid', src, '```', '');
      }
    }
    return lines.join('\n');
  }

  /** Render the 17-section HLD + Mermaid diagrams to Markdown and write to 05-HLD/. */
  private async exportMarkdown(
    projectName: string,
    version: number,
    sections: Record<string, unknown>,
    diagrams: Record<string, string>,
  ): Promise<void> {
    await this.projectFolders.writeArtifactFile(
      projectName,
      '05-HLD',
      `HLD-v${version}.md`,
      this.renderMarkdown(version, sections, diagrams),
    );
    await this.projectFolders.appendChangelog(projectName, {
      summary: `Generated HLD v${version}`,
      affectedArtifacts: [`05-HLD/HLD-v${version}.md`],
      source: 'HLD generation',
      timestamp: new Date().toISOString(),
    });
  }
}
