import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  BaMasterDataCategory,
  BaMasterDataScope,
  BaTemplateModifier,
  BaTemplate,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isTemplateCategory } from './ba-master-data.service';

export interface CreateTemplateDto {
  category: BaMasterDataCategory;
  name: string;
  content: string;
  scope?: BaMasterDataScope;
  projectId?: string | null;
  parentTemplateId?: string | null;
  lastModifiedBy?: BaTemplateModifier;
}

export interface ForkTemplateDto {
  parentTemplateId: string;
  projectId: string;
  /** Overrides — if omitted, copy from parent */
  name?: string;
  content?: string;
  lastModifiedBy?: BaTemplateModifier;
}

@Injectable()
export class BaTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    category: BaMasterDataCategory,
    projectId?: string | null,
  ) {
    return this.prisma.baTemplate.findMany({
      where: {
        category,
        OR: [
          { scope: 'GLOBAL' },
          ...(projectId ? [{ scope: 'PROJECT' as BaMasterDataScope, projectId }] : []),
        ],
      },
      orderBy: [{ scope: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(id: string) {
    const template = await this.prisma.baTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async getLineage(id: string): Promise<BaTemplate[]> {
    const chain: BaTemplate[] = [];
    let cursor: string | null = id;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) break; // cycle safety
      seen.add(cursor);
      const t: BaTemplate | null = await this.prisma.baTemplate.findUnique({ where: { id: cursor } });
      if (!t) break;
      chain.push(t);
      cursor = t.parentTemplateId;
    }
    return chain;
  }

  async create(dto: CreateTemplateDto) {
    if (!isTemplateCategory(dto.category)) {
      throw new BadRequestException(
        `Category ${dto.category} is not a template category`,
      );
    }
    const scope: BaMasterDataScope = dto.scope ?? 'PROJECT';
    if (scope === 'PROJECT' && !dto.projectId) {
      throw new BadRequestException('projectId required for PROJECT-scoped templates');
    }
    if (scope === 'GLOBAL' && dto.projectId) {
      throw new BadRequestException('projectId must be null for GLOBAL-scoped templates');
    }

    // Derive version from parent lineage if applicable
    let version = 1;
    if (dto.parentTemplateId) {
      const parent = await this.get(dto.parentTemplateId);
      version = parent.version + 1;
    }

    return this.prisma.baTemplate.create({
      data: {
        category: dto.category,
        name: dto.name,
        content: dto.content,
        scope,
        projectId: dto.projectId ?? null,
        parentTemplateId: dto.parentTemplateId ?? null,
        version,
        lastModifiedBy: dto.lastModifiedBy ?? 'HUMAN',
      },
    });
  }

  /**
   * Fork a template. Per the project's design rule, any human edit or AI
   * improvement forks a NEW template row (versioned) rather than mutating
   * the parent. Forks land at scope=PROJECT regardless of parent scope — so
   * GLOBAL templates stay stable unless explicitly promoted.
   */
  async fork(dto: ForkTemplateDto) {
    const parent = await this.get(dto.parentTemplateId);
    return this.prisma.baTemplate.create({
      data: {
        category: parent.category,
        name: dto.name ?? parent.name,
        content: dto.content ?? parent.content,
        scope: 'PROJECT',
        projectId: dto.projectId,
        parentTemplateId: parent.id,
        version: parent.version + 1,
        lastModifiedBy: dto.lastModifiedBy ?? 'HUMAN',
      },
    });
  }

  /**
   * Convenience — when an LLM improves a template, fork with lastModifiedBy=AI.
   */
  async recordAiImprovement(
    parentTemplateId: string,
    projectId: string,
    newContent: string,
    newName?: string,
  ) {
    return this.fork({
      parentTemplateId,
      projectId,
      content: newContent,
      name: newName,
      lastModifiedBy: 'AI',
    });
  }
}
