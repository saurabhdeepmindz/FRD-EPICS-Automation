import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { ContextEngineeringService } from './context-engineering.service';
import { SourceCodeScaffoldService } from './source-code-scaffold.service';

/**
 * Service for the new Customer Discovery → Code pipeline.
 * Real logic is implemented track-by-track per the backlog.
 * Tracks: B (Customer Inputs) · C (PRD+FRD) · E (HLD) · H (Source Code) · K (Code Dev)
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
    private readonly contextEngineering: ContextEngineeringService,
    private readonly scaffold: SourceCodeScaffoldService,
  ) {}

  // ── Context Engineering (S-07 / H-04) ─────────────────────────────────────

  /** (Re)generate the seven `.context/` markdown files from live artifacts. */
  async seedContext(projectId: string) {
    return this.contextEngineering.seedContextFiles(projectId);
  }

  // ── Source Code Scaffold (H-02 / H-03) ────────────────────────────────────

  /** Scaffold ProjectSourceCode/ from LLD pseudo files, then refresh .context/. */
  async scaffoldSourceCode(projectId: string) {
    const result = await this.scaffold.scaffoldProject(projectId);
    await this.contextEngineering.seedContextFiles(projectId).catch(() => undefined);
    return result;
  }

  // ── Project Folders (A-06) ────────────────────────────────────────────────

  /** Resolved paths + existence flags for one project's on-disk folder tree. */
  async getFolderStatus(projectId: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) return null;
    const paths = this.projectFolders.resolvePaths(project.name);
    const exists = async (p: string): Promise<boolean> => {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    };
    return {
      projectName: project.name,
      paths,
      exists: {
        root: await exists(paths.root),
        artifacts: await exists(paths.artifacts),
        sourceCode: await exists(paths.sourceCode),
        context: await exists(paths.context),
        changelog: await exists(paths.changelog),
      },
    };
  }

  /** Create the folder tree for one project (idempotent). */
  async ensureFolders(projectId: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) return null;
    return this.projectFolders.ensureProjectFolders(project.name);
  }

  /** Backfill folders for ALL existing projects that don't have them yet. */
  async backfillAllFolders() {
    const projects = await this.prisma.baProject.findMany({
      select: { id: true, name: true },
    });
    const results: Array<{ id: string; name: string; root: string }> = [];
    for (const p of projects) {
      const paths = await this.projectFolders.ensureProjectFolders(p.name);
      results.push({ id: p.id, name: p.name, root: paths.root });
    }
    return { count: results.length, projects: results };
  }

  // Customer Inputs (Track B) live in CustomerInputService — used by the controller directly.

  // Project PRD + FRD (Track C) lives in ProjectPrdService — used by the controller directly.

  // HLD (Track E) lives in HldService — used by the controller directly.

  // ── Project Implementation (Track H) ─────────────────────────────────────

  async getImplementation(projectId: string) {
    return this.prisma.baProjectImplementation.findUnique({
      where: { projectId },
    });
  }

  async createImplementation(projectId: string, folderPath: string) {
    return this.prisma.baProjectImplementation.create({
      data: { projectId, folderPath, metadata: {} },
    });
  }
}
