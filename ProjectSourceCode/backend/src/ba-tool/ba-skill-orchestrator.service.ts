import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaExecutionStatus, BaModuleStatus, BaArtifactType, BaArtifactStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubTaskParserService } from './subtask-parser.service';
import { BaLldParserService } from './ba-lld-parser.service';
import { BaLldNarrativeService } from './ba-lld-narrative.service';
import { BaFtcParserService } from './ba-ftc-parser.service';
import { BaFtcNarrativeService } from './ba-ftc-narrative.service';
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
  'SKILL-06-LLD', // Low-Level Design (v4)
  'SKILL-07-FTC', // Functional Test Cases (v4.2) — optional after EPIC
] as const;

export type SkillName = (typeof SKILL_ORDER)[number];

/**
 * Maps skill name to the module status it sets on completion.
 * SKILL-06-LLD and SKILL-07-FTC are excluded — both are tracked on independent
 * BaModule timestamp columns so the main status machine (DRAFT → … → APPROVED)
 * is unaffected and either can be (re)generated at any point after EPIC.
 */
const SKILL_STATUS_MAP: Partial<Record<SkillName, BaModuleStatus>> = {
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
  'SKILL-06-LLD': BaArtifactType.LLD,
  'SKILL-07-FTC': BaArtifactType.FTC,
};

/**
 * Prerequisite module status per skill. SKILL-06-LLD and SKILL-07-FTC both
 * require at least EPICS_COMPLETE — stories + subtasks are optional for both.
 */
const SKILL_PREREQ_MAP: Record<SkillName, BaModuleStatus> = {
  'SKILL-00': BaModuleStatus.SCREENS_UPLOADED,
  'SKILL-01-S': BaModuleStatus.ANALYSIS_COMPLETE,
  'SKILL-02-S': BaModuleStatus.FRD_COMPLETE,
  'SKILL-04': BaModuleStatus.EPICS_COMPLETE,
  'SKILL-05': BaModuleStatus.STORIES_COMPLETE,
  'SKILL-06-LLD': BaModuleStatus.EPICS_COMPLETE,
  'SKILL-07-FTC': BaModuleStatus.EPICS_COMPLETE,
};

@Injectable()
export class BaSkillOrchestratorService {
  private readonly logger = new Logger(BaSkillOrchestratorService.name);
  private readonly aiServiceUrl: string;
  private readonly skillFilesDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly subtaskParser: SubTaskParserService,
    private readonly lldParser: BaLldParserService,
    private readonly narrative: BaLldNarrativeService,
    private readonly ftcParser: BaFtcParserService,
    private readonly ftcNarrative: BaFtcNarrativeService,
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

      // 4. Call AI service.
      //
      // SKILL-04 branches to a per-feature loop: writing 20+ complete user
      // stories in a single AI call consistently blows the response budget
      // (observed: AI emits a Coverage Summary table for all features but
      // only fully writes 1-2 before flagging `CONTINUATION REQUIRED`). The
      // loop calls the AI once per feature with a narrow focus override
      // (~3 stories per response, well within cap) and concatenates the
      // outputs. Every other skill uses the single-shot path unchanged.
      const aiResponse = skillName === 'SKILL-04'
        ? await this.callAiServiceSkill04PerFeature(skillPrompt, contextPacket)
        : await this.callAiService(skillPrompt, contextPacket);

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
      const artifact = await this.createArtifactFromOutput(moduleDbId, skillName, humanDocument, handoffPacket);

