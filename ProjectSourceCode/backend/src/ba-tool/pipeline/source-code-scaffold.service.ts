import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';

export interface ScaffoldResult {
  projectName: string;
  folderPath: string;
  filesWritten: number;
  modules: Array<{ moduleId: string; files: number }>;
}

/**
 * Track H (H-02 + H-03) — scaffolds `ProjectSourceCode/` from the LLD pseudo
 * files. Each `BaPseudoFile.path` already encodes its location (e.g.
 * `src/services/foo.ts`), so writing every pseudo file to that path under
 * `ProjectSourceCode/` materialises the whole folder tree as a side effect.
 *
 * Uses `editedContent` when a human has edited the pseudo file, else `aiContent`
 * — this is the starting point that the `/prd` and `/dev` skills evolve into
 * complete code (Track K).
 */
@Injectable()
export class SourceCodeScaffoldService {
  private readonly logger = new Logger(SourceCodeScaffoldService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  /** Scaffold the whole project from every module's latest LLD pseudo files. */
  async scaffoldProject(projectId: string): Promise<ScaffoldResult> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true, modules: { select: { id: true, moduleId: true, lldArtifactId: true } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const paths = await this.projectFolders.ensureProjectFolders(project.name);
    await this.markStatus(projectId, paths.sourceCode, 'IN_PROGRESS');

    let total = 0;
    const moduleResults: ScaffoldResult['modules'] = [];

    try {
      for (const mod of project.modules) {
        // Prefer the module's active LLD artifact; fall back to its latest LLD.
        const lldArtifactId =
          mod.lldArtifactId ??
          (
            await this.prisma.baArtifact.findFirst({
              where: { moduleDbId: mod.id, artifactType: 'LLD' },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            })
          )?.id;
        if (!lldArtifactId) continue;

        const pseudoFiles = await this.prisma.baPseudoFile.findMany({
          where: { artifactDbId: lldArtifactId },
          select: { path: true, aiContent: true, editedContent: true },
        });

        let count = 0;
        for (const pf of pseudoFiles) {
          const content = pf.editedContent ?? pf.aiContent;
          if (!pf.path?.trim() || content == null) continue;
          await this.projectFolders.writeSourceFile(project.name, pf.path, content);
          count++;
        }
        if (count > 0) moduleResults.push({ moduleId: mod.moduleId, files: count });
        total += count;
      }

      await this.markStatus(projectId, paths.sourceCode, 'COMPLETE', {
        filesPlaced: total,
        lastScaffoldAt: new Date().toISOString(),
      });
      await this.projectFolders.appendChangelog(project.name, {
        summary: `Scaffolded ProjectSourceCode from LLD pseudo files (${total} files across ${moduleResults.length} module(s))`,
        affectedArtifacts: ['ProjectSourceCode/'],
        source: 'Source scaffold',
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Scaffolded ${total} files for ${project.name}`);
    } catch (err: unknown) {
      await this.markStatus(projectId, paths.sourceCode, 'ERROR', {
        lastError: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    return { projectName: project.name, folderPath: paths.sourceCode, filesWritten: total, modules: moduleResults };
  }

  /** Scaffle just one module's LLD (used by the auto-trigger after SKILL-06). */
  async scaffoldModule(moduleDbId: string): Promise<void> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      select: { projectId: true },
    });
    if (mod?.projectId) {
      await this.scaffoldProject(mod.projectId).catch((e) =>
        this.logger.warn(`Auto-scaffold failed: ${e instanceof Error ? e.message : e}`),
      );
    }
  }

  /** Upsert the BaProjectImplementation record with the current scaffold status. */
  private async markStatus(
    projectId: string,
    folderPath: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'ERROR',
    extraMeta?: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.prisma.baProjectImplementation.findUnique({ where: { projectId } });
    const metadata = {
      ...((existing?.metadata as Record<string, unknown>) ?? {}),
      ...(extraMeta ?? {}),
    } as Prisma.InputJsonValue;
    if (existing) {
      await this.prisma.baProjectImplementation.update({
        where: { projectId },
        data: { folderPath, scaffoldStatus: status, metadata },
      });
    } else {
      await this.prisma.baProjectImplementation.create({
        data: { projectId, folderPath, scaffoldStatus: status, metadata },
      });
    }
  }
}
