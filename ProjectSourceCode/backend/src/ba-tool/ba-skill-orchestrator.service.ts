import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaExecutionStatus, BaModuleStatus, BaArtifactType, BaArtifactStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/** Skill names in execution order */
export const SKILL_ORDER = [
  'SKILL-00',    // Screen Analysis
  'SKILL-01-S',  // FRD from Screens
  'SKILL-02-S',  // EPICs from Screens
  'SKILL-04',    // User Stories
  'SKILL-05',    // SubTasks
] as const;

export type SkillName = (typeof SKILL_ORDER)[number];

/** Maps skill name to the module status it sets on completion */
const SKILL_STATUS_MAP: Record<SkillName, BaModuleStatus> = {
  'SKILL-00': BaModuleStatus.ANALYSIS_COMPLETE,
  'SKILL-01-S': BaModuleStatus.FRD_COMPLETE,
  'SKILL-02-S': BaModuleStatus.EPICS_COMPLETE,
  'SKILL-04': BaModuleStatus.STORIES_COMPLETE,
  'SKILL-05': BaModuleStatus.SUBTASKS_COMPLETE,
};

/** Maps skill name to the artifact type it produces */
const SKILL_ARTIFACT_MAP: Record<SkillName, BaArtifactType> = {
  'SKILL-00': BaArtifactType.SCREEN_ANALYSIS,
  'SKILL-01-S': BaArtifactType.FRD,
  'SKILL-02-S': BaArtifactType.EPIC,
  'SKILL-04': BaArtifactType.USER_STORY,
  'SKILL-05': BaArtifactType.SUBTASK,
};

/** Maps skill name to required prerequisite module status */
const SKILL_PREREQ_MAP: Record<SkillName, BaModuleStatus> = {
  'SKILL-00': BaModuleStatus.SCREENS_UPLOADED,
  'SKILL-01-S': BaModuleStatus.ANALYSIS_COMPLETE,
  'SKILL-02-S': BaModuleStatus.FRD_COMPLETE,
  'SKILL-04': BaModuleStatus.EPICS_COMPLETE,
  'SKILL-05': BaModuleStatus.STORIES_COMPLETE,
};