      // 7. Incremental RTM population — runs after every skill so the
      //    Requirements Traceability Matrix fills in column-by-column as the
      //    pipeline progresses (features → EPIC → stories → subtasks).
      try {
        const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId }, include: { project: true } });
        if (mod?.projectId) {
          if (skillName === 'SKILL-01-S') {
            await this.seedRtmFromFrd(moduleDbId, mod.projectId, humanDocument);
          } else if (skillName === 'SKILL-02-S') {
            await this.extendRtmWithEpic(moduleDbId, mod.projectId, humanDocument);
          } else if (skillName === 'SKILL-04') {
            await this.extendRtmWithStories(moduleDbId, mod.projectId, humanDocument);
          }
        }
      } catch (rtmErr: unknown) {
        const rMsg = rtmErr instanceof Error ? rtmErr.message : 'Unknown';
        this.logger.warn(`Incremental RTM update failed for ${skillName}: ${rMsg}`);
      }

      // 7b. SKILL-06 post-processing: parse LLD document + pseudo files, set lldCompletedAt,
      //     and extend RTM rows with pseudo-file links so the trace runs to source.
      if (skillName === 'SKILL-06-LLD' && artifact) {
        try {
          await this.lldParser.parseAndStore(humanDocument, artifact.id);
          await this.prisma.baModule.update({
            where: { id: moduleDbId },
            data: { lldCompletedAt: new Date(), lldArtifactId: artifact.id },
          });
          const modForRtm = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
          if (modForRtm?.projectId) {
            await this.extendRtmWithLld(moduleDbId, modForRtm.projectId, artifact.id);
          }
          this.logger.log(`LLD: parsed document + pseudo files + extended RTM for module ${moduleDbId}`);
        } catch (lldErr: unknown) {
          const msg = lldErr instanceof Error ? lldErr.message : 'unknown error';
          this.logger.warn(`SKILL-06 post-processing partial failure: ${msg}`);
        }
      }

      // 7d. SKILL-07 post-processing: parse FTC document + test cases, set
      //     ftcCompletedAt/ArtifactId, and extend RTM rows with TC + OWASP coverage.
      if (skillName === 'SKILL-07-FTC' && artifact) {
        try {
          await this.ftcParser.parseAndStore(humanDocument, artifact.id);
          await this.prisma.baModule.update({
            where: { id: moduleDbId },
            data: { ftcCompletedAt: new Date(), ftcArtifactId: artifact.id },
          });
          const modForRtm = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
          if (modForRtm?.projectId) {
            await this.extendRtmWithFtc(moduleDbId, modForRtm.projectId, artifact.id);
          }
          this.logger.log(`FTC: parsed document + test cases + extended RTM for module ${moduleDbId}`);
        } catch (ftcErr: unknown) {
          const msg = ftcErr instanceof Error ? ftcErr.message : 'unknown error';
          this.logger.warn(`SKILL-07 post-processing partial failure: ${msg}`);
        }
      }

      // 7c. SKILL-05 post-processing: parse SubTasks, extract TBD, extend RTM
      if (skillName === 'SKILL-05') {
        try {
          const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId }, include: { project: true } });
          const artifactId = artifact?.id ?? null;

          // 7a. Parse SubTasks into structured records
          const subtaskIds = await this.subtaskParser.parseAndStore(humanDocument, moduleDbId, artifactId);
          this.logger.log(`Parsed ${subtaskIds.length} SubTasks for module ${moduleDbId}`);

          // 7b. Extract TBD-Future entries from parsed SubTasks
          await this.extractTbdFromSubTasks(moduleDbId);

          // 7c. Extend RTM with SubTask IDs and Test Case IDs
          if (mod?.projectId) {
            await this.extendRtmWithSubTasks(moduleDbId, mod.projectId);
          }
        } catch (pipelineErr: unknown) {
          const pMsg = pipelineErr instanceof Error ? pipelineErr.message : 'Unknown';
          this.logger.warn(`SKILL-05 post-processing partial failure: ${pMsg}`);
          // Don't fail the execution — raw output is preserved
        }
      }

      // 8. Update module status — only if this skill advances the main
      // status machine. SKILL-06-LLD has no status mapping; LLD completion
      // is tracked separately on BaModule.lldCompletedAt by the LLD service.
      const nextStatus = SKILL_STATUS_MAP[skillName];
      if (nextStatus) {
        await this.prisma.baModule.update({
          where: { id: moduleDbId },
          data: { moduleStatus: nextStatus, processedAt: new Date() },
        });
      } else {
        await this.prisma.baModule.update({
          where: { id: moduleDbId },
          data: { processedAt: new Date() },
        });
      }

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
      'SKILL-06-LLD': 'FINAL-SKILL-06-create-lld.md',
      'SKILL-07-FTC': 'FINAL-SKILL-07-create-ftc.md',
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

    // Project-level metadata — captured before EPIC generation, reused by all downstream skills
    const projectMeta = {
      projectName: mod.project?.name ?? null,
      projectCode: mod.project?.projectCode ?? null,
      productName: (mod.project as { productName?: string | null })?.productName ?? null,
      clientName: (mod.project as { clientName?: string | null })?.clientName ?? null,
      submittedBy: (mod.project as { submittedBy?: string | null })?.submittedBy ?? null,
    };

    let ctx: Record<string, unknown>;
    switch (skillName) {
      case 'SKILL-00':
        ctx = this.assembleSkill00Context(mod); break;
      case 'SKILL-01-S':
        ctx = this.assembleSkill01SContext(mod, approvedModules, tbdEntries); break;
      case 'SKILL-02-S':
        ctx = this.assembleSkill02SContext(mod, approvedModules, tbdEntries, rtmRows); break;
      case 'SKILL-04':
        ctx = this.assembleSkill04Context(mod, approvedModules, tbdEntries, rtmRows); break;
      case 'SKILL-05':
        ctx = this.assembleSkill05Context(mod, approvedModules, tbdEntries, rtmRows); break;
      case 'SKILL-06-LLD':
        ctx = await this.assembleSkill06Context(moduleDbId, mod, rtmRows, tbdEntries); break;
      case 'SKILL-07-FTC':
        ctx = await this.assembleSkill07Context(moduleDbId, mod, rtmRows, tbdEntries); break;
      default:
        ctx = { moduleId: mod.moduleId, moduleName: mod.moduleName };
    }
    // Expose the project sqlDialect to every skill; FTC actually uses it, but
    // any future SQL-emitting skill will see it automatically.
    const sqlDialect = (mod.project as { sqlDialect?: string | null })?.sqlDialect ?? 'postgresql';
    return { ...ctx, projectMeta: { ...projectMeta, sqlDialect } };
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

  /**
   * SKILL-06 (LLD): pack EPIC + optional US/SubTask + RTM + TBD +
   * Architect-selected stack + uploaded templates + NFR values.
   */
  private async assembleSkill06Context(
    moduleDbId: string,
    mod: { moduleId: string; moduleName: string; packageName: string; skillExecutions: { skillName: string; handoffPacket: unknown; humanDocument: string | null }[] },
    rtmRows: unknown[],
    tbdEntries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; isResolved: boolean }[],
  ): Promise<Record<string, unknown>> {
    const skill01SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-01-S');
    const skill02SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-02-S');
    const skill04Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-04');
    const skill05Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-05');

    // Load LLD config for this module + resolve all referenced master-data + templates
    const config = await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } });

    const resolveEntry = async (id: string | null | undefined) => {
      if (!id) return null;
      const e = await this.prisma.baMasterDataEntry.findUnique({
        where: { id },
        include: { template: true },
      });
      if (!e) return null;
      return { name: e.name, value: e.value, description: e.description };
    };

    const resolveTemplate = async (id: string | null | undefined) => {
      if (!id) return null;
      const entry = await this.prisma.baMasterDataEntry.findUnique({
        where: { id },
        include: { template: true },
      });
      if (!entry?.template) return null;
      return { name: entry.template.name, content: entry.template.content };
    };

    const stacks = {
      frontend: await resolveEntry(config?.frontendStackId),
      backend: await resolveEntry(config?.backendStackId),
      database: await resolveEntry(config?.databaseId),
      streaming: await resolveEntry(config?.streamingId),
      caching: await resolveEntry(config?.cachingId),
      storage: await resolveEntry(config?.storageId),
      cloud: await resolveEntry(config?.cloudId),
      architecture: await resolveEntry(config?.architectureId),
    };

    const resolvedTemplates = {
      projectStructure: await resolveTemplate(config?.projectStructureId),
      backend: await resolveTemplate(config?.backendTemplateId),
      frontend: await resolveTemplate(config?.frontendTemplateId),
      lld: await resolveTemplate(config?.lldTemplateId),
      codingGuidelines: await resolveTemplate(config?.codingGuidelinesId),
    };

    // Narrative-driven mode: if the architect supplied a narrative, either
    // augment the default context (useAsAdditional=true) or drop the
    // artifact-derived packets entirely and let the narrative drive generation.
    const { text: narrativeBlock, useAsAdditional, hasNarrative } =
      await this.narrative.buildNarrativeContextBlock(moduleDbId);

    const baseContext = {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      frdHandoffPacket: skill01SExec?.handoffPacket ?? {},
      epicHandoffPacket: skill02SExec?.handoffPacket ?? {},
      // Stories and subtasks are OPTIONAL — null when not yet generated
      storyHandoffPacket: skill04Exec?.handoffPacket ?? null,
      storiesDocument: skill04Exec?.humanDocument ?? null,
      subtaskHandoffPacket: skill05Exec?.handoffPacket ?? null,
      subtasksDocument: skill05Exec?.humanDocument ?? null,
      rtmRows,
      tbdFutureRegistry: tbdEntries.filter((e) => !e.isResolved),
      lldConfig: {
        stacks,
        cloudServices: config?.cloudServices ?? null,
        nfrValues: config?.nfrValues ?? null,
        customNotes: config?.customNotes ?? null,
      },
      resolvedTemplates,
    };

    if (!hasNarrative) return baseContext;

    if (useAsAdditional) {
      return {
        ...baseContext,
        architectNarrative: narrativeBlock,
        narrativeMode: 'additional',
      };
    }

    // narrative-first: keep module identity + stacks + templates so the
    // generator respects tech choices, but skip the artifact-derived handoffs
    // so the narrative is the primary driver.
    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      rtmRows: [],
      tbdFutureRegistry: [],
      lldConfig: baseContext.lldConfig,
      resolvedTemplates,
      architectNarrative: narrativeBlock,
      narrativeMode: 'from-scratch',
    };
  }

  // ─── SKILL-07 (FTC) context assembly ───────────────────────────────────

  private async assembleSkill07Context(
    moduleDbId: string,
    mod: { moduleId: string; moduleName: string; packageName: string; skillExecutions: { skillName: string; handoffPacket: unknown; humanDocument: string | null }[] },
    rtmRows: unknown[],
    tbdEntries: { registryId: string; integrationName: string; classification: string; referencedModule: string | null; isResolved: boolean }[],
  ): Promise<Record<string, unknown>> {
    const skill01SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-01-S');
    const skill02SExec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-02-S');
    const skill04Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-04');
    const skill05Exec = mod.skillExecutions.find((e) => e.skillName === 'SKILL-05');

    const ftcConfig = await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });

    // Resolve the FTC template if one is selected (master data entry)
    let ftcTemplate: { name: string; content: string } | null = null;
    if (ftcConfig?.ftcTemplateId) {
      const entry = await this.prisma.baMasterDataEntry.findUnique({
        where: { id: ftcConfig.ftcTemplateId },
        include: { template: true },
      });
      if (entry?.template) {
        ftcTemplate = { name: entry.template.name, content: entry.template.content };
      }
    }

    // If architect wants LLD references and an LLD artifact exists, include a
    // trimmed LLD context so white-box TCs can cite real classes/methods.
    const moduleRow = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      select: { lldArtifactId: true },
    });
    let lldContext: { artifactId: string; sections: { sectionLabel: string; content: string }[]; pseudoFilePaths: string[] } | null = null;
    if (ftcConfig?.includeLldReferences && moduleRow?.lldArtifactId) {
      const lldArtifact = await this.prisma.baArtifact.findUnique({
        where: { id: moduleRow.lldArtifactId },
        include: {
          sections: { orderBy: { createdAt: 'asc' }, select: { sectionLabel: true, content: true } },
          pseudoFiles: { select: { id: true, path: true } },
        },
      });
      if (lldArtifact) {
        lldContext = {
          artifactId: lldArtifact.artifactId,
          sections: lldArtifact.sections.map((s) => ({ sectionLabel: s.sectionLabel, content: s.content })),
          pseudoFilePaths: lldArtifact.pseudoFiles.map((pf) => pf.path),
        };
      }
    }

    // Narrative + attachments (FTC scope)
    const { text: narrativeBlock, useAsAdditional, hasNarrative } =
      await this.ftcNarrative.buildNarrativeContextBlock(moduleDbId);

    // Detect AI content — triggers LLM OWASP Top 10 coverage expectations
    const hasAiContent = this.detectAiContent(lldContext);

    const baseContext = {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      frdHandoffPacket: skill01SExec?.handoffPacket ?? {},
      epicHandoffPacket: skill02SExec?.handoffPacket ?? {},
      storyHandoffPacket: skill04Exec?.handoffPacket ?? null,
      storiesDocument: skill04Exec?.humanDocument ?? null,
      subtaskHandoffPacket: skill05Exec?.handoffPacket ?? null,
      subtasksDocument: skill05Exec?.humanDocument ?? null,
      rtmRows,
      tbdFutureRegistry: tbdEntries.filter((e) => !e.isResolved),
      lldContext,
      ftcConfig: {
        testingFrameworks: ftcConfig?.testingFrameworks ?? [],
        testTypes: ftcConfig?.testTypes ?? [],
        coverageTarget: ftcConfig?.coverageTarget ?? null,
        owaspWebEnabled: ftcConfig?.owaspWebEnabled ?? true,
        owaspLlmEnabled: ftcConfig?.owaspLlmEnabled ?? true,
        excludedOwaspWeb: ftcConfig?.excludedOwaspWeb ?? [],
        excludedOwaspLlm: ftcConfig?.excludedOwaspLlm ?? [],
        includeLldReferences: ftcConfig?.includeLldReferences ?? true,
        ftcTemplate,
        customNotes: ftcConfig?.customNotes ?? null,
      },
      hasAiContent,
    };

    if (!hasNarrative) return baseContext;

    if (useAsAdditional) {
      return { ...baseContext, architectNarrative: narrativeBlock, narrativeMode: 'additional' };
    }

    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      packageName: mod.packageName,
      rtmRows: [],
      tbdFutureRegistry: [],
      lldContext,
      ftcConfig: baseContext.ftcConfig,
      hasAiContent,
      architectNarrative: narrativeBlock,
      narrativeMode: 'from-scratch',
    };
  }

  private detectAiContent(
    lldContext: { pseudoFilePaths: string[]; sections: { sectionLabel: string; content: string }[] } | null,
  ): boolean {
    if (!lldContext) return false;
    const aiPathRegex = /(ai-service|backend\/ai\/|langchain|langgraph|agents?\/)/i;
    if (lldContext.pseudoFilePaths.some((p) => aiPathRegex.test(p))) return true;
    const techSection = lldContext.sections.find((s) => /technology stack/i.test(s.sectionLabel));
    if (techSection && /(langchain|langgraph|openai|anthropic|gemini|llama|pytorch|tensorflow|huggingface)/i.test(techSection.content)) {
      return true;
    }
    return false;
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

  /**
   * SKILL-04 variant — call the AI once per feature and stitch the outputs
   * into one combined document. Prevents the "AI writes 22 Coverage Summary
   * rows but only completes the first 2 features" symptom.
   *
   * Each sub-call gets the full context packet (so the AI can still cross-
   * reference) plus a focused OVERRIDE at the top of the system prompt that
   * restricts output scope to one feature. The orchestrator emits the
   * Coverage Summary table itself after all sub-calls complete.
   */
  private async callAiServiceSkill04PerFeature(
    systemPrompt: string,
    contextPacket: Record<string, unknown>,
  ): Promise<string> {
    // Extract unique feature IDs from the RTM rows for this module.
    const rtmRows = Array.isArray(contextPacket.rtmRows) ? contextPacket.rtmRows : [];
    const seen = new Set<string>();
    const features: Array<{ featureId: string; featureName: string; featureStatus: string; priority: string }> = [];
    for (const r of rtmRows as Array<Record<string, unknown>>) {
      const fid = String(r.featureId ?? '').trim();
      if (!fid || seen.has(fid)) continue;
      seen.add(fid);
      features.push({
        featureId: fid,
        featureName: String(r.featureName ?? ''),
        featureStatus: String(r.featureStatus ?? '').replace(/^"(.+)",?$/, '$1'),
        priority: String(r.priority ?? ''),
      });
    }

    if (features.length === 0) {
      this.logger.warn('SKILL-04 per-feature loop: no features found in RTM, falling back to single-shot');
      return this.callAiService(systemPrompt, contextPacket);
    }

    // Sort features by featureId ascending so the US numbering stays aligned
    // with feature order: F-04-01 gets the lowest US range, F-04-02 the next,
    // and so on. Previously the loop followed whatever order the RTM rows
    // came back in (by createdAt) — which meant F-04-09 could end up with
    // US-052 while F-04-01 got US-073. Users rightly expect lower feature
    // numbers to map to lower story numbers.
    // Sort uses locale + numeric to handle F-04-10 > F-04-09 correctly.
    features.sort((a, b) =>
      a.featureId.localeCompare(b.featureId, undefined, { numeric: true, sensitivity: 'base' }),
    );

    this.logger.log(
      `SKILL-04 per-feature loop: generating stories for ${features.length} feature(s) ` +
      `(order: ${features.map((f) => f.featureId).join(', ')})`,
    );

    const perFeatureOutputs: string[] = [];
    // Story numbering is sequential across the whole project. Reserve a US
    // range starting from (existing story count + 1) so re-runs don't clash
    // with prior artifacts. We let the AI pick the first available number
    // within each feature's 2-3 stories; the orchestrator just tells it
    // where the range starts.
    let nextUsNumber = await this.computeNextUserStoryNumber(String(contextPacket.moduleId ?? ''));

    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const focusOverride = [
        '## 🎯 SINGLE-FEATURE FOCUS — ORCHESTRATOR OVERRIDE',
        '',
        'You are running as part of a per-feature loop. The orchestrator will',
        'call you once for EACH feature. Your current call is for ONE feature only.',
        '',
        `**CURRENT FEATURE: ${f.featureId} — ${f.featureName}**`,
        `- Status: ${f.featureStatus}`,
        `- Priority: ${f.priority}`,
        `- Position in loop: ${i + 1} of ${features.length}`,
        '',
        '### What to output NOW',
        '',
        `1. A single \`## User Stories for ${f.featureId}\` heading`,
        '2. 2–3 complete User Stories for this feature only (Frontend / Backend / Integration as applicable)',
        '3. Each story uses the full 27-section template (Header through Section 27)',
        `4. Number your stories starting at **US-${String(nextUsNumber).padStart(3, '0')}** (increment by 1 for each)`,
        '',
        '### What to SKIP',
        '',
        '- Do NOT write a Coverage Summary table — the orchestrator emits it after aggregation',
        '- Do NOT mention or write stories for other features (they are handled by their own sub-calls)',
        '- Do NOT write a Context header or Decomposition note — orchestrator handles scaffolding',
        '- Do NOT emit an RTM Extension section — orchestrator appends one combined table at the end',
        '',
        '---',
        '',
        '## Original Skill Definition (follow all rules below, constrained by the override above)',
        '',
        systemPrompt,
      ].join('\n');

      // Narrow the RTM rows passed to this sub-call so the AI isn't tempted
      // to write about sibling features. Everything else (handoff packets
      // etc.) stays, so cross-references still resolve.
      const narrowedContext: Record<string, unknown> = {
        ...contextPacket,
        rtmRows: (rtmRows as Array<Record<string, unknown>>).filter(
          (r) => String(r.featureId ?? '').trim() === f.featureId,
        ),
        currentFocusFeature: f,
      };

      const out = await this.callAiService(focusOverride, narrowedContext);
      perFeatureOutputs.push(out);

      // Advance the US counter by however many stories this sub-call wrote.
      const usMatches = out.match(/US-\d{3,}/g) ?? [];
      const maxInThis = usMatches
        .map((s) => parseInt(s.slice(3), 10))
        .filter((n) => !Number.isNaN(n))
        .reduce((a, b) => Math.max(a, b), nextUsNumber - 1);
      nextUsNumber = Math.max(nextUsNumber + 1, maxInThis + 1);
    }

    // Assemble the final combined document: a Coverage Summary built from
    // per-feature outputs, then every sub-output concatenated, then the
    // RTM Extension table (same shape the legacy single-shot produced).
    const coverageRows: string[] = ['| Feature ID | Feature Name | Story Count | Story IDs |', '|---|---|---|---|'];
    const rtmRowsOut: string[] = ['| Module ID | Feature ID | Story ID | Story Name | Story Type | Story Status |', '|---|---|---|---|---|---|'];

    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const out = perFeatureOutputs[i];
      const storyIds = Array.from(new Set(out.match(/US-\d{3,}/g) ?? []));
      coverageRows.push(`| ${f.featureId} | ${f.featureName} | ${storyIds.length} | ${storyIds.join(', ') || '—'} |`);
      // Best-effort RTM rows: one row per story, detecting type from headings.
      for (const sid of storyIds) {
        const storyBlockRe = new RegExp(`###? \\d+\\.?\\s*${sid}[^\\n]*|# User Story: ${sid}[^\\n]*`);
        const m = out.match(storyBlockRe);
        const titleLine = m?.[0] ?? sid;
        const type = /frontend/i.test(titleLine)
          ? 'Frontend'
          : /backend/i.test(titleLine)
            ? 'Backend'
            : /integration/i.test(titleLine)
              ? 'Integration'
              : '';
        const status = /PARTIAL/i.test(f.featureStatus) ? 'CONFIRMED-PARTIAL' : 'CONFIRMED';
        rtmRowsOut.push(`| ${String(contextPacket.moduleId ?? '')} | ${f.featureId} | ${sid} | ${titleLine.replace(/[#*]/g, '').trim()} | ${type} | ${status} |`);
      }
    }

    return [
      '## Coverage Summary',
      '',
      coverageRows.join('\n'),
      '',
      '---',
      '',
      ...perFeatureOutputs,
      '',
      '---',
      '',
      '## RTM Extension',
      '',
      rtmRowsOut.join('\n'),
      '',
    ].join('\n');
  }

  /**
   * Determine where this module's next US-NNN number should start so that
   * re-runs don't collide with existing stories in the project. Reads all
   * USER_STORY sections across the project, finds the max US number, and
   * returns max + 1.
   */
  private async computeNextUserStoryNumber(moduleId: string): Promise<number> {
    void moduleId; // reserved for future per-module numbering; today stories are project-wide
    const sections = await this.prisma.baArtifactSection.findMany({
      where: { artifact: { artifactType: 'USER_STORY' } },
      select: { sectionKey: true, content: true },
    });
    let max = 0;
    const usRe = /US-(\d{3,})/g;
    for (const s of sections) {
      for (const key of [s.sectionKey, s.content ?? '']) {
        let m;
        while ((m = usRe.exec(key)) !== null) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n) && n > max) max = n;
        }
      }
    }
    return max + 1;
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
  ): Promise<{ id: string } | null> {
    const artifactType = SKILL_ARTIFACT_MAP[skillName];
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return null;

    let artifactId = `${artifactType}-${mod.moduleId}`;

    // For LLD and FTC artifacts we allow multiple coexisting versions per module
    // (LLD by stack, FTC by framework). Suffix the artifactId with a short tag;
    // regenerations append `-vN` so prior versions are preserved intact.
    if (artifactType === BaArtifactType.LLD || artifactType === BaArtifactType.FTC) {
      const suffix = artifactType === BaArtifactType.LLD
        ? await this.deriveLldSuffix(moduleDbId)
        : await this.deriveFtcSuffix(moduleDbId);
      const base = `${artifactType}-${mod.moduleId}-${suffix}`;
      const existingSameStack = await this.prisma.baArtifact.findMany({
        where: { moduleDbId, artifactType, artifactId: { startsWith: base } },
        select: { artifactId: true },
      });
      if (existingSameStack.length === 0) {
        artifactId = base;
      } else {
        let n = 2;
        const existingIds = new Set(existingSameStack.map((a) => a.artifactId));
        while (existingIds.has(`${base}-v${n}`)) n++;
        artifactId = `${base}-v${n}`;
      }
    }

    // Snapshot the architect narrative onto the artifact row so version history
    // stays truthful even if the configurator is edited later. LLD + FTC each
    // have their own config table with a `narrative` column.
    let sourceNarrative: string | null = null;
    if (artifactType === BaArtifactType.LLD) {
      const cfg = await this.prisma.baLldConfig.findUnique({
        where: { moduleDbId },
        select: { narrative: true },
      });
      sourceNarrative = cfg?.narrative?.trim() ? cfg.narrative : null;
    } else if (artifactType === BaArtifactType.FTC) {
      const cfg = await this.prisma.baFtcConfig.findUnique({
        where: { moduleDbId },
        select: { narrative: true },
      });
      sourceNarrative = cfg?.narrative?.trim() ? cfg.narrative : null;
    }

    const artifact = await this.prisma.baArtifact.create({
      data: {
        moduleDbId,
        artifactType,
        artifactId,
        status: BaArtifactStatus.DRAFT,
        sourceNarrative,
      },
    });

    // LLD + FTC sections are populated by their dedicated parsers in the post-hook
    // (with tidy-up + dedup). Skip the generic splitter for both to avoid
    // storing each heading twice (naive splitter + domain parser).
    if (artifactType === BaArtifactType.LLD || artifactType === BaArtifactType.FTC) {
      return { id: artifact.id };
    }

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

    return { id: artifact.id };
  }

  /**
   * Derive a short suffix for the LLD artifactId from the saved BaLldConfig
   * stacks. Priority: backend stack > frontend stack > architecture > "default".
   * Example: "nestjs", "langchain", "java", "default". When the architect
   * supplied a narrative, the suffix is extended with `-narrative` so the
   * audit trail distinguishes narrative-driven runs from stack-only runs.
   */
  private async deriveLldSuffix(moduleDbId: string): Promise<string> {
    const config = await this.prisma.baLldConfig.findUnique({
      where: { moduleDbId },
    });
    if (!config) return 'default';

    const pickId = config.backendStackId ?? config.frontendStackId ?? config.architectureId;
    let base: string;
    if (!pickId) {
      base = 'default';
    } else {
      const entry = await this.prisma.baMasterDataEntry.findUnique({
        where: { id: pickId },
        select: { value: true, name: true },
      });
      const raw = (entry?.value ?? entry?.name ?? 'default').toLowerCase();
      const cleaned = raw.replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      base = cleaned || 'default';
    }

    if (config.narrative && config.narrative.trim()) {
      return `${base}-narrative`;
    }
    return base;
  }

  /**
   * Derive a short suffix for the FTC artifactId from the saved BaFtcConfig.
   * testingFrameworks is multi-select; we pick the FIRST framework for the
   * artifactId suffix (keeps it stable + short). The full framework list
   * appears inside the document's Test Strategy section.
   * When narrative is set, append `-narrative` to the suffix.
   */
  private async deriveFtcSuffix(moduleDbId: string): Promise<string> {
    const config = await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });
    if (!config) return 'default';
    const firstFw = (config.testingFrameworks ?? [])[0] ?? 'default';
    const raw = firstFw.toLowerCase();
    const cleaned = raw.replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    let base = cleaned || 'default';
    if (config.narrative && config.narrative.trim()) base = `${base}-narrative`;
    return base;
  }

  // ─── SKILL-05 post-processing: TBD extraction + RTM extension ──────────

  private async extractTbdFromSubTasks(moduleDbId: string): Promise<void> {
    const subtasks = await this.prisma.baSubTask.findMany({
      where: { moduleDbId },
      include: { sections: { where: { sectionKey: 'integration_points' } } },
    });

    let newCount = 0;
    for (const st of subtasks) {
      const integSection = st.sections[0];
      if (!integSection) continue;

      const content = integSection.aiContent;
      // Find TBD-Future patterns
      const tbdMatches = content.matchAll(/TBD-Future\s*Ref[:\s]+(TBD-\d+)/gi);
      for (const match of tbdMatches) {
        const registryId = match[1];
        // Check if already exists
        const existing = await this.prisma.baTbdFutureEntry.findFirst({
          where: { moduleDbId, registryId },
        });
        if (existing) continue;

        // Extract integration name
        const nameMatch = content.match(/Called\s*Class[:\s]+(\w+)/i);
        const moduleMatch = content.match(/Referenced\s*Module[:\s]+(MOD-\d+)/i);

        await this.prisma.baTbdFutureEntry.create({
          data: {
            moduleDbId,
            registryId,
            integrationName: nameMatch?.[1] ?? 'Unknown',
            classification: moduleMatch ? 'INTERNAL-TBD-Future' : 'EXTERNAL-TBD-Future',
            referencedModule: moduleMatch?.[1] ?? null,
            assumedInterface: content.substring(0, 500),
            resolutionTrigger: `${moduleMatch?.[1] ?? 'Referenced module'} approved`,
            appearsInFeatures: st.featureId ? [st.featureId] : [],
          },
        });
        newCount++;
      }
    }
    if (newCount > 0) this.logger.log(`Extracted ${newCount} TBD-Future entries from SubTasks`);
  }

  /**
   * After SKILL-01-S: seed one RTM row per F-XX-XX feature parsed from the FRD
   * output. Idempotent — skips features that already have a row. This is what
   * lets the RTM page populate incrementally instead of waiting for SKILL-05.
   */
  private async seedRtmFromFrd(moduleDbId: string, projectId: string, frdMarkdown: string): Promise<void> {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    const features = this.parseFrdFeatures(frdMarkdown);
    let created = 0;

    for (const f of features) {
      const existing = await this.prisma.baRtmRow.findFirst({
        where: { projectId, moduleId: mod.moduleId, featureId: f.featureId },
      });
      if (existing) {
        // Refresh the light metadata in case the FRD was re-run
        await this.prisma.baRtmRow.update({
          where: { id: existing.id },
          data: {
            featureName: f.featureName || existing.featureName,
            featureStatus: f.status || existing.featureStatus,
            priority: f.priority || existing.priority,
            screenRef: f.screenRef || existing.screenRef,
          },
        });
        continue;
      }
      await this.prisma.baRtmRow.create({
        data: {
          projectId,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          packageName: mod.packageName,
          featureId: f.featureId,
          featureName: f.featureName,
          featureStatus: f.status || 'CONFIRMED',
          priority: f.priority || 'Must',
          screenRef: f.screenRef || '',
        },
      });
      created++;
    }
    this.logger.log(`RTM: seeded ${created} rows from FRD (${features.length} features parsed)`);
  }

  /**
   * After SKILL-02-S: link EPIC id/name to each RTM row whose feature ID is
   * mentioned in the EPIC's "FRD Feature IDs" field.
   */
  private async extendRtmWithEpic(moduleDbId: string, projectId: string, epicMarkdown: string): Promise<void> {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    const { epicId, epicName, featureIds } = this.parseEpicSummary(epicMarkdown);
    if (!epicId || featureIds.length === 0) {
      this.logger.warn(`RTM: EPIC parse yielded no linkage (epicId=${epicId}, features=${featureIds.length})`);
      return;
    }

    const result = await this.prisma.baRtmRow.updateMany({
      where: { projectId, moduleId: mod.moduleId, featureId: { in: featureIds } },
      data: { epicId, epicName },
    });
    this.logger.log(`RTM: linked EPIC ${epicId} to ${result.count} rows`);
  }

  /**
   * After SKILL-04: link User Story id/name/type/status to matching RTM rows.
   * Uses `FRD Feature Reference` fields in each parsed story.
   */
  private async extendRtmWithStories(moduleDbId: string, projectId: string, storiesMarkdown: string): Promise<void> {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    const stories = this.parseUserStories(storiesMarkdown);
    let updated = 0;

    for (const story of stories) {
      if (!story.featureIds.length) continue;
      const result = await this.prisma.baRtmRow.updateMany({
        where: { projectId, moduleId: mod.moduleId, featureId: { in: story.featureIds } },
        data: {
          storyId: story.storyId,
          storyName: story.storyName,
          storyType: story.storyType,
          storyStatus: story.storyStatus,
        },
      });
      updated += result.count;
    }
    this.logger.log(`RTM: linked ${stories.length} stories across ${updated} rows`);
  }

  // ─── Lightweight markdown parsers (server-side RTM extraction) ────────

  private parseFrdFeatures(markdown: string): Array<{ featureId: string; featureName: string; status: string; priority: string; screenRef: string }> {
    const features: Array<{ featureId: string; featureName: string; status: string; priority: string; screenRef: string }> = [];
    // Match ####/###/## **F-XX-XX: Name** or F-XX-XX: Name
    const re = /#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|---\s*\n\s*#{1,4}\s+\*{0,2}F-|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      const featureId = m[1];
      const featureName = m[2].replace(/\*+/g, '').trim();
      const block = m[3];
      features.push({
        featureId,
        featureName,
        status: this.extractField(block, ['Status', 'Feature Status']) || 'CONFIRMED',
        priority: this.extractField(block, ['Priority', 'MoSCoW']) || 'Must',
        screenRef: this.extractField(block, ['Screen Reference', 'Screen Ref', 'Screen']) || '',
      });
    }
    return features;
  }

  private parseEpicSummary(markdown: string): { epicId: string; epicName: string; featureIds: string[] } {
    const epicIdMatch = markdown.match(/\bEPIC-[A-Z0-9-]+/);
    const epicId = epicIdMatch?.[0] ?? '';
    const epicName = this.extractField(markdown, ['EPIC Name', 'Epic Name', 'Name']) || epicId;
    // FRD Feature IDs field — may be comma-separated or bullet-listed
    const ids = new Set<string>();
    const fieldVal = this.extractField(markdown, ['FRD Feature IDs', 'FRD Feature ID', 'Feature IDs']);
    if (fieldVal) {
      for (const x of fieldVal.matchAll(/F-\d+-\d+/g)) ids.add(x[0]);
    }
    // Fallback — any F-XX-XX anywhere in the document
    if (ids.size === 0) {
      for (const x of markdown.matchAll(/F-\d+-\d+/g)) ids.add(x[0]);
    }
    return { epicId, epicName, featureIds: Array.from(ids) };
  }

  private parseUserStories(markdown: string): Array<{ storyId: string; storyName: string; storyType: string; storyStatus: string; featureIds: string[] }> {
    const out: Array<{ storyId: string; storyName: string; storyType: string; storyStatus: string; featureIds: string[] }> = [];
    // Split by US-XXX or #### **US-XXX:** headings
    const re = /#{1,4}\s+\*{0,2}(US-[A-Z0-9-]+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}US-[A-Z0-9-]+|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      const storyId = m[1];
      const storyName = m[2].replace(/\*+/g, '').trim();
      const block = m[3];
      const featureRef = this.extractField(block, ['FRD Feature Reference', 'Feature Reference', 'FRD Feature']);
      const featureIds: string[] = [];
      if (featureRef) for (const x of featureRef.matchAll(/F-\d+-\d+/g)) featureIds.push(x[0]);
      out.push({
        storyId,
        storyName,
        storyType: this.extractField(block, ['User Story Type', 'Story Type', 'Type']) || '',
        storyStatus: this.extractField(block, ['User Story Status', 'Story Status', 'Status']) || 'CONFIRMED',
        featureIds,
      });
    }
    return out;
  }

  private extractField(block: string, labels: string[]): string {
    const lowerLabels = labels.map((l) => l.toLowerCase());
    for (const line of block.split('\n')) {
      const cleaned = line.replace(/^\s*[-*]*\s*/, '').replace(/\*{1,2}/g, '').trim();
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx < 1) continue;
      const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
      const lineValue = cleaned.substring(colonIdx + 1).trim();
      if (!lineValue) continue;
      for (const target of lowerLabels) {
        if (lineLabel === target || lineLabel.includes(target) || target.includes(lineLabel)) return lineValue;
      }
    }
    return '';
  }

  /**
   * Backfill RTM for a project that already has FRD/EPIC/User Story/SubTask
   * artifacts but no RTM rows yet. Idempotent — re-runs each phase.
   */
  async backfillProjectRtm(projectId: string): Promise<{ seeded: number; epics: number; stories: number; subtasks: number; llds: number; ftcs: number }> {
    const modules = await this.prisma.baModule.findMany({
      where: { projectId },
      include: { artifacts: true },
    });

    let seeded = 0, epics = 0, stories = 0, subtasks = 0, llds = 0, ftcs = 0;

    for (const mod of modules) {
      // FRD → seed rows
      const frd = mod.artifacts.find((a) => a.artifactType === 'FRD' as typeof a.artifactType);
      if (frd) {
        const doc = await this.buildArtifactMarkdown(frd.id);
        const before = await this.prisma.baRtmRow.count({ where: { projectId, moduleId: mod.moduleId } });
        await this.seedRtmFromFrd(mod.id, projectId, doc);
        const after = await this.prisma.baRtmRow.count({ where: { projectId, moduleId: mod.moduleId } });
        seeded += Math.max(0, after - before);
      }
      // EPIC → link
      const epic = mod.artifacts.find((a) => a.artifactType === 'EPIC' as typeof a.artifactType);
      if (epic) {
        const doc = await this.buildArtifactMarkdown(epic.id);
        await this.extendRtmWithEpic(mod.id, projectId, doc);
        epics++;
      }
      // User Stories → link
      const us = mod.artifacts.find((a) => a.artifactType === 'USER_STORY' as typeof a.artifactType);
      if (us) {
        const doc = await this.buildArtifactMarkdown(us.id);
        await this.extendRtmWithStories(mod.id, projectId, doc);
        stories++;
      }
      // SubTasks → link
      const subtaskCount = await this.prisma.baSubTask.count({ where: { moduleDbId: mod.id } });
      if (subtaskCount > 0) {
        await this.extendRtmWithSubTasks(mod.id, projectId);
        subtasks += subtaskCount;
      }
      // LLD → link pseudo-code files to RTM rows (uses the module's active lldArtifactId
      // when set, otherwise the newest LLD artifact for the module)
      const activeLldId = mod.lldArtifactId
        ?? mod.artifacts
          .filter((a) => a.artifactType === 'LLD' as typeof a.artifactType)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.id
        ?? null;
      if (activeLldId) {
        await this.extendRtmWithLld(mod.id, projectId, activeLldId);
        llds++;
      }
      // FTC → link test cases to RTM rows (uses the module's active ftcArtifactId
      // when set, otherwise the newest FTC artifact for the module)
      const activeFtcId = mod.ftcArtifactId
        ?? mod.artifacts
          .filter((a) => a.artifactType === 'FTC' as typeof a.artifactType)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.id
        ?? null;
      if (activeFtcId) {
        await this.extendRtmWithFtc(mod.id, projectId, activeFtcId);
        ftcs++;
      }
    }

    return { seeded, epics, stories, subtasks, llds, ftcs };
  }

  /** Reassemble an artifact's full markdown by concatenating section content (edited > AI). */
  private async buildArtifactMarkdown(artifactDbId: string): Promise<string> {
    const a = await this.prisma.baArtifact.findUnique({
      where: { id: artifactDbId },
      include: { sections: { orderBy: { createdAt: 'asc' } } },
    });
    if (!a) return '';
    return a.sections
      .map((s) => (s.isHumanModified && s.editedContent ? s.editedContent : s.content))
      .join('\n\n');
  }

  private async extendRtmWithSubTasks(moduleDbId: string, projectId: string): Promise<void> {
    const subtasks = await this.prisma.baSubTask.findMany({
      where: { moduleDbId },
      include: { sections: { where: { sectionKey: { in: ['end_to_end_flow', 'test_case_ids'] } } } },
    });

    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    let updated = 0;
    for (const st of subtasks) {
      if (!st.featureId) continue;

      // Find matching RTM row
      const rtmRow = await this.prisma.baRtmRow.findFirst({
        where: { projectId, moduleId: mod.moduleId, featureId: st.featureId },
      });

      if (rtmRow) {
        // Extract test case IDs from section content
        const testSection = st.sections.find((s) => s.sectionKey === 'end_to_end_flow' || s.sectionKey === 'test_case_ids');
        const testCaseIds: string[] = [];
        if (testSection) {
          const tcMatches = testSection.aiContent.matchAll(/TC-[A-Za-z0-9-]+/g);
          for (const m of tcMatches) testCaseIds.push(m[0]);
        }

        await this.prisma.baRtmRow.update({
          where: { id: rtmRow.id },
          data: {
            subtaskId: st.subtaskId,
            subtaskTeam: st.team,
            primaryClass: st.className ?? rtmRow.primaryClass,
            sourceFile: st.sourceFileName ?? rtmRow.sourceFile,
            methodName: st.methodName ?? rtmRow.methodName,
            testCaseIds: [...new Set([...rtmRow.testCaseIds, ...testCaseIds])],
            tbdFutureRef: st.tbdFutureRefs.length > 0 ? st.tbdFutureRefs[0] : rtmRow.tbdFutureRef,
          },
        });
        updated++;
      } else {
        this.logger.warn(`No RTM row for ${mod.moduleId}/${st.featureId} — creating one`);
        await this.prisma.baRtmRow.create({
          data: {
            projectId,
            moduleId: mod.moduleId,
            moduleName: mod.moduleName,
            packageName: mod.packageName,
            featureId: st.featureId,
            featureName: st.subtaskName,
            featureStatus: st.status,
            priority: st.priority ?? 'P1',
            screenRef: '',
            subtaskId: st.subtaskId,
            subtaskTeam: st.team,
            primaryClass: st.className,
            sourceFile: st.sourceFileName,
            methodName: st.methodName,
          },
        });
        updated++;
      }
    }
    this.logger.log(`Extended ${updated} RTM rows with SubTask data`);
  }

  /**
   * Link every pseudo-code file from the given LLD bundle back to the matching
   * RTM row(s), so the trace runs FRD → EPIC → Story → SubTask → LLD source file.
   *
   * Matching strategy (most to least reliable):
   *   1. Traceability block inside the file's content (ST: ST-US001-BE-03, US: US-001, FRD: F-01-06)
   *   2. Basename match against RTM.sourceFile
   *   3. Class-name match against RTM.primaryClass
   */
  private async extendRtmWithLld(
    moduleDbId: string,
    projectId: string,
    lldArtifactDbId: string,
  ): Promise<void> {
    const pseudoFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: lldArtifactDbId },
      orderBy: { path: 'asc' },
    });
    if (pseudoFiles.length === 0) return;

    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    const rtmRows = await this.prisma.baRtmRow.findMany({
      where: { projectId, moduleId: mod.moduleId },
    });
    if (rtmRows.length === 0) return;

    // rowId → (fileIds, filePaths)
    const attach: Record<string, { fileIds: Set<string>; filePaths: Set<string> }> = {};
    const ensure = (rowId: string) => {
      if (!attach[rowId]) attach[rowId] = { fileIds: new Set(), filePaths: new Set() };
      return attach[rowId];
    };

    for (const f of pseudoFiles) {
      const content = f.isHumanModified && f.editedContent ? f.editedContent : f.aiContent;
      const basename = f.path.split('/').pop() ?? '';
      const baseNoExt = basename.replace(/\.[^./]+$/, '');

      // 1. Traceability block — pull all ST/US/FRD IDs mentioned in the file
      const stIds = new Set<string>([...content.matchAll(/\bST-[A-Z0-9]+-[A-Z]+-\d+/g)].map((m) => m[0]));
      const usIds = new Set<string>([...content.matchAll(/\bUS-\d+/g)].map((m) => m[0]));
      const frdIds = new Set<string>([...content.matchAll(/\bF-\d{2}-\d{2}/g)].map((m) => m[0]));

      let matchedAny = false;
      for (const row of rtmRows) {
        const idHit = (row.subtaskId && stIds.has(row.subtaskId))
          || (row.storyId && usIds.has(row.storyId))
          || (row.featureId && frdIds.has(row.featureId));
        const nameHit = (row.sourceFile && row.sourceFile === basename)
          || (row.primaryClass && row.primaryClass === baseNoExt);
        if (idHit || nameHit) {
          const bucket = ensure(row.id);
          bucket.fileIds.add(f.id);
          bucket.filePaths.add(f.path);
          matchedAny = true;
        }
      }

      if (!matchedAny) {
        this.logger.debug(`LLD-RTM: no row matched pseudo file ${f.path}`);
      }
    }

    let updated = 0;
    for (const row of rtmRows) {
      const hit = attach[row.id];
      const layer = this.deriveRtmLayer(row.subtaskTeam, hit ? Array.from(hit.filePaths) : []);
      await this.prisma.baRtmRow.update({
        where: { id: row.id },
        data: {
          lldArtifactId: lldArtifactDbId,
          layer,
          pseudoFileIds: hit ? Array.from(hit.fileIds) : [],
          pseudoFilePaths: hit ? Array.from(hit.filePaths) : [],
        },
      });
      if (hit) updated++;
    }
    this.logger.log(`Extended ${updated}/${rtmRows.length} RTM rows with LLD pseudo files from ${lldArtifactDbId}`);
  }

  /** Derive the RTM "layer" from subtask team + file paths (path wins when available). */
  private deriveRtmLayer(team: string | null, paths: string[]): string | null {
    for (const p of paths) {
      const lower = p.toLowerCase();
      if (/schema|migration|\.sql|ddl/.test(lower)) return 'Database';
      if (/frontend|\/ui\/|\.tsx$|\.jsx$|components?\//.test(lower)) return 'Frontend';
      if (/integration|api\/clients|adapter|connector/.test(lower)) return 'Integration';
      if (/\.test\.|\.spec\.|__tests__/.test(lower)) return 'Testing';
      if (/backend|services?\/|controllers?\/|\.py$|\.java$/.test(lower)) return 'Backend';
    }
    switch (team) {
      case 'FE': return 'Frontend';
      case 'BE': return 'Backend';
      case 'IN': return 'Integration';
      case 'QA': return 'Testing';
      default: return null;
    }
  }

  /**
   * Link every test case from the given FTC bundle back to matching RTM rows.
   * Matching strategy:
   *   - TC.linkedFeatureIds / linkedStoryIds / linkedSubtaskIds (authoritative)
   *   - Fall back to scanning TC text for F-XX-XX / US-NNN / ST-USxxx patterns
   * Also aggregates OWASP web + LLM categories observed on each row's TCs.
   */
  private async extendRtmWithFtc(
    moduleDbId: string,
    projectId: string,
    ftcArtifactDbId: string,
  ): Promise<void> {
    const testCases = await this.prisma.baTestCase.findMany({
      where: { artifactDbId: ftcArtifactDbId },
    });
    if (testCases.length === 0) return;

    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) return;

    const rtmRows = await this.prisma.baRtmRow.findMany({
      where: { projectId, moduleId: mod.moduleId },
    });
    if (rtmRows.length === 0) return;

    const OWASP_WEB = new Set(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']);
    const OWASP_LLM = new Set(['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10']);

    // rowId → { ids: Set<tcId>, refs: Set<TC-001>, web: Set, llm: Set }
    type Bucket = { ids: Set<string>; refs: Set<string>; web: Set<string>; llm: Set<string> };
    const attach: Record<string, Bucket> = {};
    const ensure = (rowId: string): Bucket => {
      if (!attach[rowId]) {
        attach[rowId] = { ids: new Set(), refs: new Set(), web: new Set(), llm: new Set() };
      }
      return attach[rowId];
    };

    for (const tc of testCases) {
      const raw = tc.aiContent ?? '';
      const derivedFeatures = new Set<string>([...raw.matchAll(/\bF-\d{2}-\d{2}/g)].map((m) => m[0]));
      const derivedStories = new Set<string>([...raw.matchAll(/\bUS-\d+/g)].map((m) => m[0]));
      const derivedSubtasks = new Set<string>([...raw.matchAll(/\bST-[A-Z0-9]+-[A-Z]+-\d+/g)].map((m) => m[0]));

      const effectiveFeatures = new Set<string>([
        ...tc.linkedFeatureIds,
        ...derivedFeatures,
      ]);
      const effectiveStories = new Set<string>([...tc.linkedStoryIds, ...derivedStories]);
      const effectiveSubtasks = new Set<string>([...tc.linkedSubtaskIds, ...derivedSubtasks]);

      for (const row of rtmRows) {
        const hit =
          (row.featureId && effectiveFeatures.has(row.featureId)) ||
          (row.storyId && effectiveStories.has(row.storyId)) ||
          (row.subtaskId && effectiveSubtasks.has(row.subtaskId));
        if (!hit) continue;
        const bucket = ensure(row.id);
        bucket.ids.add(tc.id);
        bucket.refs.add(tc.testCaseId);
        if (tc.owaspCategory) {
          if (OWASP_WEB.has(tc.owaspCategory)) bucket.web.add(tc.owaspCategory);
          else if (OWASP_LLM.has(tc.owaspCategory)) bucket.llm.add(tc.owaspCategory);
        }
      }
    }

    let updated = 0;
    for (const row of rtmRows) {
      const hit = attach[row.id];
      await this.prisma.baRtmRow.update({
        where: { id: row.id },
        data: {
          ftcArtifactId: ftcArtifactDbId,
          ftcTestCaseIds: hit ? Array.from(hit.ids) : [],
          ftcTestCaseRefs: hit ? Array.from(hit.refs).sort() : [],
          owaspWebCategories: hit ? Array.from(hit.web).sort() : [],
          owaspLlmCategories: hit ? Array.from(hit.llm).sort() : [],
        },
      });
      if (hit) updated++;
    }
    this.logger.log(`Extended ${updated}/${rtmRows.length} RTM rows with FTC test cases from ${ftcArtifactDbId}`);
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
    const updated = await this.prisma.baSkillExecution.update({
      where: { id: executionId },
      data: { status: BaExecutionStatus.APPROVED },
    });

    // When SKILL-05 (final skill) is approved, mark the module as APPROVED
    if (exec.skillName === 'SKILL-05') {
      await this.prisma.baModule.update({
        where: { id: exec.moduleDbId },
        data: { moduleStatus: BaModuleStatus.APPROVED, approvedAt: new Date() },
      });
    }

    return updated;
  }

  async retryExecution(moduleDbId: string, skillName: SkillName): Promise<string> {
    return this.executeSkill(moduleDbId, skillName);
  }

  // ─── Artifact CRUD ─────────────────────────────────────────────────────

  async getArtifact(artifactId: string) {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactId },
      include: {
        sections: { orderBy: { createdAt: 'asc' } },
        module: {
          include: {
            project: true,
            screens: {
              orderBy: { displayOrder: 'asc' },
              select: { id: true, screenId: true, screenTitle: true, screenType: true, fileData: true, displayOrder: true, textDescription: true },
            },
          },
        },
      },
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
    const rows = await this.prisma.baRtmRow.findMany({
      where: { projectId },
      orderBy: [{ moduleId: 'asc' }, { featureId: 'asc' }],
    });

    // Collect every testCaseId referenced across all rows, then resolve to the
    // denormalized executionStatus cached on BaTestCase. One bulk query instead
    // of N per-row queries.
    const allRefs = Array.from(
      new Set(rows.flatMap((r) => r.ftcTestCaseRefs ?? []).filter(Boolean)),
    );
    const statusByRef = new Map<string, string>();
    const sprintFkByRef = new Map<string, string | null>();
    const sprintCodeByRef = new Map<string, string | null>();
    if (allRefs.length > 0) {
      // Pull both the denormalized exec status AND the sprint FK so RTM can
      // filter/group by canonical sprint without another round-trip.
      const tcs = await this.prisma.baTestCase.findMany({
        where: { testCaseId: { in: allRefs } },
        select: { testCaseId: true, executionStatus: true, sprintDbId: true, sprintId: true },
      });
      for (const tc of tcs) {
        statusByRef.set(tc.testCaseId, tc.executionStatus);
        sprintFkByRef.set(tc.testCaseId, tc.sprintDbId);
        sprintCodeByRef.set(tc.testCaseId, tc.sprintId);
      }
    }

    return rows.map((r) => {
      const refs = r.ftcTestCaseRefs ?? [];
      const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0 };
      const sprintFkSet = new Set<string>();
      const sprintCodeSet = new Set<string>();
      for (const ref of refs) {
        const s = statusByRef.get(ref) ?? 'NOT_RUN';
        if (s in counts) counts[s as keyof typeof counts] += 1;
        else counts.NOT_RUN += 1;
        const fk = sprintFkByRef.get(ref);
        if (fk) sprintFkSet.add(fk);
        const code = sprintCodeByRef.get(ref);
        if (code) sprintCodeSet.add(code);
      }
      // Collapse to a single verdict so the RTM table can show a pill at a
      // glance: any FAIL → FAIL, any BLOCKED → BLOCKED, all PASS → PASS, else
      // MIXED (some run, some not) or NOT_RUN (nothing executed).
      let verdict: 'PASS' | 'FAIL' | 'BLOCKED' | 'MIXED' | 'NOT_RUN' = 'NOT_RUN';
      if (refs.length > 0) {
        if (counts.FAIL > 0) verdict = 'FAIL';
        else if (counts.BLOCKED > 0) verdict = 'BLOCKED';
        else if (counts.PASS === refs.length) verdict = 'PASS';
        else if (counts.PASS > 0 || counts.SKIPPED > 0) verdict = 'MIXED';
      }
      return {
        ...r,
        execCounts: counts,
        execVerdict: verdict,
        sprintDbIds: Array.from(sprintFkSet),
        sprintCodes: Array.from(sprintCodeSet),
      };
    });
  }

  /**
   * Test-execution roll-up for the project dashboard. Uses the denormalized
   * status on BaTestCase so this stays O(1) query-count.
   */
  async getProjectExecutionHealth(projectId: string) {
    const tcs = await this.prisma.baTestCase.findMany({
      where: { artifact: { module: { projectId } } },
      select: {
        id: true,
        testCaseId: true,
        title: true,
        executionStatus: true,
        lastRunAt: true,
        artifact: {
          select: {
            module: { select: { id: true, moduleId: true, moduleName: true } },
          },
        },
      },
    });

    const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0 };
    let lastRunAt: Date | null = null;
    for (const tc of tcs) {
      const s = (tc.executionStatus in counts) ? (tc.executionStatus as keyof typeof counts) : 'NOT_RUN';
      counts[s] += 1;
      if (tc.lastRunAt && (!lastRunAt || tc.lastRunAt > lastRunAt)) lastRunAt = tc.lastRunAt;
    }
    const total = tcs.length;
    const executed = total - counts.NOT_RUN;
    const passRate = executed > 0 ? Math.round((counts.PASS / executed) * 100) : 0;

    const defects = await this.prisma.baDefect.findMany({
      where: { testCase: { artifact: { module: { projectId } } } },
      select: { id: true, severity: true, status: true },
    });
    const openDefects = defects.filter((d) => !['FIXED', 'VERIFIED', 'CLOSED', 'WONT_FIX'].includes(d.status)).length;
    const criticalOpenDefects = defects.filter(
      (d) => ['P0', 'P1'].includes(d.severity) && !['FIXED', 'VERIFIED', 'CLOSED', 'WONT_FIX'].includes(d.status),
    ).length;

    const failingTcs = tcs
      .filter((tc) => tc.executionStatus === 'FAIL')
      .slice(0, 10)
      .map((tc) => ({
        id: tc.id,
        testCaseId: tc.testCaseId,
        title: tc.title,
        moduleId: tc.artifact.module.moduleId,
        moduleName: tc.artifact.module.moduleName,
        moduleDbId: tc.artifact.module.id,
      }));

    const blockedTcs = tcs
      .filter((tc) => tc.executionStatus === 'BLOCKED')
      .slice(0, 10)
      .map((tc) => ({
        id: tc.id,
        testCaseId: tc.testCaseId,
        title: tc.title,
        moduleId: tc.artifact.module.moduleId,
        moduleName: tc.artifact.module.moduleName,
        moduleDbId: tc.artifact.module.id,
      }));

    return {
      total,
      executed,
      passRate,
      counts,
      openDefects,
      criticalOpenDefects,
      lastRunAt,
      failingTcs,
      blockedTcs,
    };
  }

  // ─── Export ────────────────────────────────────────────────────────────

  async getExportData(projectId: string) {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      include: {
        modules: {
          include: {
            artifacts: { include: { sections: true } },
            skillExecutions: {
              where: { status: { in: [BaExecutionStatus.APPROVED, BaExecutionStatus.AWAITING_REVIEW, BaExecutionStatus.COMPLETED] } },
              orderBy: { createdAt: 'desc' },
            },
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
