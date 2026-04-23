import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import {
  BaMasterDataCategory,
  BaMasterDataScope,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

// ─── Tech-stack vs template category split ────────────────────────────────

const TECH_STACK_CATEGORIES: BaMasterDataCategory[] = [
  'FRONTEND_STACK',
  'BACKEND_STACK',
  'DATABASE',
  'STREAMING',
  'CACHING',
  'STORAGE',
  'CLOUD',
  'ARCHITECTURE',
];

const TEMPLATE_CATEGORIES: BaMasterDataCategory[] = [
  'PROJECT_STRUCTURE',
  'BACKEND_TEMPLATE',
  'FRONTEND_TEMPLATE',
  'LLD_TEMPLATE',
  'CODING_GUIDELINES',
];

export function isTechStackCategory(c: BaMasterDataCategory): boolean {
  return TECH_STACK_CATEGORIES.includes(c);
}

export function isTemplateCategory(c: BaMasterDataCategory): boolean {
  return TEMPLATE_CATEGORIES.includes(c);
}

// Maps category enum → bundled JSON filename
const SEED_FILE_MAP: Partial<Record<BaMasterDataCategory, string>> = {
  FRONTEND_STACK: 'frontend-stack.json',
  BACKEND_STACK: 'backend-stack.json',
  DATABASE: 'database.json',
  STREAMING: 'streaming.json',
  CACHING: 'caching.json',
  STORAGE: 'storage.json',
  CLOUD: 'cloud.json',
  ARCHITECTURE: 'architecture.json',
};

export interface CreateMasterDataDto {
  category: BaMasterDataCategory;
  scope?: BaMasterDataScope;
  projectId?: string | null;
  name: string;
  value: string;
  description?: string;
  templateId?: string | null;
  /** Skip fuzzy-dedupe and force create. */
  force?: boolean;
}

export interface UpdateMasterDataDto {
  name?: string;
  value?: string;
  description?: string;
  isArchived?: boolean;
}

export interface FuzzyMatchCandidate {
  id: string;
  name: string;
  scope: BaMasterDataScope;
  distance: number;
}

@Injectable()
export class BaMasterDataService implements OnModuleInit {
  private readonly logger = new Logger(BaMasterDataService.name);

  // Resolve the bundled seed directory relative to the compiled dist location
  // (same pattern used by BaSkillOrchestratorService for skill files).
  //   __dirname → backend/dist/ba-tool/
  //     ../../.. → ProjectSourceCode/
  //     ../      → FRD-EPICS-Automation/ (repo root)
  //     then into Screen-FRD-EPICS-Automation-Skills-Prompt/master-data
  private readonly seedDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'Screen-FRD-EPICS-Automation-Skills-Prompt',
    'master-data',
  );

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedAllTechStackCategoriesIfEmpty();
    } catch (err) {
      this.logger.warn(
        `Master-data seed skipped: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  // ─── Seed loader ───────────────────────────────────────────────────────

  async seedAllTechStackCategoriesIfEmpty(): Promise<void> {
    for (const category of TECH_STACK_CATEGORIES) {
      const existing = await this.prisma.baMasterDataEntry.count({
        where: { category, scope: 'GLOBAL' },
      });
      if (existing > 0) continue;
      await this.loadBundledCategory(category);
    }
  }

  private async loadBundledCategory(category: BaMasterDataCategory): Promise<number> {
    const filename = SEED_FILE_MAP[category];
    if (!filename) return 0;

    const filePath = path.join(this.seedDir, filename);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      this.logger.warn(`Seed file not found: ${filePath}`);
      return 0;
    }

    let parsed: { entries?: Array<{ name: string; value: string; description?: string }> };
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.error(`Invalid JSON in ${filePath}`);
      return 0;
    }

    const entries = parsed.entries ?? [];
    let created = 0;
    for (const e of entries) {
      try {
        await this.prisma.baMasterDataEntry.create({
          data: {
            category,
            scope: 'GLOBAL',
            projectId: null,
            name: e.name,
            value: e.value,
            description: e.description ?? null,
          },
        });
        created++;
      } catch (err) {
        // Unique-constraint collision — already seeded, skip
      }
    }
    if (created > 0) {
      this.logger.log(`Seeded ${created} GLOBAL entries for ${category}`);
    }
    return created;
  }

  async reseed(category: BaMasterDataCategory): Promise<{ category: BaMasterDataCategory; seeded: number }> {
    if (!isTechStackCategory(category)) {
      throw new BadRequestException(
        `Reseed is not supported for template category ${category} — templates are UI-uploaded only.`,
      );
    }
    // Archive existing GLOBAL entries
    await this.prisma.baMasterDataEntry.updateMany({
      where: { category, scope: 'GLOBAL' },
      data: { isArchived: true },
    });
    // Then hard-delete them so the fresh seed isn't shadowed by archived rows
    await this.prisma.baMasterDataEntry.deleteMany({
      where: { category, scope: 'GLOBAL' },
    });
    const seeded = await this.loadBundledCategory(category);
    return { category, seeded };
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────

  async list(category: BaMasterDataCategory, projectId?: string | null) {
    // GLOBAL + PROJECT-scoped entries for this project; project overrides
    // global on exact-match name (case-insensitive).
    const globalEntries = await this.prisma.baMasterDataEntry.findMany({
      where: { category, scope: 'GLOBAL', isArchived: false },
      include: { template: true },
      orderBy: { name: 'asc' },
    });
    const projectEntries = projectId
      ? await this.prisma.baMasterDataEntry.findMany({
          where: { category, scope: 'PROJECT', projectId, isArchived: false },
          include: { template: true },
          orderBy: { name: 'asc' },
        })
      : [];

    const seen = new Set<string>();
    const merged: typeof globalEntries = [];
    for (const e of projectEntries) {
      merged.push(e);
      seen.add(e.name.toLowerCase());
    }
    for (const e of globalEntries) {
      if (!seen.has(e.name.toLowerCase())) merged.push(e);
    }
    return merged;
  }

  async get(id: string) {
    const entry = await this.prisma.baMasterDataEntry.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!entry) throw new NotFoundException(`Master data entry ${id} not found`);
    return entry;
  }

  async create(dto: CreateMasterDataDto) {
    const scope: BaMasterDataScope = dto.scope ?? 'PROJECT';
    if (scope === 'PROJECT' && !dto.projectId) {
      throw new BadRequestException('projectId is required for PROJECT-scoped entries');
    }
    if (scope === 'GLOBAL' && dto.projectId) {
      throw new BadRequestException('projectId must be null for GLOBAL-scoped entries');
    }

    if (!dto.force) {
      const candidates = await this.fuzzyMatch(dto.category, dto.name, dto.projectId ?? null);
      if (candidates.length > 0) {
        throw new ConflictException({
          message: 'Potential duplicate — use force=true to override',
          suggestions: candidates,
        });
      }
    }

    try {
      return await this.prisma.baMasterDataEntry.create({
        data: {
          category: dto.category,
          scope,
          projectId: dto.projectId ?? null,
          name: dto.name,
          value: dto.value,
          description: dto.description ?? null,
          templateId: dto.templateId ?? null,
        },
        include: { template: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An entry with this name already exists in this scope');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateMasterDataDto) {
    await this.get(id);
    return this.prisma.baMasterDataEntry.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
      include: { template: true },
    });
  }

  async archive(id: string) {
    await this.get(id);
    return this.prisma.baMasterDataEntry.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async promoteToGlobal(id: string) {
    const entry = await this.get(id);
    if (entry.scope === 'GLOBAL') {
      throw new BadRequestException('Entry is already global');
    }
    // Clone as GLOBAL; archive the project-scoped original to avoid showing
    // two matching names in the merged list.
    const cloned = await this.prisma.baMasterDataEntry.create({
      data: {
        category: entry.category,
        scope: 'GLOBAL',
        projectId: null,
        name: entry.name,
        value: entry.value,
        description: entry.description,
        templateId: entry.templateId,
      },
      include: { template: true },
    });
    await this.prisma.baMasterDataEntry.update({
      where: { id: entry.id },
      data: { isArchived: true },
    });
    return cloned;
  }

  async bulkInsert(entries: CreateMasterDataDto[]) {
    const results: { ok: number; skipped: number; errors: string[] } = {
      ok: 0,
      skipped: 0,
      errors: [],
    };
    for (const e of entries) {
      if (!isTechStackCategory(e.category)) {
        results.skipped++;
        results.errors.push(
          `${e.name}: bulk insert is not supported for template category ${e.category}`,
        );
        continue;
      }
      try {
        await this.create({ ...e, force: true });
        results.ok++;
      } catch (err) {
        results.skipped++;
        results.errors.push(
          `${e.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }
    return results;
  }

  // ─── Fuzzy dedupe ──────────────────────────────────────────────────────

  async fuzzyMatch(
    category: BaMasterDataCategory,
    name: string,
    projectId: string | null,
    maxDistance = 3,
  ): Promise<FuzzyMatchCandidate[]> {
    const pool = await this.prisma.baMasterDataEntry.findMany({
      where: {
        category,
        isArchived: false,
        OR: [
          { scope: 'GLOBAL' },
          ...(projectId ? [{ scope: 'PROJECT' as BaMasterDataScope, projectId }] : []),
        ],
      },
      select: { id: true, name: true, scope: true },
    });

    const target = name.toLowerCase().trim();
    const matches: FuzzyMatchCandidate[] = [];
    for (const e of pool) {
      const dist = levenshtein(target, e.name.toLowerCase().trim());
      if (dist <= maxDistance) {
        matches.push({ id: e.id, name: e.name, scope: e.scope, distance: dist });
      }
    }
    return matches.sort((a, b) => a.distance - b.distance).slice(0, 3);
  }
}

// ─── Levenshtein distance (iterative, O(mn)) ───────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
