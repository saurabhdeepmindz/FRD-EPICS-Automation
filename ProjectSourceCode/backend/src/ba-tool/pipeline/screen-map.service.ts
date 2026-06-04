import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { flattenSections } from './section-normalizer';
import { parseCsv, toCsv } from './csv-util';

/**
 * Screen ↔ Feature Mapping (Sprint v8 · Track Y) — PRD-sourced.
 * Generates/edits a screen map from the latest PRD (§6 FRD + §5/§8/§10), where every
 * featureRef is a §6 FR-ID and every annotation references PRD content. The map drives
 * lo-fi/hi-fi wireframe generation (Track Z). CSV import/export matches the reference shape.
 */

export interface ScreenAnnotation {
  marker: string | number; // "P" (persona) or 1,2,3,…
  title: string;
  description: string;
  prdRef: string; // PRD §/FR-ID, e.g. "§6 FR-AUTH-001"
}

interface AiScreen {
  screenId?: string;
  screenName?: string;
  prdSections?: string[];
  featureRefs?: string[];
  featureDescription?: string;
  businessRulesPrd?: string;
  businessRulesArchitect?: string;
  screenDescription?: string;
  annotations?: ScreenAnnotation[];
}
interface AiScreenMapResponse {
  screens: AiScreen[];
  coverage?: { orphanFrs?: string[]; orphanScreens?: string[] };
}

const CSV_HEADERS = [
  'Screen ID',
  'PRD Section(s)',
  'Functional Feature Reference(s)',
  'Functional Feature Description',
  'Screen Name',
  'Business Rules from PRD',
  'Business Rules Suggested by Architect',
  'Screen Description (EPIC)',
  'Wireframe Annotations (Numbered · Title · Description · PRD Ref)',
];