@Injectable()
export class BaSkillOrchestratorService {
  private readonly logger = new Logger(BaSkillOrchestratorService.name);
  private readonly aiServiceUrl: string;
  private readonly skillFilesDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
    // Skill files are at project root Master-Documents-Skills/ or Screen-FRD-EPICS-Automation-Skills/
    this.skillFilesDir = path.resolve(__dirname, '..', '..', '..', '..', 'Screen-FRD-EPICS-Automation-Skills');
  }

  // ─── Execute a skill ───────────────────────────────────────────────────

  async executeSkill(moduleDbId: string, skillName: SkillName): Promise<string> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // Validate prerequisite
    this.validatePrerequisite(mod.moduleStatus, skillName);

    // Create execution record
    const execution = await this.prisma.baSkillExecution.create({
      data: {
        moduleDbId,
        skillName,
        status: BaExecutionStatus.PENDING,
      },
    });

    // Run async — return execution ID immediately for polling/SSE
    this.runSkillAsync(execution.id, moduleDbId, skillName).catch((err) => {
      this.logger.error(`Skill ${skillName} failed for module ${moduleDbId}: ${err.message}`);
    });

    return execution.id;
  }

  private validatePrerequisite(currentStatus: BaModuleStatus, skillName: SkillName): void {
    const required = SKILL_PREREQ_MAP[skillName];
    const statusOrder: BaModuleStatus[] = [
      BaModuleStatus.DRAFT,
      BaModuleStatus.SCREENS_UPLOADED,
      BaModuleStatus.ANALYSIS_COMPLETE,
      BaModuleStatus.FRD_COMPLETE,
      BaModuleStatus.EPICS_COMPLETE,
      BaModuleStatus.STORIES_COMPLETE,
      BaModuleStatus.SUBTASKS_COMPLETE,
      BaModuleStatus.APPROVED,
    ];
    const currentIdx = statusOrder.indexOf(currentStatus);
    const requiredIdx = statusOrder.indexOf(required);
    if (currentIdx < requiredIdx) {
      throw new Error(
        `Module status is ${currentStatus} but ${skillName} requires at least ${required}`,
      );
    }
  }

  // ─── Async execution pipeline ──────────────────────────────────────────

  private async runSkillAsync(executionId: string, moduleDbId: string, skillName: SkillName): Promise<void> {
    await this.prisma.baSkillExecution.update({
      where: { id: executionId },
      data: { status: BaExecutionStatus.RUNNING, startedAt: new Date() },
    });

    try {
      // 1. Load skill file content
      const skillPrompt = this.loadSkillFile(skillName);

      // 2. Assemble context packet
      const contextPacket = await this.assembleContext(moduleDbId, skillName);

      // 3. Save context to execution record
      await this.prisma.baSkillExecution.update({
        where: { id: executionId },
        data: { contextPacket: contextPacket as object },
      });

      // 4. Call AI service
      const aiResponse = await this.callAiService(skillPrompt, contextPacket);

      // 5. Parse and store output
      const { humanDocument, handoffPacket } = this.parseAiOutput(aiResponse);

      await this.prisma.baSkillExecution.update({
        where: { id: executionId },
        data: {
          status: BaExecutionStatus.AWAITING_REVIEW,
          rawOutput: aiResponse,
          humanDocument,
          handoffPacket: handoffPacket as object | undefined,
          completedAt: new Date(),
        },
      });

      // 6. Create artifact records
      await this.createArtifactFromOutput(moduleDbId, skillName, humanDocument, handoffPacket);

      // 7. Update module status
      await this.prisma.baModule.update({
        where: { id: moduleDbId },
        data: { moduleStatus: SKILL_STATUS_MAP[skillName], processedAt: new Date() },
      });

      this.logger.log(`Skill ${skillName} completed for module ${moduleDbId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Skill ${skillName} failed: ${message}`);
      await this.prisma.baSkillExecution.update({
        where: { id: executionId },
        data: {
          status: BaExecutionStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
    }
  }

  // ─── Skill file loader ─────────────────────────────────────────────────

  private loadSkillFile(skillName: SkillName): string {
    const fileMap: Record<SkillName, string> = {
      'SKILL-00': 'FINAL-SKILL-00-screen-analysis.md',
      'SKILL-01-S': 'FINAL-SKILL-01-S-create-frd-from-screens.md',
      'SKILL-02-S': 'FINAL-SKILL-02-S-create-epics-from-screens.md',
      'SKILL-04': 'FINAL-SKILL-04-create-user-stories-v2.md',
      'SKILL-05': 'FINAL-SKILL-05-create-subtasks-v2.md',
    };
    const fileName = fileMap[skillName];
    const filePath = path.join(this.skillFilesDir, fileName);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      this.logger.warn(`Skill file not found at ${filePath}, using skill name as prompt`);
      return `Execute ${skillName} skill. Analyse the provided context and produce the required output.`;
    }
  }

  // ─── Context assembly per skill ────────────────────────────────────────

  private async assembleContext(moduleDbId: string, skillName: SkillName): Promise<Record<string, unknown>> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: {
        project: true,
        screens: { orderBy: { displayOrder: 'asc' } },
        flows: true,
        skillExecutions: { where: { status: BaExecutionStatus.APPROVED }, orderBy: { createdAt: 'desc' } },
        tbdFutureEntries: true,
      },
    });
    if (!mod) throw new Error(`Module ${moduleDbId} not found`);

    // Get all approved modules in this project (for Compact Module Index)
    const approvedModules = await this.prisma.baModule.findMany({
      where: { projectId: mod.projectId, moduleStatus: { in: [BaModuleStatus.APPROVED, BaModuleStatus.SUBTASKS_COMPLETE] } },
      select: { moduleId: true, moduleName: true, packageName: true, moduleStatus: true },
    });

    // Get all TBD-Future entries for this project
    const tbdEntries = await this.prisma.baTbdFutureEntry.findMany({
      where: { module: { projectId: mod.projectId } },
    });

    // Get RTM rows for this module
    const rtmRows = await this.prisma.baRtmRow.findMany({
      where: { projectId: mod.projectId, moduleId: mod.moduleId },
    });

    switch (skillName) {
      case 'SKILL-00':
        return this.assembleSkill00Context(mod);
      case 'SKILL-01-S':
        return this.assembleSkill01SContext(mod, approvedModules, tbdEntries);
      case 'SKILL-02-S':
        return this.assembleSkill02SContext(mod, approvedModules, tbdEntries, rtmRows);
      case 'SKILL-04':
        return this.assembleSkill04Context(mod, approvedModules, tbdEntries, rtmRows);
      case 'SKILL-05':
        return this.assembleSkill05Context(mod, approvedModules, tbdEntries, rtmRows);
      default:
        return { moduleId: mod.moduleId, moduleName: mod.moduleName };
    }
  }

  /** SKILL-00: Screen images + BA descriptions + click-through flows
   *  Priority for audio descriptions: AI-formatted (if confirmed) > AI-formatted (draft) > raw transcript
   */
  private assembleSkill00Context(mod: {
    moduleId: string; moduleName: string; packageName: string;
    screens: {
      screenId: string; screenTitle: string; screenType: string | null; fileData: string;
      textDescription: string | null; audioTranscript: string | null;
      aiFormattedTranscript: string | null; aiTranscriptReviewed: boolean;
    }[];
    flows: { flowName: string; steps: unknown }[];
  }): Record<string, unknown> {
    const screenData = mod.screens.map((s) => {
      let description = '';
      if (s.textDescription) description += `[Text Description]: ${s.textDescription}`;

      // Prefer AI-formatted transcript over raw, with confirmed taking highest priority
      const audioDesc = (s.aiFormattedTranscript && s.aiTranscriptReviewed)
        ? `[AI-Formatted Audio Description (Confirmed)]: ${s.aiFormattedTranscript}`
        : s.aiFormattedTranscript
          ? `[AI-Formatted Audio Description (Draft)]: ${s.aiFormattedTranscript}`
          : s.audioTranscript
            ? `[Audio Description]: ${s.audioTranscript}`
            : '';
      if (audioDesc) description += `\n\n${audioDesc}`;

      return {
        screenId: s.screenId,
        screenTitle: s.screenTitle,
        screenType: s.screenType,
        imageBase64: s.fileData,
        description: description.trim() || null,
      };
    });

    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      screens: screenData,
      clickThroughFlows: mod.flows.map((f) => ({ flowName: f.flowName, steps: f.steps })),
    };
  }

  /** SKILL-01-S: Screen Summary Cards + Compact Module Index + TBD Registry */
  private assembleSkill01SContext(
    mod: { moduleId: string; moduleName: string; packageName: string; skillExecutions: { skillName: string; handoffPacket: unknown }[] },
    approvedModules: { moduleId: string; moduleName: string; packageName: string; moduleStatus: string }[],
    tbdEntries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; isResolved: boolean }[],
  ): Record<string, unknown> {
    // Get SKILL-00 handoff packet (Screen Summary Cards)
    const skill00Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-00');
    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      screenSummaryCards: skill00Exec?.handoffPacket ?? {},
      compactModuleIndex: approvedModules,
      tbdFutureRegistry: tbdEntries.filter((e) => !e.isResolved),
    };
  }

  /** SKILL-02-S: FRD Handoff + Module Index + TBD + RTM */
  private assembleSkill02SContext(
    mod: { moduleId: string; moduleName: string; packageName: string; skillExecutions: { skillName: string; handoffPacket: unknown }[] },
    approvedModules: { moduleId: string; moduleName: string; packageName: string; moduleStatus: string }[],
    tbdEntries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; isResolved: boolean }[],
    rtmRows: unknown[],
  ): Record<string, unknown> {
    const skill01SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-01-S');
    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      frdHandoffPacket: skill01SExec?.handoffPacket ?? {},
      compactModuleIndex: approvedModules,
      tbdFutureRegistry: tbdEntries.filter((e) => !e.isResolved),
      rtmRows,
    };
  }

  /** SKILL-04: EPIC Handoff + FRD Handoff + Screen Cards + RTM */
  private assembleSkill04Context(
    mod: { moduleId: string; moduleName: string; packageName: string; skillExecutions: { skillName: string; handoffPacket: unknown }[] },
    approvedModules: { moduleId: string; moduleName: string; packageName: string; moduleStatus: string }[],
    tbdEntries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; isResolved: boolean }[],
    rtmRows: unknown[],
  ): Record<string, unknown> {
    const skill01SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-01-S');
    const skill02SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-02-S');
    const skill00Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-00');
    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      epicHandoffPacket: skill02SExec?.handoffPacket ?? {},
      frdHandoffPacket: skill01SExec?.handoffPacket ?? {},
      screenSummaryCards: skill00Exec?.handoffPacket ?? {},
      compactModuleIndex: approvedModules,
      tbdFutureRegistry: tbdEntries.filter((e) => !e.isResolved),
      rtmRows,
    };
  }

  /** SKILL-05: User Story + EPIC Handoff + FRD Feature + RTM + TBD */
  private assembleSkill05Context(
    mod: { moduleId: string; moduleName: string; packageName: string; skillExecutions: { skillName: string; handoffPacket: unknown; humanDocument: string | null }[] },
    approvedModules: { moduleId: string; moduleName: string; packageName: string; moduleStatus: string }[],
    tbdEntries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; isResolved: boolean }[],
    rtmRows: unknown[],
  ): Record<string, unknown> {
    const skill04Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-04');
    const skill02SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-02-S');
    const skill01SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-01-S');
    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      userStoriesDocument: skill04Exec?.humanDocument ?? '',
      epicHandoffPacket: skill02SExec?.handoffPacket ?? {},
      frdHandoffPacket: skill01SExec?.handoffPacket ?? {},
      compactModuleIndex: approvedModules,
      tbdFutureRegistry: tbdEntries.filter((e) => !e.isResolved),
      rtmRows,
    };
  }

  // ─── AI service call ───────────────────────────────────────────────────

  private async callAiService(systemPrompt: string, contextPacket: Record<string, unknown>): Promise<string> {
    // Build messages — separate images from text for SKILL-00
    const images: { type: string; source: { type: string; media_type: string; data: string } }[] = [];
    let textContent = '';

    if (contextPacket.screens && Array.isArray(contextPacket.screens)) {
      for (const screen of contextPacket.screens as { screenId: string; imageBase64: string; description: string | null }[]) {
        if (screen.imageBase64 && screen.imageBase64.startsWith('data:')) {
          const [header, data] = screen.imageBase64.split(',');
          const mediaType = header.match(/data:(.*?);/)?.[1] ?? 'image/png';
          images.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          });
        }
        textContent += `\n\nScreen ${screen.screenId}:${screen.description ? `\n${screen.description}` : ''}`;
      }
    }

    // Build non-image context as text
    const contextWithoutImages = { ...contextPacket };
    delete contextWithoutImages.screens;
    if (Object.keys(contextWithoutImages).length > 0) {
      textContent += `\n\nContext:\n${JSON.stringify(contextWithoutImages, null, 2)}`;
    }

    try {
      const { data } = await axios.post<{ output: string }>(
        `${this.aiServiceUrl}/ba/execute-skill`,
        {
          systemPrompt,
          textContent: textContent.trim(),
          images: images.length > 0 ? images : undefined,
        },
        { timeout: 300_000 }, // 5 min timeout for complex skills
      );
      return data.output;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw new Error(`AI service returned ${err.response.status}: ${JSON.stringify(err.response.data)}`);
      }
      throw new Error('AI service unreachable');
    }
  }

  // ─── Output parsing ────────────────────────────────────────────────────

  private parseAiOutput(rawOutput: string): { humanDocument: string; handoffPacket: Record<string, unknown> | null } {
    // Try to extract JSON handoff packet from the output
    let handoffPacket: Record<string, unknown> | null = null;
    const jsonMatch = rawOutput.match(/```json\s*\n([\s\S]*?)\n\s*```/);
    if (jsonMatch) {
      try {
        handoffPacket = JSON.parse(jsonMatch[1]);
      } catch {
        this.logger.warn('Failed to parse handoff packet JSON from AI output');
      }
    }
    return { humanDocument: rawOutput, handoffPacket };
  }

  // ─── Artifact creation ─────────────────────────────────────────────────

  private async createArtifactFromOutput(
    moduleDbId: string,
    skillName: SkillName,
    humanDocument: string,
    handoffPacket: Record<string, unknown> | null,
  ): Promise<void> {
    const artifactType = SKILL_ARTIFACT_MAP[skillName];
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    const artifactId = `${artifactType}-${mod.moduleId}`;

    const artifact = await this.prisma.baArtifact.create({
      data: {
        moduleDbId,
        artifactType,
        artifactId,
        status: BaArtifactStatus.DRAFT,
      },
    });

    // Split document into sections by headings
    const sections = this.splitIntoSections(humanDocument);
    for (const section of sections) {
      await this.prisma.baArtifactSection.create({
        data: {
          artifactId: artifact.id,
          sectionKey: section.key,
          sectionLabel: section.label,
          aiGenerated: true,
          content: section.content,
        },
      });
    }
  }

  private splitIntoSections(markdown: string): { key: string; label: string; content: string }[] {
    const lines = markdown.split('\n');
    const sections: { key: string; label: string; content: string }[] = [];
    let currentLabel = 'Introduction';
    let currentKey = 'introduction';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({
            key: currentKey,
            label: currentLabel,
            content: currentContent.join('\n').trim(),
          });
        }
        currentLabel = headingMatch[1].trim();
        currentKey = currentLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentContent.length > 0) {
      sections.push({ key: currentKey, label: currentLabel, content: currentContent.join('\n').trim() });
    }
    return sections;
  }

  // ─── Execution status & approval ───────────────────────────────────────

  async getExecution(executionId: string) {
    const exec = await this.prisma.baSkillExecution.findUnique({ where: { id: executionId } });
    if (!exec) throw new NotFoundException(`Execution ${executionId} not found`);
    return exec;
  }

  async approveExecution(executionId: string) {
    const exec = await this.getExecution(executionId);
    if (exec.status !== BaExecutionStatus.AWAITING_REVIEW) {
      throw new Error(`Execution is ${exec.status}, not AWAITING_REVIEW`);
    }
    return this.prisma.baSkillExecution.update({
      where: { id: executionId },
      data: { status: BaExecutionStatus.APPROVED },
    });
  }

  async retryExecution(moduleDbId: string, skillName: SkillName): Promise<string> {
    return this.executeSkill(moduleDbId, skillName);
  }

  // ─── Artifact CRUD ─────────────────────────────────────────────────────

  async getArtifact(artifactId: string) {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactId },
      include: { sections: { orderBy: { createdAt: 'asc' } } },
    });
    if (!artifact) throw new NotFoundException(`Artifact ${artifactId} not found`);
    return artifact;
  }

  async updateArtifactSection(sectionDbId: string, editedContent: string) {
    return this.prisma.baArtifactSection.update({
      where: { id: sectionDbId },
      data: { editedContent, isHumanModified: true },
    });
  }

  async approveArtifact(artifactDbId: string) {
    return this.prisma.baArtifact.update({
      where: { id: artifactDbId },
      data: { status: BaArtifactStatus.APPROVED, approvedAt: new Date() },
    });
  }

  // ─── TBD-Future Registry ───────────────────────────────────────────────

  async listTbdEntries(projectId: string) {
    return this.prisma.baTbdFutureEntry.findMany({
      where: { module: { projectId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveTbdEntry(entryId: string, resolvedInterface: string) {
    return this.prisma.baTbdFutureEntry.update({
      where: { id: entryId },
      data: { isResolved: true, resolvedAt: new Date(), resolvedInterface },
    });
  }

  // ─── RTM ───────────────────────────────────────────────────────────────

  async getProjectRtm(projectId: string) {
    return this.prisma.baRtmRow.findMany({
      where: { projectId },
      orderBy: [{ moduleId: 'asc' }, { featureId: 'asc' }],
    });
  }

  // ─── Export ────────────────────────────────────────────────────────────

  async getExportData(projectId: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      include: {
        modules: {
          include: {
            artifacts: { include: { sections: true } },
            skillExecutions: { where: { status: BaExecutionStatus.APPROVED } },
            tbdFutureEntries: true,
          },
        },
        rtmRows: true,
      },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }
}
