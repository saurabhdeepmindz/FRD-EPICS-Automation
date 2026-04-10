import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaExecutionStatus } from '@prisma/client';
import archiver from 'archiver';
import { PassThrough } from 'stream';

@Injectable()
export class BaExportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateExportZip(projectId: string): Promise<{ stream: PassThrough; fileName: string }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      include: {
        modules: {
          include: {
            screens: { orderBy: { displayOrder: 'asc' } },
            flows: true,
            skillExecutions: {
              where: { status: { in: [BaExecutionStatus.APPROVED, BaExecutionStatus.AWAITING_REVIEW, BaExecutionStatus.COMPLETED] } },
              orderBy: { createdAt: 'desc' },
            },
            artifacts: { include: { sections: true } },
            tbdFutureEntries: true,
          },
        },
        rtmRows: { orderBy: [{ moduleId: 'asc' }, { featureId: 'asc' }] },
      },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const passThrough = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(passThrough);

    const prefix = `${project.projectCode}-ba-artifacts`;

    // ─── Per-module artifacts ──────────────────────────────────────────

    for (const mod of project.modules) {
      const modDir = `${prefix}/${mod.moduleId}-${sanitize(mod.moduleName)}`;

      // Screen Inventory
      const screenInventory = this.buildScreenInventory(mod);
      archive.append(screenInventory, { name: `${modDir}/Screen-Inventory.md` });

      // Click-through flows
      if (mod.flows.length > 0) {
        const flowsMd = this.buildFlowsDocument(mod);
        archive.append(flowsMd, { name: `${modDir}/Navigation-Flows.md` });
      }

      // Skill outputs (human documents)
      for (const exec of mod.skillExecutions) {
        if (exec.humanDocument) {
          const skillDir = this.skillDirName(exec.skillName);
          archive.append(exec.humanDocument, {
            name: `${modDir}/${skillDir}/${exec.skillName}-output.md`,
          });
        }
        if (exec.handoffPacket) {
          const skillDir = this.skillDirName(exec.skillName);
          archive.append(JSON.stringify(exec.handoffPacket, null, 2), {
            name: `${modDir}/${skillDir}/${exec.skillName}-handoff.json`,
          });
        }
      }

      // Artifacts with sections
      for (const artifact of mod.artifacts) {
        const artifactDir = `${modDir}/${artifact.artifactType}`;
        let md = `# ${artifact.artifactId}\n\n`;
        md += `Type: ${artifact.artifactType}\n`;
        md += `Status: ${artifact.status}\n`;
        if (artifact.approvedAt) md += `Approved: ${artifact.approvedAt}\n`;
        md += `\n---\n\n`;

        for (const section of artifact.sections) {
          const content = section.isHumanModified && section.editedContent
            ? section.editedContent
            : section.content;
          md += `## ${section.sectionLabel}\n\n`;
          if (section.isHumanModified) md += `> *Human-edited*\n\n`;
          md += `${content}\n\n`;
        }

        archive.append(md, { name: `${artifactDir}/${artifact.artifactId}.md` });
      }

      // TBD-Future entries for this module
      if (mod.tbdFutureEntries.length > 0) {
        const tbdMd = this.buildTbdDocument(mod.tbdFutureEntries);
        archive.append(tbdMd, { name: `${modDir}/TBD-Future-Registry.md` });
      }
    }

    // ─── Project-level files ──────────────────────────────────────────

    // RTM as CSV
    if (project.rtmRows.length > 0) {
      const csv = this.buildRtmCsv(project.rtmRows);
      archive.append(csv, { name: `${prefix}/RTM/Master-RTM.csv` });
    }

    // RTM as Markdown
    if (project.rtmRows.length > 0) {
      const md = this.buildRtmMarkdown(project.rtmRows, project.projectCode);
      archive.append(md, { name: `${prefix}/RTM/Master-RTM.md` });
    }

    // Project-wide TBD-Future Registry
    const allTbd = project.modules.flatMap((m) => m.tbdFutureEntries);
    if (allTbd.length > 0) {
      const tbdMd = this.buildTbdDocument(allTbd);
      archive.append(tbdMd, { name: `${prefix}/TBD-Future-Registry.md` });
    }

    // Project summary
    const summary = this.buildProjectSummary(project);
    archive.append(summary, { name: `${prefix}/PROJECT-SUMMARY.md` });

    await archive.finalize();

    return {
      stream: passThrough,
      fileName: `${project.projectCode}-ba-artifacts.zip`,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private buildScreenInventory(mod: {
    moduleId: string; moduleName: string;
    screens: { screenId: string; screenTitle: string; screenType: string | null; textDescription: string | null; audioTranscript: string | null; aiFormattedTranscript: string | null; transcriptReviewed: boolean; aiTranscriptReviewed: boolean }[];
  }): string {
    let md = `# Screen Inventory — ${mod.moduleId} ${mod.moduleName}\n\n`;
    md += `| # | Screen ID | Title | Type | Text Desc | Audio | AI Formatted |\n`;
    md += `|---|-----------|-------|------|-----------|-------|-------------|\n`;
    for (let i = 0; i < mod.screens.length; i++) {
      const s = mod.screens[i];
      md += `| ${i + 1} | ${s.screenId} | ${s.screenTitle} | ${s.screenType ?? '—'} | ${s.textDescription ? 'Yes' : '—'} | ${s.transcriptReviewed ? 'Confirmed' : s.audioTranscript ? 'Draft' : '—'} | ${s.aiTranscriptReviewed ? 'Confirmed' : s.aiFormattedTranscript ? 'Draft' : '—'} |\n`;
    }
    md += `\n---\n\n`;

    // Include descriptions
    for (const s of mod.screens) {
      md += `## ${s.screenId}: ${s.screenTitle}\n\n`;
      if (s.textDescription) md += `### Text Description\n${s.textDescription}\n\n`;
      if (s.aiFormattedTranscript) md += `### AI-Formatted Audio Description\n${s.aiFormattedTranscript}\n\n`;
      else if (s.audioTranscript) md += `### Audio Transcript\n${s.audioTranscript}\n\n`;
    }
    return md;
  }

  private buildFlowsDocument(mod: { moduleId: string; moduleName: string; flows: { flowName: string; steps: unknown }[] }): string {
    let md = `# Navigation Flows — ${mod.moduleId} ${mod.moduleName}\n\n`;
    for (const flow of mod.flows) {
      md += `## ${flow.flowName}\n\n`;
      const steps = flow.steps as { screenId: string; triggerLabel: string; outcome?: string }[];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        md += `${i + 1}. **${step.screenId}**\n`;
        if (step.triggerLabel && i < steps.length - 1) md += `   → Trigger: ${step.triggerLabel}\n`;
        if (step.outcome && i === steps.length - 1) md += `   → Outcome: ${step.outcome}\n`;
      }
      md += `\n`;
    }
    return md;
  }

  private buildTbdDocument(entries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; assumedInterface: string; resolutionTrigger: string; appearsInFeatures: string[]; isResolved: boolean; resolvedInterface: string | null }[]): string {
    let md = `# TBD-Future Integration Registry\n\n`;
    md += `| Registry ID | Integration | Classification | Ref Module | Resolution Trigger | Resolved |\n`;
    md += `|------------|-------------|---------------|------------|-------------------|----------|\n`;
    for (const e of entries) {
      md += `| ${e.registryId} | ${e.integrationName} | ${e.classification} | ${e.referencedModule ?? '—'} | ${e.resolutionTrigger} | ${e.isResolved ? 'Yes' : 'No'} |\n`;
    }
    md += `\n---\n\n`;
    for (const e of entries) {
      md += `## ${e.registryId}: ${e.integrationName}\n\n`;
      md += `- Classification: ${e.classification}\n`;
      md += `- Referenced Module: ${e.referencedModule ?? 'N/A'}\n`;
      md += `- Appears in: ${e.appearsInFeatures.join(', ') || 'N/A'}\n`;
      md += `- Resolution Trigger: ${e.resolutionTrigger}\n`;
      md += `- Resolved: ${e.isResolved ? 'Yes' : 'No'}\n\n`;
      md += `### Assumed Interface\n\`\`\`\n${e.assumedInterface}\n\`\`\`\n\n`;
      if (e.resolvedInterface) {
        md += `### Confirmed Interface\n\`\`\`\n${e.resolvedInterface}\n\`\`\`\n\n`;
      }
    }
    return md;
  }

  private buildRtmCsv(rows: { moduleId: string; moduleName: string; packageName: string; featureId: string; featureName: string; featureStatus: string; priority: string; screenRef: string; epicId: string | null; epicName: string | null; storyId: string | null; storyName: string | null; storyType: string | null; storyStatus: string | null; primaryClass: string | null; sourceFile: string | null; subtaskId: string | null; subtaskTeam: string | null; methodName: string | null; testCaseIds: string[]; integrationStatus: string | null; tbdFutureRef: string | null; tbdResolved: boolean }[]): string {
    const headers = ['Module ID', 'Module Name', 'Package', 'Feature ID', 'Feature Name', 'Status', 'Priority', 'Screen', 'EPIC ID', 'EPIC Name', 'Story ID', 'Story Name', 'Story Type', 'Story Status', 'Class', 'Source File', 'SubTask', 'Team', 'Method', 'Test Cases', 'Integration', 'TBD-Future', 'Resolved'];
    const csvRows = rows.map((r) => [
      r.moduleId, r.moduleName, r.packageName, r.featureId, r.featureName, r.featureStatus, r.priority, r.screenRef,
      r.epicId ?? '', r.epicName ?? '', r.storyId ?? '', r.storyName ?? '', r.storyType ?? '', r.storyStatus ?? '',
      r.primaryClass ?? '', r.sourceFile ?? '', r.subtaskId ?? '', r.subtaskTeam ?? '', r.methodName ?? '',
      (r.testCaseIds ?? []).join('; '), r.integrationStatus ?? '', r.tbdFutureRef ?? '', r.tbdResolved ? 'Yes' : 'No',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [headers.join(','), ...csvRows].join('\n');
  }

  private buildRtmMarkdown(rows: { moduleId: string; featureId: string; featureName: string; featureStatus: string; priority: string; epicId: string | null; storyId: string | null; storyType: string | null; subtaskId: string | null; subtaskTeam: string | null; tbdFutureRef: string | null; tbdResolved: boolean }[], projectCode: string): string {
    let md = `# Master RTM — ${projectCode}\n\n`;
    md += `| Module | Feature ID | Feature | Status | Priority | EPIC | Story | Type | SubTask | Team | TBD |\n`;
    md += `|--------|-----------|---------|--------|----------|------|-------|------|---------|------|-----|\n`;
    for (const r of rows) {
      md += `| ${r.moduleId} | ${r.featureId} | ${r.featureName} | ${r.featureStatus} | ${r.priority} | ${r.epicId ?? '—'} | ${r.storyId ?? '—'} | ${r.storyType ?? '—'} | ${r.subtaskId ?? '—'} | ${r.subtaskTeam ?? '—'} | ${r.tbdFutureRef ? `${r.tbdFutureRef}${r.tbdResolved ? ' ✓' : ''}` : '—'} |\n`;
    }
    return md;
  }

  private buildProjectSummary(project: {
    name: string; projectCode: string; description: string | null; status: string;
    modules: { moduleId: string; moduleName: string; moduleStatus: string; screens: unknown[]; artifacts: unknown[]; skillExecutions: unknown[] }[];
    rtmRows: unknown[];
  }): string {
    let md = `# Project Summary — ${project.projectCode}\n\n`;
    md += `- **Name:** ${project.name}\n`;
    md += `- **Code:** ${project.projectCode}\n`;
    md += `- **Status:** ${project.status}\n`;
    if (project.description) md += `- **Description:** ${project.description}\n`;
    md += `- **Modules:** ${project.modules.length}\n`;
    md += `- **RTM Rows:** ${project.rtmRows.length}\n\n`;
    md += `## Modules\n\n`;
    md += `| Module ID | Name | Status | Screens | Artifacts | Executions |\n`;
    md += `|-----------|------|--------|---------|-----------|------------|\n`;
    for (const m of project.modules) {
      md += `| ${m.moduleId} | ${m.moduleName} | ${m.moduleStatus} | ${m.screens.length} | ${m.artifacts.length} | ${m.skillExecutions.length} |\n`;
    }
    return md;
  }

  private skillDirName(skillName: string): string {
    const map: Record<string, string> = {
      'SKILL-00': 'Screen-Analysis',
      'SKILL-01-S': 'FRD',
      'SKILL-02-S': 'EPICs',
      'SKILL-04': 'UserStories',
      'SKILL-05': 'SubTasks',
    };
    return map[skillName] ?? skillName;
  }
}

function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}
