import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { flattenSections } from './section-normalizer';

/**
 * The seven context-engineering markdown files in `ProjectSourceCode/.context/`.
 * They give the /prd and /dev skills the full upstream picture without re-querying
 * the database. Order is upstream → downstream.
 */
export const CONTEXT_FILES = [
  { file: 'REQUIREMENTS.md', title: 'Requirements (PRD + FRD)', source: 'BaProjectPrd' },
  { file: 'HLD.md', title: 'High Level Design', source: 'BaHld' },
  { file: 'RTM.md', title: 'Requirements Traceability Matrix', source: 'BaRtmRow' },
  { file: 'EPICS.md', title: 'EPICs', source: '06-EPICs' },
  { file: 'USER_STORIES.md', title: 'User Stories', source: '07-UserStories' },
  { file: 'SUBTASKS.md', title: 'Sub-Tasks', source: '08-SubTasks' },
  { file: 'LLD.md', title: 'Low Level Design', source: '09-LLD' },
] as const;

export type ContextFileName = (typeof CONTEXT_FILES)[number]['file'];

/**
 * Assembles the `.context/` folder for a project's `ProjectSourceCode/`.
 *
 * H-04: assembles REAL content from the live DB artifacts (PRD+FRD, HLD, RTM)
 * and the mirrored ProjectArtifacts markdown (EPICs, Stories, SubTasks, LLD).
 * Falls back to a clear placeholder when an upstream artifact doesn't exist yet,
 * so the file layout is always present and navigable.
 */