@Injectable()
export class ScreenMapService {
  private readonly logger = new Logger(ScreenMapService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly projectFolders: ProjectFolderService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  async getLatest(projectId: string) {
    return this.prisma.baScreenMap.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: { rows: { orderBy: { sequenceNum: 'asc' } } },
    });
  }

  async list(projectId: string) {
    return this.prisma.baScreenMap.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  async get(id: string) {
    const map = await this.prisma.baScreenMap.findUnique({
      where: { id },
      include: { rows: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!map) throw new NotFoundException(`Screen map ${id} not found`);
    return map;
  }

  /** Y-02/Y-03 — generate a PRD-sourced screen map. */
  async generate(projectId: string): Promise<{ id: string; version: number; rows: number; coverage: unknown }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true, productName: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true, sections: true },
    });
    if (!prd) throw new BadRequestException('No PRD found. Generate the PRD first (Stage 2).');

    const flatSections = flattenSections(prd.sections as Record<string, unknown>);
    const knownFrIds = this.extractFrIds(flatSections);

    let ai: AiScreenMapResponse;
    try {
      const { data } = await axios.post<AiScreenMapResponse>(
        `${this.aiServiceUrl}/screen-map-generate`,
        { project_id: projectId, prd_sections: flatSections, product_name: project.productName ?? project.name },
        { timeout: 300_000 },
      );
      ai = data;
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error
          ? err.message
          : 'unknown error';
      this.logger.error(`AI screen-map generation failed: ${msg}`);
      throw new BadRequestException(`AI screen-map generation failed: ${msg}`);
    }

    const screens = Array.isArray(ai.screens) ? ai.screens : [];
    if (!screens.length) throw new BadRequestException('AI returned no screens for the screen map.');

    // Coverage: prefer the AI's, else compute against the PRD's §6 FR-IDs.
    const mapped = new Set(screens.flatMap((s) => s.featureRefs ?? []));
    const coverage = {
      orphanFrs: ai.coverage?.orphanFrs ?? knownFrIds.filter((id) => !mapped.has(id)),
      orphanScreens: ai.coverage?.orphanScreens ?? screens.filter((s) => !(s.featureRefs?.length)).map((s) => s.screenId ?? ''),
    };

    const latest = await this.getLatest(projectId);
    const record = await this.prisma.baScreenMap.create({
      data: {
        projectId,
        version: latest ? latest.version + 1 : 1,
        status: 'DRAFT',
        triggeredBy: latest ? 'MANUAL_EDIT' : 'INITIAL_GENERATION',
        sourceArtifactVersions: { prdVersion: prd.version } as Prisma.InputJsonValue,
        metadata: { coverage } as unknown as Prisma.InputJsonValue,
        rows: {
          create: screens.map((s, i) => ({
            screenId: s.screenId?.trim() || `SCR-${String(i + 1).padStart(2, '0')}`,
            sequenceNum: i + 1,
            screenName: s.screenName ?? '',
            prdSections: Array.isArray(s.prdSections) ? s.prdSections : [],
            featureRefs: Array.isArray(s.featureRefs) ? s.featureRefs : [],
            featureDescription: s.featureDescription ?? '',
            businessRulesPrd: s.businessRulesPrd ?? '',
            businessRulesArchitect: s.businessRulesArchitect ?? '',
            screenDescription: s.screenDescription ?? '',
            annotations: (Array.isArray(s.annotations) ? s.annotations : []) as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });

    await this.exportToDisk(projectId, project.name).catch((e) =>
      this.logger.warn(`screen-map export failed: ${e instanceof Error ? e.message : e}`),
    );

    this.logger.log(`Generated screen map v${record.version} for ${project.name} (${screens.length} screens)`);
    return { id: record.id, version: record.version, rows: screens.length, coverage };
  }

  /** Edit one row (fields + annotations). */
  async updateRow(rowId: string, data: Partial<{
    screenId: string; screenName: string; prdSections: string[]; featureRefs: string[];
    featureDescription: string; businessRulesPrd: string; businessRulesArchitect: string;
    screenDescription: string; annotations: ScreenAnnotation[];
  }>) {
    const row = await this.prisma.baScreenMapRow.findUnique({ where: { id: rowId } });
    if (!row) throw new NotFoundException(`Screen map row ${rowId} not found`);
    return this.prisma.baScreenMapRow.update({
      where: { id: rowId },
      data: {
        ...(data.screenId !== undefined ? { screenId: data.screenId } : {}),
        ...(data.screenName !== undefined ? { screenName: data.screenName } : {}),
        ...(data.prdSections !== undefined ? { prdSections: data.prdSections } : {}),
        ...(data.featureRefs !== undefined ? { featureRefs: data.featureRefs } : {}),
        ...(data.featureDescription !== undefined ? { featureDescription: data.featureDescription } : {}),
        ...(data.businessRulesPrd !== undefined ? { businessRulesPrd: data.businessRulesPrd } : {}),
        ...(data.businessRulesArchitect !== undefined ? { businessRulesArchitect: data.businessRulesArchitect } : {}),
        ...(data.screenDescription !== undefined ? { screenDescription: data.screenDescription } : {}),
        ...(data.annotations !== undefined ? { annotations: data.annotations as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  /** Y-03 — import a screen map from CSV (creates a new version). */
  async importCsv(projectId: string, csvText: string): Promise<{ id: string; version: number; rows: number }> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const grid = parseCsv(csvText);
    if (grid.length < 2) throw new BadRequestException('CSV has no data rows.');
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const col = (needle: string) => header.findIndex((h) => h.includes(needle));
    const idx = {
      screenId: col('screen id'),
      prdSections: col('section'),
      featureRefs: col('feature reference'),
      featureDescription: col('feature description'),
      screenName: col('screen name'),
      businessRulesPrd: col('rules from'),
      businessRulesArchitect: col('architect'),
      screenDescription: col('screen description'),
      annotations: col('annotation'),
    };

    const dataRows = grid.slice(1).filter((r) => (r[idx.screenId] ?? '').trim() || (r[idx.screenName] ?? '').trim());
    const latest = await this.getLatest(projectId);
    const record = await this.prisma.baScreenMap.create({
      data: {
        projectId,
        version: latest ? latest.version + 1 : 1,
        status: 'DRAFT',
        triggeredBy: 'MANUAL_EDIT',
        metadata: { imported: true } as unknown as Prisma.InputJsonValue,
        rows: {
          create: dataRows.map((r, i) => ({
            screenId: (r[idx.screenId] ?? '').trim() || `SCR-${String(i + 1).padStart(2, '0')}`,
            sequenceNum: i + 1,
            screenName: (r[idx.screenName] ?? '').trim(),
            prdSections: this.splitList(r[idx.prdSections]),
            featureRefs: this.splitList(r[idx.featureRefs]),
            featureDescription: (r[idx.featureDescription] ?? '').trim(),
            businessRulesPrd: (r[idx.businessRulesPrd] ?? '').trim(),
            businessRulesArchitect: (r[idx.businessRulesArchitect] ?? '').trim(),
            screenDescription: (r[idx.screenDescription] ?? '').trim(),
            annotations: this.parseAnnotations(r[idx.annotations] ?? '') as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });
    await this.exportToDisk(projectId, project.name).catch(() => undefined);
    this.logger.log(`Imported screen map v${record.version} for ${project.name} (${dataRows.length} rows)`);
    return { id: record.id, version: record.version, rows: dataRows.length };
  }

  /** Render the latest screen map as CSV (reference column shape, PRD-referenced). */
  async toCsvString(projectId: string): Promise<{ version: number; csv: string } | null> {
    const map = await this.getLatest(projectId);
    if (!map) return null;
    const rows: string[][] = [CSV_HEADERS];
    for (const r of map.rows) {
      rows.push([
        r.screenId,
        (r.prdSections ?? []).join('; '),
        (r.featureRefs ?? []).join('; '),
        r.featureDescription,
        r.screenName,
        r.businessRulesPrd,
        r.businessRulesArchitect,
        r.screenDescription,
        this.serializeAnnotations(r.annotations as unknown as ScreenAnnotation[]),
      ]);
    }
    return { version: map.version, csv: toCsv(rows) };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async exportToDisk(projectId: string, projectName: string): Promise<void> {
    const out = await this.toCsvString(projectId);
    if (!out) return;
    await this.projectFolders.writeArtifactFile(projectName, '02b-ScreenMap', `ScreenMap-v${out.version}.csv`, out.csv);
    await this.projectFolders.appendChangelog(projectName, {
      summary: `Screen↔Feature map v${out.version} written`,
      affectedArtifacts: [`02b-ScreenMap/ScreenMap-v${out.version}.csv`],
      source: 'screen map',
      timestamp: new Date().toISOString(),
    });
  }

  /** Collect all §6 FRD FR-IDs from the (flattened) PRD sections. */
  private extractFrIds(sections: Record<string, unknown>): string[] {
    const ids = new Set<string>();
    const six = sections['6'];
    if (six && typeof six === 'object') {
      for (const [k, v] of Object.entries(six as Record<string, unknown>)) {
        if (/_features$/.test(k) && Array.isArray(v)) {
          for (const f of v) {
            const fid = (f as { featureId?: unknown })?.featureId;
            if (typeof fid === 'string' && fid.trim()) ids.add(fid.trim());
          }
        }
      }
    }
    return [...ids];
  }

  private splitList(cell: string | undefined): string[] {
    return (cell ?? '')
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** "P | Persona — desc · §ref || 1 | Title — desc · §6 FR-1" → annotation objects. */
  private parseAnnotations(cell: string): ScreenAnnotation[] {
    if (!cell.trim()) return [];
    return cell
      .split('||')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [markerRaw, rest = ''] = part.split('|').map((x) => x.trim());
        const marker = /^\d+$/.test(markerRaw) ? Number(markerRaw) : markerRaw || 'P';
        // rest = "Title — description · §ref"
        let title = rest;
        let description = '';
        let prdRef = '';
        const refSplit = rest.split('·');
        if (refSplit.length > 1) {
          prdRef = refSplit[refSplit.length - 1].trim();
        }
        const body = refSplit.slice(0, refSplit.length > 1 ? -1 : undefined).join('·').trim();
        const dash = body.split(/—|--/);
        if (dash.length > 1) {
          title = dash[0].trim();
          description = dash.slice(1).join('—').trim();
        } else {
          title = body;
        }
        return { marker, title, description, prdRef };
      });
  }

  private serializeAnnotations(annotations: ScreenAnnotation[] | undefined): string {
    if (!Array.isArray(annotations)) return '';
    return annotations
      .map((a) => `${a.marker} | ${a.title} — ${a.description} · ${a.prdRef}`)
      .join(' || ');
  }
}
