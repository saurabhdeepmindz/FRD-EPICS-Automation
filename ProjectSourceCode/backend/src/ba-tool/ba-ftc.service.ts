import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface FtcConfigPayload {
  testingFramework?: string | null;
  coverageTarget?: string | null;
  owaspWebEnabled?: boolean | null;
  owaspLlmEnabled?: boolean | null;
  excludedOwaspWeb?: string[] | null;
  excludedOwaspLlm?: string[] | null;
  includeLldReferences?: boolean | null;
  ftcTemplateId?: string | null;
  customNotes?: string | null;
  narrative?: string | null;
  useAsAdditional?: boolean | null;
}

@Injectable()
export class BaFtcService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const config = await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });
    return {
      config,
      moduleStatus: mod.moduleStatus,
      ftcCompletedAt: mod.ftcCompletedAt,
      ftcArtifactId: mod.ftcArtifactId,
    };
  }

  async saveConfig(moduleDbId: string, payload: FtcConfigPayload) {
    const existing = await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });
    const data: Record<string, unknown> = {
      testingFramework: payload.testingFramework ?? null,
      coverageTarget: payload.coverageTarget ?? null,
      excludedOwaspWeb: payload.excludedOwaspWeb ?? [],
      excludedOwaspLlm: payload.excludedOwaspLlm ?? [],
      ftcTemplateId: payload.ftcTemplateId ?? null,
      customNotes: payload.customNotes ?? null,
      ...(payload.owaspWebEnabled !== undefined && payload.owaspWebEnabled !== null
        ? { owaspWebEnabled: payload.owaspWebEnabled }
        : {}),
      ...(payload.owaspLlmEnabled !== undefined && payload.owaspLlmEnabled !== null
        ? { owaspLlmEnabled: payload.owaspLlmEnabled }
        : {}),
      ...(payload.includeLldReferences !== undefined && payload.includeLldReferences !== null
        ? { includeLldReferences: payload.includeLldReferences }
        : {}),
      ...(payload.narrative !== undefined ? { narrative: payload.narrative } : {}),
      ...(payload.useAsAdditional !== undefined && payload.useAsAdditional !== null
        ? { useAsAdditional: payload.useAsAdditional }
        : {}),
    };
    if (existing) {
      return this.prisma.baFtcConfig.update({ where: { moduleDbId }, data });
    }
    return this.prisma.baFtcConfig.create({ data: { moduleDbId, ...data } });
  }

  async getFtcArtifact(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    if (!mod.ftcArtifactId) return null;
    return this.prisma.baArtifact.findUnique({
      where: { id: mod.ftcArtifactId },
      include: { sections: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async listFtcArtifactsForModule(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const artifacts = await this.prisma.baArtifact.findMany({
      where: { moduleDbId, artifactType: 'FTC' },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: { select: { id: true } },
        testCases: { select: { id: true, scope: true, owaspCategory: true } },
      },
    });
    return artifacts.map((a) => ({
      id: a.id,
      artifactId: a.artifactId,
      status: a.status,
      approvedAt: a.approvedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      sectionCount: a.sections.length,
      testCaseCount: a.testCases.length,
      whiteBoxCount: a.testCases.filter((tc) => tc.scope === 'white_box').length,
      owaspCategories: Array.from(
        new Set(a.testCases.map((tc) => tc.owaspCategory).filter((x): x is string => !!x)),
      ).sort(),
      isCurrent: mod.ftcArtifactId === a.id,
    }));
  }

  async listTestCases(artifactDbId: string) {
    return this.prisma.baTestCase.findMany({
      where: { artifactDbId },
      orderBy: [{ parentTestCaseId: 'asc' }, { testCaseId: 'asc' }],
    });
  }

  async getTestCase(id: string) {
    const tc = await this.prisma.baTestCase.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException(`Test case ${id} not found`);
    return tc;
  }

  async updateTestCase(id: string, editedContent: string) {
    const tc = await this.prisma.baTestCase.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException(`Test case ${id} not found`);
    return this.prisma.baTestCase.update({
      where: { id },
      data: { editedContent, isHumanModified: true },
    });
  }
}