@Injectable()
export class ContextEngineeringService {
  private readonly logger = new Logger(ContextEngineeringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  /**
   * (Re)generate the seven `.context/` files for a project from live artifacts.
   * Idempotent. Kept under the name `seedContextFiles` so the existing endpoint
   * still works; it now writes real content (H-04) instead of placeholders (S-07).
   */
  async seedContextFiles(projectId: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, projectCode: true },
    });
    if (!project) return null;

    await this.projectFolders.ensureProjectFolders(project.name);

    const bodies: Record<ContextFileName, string> = {
      'REQUIREMENTS.md': await this.buildRequirements(projectId, project),
      'HLD.md': await this.buildHld(projectId, project),
      'RTM.md': await this.buildRtm(projectId, project),
      'EPICS.md': await this.buildFromArtifacts(project.name, '06-EPICs', 'EPICs'),
      'USER_STORIES.md': await this.buildFromArtifacts(project.name, '07-UserStories', 'User Stories'),
      'SUBTASKS.md': await this.buildFromArtifacts(project.name, '08-SubTasks', 'Sub-Tasks'),
      'LLD.md': await this.buildFromArtifacts(project.name, '09-LLD', 'Low Level Design'),
    };

    const written: string[] = [];
    for (const meta of CONTEXT_FILES) {
      const full = await this.projectFolders.writeContextFile(project.name, meta.file, bodies[meta.file]);
      written.push(full);
    }

    await this.prisma.baProjectImplementation
      .updateMany({ where: { projectId }, data: { contextEngineeringStatus: 'COMPLETE', lastContextRefreshedAt: new Date() } })
      .catch(() => undefined);

    this.logger.log(`Assembled ${written.length} .context files for "${project.name}"`);
    return { projectName: project.name, files: written };
  }

  // ── builders ─────────────────────────────────────────────────────────────

  private header(title: string, project: { name: string; projectCode: string }, source: string): string {
    return (
      `# ${title}\n\n` +
      `> **Project:** ${project.name} (${project.projectCode})\n` +
      `> **Source:** ${source}\n` +
      `> **Generated:** context-engineering bundle for /prd + /dev\n\n---\n\n`
    );
  }

  private async buildRequirements(
    projectId: string,
    project: { name: string; projectCode: string },
  ): Promise<string> {
    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true, sections: true },
    });
    let body = this.header('Requirements (PRD + FRD)', project, 'BaProjectPrd');
    if (!prd) {
      return body + '_No project-level PRD generated yet. Generate it in Stage 2 (PRD + FRD)._\n';
    }
    body += `_PRD version ${prd.version}. Section 6 is the FRD._\n\n`;
    body += this.renderSectionsObject(prd.sections as Record<string, unknown>);
    return body;
  }

  private async buildHld(
    projectId: string,
    project: { name: string; projectCode: string },
  ): Promise<string> {
    const hld = await this.prisma.baHld.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true, sections: true, mermaidDiagrams: true },
    });
    let body = this.header('High Level Design', project, 'BaHld');
    if (!hld) {
      return body + '_No HLD generated yet. Generate it in Stage 5 (HLD)._\n';
    }
    body += `_HLD version ${hld.version}._\n\n`;
    body += this.renderSectionsObject(hld.sections as Record<string, unknown>);
    const diagrams = (hld.mermaidDiagrams as Record<string, string>) ?? {};
    if (Object.keys(diagrams).length) {
      body += `\n## Architecture Diagrams (Mermaid)\n\n`;
      for (const [name, src] of Object.entries(diagrams)) {
        body += `### ${name}\n\n\`\`\`mermaid\n${src}\n\`\`\`\n\n`;
      }
    }
    return body;
  }

  private async buildRtm(
    projectId: string,
    project: { name: string; projectCode: string },
  ): Promise<string> {
    const rows = await this.prisma.baRtmRow.findMany({
      where: { projectId },
      orderBy: [{ moduleId: 'asc' }, { featureId: 'asc' }],
      select: {
        moduleId: true, featureId: true, featureName: true, epicId: true,
        storyId: true, subtaskId: true, layer: true,
      },
    });
    let body = this.header('Requirements Traceability Matrix', project, 'BaRtmRow');
    if (!rows.length) {
      return body + '_No RTM rows yet. They populate as EPICs → Stories → SubTasks → LLD are generated._\n';
    }
    body += `| Module | Feature | Name | EPIC | Story | SubTask | Layer |\n`;
    body += `|---|---|---|---|---|---|---|\n`;
    for (const r of rows) {
      body += `| ${r.moduleId} | ${r.featureId} | ${(r.featureName ?? '').slice(0, 50)} | ${r.epicId ?? ''} | ${r.storyId ?? ''} | ${r.subtaskId ?? ''} | ${r.layer ?? ''} |\n`;
    }
    return body;
  }

  /** Concatenate the mirrored ProjectArtifacts markdown files for a stage. */
  private async buildFromArtifacts(
    projectName: string,
    subfolder: string,
    title: string,
  ): Promise<string> {
    const paths = this.projectFolders.resolvePaths(projectName);
    const dir = path.join(paths.artifacts, subfolder);
    let body = `# ${title}\n\n> **Source:** ProjectArtifacts/${subfolder}/\n\n---\n\n`;
    try {
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md')).sort();
      if (!files.length) {
        return body + `_No ${title} generated yet._\n`;
      }
      for (const f of files) {
        const content = await fs.readFile(path.join(dir, f), 'utf8');
        body += `\n<!-- ${f} -->\n${content}\n\n`;
      }
      return body;
    } catch {
      return body + `_No ${title} generated yet._\n`;
    }
  }

  /**
   * Render a sections JSON object (numbered or keyed) as readable markdown.
   * Each section becomes a `##` block; field values render as key/value lines,
   * with arrays/objects shown as fenced JSON.
   */
  private renderSectionsObject(rawSections: Record<string, unknown>): string {
    // F2 seam: flatten structured fields to flat text before rendering REQUIREMENTS.md.
    const sections = flattenSections(rawSections);
    const keys = Object.keys(sections);
    // numeric-first sort so "1".."22" order, otherwise alpha
    keys.sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    let out = '';
    for (const k of keys) {
      out += `## ${k}\n\n`;
      const body = sections[k];
      if (body && typeof body === 'object') {
        for (const [fk, fv] of Object.entries(body as Record<string, unknown>)) {
          if (typeof fv === 'string') {
            out += `**${fk}:** ${fv}\n\n`;
          } else {
            out += `**${fk}:**\n\n\`\`\`json\n${JSON.stringify(fv, null, 2)}\n\`\`\`\n\n`;
          }
        }
      } else {
        out += `${String(body)}\n\n`;
      }
    }
    return out;
  }
}
