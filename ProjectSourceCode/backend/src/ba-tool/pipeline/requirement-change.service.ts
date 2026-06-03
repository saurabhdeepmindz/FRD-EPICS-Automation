import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';

export interface ModuleImpact {
  moduleId: string;
  moduleName: string;
  epics: number;
  stories: number;
  subtasks: number;
  lld: number;
  rtmRows: number;
}

/** T-01 — project-scoped artifact downstream of the changed requirement. */
export interface ProjectArtifactImpact {
  type: 'HLD' | 'E2E_FLOW';
  label: string;
}

export interface RequirementChangeImpact {
  source: 'PRD' | 'HLD';
  sectionKey: string;
  sectionName: string;
  /** True when downstream artifacts exist that may need review. */
  hasImpact: boolean;
  modules: ModuleImpact[];
  /** Project-scoped downstream artifacts (HLD downstream of PRD; E2E of both). */
  projectArtifacts: ProjectArtifactImpact[];
  totalDownstream: number;
  reportPaths: string[];
  timestamp: string;
}

/**
 * I-01/I-02 — when an upstream requirement document (PRD+FRD or HLD) section is
 * edited *after* downstream artifacts exist, compute which module artifacts
 * (EPICs / Stories / Sub-Tasks / LLD) may be impacted, write a change-impact
 * report (MD + CSV) to `ProjectArtifacts/10-RTM/`, and log it to CHANGELOG.
 *
 * Read-only on the DB (no new model). The mapping from a project-level section
 * to specific artifacts is intentionally coarse — a PRD/HLD change is
 * project-wide, so every module's downstream artifacts are flagged for review.
 */
@Injectable()
export class RequirementChangeService {
  private readonly logger = new Logger(RequirementChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFolders: ProjectFolderService,
  ) {}

