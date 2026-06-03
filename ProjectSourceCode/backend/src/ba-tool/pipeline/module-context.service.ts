import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { flattenSections } from './section-normalizer';

/** A subtask reduced to the fields that matter for code-task planning + linkage. */
export interface ModuleSubtaskRef {
  subtaskId: string;
  subtaskName: string;
  subtaskType: string | null;
  team: string | null;
  userStoryId: string | null;
  epicId: string | null;
  prerequisites: string[];
  sourceFileName: string | null;
  className: string | null;
  methodName: string | null;
}

/** A scaffolded pseudo file — path the agent can Read from `cwd`, plus language. */
export interface ModulePseudoRef {
  path: string;
  language: string;
}

export interface ModuleContext {
  moduleDbId: string;
  moduleId: string;
  moduleName: string;
  /** Full grounding text for the agent (PRD+FRD, HLD, EPICs, Stories, subtasks, LLD). */
  text: string;
  /** Structured subtasks (sequence honored via `prerequisites`) — reused by O-02. */
  subtasks: ModuleSubtaskRef[];
  /** Pseudo-file paths for this module — reused by O-02 linkage + P-04 dynamic detection. */
  pseudoFiles: ModulePseudoRef[];
}

/**
 * N-03 — assembles a **module-scoped** grounding context for `/prd` `/dev`.
 *
 * Keeps project-level PRD+FRD and HLD as shared grounding, but narrows EPICs,
 * User Stories, Sub-Tasks and LLD to the selected module. Sub-tasks are emitted
 * as a linkage-rich summary (id · type · team · prerequisites · source file),
 * not their full 24 sections — modules can carry hundreds of subtasks, so the
 * full detail stays on disk where the agent can Read it on demand. Pseudo files
 * are listed by path (the agent reads contents from `cwd`).
 */
@Injectable()
export class ModuleContextService {
  private readonly logger = new Logger(ModuleContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildModuleContext(
    projectId: string,
    moduleDbId: string,
  ): Promise<ModuleContext | null> {
    const module = await this.prisma.baModule.findFirst({
      where: { id: moduleDbId, projectId },
      select: { id: true, moduleId: true, moduleName: true },
    });
    if (!module) return null;

    const [prd, hld, artifacts, subtasks, pseudoFiles] = await Promise.all([
      this.prisma.baProjectPrd.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true, sections: true },
      }),
      this.prisma.baHld.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true, sections: true, mermaidDiagrams: true },
      }),
      this.prisma.baArtifact.findMany({
        where: {
          moduleDbId,
          artifactType: { in: ['EPIC', 'USER_STORY', 'LLD'] },
        },
        select: {
          artifactType: true,
          artifactId: true,
          sections: {
            orderBy: { createdAt: 'asc' },
            select: { sectionLabel: true, content: true, editedContent: true },
          },
        },
      }),
      this.prisma.baSubTask.findMany({
        where: { moduleDbId },
        orderBy: { subtaskId: 'asc' },
        select: {
          subtaskId: true, subtaskName: true, subtaskType: true, team: true,
          userStoryId: true, epicId: true, prerequisites: true,
          sourceFileName: true, className: true, methodName: true,
        },
      }),
      this.prisma.baPseudoFile.findMany({
        where: { artifact: { moduleDbId } },
        orderBy: { path: 'asc' },
        select: { path: true, language: true },
      }),
    ]);

    const byType = (t: string) => artifacts.filter((a) => a.artifactType === t);

    let text = `# Module Code-Gen Context — ${module.moduleName} (${module.moduleId})\n\n`;
    text += `> Scope: generate/evolve code for **this module only**. Project-level PRD+FRD and HLD are shared grounding.\n\n---\n\n`;

    text += `## 1 · PRD + FRD (project)\n\n`;
    text += prd
      ? `_PRD v${prd.version}. Section "functionalRequirements" is the FRD._\n\n${renderSections(flattenSections(prd.sections as Record<string, unknown>))}\n`
      : `_No project PRD yet._\n\n`;

    text += `## 2 · HLD (project)\n\n`;
    if (hld) {
      text += `_HLD v${hld.version}._\n\n${renderSections(flattenSections(hld.sections as Record<string, unknown>))}\n`;
      const diagrams = (hld.mermaidDiagrams as Record<string, string>) ?? {};
      for (const [name, src] of Object.entries(diagrams)) {
        text += `### Diagram: ${name}\n\n\`\`\`mermaid\n${src}\n\`\`\`\n\n`;
      }
    } else {
      text += `_No HLD yet._\n\n`;
    }

    text += `## 3 · EPICs (${module.moduleId})\n\n${renderArtifacts(byType('EPIC'))}\n`;
    text += `## 4 · User Stories (${module.moduleId})\n\n${renderArtifacts(byType('USER_STORY'))}\n`;

    text += `## 5 · Sub-Tasks (${module.moduleId}) — implement in prerequisite order\n\n`;
    text += renderSubtaskTable(subtasks);

    text += `\n## 6 · LLD (${module.moduleId})\n\n${renderArtifacts(byType('LLD'))}\n`;

    text += `## 7 · Pseudo Files (${module.moduleId}) — scaffolded under ProjectSourceCode/, Read them on demand\n\n`;
    text += pseudoFiles.length
      ? pseudoFiles.map((p) => `- \`${p.path}\` (${p.language})`).join('\n') + '\n'
      : '_No pseudo files scaffolded._\n';

    return {
      moduleDbId: module.id,
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      text: text.trim(),
      subtasks,
      pseudoFiles,
    };
  }
}

// ── renderers (module-local, no side effects) ────────────────────────────────

function renderSections(sections: Record<string, unknown>): string {
  const keys = Object.keys(sections).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  let out = '';
  for (const k of keys) {
    out += `### ${k}\n\n`;
    const body = sections[k];
    if (body && typeof body === 'object') {
      for (const [fk, fv] of Object.entries(body as Record<string, unknown>)) {
        out += typeof fv === 'string'
          ? `**${fk}:** ${fv}\n\n`
          : `**${fk}:**\n\n\`\`\`json\n${JSON.stringify(fv, null, 2)}\n\`\`\`\n\n`;
      }
    } else {
      out += `${String(body)}\n\n`;
    }
  }
  return out || '_empty_\n';
}

function renderArtifacts(
  artifacts: Array<{
    artifactId: string;
    sections: Array<{ sectionLabel: string; content: string; editedContent: string | null }>;
  }>,
): string {
  if (!artifacts.length) return '_none for this module_\n';
  let out = '';
  for (const a of artifacts) {
    out += `### ${a.artifactId}\n\n`;
    for (const s of a.sections) {
      out += `**${s.sectionLabel}**\n\n${s.editedContent ?? s.content}\n\n`;
    }
  }
  return out;
}

function renderSubtaskTable(subtasks: ModuleSubtaskRef[]): string {
  if (!subtasks.length) return '_no sub-tasks for this module_\n';
  let out = `| SubTask | Name | Type | Team | Story | Prerequisites | Source File | Class.Method |\n`;
  out += `|---|---|---|---|---|---|---|---|\n`;
  for (const s of subtasks) {
    const cm = [s.className, s.methodName].filter(Boolean).join('.') || '';
    out += `| ${s.subtaskId} | ${(s.subtaskName ?? '').slice(0, 60)} | ${s.subtaskType ?? ''} | ${s.team ?? ''} | ${s.userStoryId ?? ''} | ${(s.prerequisites ?? []).join(', ')} | ${s.sourceFileName ?? ''} | ${cm} |\n`;
  }
  return out;
}
