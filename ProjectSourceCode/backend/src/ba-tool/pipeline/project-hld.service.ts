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
  /**
   * Provider for the structured HLD view generators (§3–§7, §17). Defaults to
   * OpenAI; set HLD_AI_PROVIDER=anthropic in backend/.env to use Claude. Lets us
   * switch providers without a code change (e.g. when one account is out of
   * credits). See [[ai-engines-and-env]].
   */
  private readonly hldProvider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly projectFolders: ProjectFolderService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
    this.hldProvider = this.config.get<string>('HLD_AI_PROVIDER', 'openai');
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
      // 50k-ft band model (canonical §3 representation) for export rendering.
      systemView: ((hld.metadata ?? {}) as Record<string, unknown>).systemView ?? null,
      // Layered technical view (canonical §4 representation) for export rendering.
      technicalView: ((hld.metadata ?? {}) as Record<string, unknown>).technicalView ?? null,
      // Detailed component view (canonical §5 representation) for export rendering.
      componentView: ((hld.metadata ?? {}) as Record<string, unknown>).componentView ?? null,
      // Architecture style & patterns view (canonical §6 representation).
      styleView: ((hld.metadata ?? {}) as Record<string, unknown>).styleView ?? null,
      // AWS deployment view (canonical §7 representation).
      deploymentView: ((hld.metadata ?? {}) as Record<string, unknown>).deploymentView ?? null,
      // AWS flow diagrams (§7.5) — connected reference-architecture views.
      deploymentFlows: ((hld.metadata ?? {}) as Record<string, unknown>).deploymentFlows ?? null,
      // Project structure overview (canonical §17 representation).
      structureView: ((hld.metadata ?? {}) as Record<string, unknown>).structureView ?? null,
    };
  }

  /**
   * 50,000-ft System View (Sprint v11) — structured 6-band model derived from the
   * project's PRD/FRD/HLD via the AI service, cached on the HLD's metadata. Pass
   * force=true to regenerate.
   */
  async getSystemView(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.systemView) return meta.systemView as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.systemViewHldContext(hld.sections);

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-system-view`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`System view generation failed: ${detail}`);
      throw new BadRequestException(`System view generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, systemView: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /**
   * Layered Technical View (§4) — structured layered-band model derived from the
   * project's PRD/FRD/HLD via the AI service, cached on the HLD's metadata. Pass
   * force=true to regenerate. Reuses the System View context builders.
   */
  async getTechnicalView(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.technicalView) return meta.technicalView as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.technicalViewHldContext(hld.sections);

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-technical-view`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`Technical view generation failed: ${detail}`);
      throw new BadRequestException(`Technical view generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, technicalView: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /**
   * Detailed Component View (§5) — structured model derived from the project's
   * PRD/FRD/HLD via the AI service, cached on the HLD's metadata. Pass force=true
   * to regenerate. Reuses the §4 context (component/technical-leaning sections).
   */
  async getComponentView(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.componentView) return meta.componentView as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.technicalViewHldContext(hld.sections);

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-component-view`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`Component view generation failed: ${detail}`);
      throw new BadRequestException(`Component view generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, componentView: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /**
   * Architecture Style & Design Patterns View (§6) — structured model derived
   * from the project's PRD/FRD/HLD via the AI service, cached on the HLD's
   * metadata. Pass force=true to regenerate.
   */
  async getStyleView(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.styleView) return meta.styleView as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.styleViewHldContext(hld.sections);

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-style-view`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`Style view generation failed: ${detail}`);
      throw new BadRequestException(`Style view generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, styleView: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /**
   * AWS Deployment View (§7) — structured model derived from the project's
   * PRD/FRD/HLD via the AI service, cached on the HLD's metadata. One concrete
   * AWS instantiation of the cloud-agnostic architecture. Pass force=true to
   * regenerate.
   */
  async getDeploymentView(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.deploymentView) return meta.deploymentView as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.deploymentViewHldContext(hld.sections);

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-deployment-view`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`Deployment view generation failed: ${detail}`);
      throw new BadRequestException(`Deployment view generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, deploymentView: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /**
   * AWS Flow Diagrams (§7.5) — connected reference-architecture flow model derived
   * from the project's PRD/FRD/HLD (+ the cached §7 deployment view) via the AI
   * service, cached on the HLD's metadata. Pass force=true to regenerate.
   */
  async getDeploymentFlows(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.deploymentFlows) return meta.deploymentFlows as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.deploymentViewHldContext(hld.sections);
    // Reuse the §7 band model's chosen services so the flows stay consistent with it.
    const deploymentView = meta.deploymentView ? JSON.stringify(meta.deploymentView).slice(0, 5000) : '';

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-deployment-flows`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
          deployment_view: deploymentView,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`Deployment flows generation failed: ${detail}`);
      throw new BadRequestException(`Deployment flows generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, deploymentFlows: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /**
   * Project Structure (§17) overview — structured monorepo map derived from the
   * project's PRD/FRD/HLD via the AI service, cached on the HLD's metadata. Pass
   * force=true to regenerate.
   */
  async getProjectStructureView(hldId: string, force = false): Promise<Record<string, unknown>> {
    const hld = await this.get(hldId);
    const meta = (hld.metadata ?? {}) as Record<string, unknown>;
    if (!force && meta.structureView) return meta.structureView as Record<string, unknown>;

    const project = await this.prisma.baProject.findUnique({
      where: { id: hld.projectId },
      select: { name: true, productName: true },
    });
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId: hld.projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    const prdContext = this.systemViewPrdContext(prd?.sections);
    const hldContext = this.structureViewHldContext(hld.sections);

    let model: Record<string, unknown>;
    try {
      const { data } = await axios.post<Record<string, unknown>>(
        `${this.aiServiceUrl}/hld-project-structure`,
        {
          provider: this.hldProvider,
          product_name: project?.productName ?? project?.name ?? 'Project',
          prd_context: prdContext,
          hld_context: hldContext,
        },
        { timeout: 180_000 },
      );
      model = data;
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`Project structure generation failed: ${detail}`);
      throw new BadRequestException(`Project structure generation failed: ${detail}`);
    }

    await this.prisma.baHld.update({
      where: { id: hldId },
      data: { metadata: { ...meta, structureView: model } as Prisma.InputJsonValue },
    });
    return model;
  }

  /** HLD context tuned for the project structure overview (§17). */
  private structureViewHldContext(sections: unknown): string {
    const s = (sections ?? {}) as Record<string, unknown>;
    const picks = [
      'projectStructure', 'componentView', 'technologyStack', 'technicalLayersView',
      'integrations', 'aiLayer', 'multiTenancy', 'dataLayer',
    ];
    const parts: string[] = [];
    for (const k of picks) {
      if (s[k]) parts.push(`## ${HLD_SECTION_NAMES[k] ?? k}\n${JSON.stringify(flattenValue(s[k]))}`);
    }
    return parts.join('\n\n').slice(0, 5000);
  }

  /** HLD context tuned for the architecture style & patterns view (§6). */
  private styleViewHldContext(sections: unknown): string {
    const s = (sections ?? {}) as Record<string, unknown>;
    const picks = [
      'architectureStyleView', 'architectureStyleDecision', 'componentView', 'technicalLayersView',
      'designPatterns', 'technologyStack', 'authDesign', 'aiLayer', 'integrations', 'multiTenancy',
    ];
    const parts: string[] = [];
    for (const k of picks) {
      if (s[k]) parts.push(`## ${HLD_SECTION_NAMES[k]}\n${JSON.stringify(flattenValue(s[k]))}`);
    }
    return parts.join('\n\n').slice(0, 6000);
  }

  /** HLD context tuned for the AWS deployment view (§7). */
  private deploymentViewHldContext(sections: unknown): string {
    const s = (sections ?? {}) as Record<string, unknown>;
    const picks = [
      'deploymentView', 'technicalLayersView', 'componentView', 'technologyStack',
      'integrations', 'aiLayer', 'multiTenancy', 'authDesign', 'nfr', 'architectureStyleDecision',
    ];
    const parts: string[] = [];
    for (const k of picks) {
      if (s[k]) parts.push(`## ${HLD_SECTION_NAMES[k]}\n${JSON.stringify(flattenValue(s[k]))}`);
    }
    return parts.join('\n\n').slice(0, 7000);
  }

  /** HLD context tuned for the layered technical view (§4). */
  private technicalViewHldContext(sections: unknown): string {
    const s = (sections ?? {}) as Record<string, unknown>;
    const picks = [
      'technicalLayersView', 'componentView', 'technologyStack', 'architectureStyleDecision',
      'authDesign', 'aiLayer', 'integrations', 'deploymentView', 'multiTenancy',
    ];
    const parts: string[] = [];
    for (const k of picks) {
      if (s[k]) parts.push(`## ${HLD_SECTION_NAMES[k]}\n${JSON.stringify(flattenValue(s[k]))}`);
    }
    return parts.join('\n\n').slice(0, 6000);
  }

  private systemViewPrdContext(sections?: unknown): string {
    if (!sections) return '';
    const s = sections as Record<string, unknown>;
    const picks: [string, string][] = [
      ['5', 'Actors / User Types'],
      ['6', 'Functional Requirements (FRD)'],
      ['7', 'Integration Requirements'],
      ['13', 'UI/UX Requirements'],
      ['11', 'Technology'],
      ['3', 'Out of Scope'],
      ['20', 'High-Level Timelines'],
    ];
    const parts: string[] = [];
    for (const [k, label] of picks) {
      if (s[k]) parts.push(`## ${label}\n${JSON.stringify(flattenValue(s[k]))}`);
    }
    return parts.join('\n\n').slice(0, 9000);
  }

  private systemViewHldContext(sections: unknown): string {
    const s = (sections ?? {}) as Record<string, unknown>;
    const picks = ['systemView', 'integrations', 'aiLayer', 'multiTenancy', 'technologyStack', 'componentView'];
    const parts: string[] = [];
    for (const k of picks) {
      if (s[k]) parts.push(`## ${HLD_SECTION_NAMES[k]}\n${JSON.stringify(flattenValue(s[k]))}`);
    }
    return parts.join('\n\n').slice(0, 5000);
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
        ((latest.metadata ?? {}) as Record<string, unknown>).systemView,
        ((latest.metadata ?? {}) as Record<string, unknown>).technicalView,
        ((latest.metadata ?? {}) as Record<string, unknown>).componentView,
        ((latest.metadata ?? {}) as Record<string, unknown>).styleView,
        ((latest.metadata ?? {}) as Record<string, unknown>).structureView,
        ((latest.metadata ?? {}) as Record<string, unknown>).deploymentView,
        ((latest.metadata ?? {}) as Record<string, unknown>).deploymentFlows,
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

  /** Strip legacy free-text fields now superseded by a band model (§3/§4). */
  private withoutLegacyFields(body: unknown, legacyKeys: string[]): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const legacy = new Set(legacyKeys);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (!legacy.has(k)) out[k] = v;
    }
    return out;
  }

  /** Render the layered technical view (§4) band model as readable Markdown. */
  private technicalViewBandsMarkdown(model: Record<string, unknown>): string {
    const m = model as {
      layers?: { name?: string; applicable?: boolean; outOfScope?: string; nodes?: string[]; whatLivesHere?: string; keyTech?: string }[];
      gaps?: string[];
    };
    const layers = m.layers ?? [];
    const out: string[] = [];
    for (const l of layers.filter((x) => x.applicable !== false)) {
      out.push(`### ${l.name ?? ''}`);
      (l.nodes ?? []).forEach((n) => out.push(`- ${n}`));
      out.push('');
    }
    const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
    out.push('### The technical layers — what lives in each', '');
    out.push('| Layer | What lives here | Key technology / pattern |');
    out.push('| --- | --- | --- |');
    layers.forEach((l) => {
      const oos = l.applicable === false;
      const what = oos ? `Out of scope — ${l.outOfScope || 'not applicable to this project'}` : esc(l.whatLivesHere);
      const tech = oos ? '—' : esc(l.keyTech);
      out.push(`| ${esc(l.name)} | ${what} | ${tech} |`);
    });
    if (m.gaps?.length) {
      out.push('', '### Gaps & assumptions');
      m.gaps.forEach((g) => out.push(`- ${g}`));
    }
    return out.join('\n');
  }

  /** Render the detailed component view (§5) model as readable Markdown. */
  private componentViewBandsMarkdown(model: Record<string, unknown>): string {
    const m = model as {
      intro?: string;
      layers?: { name?: string; applicable?: boolean; pattern?: string; components?: { name?: string; subtext?: string }[] }[];
      services?: { name?: string; dominantConcern?: string; whereKeys?: string[] }[];
      reading?: string[];
      gaps?: string[];
    };
    const out: string[] = [];
    if (m.intro) out.push(`_${m.intro}_`, '');
    for (const l of (m.layers ?? []).filter((x) => x.applicable !== false)) {
      out.push(`### ${l.name ?? ''}${l.pattern && l.pattern !== '—' ? ` — _${l.pattern}_` : ''}`);
      (l.components ?? []).forEach((c) => out.push(`- ${c.name ?? ''}${c.subtext ? ` — ${c.subtext}` : ''}`));
      out.push('');
    }
    if (m.reading?.length) {
      out.push('### 5.1 — Reading the detailed view', '');
      m.reading.forEach((r) => out.push(`- ${r}`));
      out.push('');
    }
    if (m.services?.length) {
      const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
      const ref = (k: string) => {
        const n = HLD_SECTION_ORDER.indexOf(k) + 1;
        return n > 0 ? `§${n} ${HLD_SECTION_NAMES[k]}` : '';
      };
      out.push('### 5.2 — How modules show up in this view', '');
      out.push('| Service | Dominant concern | Where it lives |');
      out.push('| --- | --- | --- |');
      m.services.forEach((s) => {
        const where = (s.whereKeys ?? []).map(ref).filter(Boolean).join(' · ') || '—';
        out.push(`| ${esc(s.name)} | ${esc(s.dominantConcern)} | ${where} |`);
      });
    }
    if (m.gaps?.length) {
      out.push('', '### Gaps & assumptions');
      m.gaps.forEach((g) => out.push(`- ${g}`));
    }
    return out.join('\n');
  }

  /** Render the 50k-ft band model as readable Markdown (canonical §3 representation). */
  private systemViewBandsMarkdown(model: Record<string, unknown>): string {
    const m = model as {
      actors?: string[]; channels?: string[]; coreInfra?: string[];
      functionalModules?: { name?: string; subtitle?: string; phase?: number; thirdParty?: boolean }[];
      rbac?: { title?: string; subtitle?: string };
      integrationModules?: { name?: string; subtitle?: string }[];
      externalGroups?: { title?: string; items?: string[] }[];
      aiLayer?: { capabilities?: string[]; rag?: { title?: string; subtitle?: string }; llmProviders?: string[] };
      layerNotes?: Record<string, string>; gatewayNote?: string; gaps?: string[];
    };
    const ln = m.layerNotes ?? {};
    const out: string[] = [];
    const band = (title: string) => out.push(`### ${title}`);
    const bullets = (items?: string[]) => (items ?? []).forEach((x) => out.push(`- ${x}`));
    const mods = (list?: { name?: string; subtitle?: string; phase?: number; thirdParty?: boolean }[]) =>
      (list ?? []).forEach((x) => {
        const tags = [x.thirdParty ? '3rd-party' : '', x.phase && x.phase > 1 ? `Phase ${x.phase}` : '']
          .filter(Boolean)
          .map((t) => ` _[${t}]_`)
          .join('');
        out.push(`- ${x.name ?? ''}${x.subtitle ? ` — ${x.subtitle}` : ''}${tags}`);
      });

    band('1. Access layer');
    bullets(m.channels);
    if (m.actors?.length) out.push(`- **Actors:** ${m.actors.join(' · ')}`);
    out.push('');
    band('2. Core infrastructure');
    bullets(m.coreInfra);
    out.push('');
    band('3. Core functional modules');
    mods(m.functionalModules);
    if (m.rbac?.title) out.push(`- **${m.rbac.title}**${m.rbac.subtitle ? ` — ${m.rbac.subtitle}` : ''}`);
    out.push('');
    band('4. Integration layer — 3rd party module integrations');
    mods(m.integrationModules);
    out.push('');
    band(`5. External / 3rd party systems${m.gatewayNote ? ` (${m.gatewayNote})` : ''}`);
    (m.externalGroups ?? []).forEach((g) => out.push(`- **${g.title ?? ''}:** ${(g.items ?? []).join(' · ')}`));
    out.push('');
    band('6. AI layer — conversational, RAG, multi-LLM');
    const hasAi = (m.aiLayer?.capabilities?.length ?? 0) > 0 || !!m.aiLayer?.rag?.title || (m.aiLayer?.llmProviders?.length ?? 0) > 0;
    if (hasAi) {
      if (m.aiLayer?.capabilities?.length) out.push(`- **Capabilities:** ${m.aiLayer.capabilities.join(' · ')}`);
      if (m.aiLayer?.rag?.title) out.push(`- **RAG:** ${m.aiLayer.rag.title}${m.aiLayer.rag.subtitle ? ` — ${m.aiLayer.rag.subtitle}` : ''}`);
      if (m.aiLayer?.llmProviders?.length) out.push(`- **LLM providers:** ${m.aiLayer.llmProviders.join(' · ')}`);
    } else {
      out.push('- _No AI layer in scope._');
    }

    // §3.1-style reference table: Layer | What it represents | Where it gets unpacked.
    const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
    const rows: [string, string | undefined, string][] = [
      ['Access layer', ln.access, '§4 Layered Technical View · §6 Architecture Style & Patterns View'],
      ['Core infrastructure', ln.coreInfra, '§9 Technology Stack · §13 Integration Architecture'],
      ['Core functional modules', ln.functionalModules, '§5 Detailed Component View · §10 Design Patterns Catalogue'],
      ['Integration layer — 3rd party module integrations', ln.integration, '§13 Integration Architecture'],
      ['External / 3rd party systems', ln.external, '§11 Auth & Security Design · §13 Integration Architecture'],
      ['AI layer (conversational, RAG, multi-LLM)', ln.ai, '§12 AI Layer Architecture'],
    ];
    out.push('', '### The six layers — what each represents', '');
    out.push('| Layer | What it represents | Where it gets unpacked in this HLD |');
    out.push('| --- | --- | --- |');
    rows.forEach(([name, note, ref]) => out.push(`| ${esc(name)} | ${esc(note)} | ${esc(ref)} |`));

    if (m.gaps?.length) {
      out.push('', '### Gaps & assumptions');
      bullets(m.gaps);
    }
    return out.join('\n');
  }

  /** Render the architecture style & patterns view (§6) model as readable Markdown. */
  private styleViewBandsMarkdown(model: Record<string, unknown>): string {
    const m = model as {
      intro?: string;
      actors?: string[];
      tiers?: { name?: string; applicable?: boolean; pattern?: string; components?: { name?: string; subtext?: string }[] }[];
      architecturalChoices?: { choice?: string; explicit?: string }[];
      tierPatterns?: { tier?: string; patterns?: string }[];
      modulePattern?: { applicable?: boolean; note?: string; tiers?: { tier?: string; archetype?: string; stack?: string; responsibility?: string; mustHave?: boolean }[]; forcingFunctions?: { service?: string; trigger?: string }[] };
      gaps?: string[];
    };
    const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
    const out: string[] = [];
    if (m.intro) out.push(`_${m.intro}_`, '');
    if (m.actors?.length) out.push(`**Actors:** ${m.actors.join(' · ')}`, '');
    for (const t of (m.tiers ?? []).filter((x) => x.applicable !== false)) {
      out.push(`### ${t.name ?? ''}${t.pattern && t.pattern !== '—' ? ` — _${t.pattern}_` : ''}`);
      (t.components ?? []).forEach((c) => out.push(`- ${c.name ?? ''}${c.subtext ? ` — ${c.subtext}` : ''}`));
      out.push('');
    }
    if (m.architecturalChoices?.length) {
      out.push('### 6.1 — What this view tells you that the others do not', '');
      out.push('| Architectural choice | What the diagram makes explicit |');
      out.push('| --- | --- |');
      m.architecturalChoices.forEach((c) => out.push(`| ${esc(c.choice)} | ${esc(c.explicit)} |`));
      out.push('');
    }
    if (m.tierPatterns?.length) {
      out.push('### 6.2 — Design patterns visible in this view', '');
      out.push('| Tier | Patterns applied |');
      out.push('| --- | --- |');
      m.tierPatterns.forEach((tp) => out.push(`| ${esc(tp.tier)} | ${esc(tp.patterns)} |`));
      out.push('');
    }
    const mp = m.modulePattern;
    if (mp) {
      out.push('### 6.3 — The 3-Tier Module Pattern', '');
      if (mp.note) out.push(`_${mp.note}_`, '');
      if (mp.applicable !== false && mp.tiers?.length) {
        out.push('| Tier | Service archetype | Stack | Responsibility |');
        out.push('| --- | --- | --- | --- |');
        mp.tiers.forEach((t) => out.push(`| ${esc(t.tier)}${t.mustHave ? ' *' : ''} | ${esc(t.archetype)} | ${esc(t.stack)} | ${esc(t.responsibility)} |`));
        out.push('');
      }
      if (mp.applicable !== false && mp.forcingFunctions?.length) {
        out.push('**When to break the optional tiers out of M1**', '');
        out.push('| Service to extract | Forcing function |');
        out.push('| --- | --- |');
        mp.forcingFunctions.forEach((f) => out.push(`| ${esc(f.service)} | ${esc(f.trigger)} |`));
        out.push('');
      }
    }
    if (m.gaps?.length) {
      out.push('### Gaps & assumptions');
      m.gaps.forEach((g) => out.push(`- ${g}`));
    }
    return out.join('\n');
  }

  /** Render the AWS deployment view (§7) model as readable Markdown. */
  private deploymentViewMarkdown(model: Record<string, unknown>): string {
    type Svc = { name?: string; abbr?: string; family?: string; subtext?: string };
    const m = model as {
      intro?: string;
      cloud?: string;
      region?: string;
      account?: string;
      scopeNote?: string;
      layers?: { name?: string; applicable?: boolean; outOfScope?: string; services?: Svc[]; subGroups?: { label?: string; services?: Svc[] }[] }[];
      serviceMapping?: { hldLayer?: string; component?: string; awsService?: string; rationale?: string }[];
      serverless?: { intro?: string; patterns?: { pattern?: string; detail?: string }[]; closing?: string };
      notInView?: { item?: string; reason?: string }[];
      evolution?: { when?: string; added?: string }[];
      gaps?: string[];
    };
    const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
    const svc = (x: Svc) => `${x.name ?? x.abbr ?? ''}${x.subtext ? ` (${x.subtext})` : ''}`;
    const out: string[] = [];
    if (m.intro) out.push(`_${m.intro}_`, '');
    const meta = [m.cloud, m.region ? `Region: ${m.region}` : '', m.account ? `Account: ${m.account}` : '']
      .filter(Boolean)
      .join(' · ');
    if (meta) out.push(`**${meta}**`, '');
    if (m.scopeNote) out.push(m.scopeNote, '');

    out.push('### Deployment diagram — AWS service catalogue', '');
    for (const l of (m.layers ?? []).filter((x) => x.applicable !== false)) {
      out.push(`**${l.name ?? ''}**`);
      if (l.subGroups?.length) {
        l.subGroups.forEach((g) => {
          out.push(`- _${g.label ?? ''}:_ ${(g.services ?? []).map(svc).join(' · ') || '—'}`);
        });
      } else {
        out.push(`- ${(l.services ?? []).map(svc).join(' · ') || '—'}`);
      }
      out.push('');
    }
    for (const l of (m.layers ?? []).filter((x) => x.applicable === false)) {
      out.push(`**${l.name ?? ''}** — _Out of scope${l.outOfScope ? `: ${l.outOfScope}` : ''}_`, '');
    }

    if (m.serviceMapping?.length) {
      out.push('### 7.1 — AWS service mapping (HLD layer → AWS service)', '');
      out.push('| HLD layer | Component | AWS service | Rationale and trade-offs |', '| --- | --- | --- | --- |');
      m.serviceMapping.forEach((r) =>
        out.push(`| ${esc(r.hldLayer)} | ${esc(r.component)} | ${esc(r.awsService)} | ${esc(r.rationale)} |`),
      );
      out.push('');
    }
    if (m.serverless) {
      out.push('### 7.2 — Serverless choices (where Lambda fits)', '');
      if (m.serverless.intro) out.push(m.serverless.intro, '');
      (m.serverless.patterns ?? []).forEach((p) => out.push(`- **${p.pattern ?? ''}** — ${p.detail ?? ''}`));
      if (m.serverless.patterns?.length) out.push('');
      if (m.serverless.closing) out.push(m.serverless.closing, '');
    }
    if (m.notInView?.length) {
      out.push('### 7.3 — What is deliberately NOT in this view', '');
      m.notInView.forEach((n) => out.push(`- **${n.item ?? ''}** — ${n.reason ?? ''}`));
      out.push('');
    }
    if (m.evolution?.length) {
      out.push('### 7.4 — How this view evolves', '');
      out.push('| When | What is added to this view |', '| --- | --- |');
      m.evolution.forEach((e) => out.push(`| ${esc(e.when)} | ${esc(e.added)} |`));
      out.push('');
    }
    if (m.gaps?.length) {
      out.push('### Gaps & assumptions');
      m.gaps.forEach((g) => out.push(`- ${g}`));
    }
    return out.join('\n');
  }

  /** Render the AWS flow diagrams (§7.5) as readable Markdown (textual flow listing). */
  private deploymentFlowsMarkdown(model: Record<string, unknown>): string {
    type Node = { id?: string; label?: string };
    type Edge = { from?: string; to?: string; label?: string };
    type Diagram = { title?: string; description?: string; nodes?: Node[]; edges?: Edge[] };
    const m = model as { diagrams?: Diagram[]; consolidated?: Diagram };
    const out: string[] = ['### 7.5 — AWS flow diagrams', ''];
    const renderDiagram = (d?: Diagram) => {
      if (!d) return;
      const labels = new Map<string, string>();
      (d.nodes ?? []).forEach((n) => n.id && labels.set(n.id, n.label ?? n.id));
      out.push(`**${d.title ?? 'Flow'}**`);
      if (d.description) out.push(`_${d.description}_`);
      (d.edges ?? []).forEach((e) => {
        const f = labels.get(e.from ?? '') ?? e.from ?? '';
        const t = labels.get(e.to ?? '') ?? e.to ?? '';
        out.push(`- ${f} → ${t}${e.label ? ` (${e.label})` : ''}`);
      });
      out.push('');
    };
    (m.diagrams ?? []).forEach(renderDiagram);
    if (m.consolidated) renderDiagram(m.consolidated);
    out.push('_(Diagrams render visually in the app preview, PDF and DOCX exports.)_', '');
    return out.join('\n');
  }

  /** Render the project structure (§17) model as readable Markdown. */
  private projectStructureMarkdown(model: Record<string, unknown>): string {
    type Ref = { folder?: string; poc?: boolean; purpose?: string };
    const m = model as {
      monorepoLabel?: string;
      groups?: { title?: string; items?: string[] }[];
      intro?: string;
      principles?: { principle?: string; how?: string }[];
      backend?: { stack?: string; intro?: string; rootTree?: string; perModuleTree?: string; folderReference?: Ref[] };
      frontend?: { stack?: string; intro?: string; rootTree?: string; componentRule?: { scope?: string; location?: string; rule?: string }[]; promotionRule?: string };
      aiAgent?: { applicable?: boolean; note?: string; stack?: string; rootTree?: string; folderResponsibilities?: Ref[]; runtimeInteraction?: string };
      namingConventions?: { concern?: string; convention?: string; examples?: string }[];
      gaps?: string[];
    };
    const esc = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '—';
    const out: string[] = [];
    if (m.monorepoLabel) out.push(`**${m.monorepoLabel}**`, '');
    (m.groups ?? []).forEach((g) => out.push(`- **${g.title ?? ''}:** ${(g.items ?? []).join(' · ')}`));
    if (m.aiAgent) out.push(`- **AI Agent:** ${m.aiAgent.applicable === false ? `_${m.aiAgent.note || 'Not applicable'}_` : m.aiAgent.note || 'applicable'}`);
    out.push('');
    if (m.intro) out.push(`_${m.intro}_`, '');
    if (m.principles?.length) {
      out.push('| Principle | How it shows up in the structure |', '| --- | --- |');
      m.principles.forEach((p) => out.push(`| ${esc(p.principle)} | ${esc(p.how)} |`));
      out.push('');
    }
    const refTable = (rows?: Ref[]) => {
      if (!rows?.length) return;
      out.push('| Folder | POC | Purpose |', '| --- | --- | --- |');
      rows.forEach((r) => out.push(`| ${esc(r.folder)} | ${r.poc ? '★' : ''} | ${esc(r.purpose)} |`));
      out.push('');
    };
    const codeBlock = (s?: string) => {
      if (s?.trim()) out.push('```', s, '```', '');
    };
    if (m.backend) {
      out.push(`### 17.1 — Backend project structure${m.backend.stack ? ` (${m.backend.stack})` : ''}`, '');
      if (m.backend.intro) out.push(m.backend.intro, '');
      codeBlock(m.backend.rootTree);
      if (m.backend.perModuleTree?.trim() || m.backend.folderReference?.length) {
        out.push('### 17.2 — Per-module structure — apps/[module]-api/', '');
        codeBlock(m.backend.perModuleTree);
        refTable(m.backend.folderReference);
      }
    }
    if (m.frontend) {
      out.push(`### 17.3 — Frontend project structure${m.frontend.stack ? ` (${m.frontend.stack})` : ''}`, '');
      if (m.frontend.intro) out.push(m.frontend.intro, '');
      codeBlock(m.frontend.rootTree);
      if (m.frontend.componentRule?.length) {
        out.push('| Scope | Location | Rule |', '| --- | --- | --- |');
        m.frontend.componentRule.forEach((c) => out.push(`| ${esc(c.scope)} | ${esc(c.location)} | ${esc(c.rule)} |`));
        out.push('');
      }
      if (m.frontend.promotionRule) out.push(`**Promotion rule —** ${m.frontend.promotionRule}`, '');
    }
    out.push(`### 17.4 — AI Agent project structure${m.aiAgent?.applicable !== false && m.aiAgent?.stack ? ` (${m.aiAgent.stack})` : ''}`, '');
    if (m.aiAgent?.applicable === false) {
      out.push(`_${m.aiAgent?.note || 'Not applicable — no AI agent required.'}_`, '');
    } else {
      if (m.aiAgent?.note) out.push(m.aiAgent.note, '');
      codeBlock(m.aiAgent?.rootTree);
      refTable(m.aiAgent?.folderResponsibilities);
      codeBlock(m.aiAgent?.runtimeInteraction);
    }
    if (m.namingConventions?.length) {
      out.push('### 17.5 — Naming conventions across all stacks', '');
      out.push('| Concern | Convention | Examples |', '| --- | --- | --- |');
      m.namingConventions.forEach((n) => out.push(`| ${esc(n.concern)} | ${esc(n.convention)} | ${esc(n.examples)} |`));
      out.push('');
    }
    if (m.gaps?.length) {
      out.push('### Gaps & assumptions');
      m.gaps.forEach((g) => out.push(`- ${g}`));
    }
    return out.join('\n');
  }

  private renderMarkdown(
    version: number,
    sections: Record<string, unknown>,
    diagrams: Record<string, string>,
    systemView?: unknown,
    technicalView?: unknown,
    componentView?: unknown,
    styleView?: unknown,
    structureView?: unknown,
    deploymentView?: unknown,
    deploymentFlows?: unknown,
  ): string {
    const lines: string[] = [`# High-Level Design (HLD)`, ``, `_Version ${version}_`, ``];
    HLD_SECTION_ORDER.forEach((key, i) => {
      lines.push(`## ${i + 1}. ${HLD_SECTION_NAMES[key]}`, ``);
      const body = sections[key];
      // §3 — render the canonical band model; drop legacy free-text layer fields.
      if (key === 'systemView' && systemView && typeof systemView === 'object') {
        lines.push(this.systemViewBandsMarkdown(systemView as Record<string, unknown>), '');
        const rest = this.withoutLegacyFields(body, ['layers', 'phasing', 'externalSystems']);
        if (rest && Object.keys(rest).length) {
          lines.push('```json', JSON.stringify(flattenValue(rest), null, 2), '```', '');
        }
        return;
      }
      // §4 — render the canonical layered technical view; drop legacy free-text fields.
      if (key === 'technicalLayersView' && technicalView && typeof technicalView === 'object') {
        lines.push(this.technicalViewBandsMarkdown(technicalView as Record<string, unknown>), '');
        const rest = this.withoutLegacyFields(body, ['layers', 'description']);
        if (rest && Object.keys(rest).length) {
          lines.push('```json', JSON.stringify(flattenValue(rest), null, 2), '```', '');
        }
        return;
      }
      // §5 — render the canonical detailed component view; drop legacy free-text fields.
      if (key === 'componentView' && componentView && typeof componentView === 'object') {
        lines.push(this.componentViewBandsMarkdown(componentView as Record<string, unknown>), '');
        const rest = this.withoutLegacyFields(body, ['components', 'description']);
        if (rest && Object.keys(rest).length) {
          lines.push('```json', JSON.stringify(flattenValue(rest), null, 2), '```', '');
        }
        return;
      }
      // §6 — render the canonical architecture style & patterns view; drop legacy fields.
      if (key === 'architectureStyleView' && styleView && typeof styleView === 'object') {
        lines.push(this.styleViewBandsMarkdown(styleView as Record<string, unknown>), '');
        const rest = this.withoutLegacyFields(body, ['tiers', 'description', 'patternsByTier']);
        if (rest && Object.keys(rest).length) {
          lines.push('```json', JSON.stringify(flattenValue(rest), null, 2), '```', '');
        }
        return;
      }
      // §7 — render the canonical AWS deployment view; drop legacy free-text fields.
      if (key === 'deploymentView' && deploymentView && typeof deploymentView === 'object') {
        lines.push(this.deploymentViewMarkdown(deploymentView as Record<string, unknown>), '');
        if (deploymentFlows && typeof deploymentFlows === 'object') {
          lines.push(this.deploymentFlowsMarkdown(deploymentFlows as Record<string, unknown>), '');
        }
        const rest = this.withoutLegacyFields(body, ['description', 'cloudMapping', 'serverlessChoices', 'notInScope']);
        if (rest && Object.keys(rest).length) {
          lines.push('```json', JSON.stringify(flattenValue(rest), null, 2), '```', '');
        }
        return;
      }
      // §17 — render the canonical project structure; drop legacy free-text fields.
      if (key === 'projectStructure' && structureView && typeof structureView === 'object') {
        lines.push(this.projectStructureMarkdown(structureView as Record<string, unknown>), '');
        const rest = this.withoutLegacyFields(body, ['aiAgent', 'backend', 'frontend', 'namingConventions']);
        if (rest && Object.keys(rest).length) {
          lines.push('```json', JSON.stringify(flattenValue(rest), null, 2), '```', '');
        }
        return;
      }
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