  async analyzeChange(
    projectId: string,
    source: 'PRD' | 'HLD',
    sectionKey: string,
    sectionName: string,
    timestamp: string,
  ): Promise<RequirementChangeImpact | null> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) return null;

    const modules = await this.prisma.baModule.findMany({
      where: { projectId },
      orderBy: { moduleId: 'asc' },
      select: { id: true, moduleId: true, moduleName: true },
    });
    if (!modules.length) return null;

    const moduleIds = modules.map((m) => m.id);
    const [artifacts, rtmCounts] = await Promise.all([
      this.prisma.baArtifact.findMany({
        where: { moduleDbId: { in: moduleIds } },
        select: { moduleDbId: true, artifactType: true },
      }),
      this.prisma.baRtmRow.groupBy({
        by: ['moduleId'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map<string, { epics: number; stories: number; subtasks: number; lld: number }>();
    for (const m of modules) counts.set(m.id, { epics: 0, stories: 0, subtasks: 0, lld: 0 });
    for (const a of artifacts) {
      const c = counts.get(a.moduleDbId);
      if (!c) continue;
      if (a.artifactType === 'EPIC') c.epics++;
      else if (a.artifactType === 'USER_STORY') c.stories++;
      else if (a.artifactType === 'SUBTASK') c.subtasks++;
      else if (a.artifactType === 'LLD') c.lld++;
    }
    const rtmByModuleId = new Map(rtmCounts.map((r) => [r.moduleId, r._count._all]));

    const impacted: ModuleImpact[] = modules
      .map((m) => {
        const c = counts.get(m.id)!;
        return {
          moduleId: m.moduleId,
          moduleName: m.moduleName,
          epics: c.epics,
          stories: c.stories,
          subtasks: c.subtasks,
          lld: c.lld,
          rtmRows: rtmByModuleId.get(m.moduleId) ?? 0,
        };
      })
      .filter((m) => m.epics + m.stories + m.subtasks + m.lld + m.rtmRows > 0);

    const totalDownstream = impacted.reduce(
      (sum, m) => sum + m.epics + m.stories + m.subtasks + m.lld,
      0,
    );

    // T-01 — project-scoped artifacts downstream of this change: a PRD change can
    // affect the HLD and every E2E flow; an HLD change affects the E2E flows.
    const projectArtifacts: ProjectArtifactImpact[] = [];
    const [latestHld, e2eFlows] = await Promise.all([
      source === 'PRD'
        ? this.prisma.baHld.findFirst({ where: { projectId }, orderBy: { version: 'desc' }, select: { version: true } })
        : Promise.resolve(null),
      this.prisma.baE2eFlow.findMany({ where: { projectId }, select: { flowKey: true, flowName: true } }),
    ]);
    if (latestHld) projectArtifacts.push({ type: 'HLD', label: `HLD v${latestHld.version}` });
    for (const f of e2eFlows) projectArtifacts.push({ type: 'E2E_FLOW', label: f.flowName || f.flowKey });

    // No downstream artifacts at all → no impact to report (edit is harmless).
    if (!impacted.length && !projectArtifacts.length) {
      return {
        source, sectionKey, sectionName, hasImpact: false,
        modules: [], projectArtifacts: [], totalDownstream: 0, reportPaths: [], timestamp,
      };
    }

    const reportPaths = await this.writeReports(project.name, source, sectionKey, sectionName, impacted, projectArtifacts, timestamp);

    await this.projectFolders
      .appendChangelog(project.name, {
        summary: `Requirement change: ${source} §${sectionKey} "${sectionName}" edited — ${totalDownstream} downstream artifact(s) across ${impacted.length} module(s) flagged for review.`,
        affectedArtifacts: impacted.map((m) => m.moduleId),
        source: 'requirement change (upstream→downstream)',
        timestamp,
      })
      .catch((e) => this.logger.warn(`CHANGELOG append failed: ${String(e)}`));

    this.logger.log(
      `Requirement change impact: ${source} §${sectionKey} → ${impacted.length} module(s), ${projectArtifacts.length} project artifact(s)`,
    );
    return {
      source, sectionKey, sectionName, hasImpact: true,
      modules: impacted, projectArtifacts, totalDownstream, reportPaths, timestamp,
    };
  }

  private async writeReports(
    projectName: string,
    source: string,
    sectionKey: string,
    sectionName: string,
    impacted: ModuleImpact[],
    projectArtifacts: ProjectArtifactImpact[],
    timestamp: string,
  ): Promise<string[]> {
    const stamp = timestamp.replace(/[:.]/g, '-');
    const base = `change-impact-${source}-sec${sectionKey}-${stamp}`;

    const md: string[] = [
      `# Requirement Change Impact — ${source} §${sectionKey} ${sectionName}`,
      ``,
      `> **Project:** ${projectName}`,
      `> **Changed:** ${timestamp}`,
      ``,
      `A change to ${source} section "${sectionName}" may impact the downstream artifacts below. ` +
        `Review each module and regenerate EPICs / Stories / Sub-Tasks / LLD where the change applies.`,
      ``,
      `| Module | EPICs | User Stories | Sub-Tasks | LLD | RTM rows |`,
      `|---|---|---|---|---|---|`,
      ...impacted.map(
        (m) => `| ${m.moduleId} · ${m.moduleName} | ${m.epics} | ${m.stories} | ${m.subtasks} | ${m.lld} | ${m.rtmRows} |`,
      ),
      ``,
    ];

    if (projectArtifacts.length) {
      md.push(
        `## Project-scoped artifacts flagged`,
        ``,
        `These were built from an earlier version and may need review/regeneration:`,
        ``,
        ...projectArtifacts.map((a) => `- **${a.type}** — ${a.label}`),
        ``,
      );
    }

    const csv: string[] = [
      `moduleId,moduleName,epics,userStories,subtasks,lld,rtmRows`,
      ...impacted.map(
        (m) => `${m.moduleId},"${m.moduleName.replace(/"/g, '""')}",${m.epics},${m.stories},${m.subtasks},${m.lld},${m.rtmRows}`,
      ),
    ];

    const mdPath = await this.projectFolders.writeArtifactFile(projectName, '10-RTM', `${base}.md`, md.join('\n'));
    const csvPath = await this.projectFolders.writeArtifactFile(projectName, '10-RTM', `${base}.csv`, csv.join('\n'));
    return [mdPath, csvPath];
  }
}
