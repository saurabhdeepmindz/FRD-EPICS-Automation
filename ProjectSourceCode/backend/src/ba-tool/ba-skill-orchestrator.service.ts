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
      // SKILL-07-FTC: like SKILL-05, the comprehensive skill file gets
      // pattern-matched away under deep context (EPIC + ~27 stories +
      // ~150 SubTasks fed in). Observed regression: AI emits a Coverage
      // Analysis for the LAST story only, in markdown-table form, with
      // ZERO ```tc id=...``` fenced blocks — so the BaFtcParser finds
      // 0 test cases. Wrap the skill prompt in a focus override that
      // re-states the parser-shape contract + full-coverage requirement.
      //
      // SKILL-06-LLD: same regression class. On modules with 9+ features
      // the AI pattern-matches to a per-user-story LLD scope (e.g.
      // "# LLD: <story title> (US-NNN, MOD-NN, F-NN-NN)") instead of the
      // module-wide 19-section structure defined in
      // FINAL-SKILL-06-create-lld.md §3. The parser then stores 17 of 19
      // canonical sections as empty (the AI used non-canonical headings
      // like `## 1. Identification` / `## 4. Public Contract`). Wrapper
      // re-states the canonical 19-heading order + forbids per-story scope.
      let wrappedPrompt = skillPrompt;
      if (skillName === 'SKILL-07-FTC') {
        wrappedPrompt = this.wrapSkill07Prompt(skillPrompt, contextPacket);
      } else if (skillName === 'SKILL-06-LLD') {
        wrappedPrompt = this.wrapSkill06Prompt(skillPrompt, contextPacket);
      } else if (skillName === 'SKILL-01-S') {
        wrappedPrompt = this.wrapSkill01SPrompt(skillPrompt, contextPacket);
      }

      // SKILL-05: route through the per-story append loop.
      // Legacy single-shot collapses into a meta-overview document on
      // modules with more than ~10-15 user stories — 100+ structured
      // 6KB SubTasks don't fit in one response. The per-story loop
      // (one AI call per US-NNN, append to artifact) is the proven
      // path that built MOD-04's full SubTask structure.
      let aiResponse: string;
      if (skillName === 'SKILL-04') {
        aiResponse = await this.callAiServiceSkill04PerFeature(skillPrompt, contextPacket);
      } else if (skillName === 'SKILL-05') {
        aiResponse = await this.runSkill05PerStoryLoop(moduleDbId);
      } else {
        aiResponse = await this.callAiService(wrappedPrompt, contextPacket);
      }

      // 5. Parse and store output
      const { humanDocument, handoffPacket } = this.parseAiOutput(aiResponse);

      // 5a. SKILL-01-S contract enforcement: every feature in the module
      // MUST be emitted as a #### F-XX-XX: heading block carrying all 9
      // mandatory attributes. Without this guard, SKILL-01-S can silently
      // emit a catalog-table-only FRD that breaks downstream skills and
      // the artifact tree. We persist the raw output so a developer can
      // inspect what was generated, but mark the execution FAILED so the
      // workflow does not advance with a degraded FRD.
      if (skillName === 'SKILL-01-S') {
        const v = this.validateSkill01SOutput(humanDocument, handoffPacket);
        if (!v.ok) {
          const detailLines: string[] = [v.summary];
          if (v.missingFeatures.length > 0) {
            detailLines.push(`Missing detail blocks (no #### F-XX-XX: heading): ${v.missingFeatures.join(', ')}`);
          }
          if (v.partialFeatures.length > 0) {
            detailLines.push('Incomplete detail blocks (missing attributes):');
            for (const pf of v.partialFeatures) {
              detailLines.push(`  - ${pf.featureId}: missing [${pf.missingAttributes.join(', ')}]`);
            }
          }
          detailLines.push('Re-run SKILL-01-S; the prompt now requires Section 4-Detail with all 9 attributes per feature.');
          const errorMessage = detailLines.join('\n');
          await this.prisma.baSkillExecution.update({
            where: { id: executionId },
            data: {
              status: BaExecutionStatus.FAILED,
              rawOutput: aiResponse,
              humanDocument,
              handoffPacket: handoffPacket as object | undefined,
              completedAt: new Date(),
              errorMessage,
            },
          });
          this.logger.error(`SKILL-01-S validation failed for module ${moduleDbId}: ${v.summary}`);
          return;
        }
        this.logger.log(`SKILL-01-S validation passed for module ${moduleDbId}: ${v.summary}`);
      }

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

      // 6. Create artifact records.
      // SKILL-05 special case: the per-story append loop in step 4 has
      // already created and populated the SUBTASK artifact section by
      // section. Calling createArtifactFromOutput here would create a
      // SECOND empty artifact and the post-processing step would then
      // store BaSubTask records referencing the wrong artifactId. So we
      // just look up the existing artifact for downstream processing.
      const artifact = skillName === 'SKILL-05'
        ? await this.prisma.baArtifact.findFirst({
            where: { moduleDbId, artifactType: BaArtifactType.SUBTASK },
            orderBy: { createdAt: 'desc' },
          })
        : await this.createArtifactFromOutput(moduleDbId, skillName, humanDocument, handoffPacket);

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
        ctx = this.assembleSkill05Context(mod, approvedModules, tbdEntries, rtmRows);
        // Inject resolved tech stack so SubTasks are generated with the
        // project's frameworks / database in mind (imports, file paths,
        // test frameworks, ORM shape, etc.). Falls back to sensible
        // defaults when the Architect hasn't filled BaLldConfig.
        ctx.techStack = await this.resolveTechStack(moduleDbId, mod.projectId ?? null);
        break;
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
   * Resolve the tech stack for a module. Priority:
   *   1. BaLldConfig for this specific module (Architect's selections)
   *   2. BaLldConfig for any other module in the same project (first non-empty fields win)
   *   3. Project default stored on BaProject.sqlDialect (DB only) + hardcoded framework fallbacks
   *
   * The fallback stack is intentionally Next.js + NestJS + PostgreSQL because
   * that's what this repo itself uses; changes are one line away if needed.
   * SubTasks read this to emit stack-appropriate code (imports, file paths,
   * test frameworks, ORM usage).
   */
  private async resolveTechStack(moduleDbId: string, projectId: string | null): Promise<Record<string, string>> {
    const nameFromMaster = async (id: string | null): Promise<string | null> => {
      if (!id) return null;
      const entry = await this.prisma.baMasterDataEntry.findUnique({ where: { id }, select: { name: true } });
      return entry?.name ?? null;
    };

    // 1. Module-specific LLD config
    let cfg = await this.prisma.baLldConfig.findUnique({ where: { moduleDbId } });

    // 2. Fall back to any other module's LLD config in the same project
    if ((!cfg || (!cfg.frontendStackId && !cfg.backendStackId && !cfg.databaseId)) && projectId) {
      const sibling = await this.prisma.baLldConfig.findFirst({
        where: {
          module: { projectId },
          OR: [
            { frontendStackId: { not: null } },
            { backendStackId: { not: null } },
            { databaseId: { not: null } },
          ],
        },
      });
      if (sibling) cfg = cfg ? { ...cfg, ...sibling } : sibling;
    }

    const [frontend, backend, database, architecture] = await Promise.all([
      nameFromMaster(cfg?.frontendStackId ?? null),
      nameFromMaster(cfg?.backendStackId ?? null),
      nameFromMaster(cfg?.databaseId ?? null),
      nameFromMaster(cfg?.architectureId ?? null),
    ]);

    // 3. Project SQL dialect is also useful — plus hardcoded defaults for
    //    any field still null so the AI always has a stack to target.
    let sqlDialect: string | null = null;
    if (projectId) {
      const p = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { sqlDialect: true } });
      sqlDialect = p?.sqlDialect ?? null;
    }

    return {
      frontend: frontend ?? 'Next.js (App Router, TypeScript, Tailwind CSS)',
      backend: backend ?? 'NestJS (TypeScript, Prisma ORM)',
      database: database ?? (sqlDialect ? `PostgreSQL (dialect: ${sqlDialect})` : 'PostgreSQL'),
      architecture: architecture ?? 'Modular monolith (frontend + backend + separate AI service)',
      // Naming conventions implied by the stack — the AI reads these to
      // pick file paths and imports.
      frontendExt: /next|react/i.test(frontend ?? 'Next.js') ? '.tsx' : '.ts',
      backendExt: /nest|express|typescript/i.test(backend ?? 'NestJS') ? '.ts' : '.py',
      ormHint: /prisma/i.test(backend ?? 'NestJS') ? 'Prisma ORM (schema.prisma)' : 'Your project\'s preferred ORM',
      testFrameworkFrontend: 'Jest + React Testing Library (or Playwright for E2E)',
      testFrameworkBackend: 'Jest + supertest (for e2e), plain Jest (for unit)',
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
  /**
   * Wrap the SKILL-07-FTC prompt with a focus override that re-states the
   * parser contract and the full-coverage requirement. Without this, the
   * AI consistently emits a Coverage Analysis for one story in markdown-
   * table form (no ```tc id=...``` fenced blocks) and the BaFtcParser
   * finds zero test cases. Same root cause as the SKILL-05 single-story
   * regression: comprehensive skill files get pattern-matched away under
   * deep context.
   *
   * The override is short and explicit:
   *  - Cover ALL user stories listed in the input (not just one)
   *  - Every test case MUST be a ```tc id=TC-NNN ...``` fenced block
   *    with the canonical header attrs and the §5 body shape
   *  - The Test Case Appendix is mandatory — parser reads from there
   */
  private wrapSkill07Prompt(
    skillPrompt: string,
    contextPacket: Record<string, unknown>,
  ): string {
    // Pull the story IDs out of the input doc so we can name them.
    const userStoriesDoc = String(contextPacket.userStoriesDocument ?? '');
    const storyIds = Array.from(new Set(userStoriesDoc.match(/US-\d{3,}/g) ?? []))
      .sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10));
    const storyList = storyIds.length > 0
      ? `${storyIds.length} stories: ${storyIds.slice(0, 4).join(', ')}${storyIds.length > 4 ? `, …, ${storyIds[storyIds.length - 1]}` : ''}`
      : 'all user stories present in the input';

    return [
      '## 🎯 SKILL-07-FTC FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      `Generate test cases that cover **ALL ${storyList}** in this module — NOT a single story. The Coverage Summary, OWASP Map, AC Coverage, and especially the §17 Test Case Appendix MUST span every user story present in the input. Do not produce a Coverage Analysis essay focused on one story.`,
      '',
      '### Parser contract (CRITICAL — non-negotiable)',
      '',
      'The backend parser ONLY reads test cases from ```tc id=...``` fenced blocks. A markdown table listing TC-IDs is IGNORED — zero `BaTestCase` rows are written when there are no fences. The parser is also strict about heading names: `### Expected Result`, `### Steps`, `### Traceability`, or an inline `preconditions:` key:value line WILL DROP the corresponding field on every TC. The reference reading is §5 of the skill file below — match it exactly.',
      '',
      'Every test case MUST be a fenced block in this exact shape (all header `key: value` lines + all 10 `### ` sub-section blocks present), and every TC MUST also appear in the §17 Test Case Appendix verbatim:',
      '',
      '```text',
      '```tc id=TC-001 parent= scope=black_box testKind=positive category=Functional priority=P1 owasp= isIntegrationTest=false sprintId= executionStatus=NOT_RUN scenarioGroup=Login',
      'title: User logs in with valid credentials',
      'linkedFeatureIds: F-01-02',
      'linkedEpicIds: EPIC-01',
      'linkedStoryIds: US-001',
      'linkedSubtaskIds: ST-US001-BE-03',
      'linkedPseudoFileIds:',
      'linkedLldArtifactId:',
      'tags: auth, smoke',
      'supportingDocs: Login Flow Screenshot, Auth API trace',
      'defectIds:',
      '',
      '### Test Data',
      'Email: alice@acme.com',
      'Password: P@ssw0rd!',
      '',
      '### Pre Condition',
      '- Tenant `acme` exists',
      '- User `alice@acme.com` registered with the password above',
      '- Application URL is accessible',
      '',
      '### E2E Flow',
      'Launch URL → Login → Enter credentials → Submit → Dashboard loaded',
      '',
      '### Test Steps',
      '1. Launch the application URL.',
      '2. Click **Login**.',
      '3. Enter email `alice@acme.com`.',
      '4. Enter password `P@ssw0rd!`.',
      '5. Click **Sign in**.',
      '',
      '### Expected',
      '- Browser redirects to `/dashboard`.',
      '- Session cookie `sid` is set with `HttpOnly; Secure; SameSite=Lax`.',
      '- User greeting shows "Welcome, Alice".',
      '',
      '### Post Validation',
      '- Audit row `action=LOGIN_SUCCESS, actor=alice@acme.com` written within 10 s.',
      '- No `LOGIN_FAILURE` row.',
      '- `/api/auth/login` returned 200 with a JWT expiring in 24 h.',
      '',
      '### SQL Setup',
      "INSERT INTO tenants (id, name) VALUES ('acme', 'Acme Corp');",
      "INSERT INTO users (id, email, password_hash, tenant_id) VALUES ('u1', 'alice@acme.com', '$argon2id$...', 'acme');",
      '',
      '### SQL Verify',
      'SELECT COUNT(*) = 1 AS ok FROM audit_events',
      "WHERE actor = 'alice@acme.com' AND action = 'LOGIN_SUCCESS' AND created_at > NOW() - INTERVAL \'1 minute\';",
      '',
      '### Playwright Hint',
      "await page.goto('/login');",
      "await page.getByLabel('Email').fill('alice@acme.com');",
      "await page.getByLabel('Password').fill('P@ssw0rd!');",
      "await page.getByRole('button', { name: 'Sign in' }).click();",
      'await expect(page).toHaveURL(/\\/dashboard/);',
      '',
      '### Developer Hints',
      'AuthService.login(email, password) returns { userId, tenantId, sessionId } on success.',
      'Unit test: mocked user repo; verify password_hash check and audit row emission.',
      '```',
      '```',
      '',
      'Mandatory header attrs (case-sensitive): `id`, `parent`, `scope` (black_box / white_box), `testKind` (positive / negative / edge), `category` (Functional / Integration / Security / Data / UI / Performance / Accessibility / Regression / Smoke), `priority` (P0 / P1 / P2), `owasp` (A01–A10 or LLM01–LLM10 or blank), `isIntegrationTest` (true / false), `sprintId` (blank), `executionStatus=NOT_RUN`, `scenarioGroup` (a SHORT human label like "Login" / "Forgot Password" / "SLA Breach Banner — Happy Path" — NOT a feature ID like F-04-01).',
      '',
      'Mandatory header `key: value` lines (one per line, before the first `###`): `title`, `linkedFeatureIds`, `linkedEpicIds`, `linkedStoryIds`, `linkedSubtaskIds`, `linkedPseudoFileIds`, `linkedLldArtifactId`, `tags`, `supportingDocs`, `defectIds`. Use comma-separated values; leave blank when nothing applies but DO NOT skip the line.',
      '',
      'Mandatory `### ` sub-section blocks (in this order, each populated unless the rule below allows blank): `### Test Data`, `### Pre Condition`, `### E2E Flow`, `### Test Steps`, `### Expected`, `### Post Validation`, `### SQL Setup`, `### SQL Verify`, `### Playwright Hint`, `### Developer Hints`.',
      '',
      '- `### Pre Condition` — H3 block (NOT an inline `preconditions:` key:value line).',
      '- `### Test Steps` — H3 heading exactly (not `### Steps`).',
      '- `### Expected` — H3 heading exactly (not `### Expected Result` — the parser drops anything else).',
      '- `### SQL Setup` / `### SQL Verify` — only skip when the TC is pure UI with no DB surface; if so leave the heading + `-- N/A` body so the structure is preserved.',
      '- `### Playwright Hint` — only skip when ftcConfig.testingFrameworks excludes Playwright (use `### pytest Hint` / `### k6 Script` etc. per §5 framework routing); never replace with a `### Traceability` block.',
      '- `### Developer Hints` — 1–3 sentences for white-box / TDD followup; leave blank only for pure end-to-end UI cases.',
      '- DO NOT add a `### Traceability` block — traceability lives in the `linkedFeatureIds / linkedEpicIds / linkedStoryIds / linkedSubtaskIds` header lines instead. The parser ignores `### Traceability`.',
      '',
      'TC ID convention: sequential `TC-001`, `TC-002`, … for positive cases and `Neg_TC-005`, `Neg_TC-006`, … for negative cases — a single shared numeric sequence across the artifact. DO NOT use story-coded IDs like `TC-US074-BE-003`; sequential is the canonical convention. `parent` stays blank unless `isIntegrationTest=true`, in which case it is the parent TC ID (e.g. `parent=TC-005`) — never set parent to a feature ID.',
      '',
      'Coverage requirements:',
      '- At least 1 happy-path TC per user story',
      '- At least 1 negative TC per user story (`Neg_TC-NNN` id prefix, `testKind=negative`)',
      '- Boundary / edge TCs where the AC mentions limits, ranges, or quotas',
      '- For CONFIRMED-PARTIAL stories with TBD-Future stubs: include stub-integration TCs marked `category=Integration` and explicitly note the stub in `### Pre Condition`',
      '',
      '### What MUST appear at the bottom of the document',
      '',
      'A `## Test Case Appendix` heading followed by every ```tc id=...``` block from the body, repeated verbatim. The parser reads from the appendix as the authoritative source. Skip the appendix → parser finds zero test cases.',
      '',
      '---',
      '',
      '## Original Skill Definition (follow all rules below — especially §5 Test Case Block Format and §17 Test Case Appendix)',
      '',
      skillPrompt,
    ].join('\n');
  }

  /**
   * Wrap the SKILL-06-LLD prompt with a focus override that re-states the
   * 19-section canonical contract and the parser-shape requirement. Without
   * this wrapper, on large modules (10+ features) the AI consistently
   * pattern-matches to a per-user-story LLD format (one document scoped to
   * a single US-NNN / F-NN-NN) instead of producing the module-wide LLD
   * with 19 canonical `## ` headings. Same regression class as the
   * SKILL-07-FTC single-story drift the FTC wrapper fixed.
   *
   * The override is short and explicit:
   *  - Produce ONE module-wide LLD covering ALL features in the input
   *  - Use the EXACT 19 `## ` headings from FINAL-SKILL-06-create-lld.md §3
   *  - Append `## Pseudo-Code Files` at the end with at least 8-15 files
   *  - Do NOT scope the document to a single user story / feature
   *  - Do NOT use a `# LLD: <story title>` H1 — the parser splits on H2 only
   */
  /**
   * Wrap the SKILL-01-S prompt with a focus override that re-states the
   * Section 4-Detail per-feature 9-attribute contract. Without this
   * wrapper, the FRD prompt is large enough that under deep context the
   * AI pattern-matches to a "catalog table + spotlight examples" shape —
   * observed on MOD-05 — emitting all features as a 21-row table but
   * only producing detailed `#### F-XX-XX:` heading blocks for the
   * partial-status features. The orchestrator's post-emission
   * `validateSkill01SOutput()` is the safety net that hard-fails such
   * outputs; this wrapper is the prevention layer that makes the
   * happy-path more reliable.
   *
   * The override is short and explicit:
   *  - One `#### F-XX-XX: Name` heading block per feature (no exceptions)
   *  - All 9 mandatory attributes per block, in canonical order
   *  - Section 4 (catalog table) and Section 4-Detail (heading blocks) are
   *    BOTH required — neither replaces the other
   */
  private wrapSkill01SPrompt(
    skillPrompt: string,
    contextPacket: Record<string, unknown>,
  ): string {
    // Pull a hint of how many features are expected from the screen summary
    // cards so we can name a target count in the override. This is best-
    // effort: SKILL-01-S derives the actual feature list from the screens,
    // so we don't enumerate Feature IDs here (they don't exist yet).
    const cards = Array.isArray(contextPacket.screenSummaryCards)
      ? (contextPacket.screenSummaryCards as unknown[])
      : [];
    const screenCount = cards.length;
    const moduleId = String(contextPacket.moduleId ?? 'this module');
    const moduleName = String(contextPacket.moduleName ?? '');

    return [
      '## 🎯 SKILL-01-S FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      `Produce the FRD module section for **${moduleId}${moduleName ? ` — ${moduleName}` : ''}** covering ALL ${screenCount > 0 ? `${screenCount} screens` : 'screens'} present in the Screen Summary Cards. Every screen-derived feature MUST appear in BOTH Section 4 (catalog table) AND Section 4-Detail (per-feature heading blocks). Section 4-Detail is non-optional and non-negotiable.`,
      '',
      '### Validator contract (CRITICAL — non-negotiable)',
      '',
      'The backend will run a post-emission validator (`validateSkill01SOutput`) that walks the markdown looking for `#### F-XX-XX:` heading blocks. Its rules:',
      '',
      '1. The number of `#### F-XX-XX:` heading blocks must equal the number of distinct Feature IDs in the module — same count as the Section 4 catalog table rows and the `features[]` array in the Handoff Packet JSON.',
      '2. Each block must contain ALL 9 mandatory attribute labels, prefixed with `- **<Label>:**`, in this order: **Description**, **Screen Reference**, **Trigger**, **Pre-Conditions**, **Post-Conditions**, **Business Rules**, **Validations**, **Integration Signals**, **Acceptance Criteria**.',
      '3. Empty values, bare `TBD`, naked dashes, or omitted bullets are validation failures. If an attribute is genuinely not applicable, write a one-line rationale starting with `N/A —` (e.g. `N/A — read-only feature, no input validations`).',
      '4. The Handoff Packet JSON `features[]` array must carry the same 9 attribute keys (`description`, `screenRef`, `trigger`, `preConditions`, `postConditions`, `businessRules`, `validations`, `integrationSignals`, `acceptanceCriteria`) for every entry. Missing keys = validation failure.',
      '',
      'If the validator fails, the execution is marked FAILED with a structured error listing the missing/incomplete features. The pipeline does NOT advance to SKILL-02-S.',
      '',
      '### Forbidden patterns (will fail validation)',
      '',
      '- ❌ Catalog-table-only output: emitting Section 4 (the `| F-XX-XX | Name | Status | Priority | Screen | ... |` table) WITHOUT also emitting a `#### F-XX-XX:` heading block per row.',
      '- ❌ Spotlight-detail-only output: emitting heading blocks for only a handful of features (e.g. just the CONFIRMED-PARTIAL ones) and treating the catalog table as "enough" for the rest.',
      '- ❌ Substituting `**F-XX-XX:** Name` (bold-only, no `####` heading) for the heading. The validator parses on the four-hash heading; bold-only mentions do NOT count.',
      '- ❌ Omitting any of the 9 attribute labels from any block. All 9 must be present even if a value is `N/A — ...`.',
      '- ❌ Wrapping attribute values inside a single paragraph instead of bullet lines. The Pre-Conditions, Post-Conditions, Business Rules, Validations, Integration Signals, and Acceptance Criteria attributes MUST use bullet lines (`- ...`).',
      '',
      '### Mandatory per-feature heading block format',
      '',
      'Emit each feature in EXACTLY this shape (one block per feature, in numerical Feature ID order):',
      '',
      '```markdown',
      '#### F-XX-XX: <Feature Name>',
      '',
      '- **Description:** 2–4 sentences synthesising the screen analysis into the full behaviour. Must be specific enough that a developer can implement without re-reading the screen.',
      '- **Screen Reference:** SCR-NN — Screen Title',
      '- **Trigger:** What initiates the feature (verb-led, e.g. "Admin clicks Save").',
      '- **Pre-Conditions:**',
      '  - Condition 1',
      '  - Condition 2',
      '- **Post-Conditions:**',
      '  - State 1 after success',
      '  - State 2',
      '- **Business Rules:**',
      '  - BR-01: Named rule with explicit logic',
      '  - BR-02: ...',
      '- **Validations:**',
      '  - Field-level validation 1',
      '  - ... (or `N/A — read-only feature, no input validations`)',
      '- **Integration Signals:**',
      '  - Signal 1: <Name> — <CLASSIFICATION> — Used for: <purpose> — Assumed Interface: `<sig>` — Resolution: <N/A | TBD-Future ref TBD-NNN>',
      '  - ... (or `N/A — self-contained feature, no integration dependencies`)',
      '- **Acceptance Criteria:**',
      '  - AC-01: Plain-English business-level criterion',
      '  - AC-02: ...',
      '```',
      '',
      'The skill file (loaded above) carries the full per-attribute semantics. This wrapper is a structural reminder — it does NOT override the attribute definitions in Step 2 of the skill file.',
      '',
      `Self-check before emitting your response: count your \`#### F-XX-XX:\` heading blocks. If the count does not equal the number of features you derived from the screens, you have a validation failure waiting to happen — emit the missing blocks before responding.`,
      '',
      '---',
      '',
      skillPrompt,
    ].join('\n');
  }

  private wrapSkill06Prompt(
    skillPrompt: string,
    contextPacket: Record<string, unknown>,
  ): string {
    // Pull feature IDs from RTM rows so we can name them in the override.
    const rtmRows = Array.isArray(contextPacket.rtmRows) ? (contextPacket.rtmRows as Array<Record<string, unknown>>) : [];
    const featureIds = Array.from(new Set(
      rtmRows
        .map((r) => String(r.featureId ?? '').trim())
        .filter((fid) => /^F-\d+-\d+$/.test(fid)),
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const featureList = featureIds.length > 0
      ? `${featureIds.length} features: ${featureIds.slice(0, 4).join(', ')}${featureIds.length > 4 ? `, …, ${featureIds[featureIds.length - 1]}` : ''}`
      : 'all features present in the input';

    return [
      '## 🎯 SKILL-06-LLD FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      `Produce a SINGLE module-wide LLD document covering **ALL ${featureList}** in this module — NOT a per-user-story or per-feature LLD. The output must follow the canonical 19-section contract in the skill file (§3 "Output Contract") with EXACTLY the heading labels listed below, in EXACTLY this order, each as a level-2 \`## \` heading.`,
      '',
      '### Parser contract (CRITICAL — non-negotiable)',
      '',
      'The backend `BaLldParserService` reads sections by walking `## ` (H2) headings ONLY. A document scoped to a single user story (e.g. `# LLD: <Feature Title> (US-NNN, MOD-NN, F-NN-NN)` followed by per-story `## 1. Identification` / `## 2. RTM Traceability` / `## 3. @frdContext` / `## 4. Public Contract` / etc.) **DOES NOT MATCH** the parser contract — those headings will be stored under non-canonical keys like `custom_identification` and the canonical 19-section slots will stay empty. The validator will then report 17/19 sections missing.',
      '',
      'Required H2 heading order (exact text match, parser is case-insensitive but order-sensitive):',
      '',
      '```text',
      '## 1. Summary',
      '## 2. Technology Stack',
      '## 3. Architecture Overview',
      '## 4. Module Dependency Graph',
      '## 5. Class Diagram',
      '## 6. Sequence Diagrams',
      '## 7. Non-Functional Requirements',
      '## 8. API Contract Manifest',
      '## 9. Data Model Definitions',
      '## 10. Schema Diagram',
      '## 11. Integration Points',
      '## 12. Cross-Cutting Concerns',
      '## 13. Env Var / Secret Catalog',
      '## 14. Test Scaffold Hints',
      '## 15. Build / CI Hooks',
      '## 16. Project Structure',
      '## 17. Traceability Summary',
      '## 18. Open Questions / TBD-Future References',
      '## 19. Applied Best-Practice Defaults',
      '## Pseudo-Code Files',
      '```',
      '',
      'Each section MUST be emitted exactly once. Sub-topics inside a section (e.g. `Endpoint:` items under §8 API Contract Manifest, or `### 4.1 DTOs` style sub-topics) MUST use `### ` (H3), never `## ` (H2). The parser splits on H2 only — any `## ` heading that does not match a canonical label gets stored as a non-canonical row, leaving the matching canonical slot empty.',
      '',
      '### Forbidden patterns (will cause 17/19 missing in the validator)',
      '',
      '- ❌ A top-level `# LLD: <title>` heading scoped to a single user story / feature (e.g. `# LLD: Verification Quota Check and Decrement (US-074, MOD-04, F-04-08)`). Do NOT scope the document to one story — produce a module-wide LLD that covers EVERY feature listed above.',
      '- ❌ Per-story sub-document headings: `## 1. Identification`, `## 2. RTM Traceability`, `## 3. @frdContext`, `## 4. Public Contract`. These are NOT canonical sections. The canonical §3 is "Architecture Overview", not "@frdContext".',
      '- ❌ Multiple LLD documents in one response (one per story). Produce ONE document, not N.',
      '- ❌ Using `## ` for sub-topics inside a section (use `### ` or deeper).',
      '- ❌ Wrapping the entire response in a code fence.',
      '',
      '### Module-wide scope (all features, not just one)',
      '',
      'Every section MUST cover the full module:',
      `- §5 Class Diagram → every domain class across all ${featureIds.length} features (group by feature/EPIC if helpful)`,
      `- §6 Sequence Diagrams → 3-5 critical flows spanning multiple features (one per major flow, NOT one per feature)`,
      `- §8 API Contract Manifest → every REST endpoint exposed by the module across all features`,
      `- §9 Data Model Definitions → every entity / DTO across all features`,
      `- §17 Traceability Summary → table mapping every Feature → EPIC → User Story → SubTask → Class/Method → Pseudo-File. ALL features must appear.`,
      '- §19 Applied Best-Practice Defaults → list every choice the AI made because input was ambiguous or missing.',
      '',
      '### Pseudo-Code Files (mandatory section, after §19)',
      '',
      'Append `## Pseudo-Code Files` then list pseudo-code files as fenced code blocks. Format (info string carries language + path):',
      '',
      '~~~text',
      '```typescript path=backend/controllers/SearchController.ts',
      'import ...',
      '/** ... Traceability: FRD: F-04-01 / EPIC: EPIC-04 / US: US-052 / ST: ST-US052-BE-01 */',
      'class SearchController { ... // TODO: ... }',
      '```',
      '~~~',
      '',
      `For a module with ${featureIds.length} features, produce at minimum **${Math.max(featureIds.length * 4, 20)} pseudo-files** spanning backend / frontend / database / tests. Every feature must be referenced by at least one pseudo-file's Traceability block.`,
      '',
      '#### Frontend pseudo-file quota (CRITICAL when frontend stack is selected)',
      '',
      'Backend-only LLDs ship with backend controllers + services + DTOs. That is necessary but NOT sufficient for a frontend-bearing project. When the architect picked a frontend stack (currently: see `lldConfig.stacks.frontend`) — and especially **Next.js + Tailwind** — the LLD MUST also produce the App Router skeleton, route handlers, and frontend tests. A "components-only" output (a flat `components/` folder with `.tsx` stubs and no pages) is INCOMPLETE: it leaves the developer to invent the routing, layouts, and data-fetching shape from scratch.',
      '',
      'For Next.js + Tailwind specifically, produce ALL of the following file types:',
      '',
      '1. **App Router pages** — at minimum ONE `frontend/app/<feature-slug>/page.tsx` per user-facing feature (≥ ' + featureIds.length + ' pages for this module). Each page is a React Server Component by default; mark `\'use client\'` only when interactivity (forms, hooks, event handlers) requires it. Pages compose components from `frontend/components/...` and fetch data via the route handlers below.',
      '',
      '   ~~~text',
      '   ```typescript path=frontend/app/research-chats/page.tsx',
      '   import { ResearchChatList } from \'@/components/research-chats/ResearchChatList\';',
      '   /** App Router page for the Research Chats feature.',
      '    * Traceability: FRD: F-04-01 / EPIC: EPIC-04 / US: US-052 / ST: ST-US052-FE-01',
      '    */',
      '   export default async function ResearchChatsPage() {',
      '     // TODO: fetch list via /api/research-chats',
      '     return <main className="container mx-auto p-6"><ResearchChatList chats={[]} /></main>;',
      '   }',
      '   ```',
      '   ~~~',
      '',
      '2. **Route handlers** — at minimum ONE `frontend/app/api/<resource>/route.ts` per backend resource the frontend reads or writes. These are server-side request handlers that proxy to the backend (or implement the endpoint directly when the frontend is the source of truth). Without these, the frontend cannot call the backend through Next.js conventions.',
      '',
      '   ~~~text',
      '   ```typescript path=frontend/app/api/research-chats/route.ts',
      '   /** GET /api/research-chats — list previous research conversations.',
      '    * Traceability: FRD: F-04-01 / EPIC: EPIC-04 / US: US-052',
      '    */',
      '   export async function GET(req: Request): Promise<Response> {',
      '     // TODO: forward to backend ResearchChatController.list',
      '     return Response.json({ chats: [] });',
      '   }',
      '   ```',
      '   ~~~',
      '',
      '3. **Layouts** — at least ONE `frontend/app/layout.tsx` (root layout) and one `frontend/app/<feature-slug>/layout.tsx` if the feature has nested routes / shared chrome. Layouts wrap pages with HTML shell, fonts, providers (theme, query client), and Tailwind imports.',
      '',
      '4. **Components** under `frontend/components/<feature-slug>/<ComponentName>.tsx`. Mark `\'use client\'` for interactive components (forms, buttons with handlers, hook-using components). Pure presentational components stay server components.',
      '',
      '5. **Frontend tests** — at minimum ONE `*.test.tsx` per non-trivial component, under `tests/frontend/components/<feature-slug>/<ComponentName>.test.tsx`. Use the testing framework matching the architect\'s testTypes selection (Playwright for e2e, Vitest / React Testing Library for unit). Include traceability docstrings.',
      '',
      '6. **Tailwind utility classes** — every JSX element in pseudo-code that has visual styling should include realistic Tailwind utility classes (`className="container mx-auto p-6"`, `flex items-center gap-2`, etc.). Do NOT inline `<style>` tags or import CSS modules — the architect picked Tailwind.',
      '',
      'For NestJS / Spring / FastAPI / etc. backends paired with Next.js: backend HTTP endpoints live under `backend/...` (e.g. NestJS `controllers/`), and the frontend calls them via the route handlers in step 2 (which forward upstream).',
      '',
      'Minimum frontend file counts for THIS module (with ' + featureIds.length + ' features):',
      '- App Router pages : ≥ ' + featureIds.length + ' (one per feature)',
      '- Route handlers   : ≥ ' + Math.max(Math.ceil(featureIds.length * 0.7), 5) + ' (one per resource the frontend talks to)',
      '- Components       : ≥ ' + (featureIds.length * 2) + ' (≥ 2 per feature on average)',
      '- Frontend tests   : ≥ ' + featureIds.length + ' (≥ 1 per feature\'s primary component)',
      '- Layouts          : ≥ 1 root layout, plus per-feature layouts where needed',
      '',
      '#### Backend pseudo-file quota',
      '',
      'For NestJS + Postgres (current backend stack), produce per-feature: at least one `backend/<feature>/controller.ts`, `backend/<feature>/service.ts`, and DTOs / exceptions where the EPIC mentions them. SQL DDL files for new tables go under `database/migrations/*.sql`.',
      '',
      '#### Test pseudo-file quota',
      '',
      'Tests sit under `tests/`. At minimum: one backend test per service (`tests/backend/services/*.spec.ts`), one frontend component test per primary user flow (`tests/frontend/components/**/*.test.tsx`), and one integration / e2e test per critical scenario.',
      '',
      '### Mermaid syntax rules (CRITICAL — render failures are user-visible)',
      '',
      'Sections §4 Module Dependency Graph, §5 Class Diagram, §6 Sequence Diagrams, and §10 Schema Diagram contain ```mermaid fenced code blocks. The frontend uses Mermaid 11+ which is strict about node-label syntax. Two specific failure modes to avoid:',
      '',
      '1. **`graph` / `flowchart` blocks** — node labels containing parens, slashes, ampersands, colons, hashes, pipes, or curly braces MUST be wrapped in double-quotes:',
      '',
      '   ❌ `A[ResearchChatController/Service]`             (slash crashes Mermaid 11)',
      '   ❌ `F[PaymentServiceClient (TBD)]`                 (parens crash Mermaid)',
      '   ✅ `A["ResearchChatController/Service"]`',
      '   ✅ `F["PaymentServiceClient (TBD)"]`',
      '',
      '   Rule: if the bracket contents have any of `( )  /  &  #  :  |  { }`, quote them.',
      '',
      '2. **`erDiagram` blocks** — column types MUST be lowercase Mermaid primitives. Do NOT use SQL-style capitalised type names — Mermaid 11 fails to parse them.',
      '',
      '   ❌ `UUID userId PK`        ✅ `uuid userId PK`',
      '   ❌ `String title`          ✅ `string title`',
      '   ❌ `DateTime createdAt`    ✅ `datetime createdAt`',
      '   ❌ `Enum status`           ✅ `string status`   (Mermaid has no enum primitive)',
      '   ❌ `Decimal price`         ✅ `decimal price`',
      '',
      '   Allowed primitives: `int`, `string`, `text`, `boolean`, `float`, `double`, `decimal`, `date`, `datetime`, `time`, `timestamp`, `uuid`, `binary`, `blob`. Anything else: lowercase it.',
      '',
      '3. **Arrow targets must reference node identifiers (A, B, …), never label text**:',
      '',
      '   ❌ `B -- writes/reads --> AIResponse`              (`AIResponse` is a label, not an id)',
      '   ✅ `B -- writes/reads --> S`                       (`S` is the node id defined as `S[AIResponse]`)',
      '',
      'Failing to follow these rules causes "Syntax error in text" overlays in the preview UI. The backend has a deterministic fallback sanitizer, but emitting clean Mermaid the first time is preferred.',
      '',
      '### Hard rules',
      '',
      '- All 19 LLD sections must be present even if the body is "N/A — not applicable in this module".',
      '- Every pseudo-file class + method has a Traceability docstring citing real FRD / EPIC / US / ST IDs from the input context — never invent IDs.',
      '- Method bodies are TODO comments only — no compilable logic.',
      '- Single markdown document — no JSON sidecar, no preamble before `## 1. Summary`, no commentary after the final pseudo-code fence.',
      '- Use the architect-saved tech stack from `lldConfig.stacks` (input context) — never substitute a different stack.',
      '',
      '---',
      '',
      '## Original Skill Definition (follow all rules below — especially §3 Output Contract and the Hard Rules section)',
      '',
      skillPrompt,
    ].join('\n');
  }

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

  // ─── SKILL-05 per-story append-mode (v4-post) ──────────────────────────
  //
  // Generate SubTasks for ONE user story at a time and APPEND the resulting
  // sections to the module's SUBTASK BaArtifact. Each call:
  //   1. Resolves (or creates) the SUBTASK BaArtifact for the module
  //   2. Idempotency-skips when the storyId already has st_us<NNN>_* rows
  //   3. Wraps the canonical SKILL-05 prompt with a SKILL-04-style focus
  //      override that constrains output scope to one story but keeps the
  //      24-section template + heading rules from the skill file in charge
  //   4. Passes the FULL user-stories context (all stories) — not a slice
  //      — so the AI's "execution mode" matches the working single-shot
  //   5. Calls the AI (with 429 retry/backoff)
  //   6. Splits the response with the defensive splitter
  //   7. Appends each section as a new BaArtifactSection on the artifact
  //
  // The intentional design choice: each AI response is processed in
  // isolation so the splitter only ever sees ONE story's worth of output —
  // identical in shape to the (working) single-shot path. We never
  // concatenate multiple stories' outputs and run the splitter once.

  /** Enumerate user stories for a module from the SKILL-04 humanDocument. */
  async listUserStoriesForModule(
    moduleDbId: string,
  ): Promise<Array<{ storyId: string; title: string; type: string | null }>> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: {
        // Newest APPROVED execution first — when SKILL-04 has been re-run
        // multiple times we want the latest story set, not whichever Prisma
        // happens to return first.
        skillExecutions: {
          where: { status: BaExecutionStatus.APPROVED },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    const skill04 = mod.skillExecutions.find((e) => e.skillName === 'SKILL-04');
    const doc = skill04?.humanDocument ?? '';
    if (!doc.trim()) return [];

    const seen = new Map<string, { storyId: string; title: string; type: string | null }>();
    const re = /US-(\d{3,})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const storyId = `US-${m[1]}`;
      if (seen.has(storyId)) continue;

      // Pull a 200-char window around the first hit for a title heuristic.
      const window = doc.slice(Math.max(0, m.index - 5), m.index + 200);
      const titleMatch = window.match(/(?:User Story:?\s*)?US-\d{3,}\s*[—\-]\s*([^\n]{4,150})/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const type = /backend/i.test(window)
        ? 'Backend'
        : /frontend/i.test(window)
          ? 'Frontend'
          : /integration/i.test(window)
            ? 'Integration'
            : null;

      seen.set(storyId, { storyId, title, type });
    }

    return Array.from(seen.values()).sort((a, b) => {
      const na = parseInt(a.storyId.slice(3), 10);
      const nb = parseInt(b.storyId.slice(3), 10);
      return na - nb;
    });
  }

  /**
   * Drive the SKILL-05 per-story append mode for every user story in the
   * module's latest APPROVED SKILL-04 output. Each story gets its own AI
   * call with a focused single-story override (defined inside
   * executeSkill05ForStory). Returns a synthetic humanDocument that
   * combines a per-story summary table with the persisted artifact body —
   * downstream post-processing (subtask parser, RTM extension) parses
   * subtasks from this string and links them to the artifact.
   *
   * This is the default SKILL-05 path invoked by `executeSkill('SKILL-05')`
   * since the legacy single-shot route consistently collapses into a
   * meta-overview document on modules with more than ~10-15 user stories.
   * Each AI response in this loop carries one story's worth of subtasks,
   * which fits comfortably in the response budget.
   */
  private async runSkill05PerStoryLoop(moduleDbId: string): Promise<string> {
    const stories = await this.listUserStoriesForModule(moduleDbId);
    if (stories.length === 0) {
      throw new Error('SKILL-05: no user stories found in latest APPROVED SKILL-04 output. Run SKILL-04 first.');
    }
    this.logger.log(
      `SKILL-05 per-story loop: processing ${stories.length} stories for module ${moduleDbId}`,
    );

    const summary: Array<{
      storyId: string;
      added: number;
      skipped: boolean;
      reason?: string;
      error?: string;
    }> = [];

    for (const s of stories) {
      try {
        const r = await this.executeSkill05ForStory(moduleDbId, s.storyId);
        summary.push({ storyId: r.storyId, added: r.added, skipped: r.skipped, reason: r.reason });
        this.logger.log(
          `SKILL-05 per-story ${r.storyId}: added=${r.added} skipped=${r.skipped}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        summary.push({ storyId: s.storyId, added: 0, skipped: false, error: msg });
        this.logger.error(`SKILL-05 per-story ${s.storyId} failed: ${msg}`);
      }
    }

    // Read back the persisted SUBTASK artifact and synthesize a
    // humanDocument that downstream post-processing reads from.
    //
    // splitIntoSections() strips the `## <heading>` line into
    // sectionLabel + sectionKey and stores only the body in content.
    // SubTaskParserService.parseMarkdown() splits on
    //   /(?=^## (?:SubTask:\s*)?ST-)/m
    // and pulls the heading via /^## (?:SubTask:\s*)?(ST-[A-Za-z0-9-]+)/m,
    // so it requires the `## ST-...` heading to be present in the input.
    // We must rebuild it here by prepending `## <label>` to each section
    // body, otherwise parseAndStore finds 0 subtasks and BaSubTask stays
    // empty even though the artifact has the right content.
    const artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.SUBTASK },
      orderBy: { createdAt: 'desc' },
      include: { sections: true },
    });
    const artifactBody = artifact
      ? artifact.sections.map((s) => `## ${s.sectionLabel}\n${s.content}`).join('\n\n')
      : '';

    const succeeded = summary.filter((r) => r.added > 0 && !r.error).length;
    const skippedCount = summary.filter((r) => r.skipped).length;
    const failedCount = summary.filter((r) => r.error).length;

    const summaryHeader = [
      '# SKILL-05 Per-Story Run Summary',
      '',
      `Total stories processed: **${stories.length}**`,
      `Succeeded: **${succeeded}**`,
      `Skipped (idempotent — already had sections): **${skippedCount}**`,
      `Failed: **${failedCount}**`,
      '',
      '| Story ID | Sections added | Outcome |',
      '|---|---|---|',
      ...summary.map((r) =>
        `| ${r.storyId} | ${r.added} | ${
          r.error
            ? `error: ${r.error.slice(0, 100)}`
            : r.skipped
              ? `skipped — ${r.reason ?? 'already had sections'}`
              : 'OK'
        } |`,
      ),
      '',
      '---',
      '',
    ].join('\n');

    return summaryHeader + artifactBody;
  }

  /**
   * Generate SubTasks for one user story and append the resulting sections
   * to the module's existing SUBTASK BaArtifact (creating one if it doesn't
   * exist yet). Returns a summary of what was added.
   */
  async executeSkill05ForStory(
    moduleDbId: string,
    storyId: string,
  ): Promise<{
    storyId: string;
    artifactId: string;
    added: number;
    sectionKeys: string[];
    skipped: boolean;
    reason?: string;
  }> {
    const usMatch = /^US-(\d{3,})$/.exec(storyId);
    if (!usMatch) {
      throw new Error(`Invalid storyId "${storyId}". Expected format: US-NNN (e.g. US-074)`);
    }
    const usNum = usMatch[1];

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: {
        project: true,
        skillExecutions: {
          where: { status: BaExecutionStatus.APPROVED },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // 1. Find or create the SUBTASK BaArtifact.
    let artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.SUBTASK },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      artifact = await this.prisma.baArtifact.create({
        data: {
          moduleDbId,
          artifactType: BaArtifactType.SUBTASK,
          artifactId: `SUBTASK-${mod.moduleId}`,
          status: BaArtifactStatus.DRAFT,
        },
      });
    }

    // 2. Idempotency — skip when the artifact already has rows for this story.
    const sectionKeyPrefix = `st_us${usNum}_`;
    const existing = await this.prisma.baArtifactSection.findMany({
      where: {
        artifactId: artifact.id,
        sectionKey: { startsWith: sectionKeyPrefix },
      },
      select: { id: true, sectionKey: true },
    });
    if (existing.length > 0) {
      this.logger.log(
        `SKILL-05 per-story: skipping ${storyId} — already has ${existing.length} section(s)`,
      );
      return {
        storyId,
        artifactId: artifact.id,
        added: 0,
        sectionKeys: [],
        skipped: true,
        reason: `${existing.length} ${storyId} section(s) already exist; delete them first to regenerate`,
      };
    }

    // 3. Build the single-story focus prompt + full context.
    //
    // We pass the FULL userStoriesDocument (all stories) — not a slice —
    // so the AI sees the same input volume the working single-shot saw.
    // Narrowing the doc to one story made the AI treat the call as a
    // user-story drafting task rather than a subtask decomposition task,
    // and improvise non-canonical section labels. The currentFocusStory
    // hint + the override above are what constrain output scope.
    const skillPrompt = this.loadSkillFile('SKILL-05');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-05');
    // Mirror the SKILL-04 per-feature pattern that's been working in
    // production for months — same prefix shape, same skill file appended
    // unchanged. Critically, we DON'T enumerate Section 19/20/21 names in
    // the prefix — that confused the AI into improvising labels. The skill
    // file's canonical template is authoritative and we just constrain
    // scope to one story.
    const focusedPrompt = [
      '## 🎯 SINGLE-STORY FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      'You are running as part of a per-story loop. The orchestrator will',
      'call you once for EACH user story. Your current call is for ONE story only.',
      '',
      `**CURRENT STORY: ${storyId}**`,
      '',
      '### What to output NOW',
      '',
      `1. A single \`## SubTask Decomposition for ${storyId} — <title> (<status>, <module>, <feature>)\` heading followed by 1–3 paragraphs that frame the SubTasks below.`,
      `2. ALL implementation SubTasks for **${storyId}** (FE / BE / IN as applicable). For each one:`,
      `   - SubTask separator at heading level 2: \`## ST-${storyId.replace(/^US-/, 'US')}-<TEAM>-NN — <Title>\``,
      '   - The 25 numbered Section labels at heading level 4 using the EXACT skill-file canonical labels listed below. Use these EXACT labels — do NOT improvise alternate labels (e.g. "SubTask Description" is wrong, the canonical label is "Description"; "Algorithm Outline" is wrong, the canonical label is "Algorithm"; "End-to-End Integration Flow" must NOT be replaced with "Algorithm Outline").',
      '',
      '   **Canonical 25-section template — every SubTask body must use these EXACT labels in this exact order:**',
      '',
      '   - `#### Section 1 — SubTask ID`',
      '   - `#### Section 2 — SubTask Name`',
      '   - `#### Section 3 — SubTask Type`',
      '   - `#### Section 4 — Description` *(AUTOMATION CRITICAL)*',
      '   - `#### Section 5 — Pre-requisites` *(list other ST-... IDs this SubTask depends on)*',
      '   - `#### Section 6 — Source File Name` *(AUTOMATION CRITICAL — full path)*',
      '   - `#### Section 7 — Class Name` *(AUTOMATION CRITICAL)*',
      '   - `#### Section 8 — Class Description` *(AUTOMATION CRITICAL)*',
      '   - `#### Section 9 — Method Name` *(AUTOMATION CRITICAL)*',
      '   - `#### Section 10 — Method Description` *(AUTOMATION CRITICAL)*',
      '   - `#### Section 11 — Arguments` *(AUTOMATION CRITICAL — name, type, description, constraints)*',
      '   - `#### Section 12 — Return Type` *(AUTOMATION CRITICAL)*',
      '   - `#### Section 13 — Validations` *(AUTOMATION CRITICAL — rule name, condition, error message)*',
      '   - `#### Section 14 — Algorithm` *(AUTOMATION CRITICAL — numbered step-by-step logic)*',
      '   - `#### Section 15 — Integration Points` *(AUTOMATION CRITICAL — called class, method, args, return)*',
      '   - `#### Section 16 — Error Handling` *(AUTOMATION CRITICAL — Exception class, trigger, HTTP status, on-catch)*',
      '   - `#### Section 17 — Database Operations` *(table/collection, operation, key fields, conditions)*',
      '   - `#### Section 18 — Technical Notes`',
      '   - `#### Section 19 — Traceability Header` *(AUTOMATION CRITICAL — `/* TRACEABILITY */` block + TBD-Future Dependencies sub-block — see CONFIRMED-PARTIAL rule below)*',
      '   - `#### Section 20 — Project Structure Definition` *(AUTOMATION CRITICAL — `Project Structure:` KV + `Directory Map:` tree, plain text not in code fence)*',
      '   - `#### Section 21 — Sequence Diagram Inputs` *(AUTOMATION CRITICAL — Mermaid `sequenceDiagram` block when crossing a boundary)*',
      '   - `#### Section 22 — End-to-End Integration Flow` *(AUTOMATION CRITICAL — MANDATORY for every SubTask, every team. Has THREE parts: **Part A — Flow Chain** (sequential arrow diagram FE → BE → IN), **Part B — Dependency Table** (markdown pipe table with columns: SubTask ID | Team | Layer | Class | Depends On | Depended On By | Status), **Part C — Sprint Sequencing** (P0/P1/P2/P3 priority lists). The same Section 22 content is identical across every SubTask in this story — copy it verbatim.)*',
      '   - `#### Section 23 — Test Case IDs` *(AUTOMATION CRITICAL — list of TC-IDs)*',
      '   - `#### Section 24 — Acceptance Criteria`',
      '   - `#### Section 25 — Testing Notes`',
      '',
      '   DO NOT use bold-numbered labels (e.g. `**1. SubTask ID:**` or `**Section 1: SubTask ID**`). DO NOT skip Section 22 or replace it with "Algorithm Outline" — Section 14 is Algorithm, Section 22 is End-to-End Integration Flow with the Dependency Table.',
      '',
      '### Section 19 — TBD-Future Dependencies for CONFIRMED-PARTIAL stories (CRITICAL)',
      '',
      `When ${storyId} has Story Status \`CONFIRMED-PARTIAL\` (it carries TBD-NNN`,
      'references to integrations pending another module), EVERY SubTask in this',
      'story — including pure UI SubTasks and QA SubTasks — MUST emit REAL',
      'TBD-Future Dependencies entries inside the Section 19 `/* TRACEABILITY */`',
      'block. The "carry forward" model in the skill file is non-negotiable: a',
      'developer reading any SubTask must see the TBD context with stub guidance.',
      '',
      'DO NOT write `* None for this SubTask.` for CONFIRMED-PARTIAL stories. It',
      'silently drops the cross-module dependency tracking and breaks the entire',
      'TBD-Future Integration Registry workflow.',
      '',
      'Required format inside the Traceability comment block (one entry per TBD',
      'reference the parent story carries):',
      '',
      '    * TBD-Future Dependencies:',
      '    *   TBD-NNN: <integration name> — pending <module-id> approval',
      '    *   Assumed: <method signature> → <return type or shape>',
      '    *   Stub: <stub class name> — replace with real service when <module-id> confirmed',
      '    *   Affected: <which Algorithm steps / Integration points / Exceptions in THIS SubTask use the stub>',
      '    *   Resolution: Update Called Class, Method, Return type when <module-id> SubTasks approved',
      '',
      'For SubTasks that are several layers removed from the TBD integration',
      '(e.g. a pure UI design subtask), the `Affected` line can read "Indirect',
      '— consumes data shape from <other SubTask>" — but the TBD-NNN, Assumed,',
      'Stub, and Resolution lines are still mandatory so the carry-forward chain',
      'is unbroken.',
      '',
      'Read the parent story content in the input context to identify which',
      'TBD-NNN refs apply (look for `[TBD-Future]` markers, `TBD-NNN` tokens',
      'inside the story body, and the FRD/EPIC TBD-Future Integration Registry).',
      '',
      `3. The QA bucket: a \`## QA SubTasks (Mandatory for Every Story)\` heading at level 2, then one \`## ST-${storyId.replace(/^US-/, 'US')}-QA-NN — <Title>\` block per QA SubTask (QA-01 always; add QA-02..04 when the story warrants). Each QA SubTask body uses the same 25 canonical labels at level 4.`,
      '',
      '### Section 20 — Project Structure Definition (REQUIRED, every SubTask, every team)',
      '',
      'Emit Section 20 in the EXACT canonical format below — never a bullet',
      'list of file paths. The renderer\'s 2-col table + monospace tree only',
      'fires on the literal `Project Structure:` and `Directory Map:`',
      'headers.',
      '',
      'IMPORTANT — Output the Section 20 body as plain text (regular markdown',
      'paragraph + indented lines). Do NOT wrap it in a ```text or ``` code',
      'fence. The renderer detects the canonical headers either way, but a',
      'plain-text body produces the cleanest rendering.',
      '',
      'Frontend (Next.js App Router) example body — copy this shape (output',
      'these lines directly under the `#### Section 20 — Project Structure',
      'Definition` heading, with NO code fence around them):',
      '',
      '    Project Structure:',
      '      Language/Framework:   TypeScript / Next.js (App Router)',
      '      Base Directory:       app/',
      '      Feature Directory:    app/<feature-slug>/',
      '      Components Directory: components/<feature-slug>/',
      '      Hooks Directory:      hooks/',
      '      Full File Path:       components/<feature-slug>/<ComponentName>.tsx',
      '',
      '      Directory Map:',
      '        app/',
      '        └── <feature-slug>/',
      '            └── page.tsx',
      '        components/',
      '        └── <feature-slug>/',
      '            ├── <ComponentName>.tsx                ← this file',
      '            └── <Sibling>.tsx',
      '        hooks/',
      '        └── use<Feature>.ts',
      '',
      '### Section 21 — Sequence Diagram Inputs (when this SubTask crosses a boundary)',
      '',
      'Emit a Mermaid `sequenceDiagram` fenced block (followed by the textual',
      'message sequence) whenever the SubTask:',
      '- Makes any HTTP request, calls a service/API/repository, or dispatches',
      '  a state action that crosses a layer boundary',
      '- Invokes an integration (TBD-Future or otherwise)',
      '',
      'A frontend SubTask labelled "Integrate ... API" / "Connect to backend"',
      '/ "Call service" / "Fetch ..." MUST include the Mermaid block.',
      '',
      'Pure presentational SubTasks — UI layout / styling / static rendering',
      'with no async work — may omit Mermaid. When in doubt, INCLUDE it.',
      '',
      '### What to SKIP',
      '',
      '- Do NOT write SubTasks for ANY other user story (other stories are processed in their own sub-calls)',
      '- Do NOT write a module-level Introduction, Coverage Summary, or RTM Extension table — orchestrator handles all module-level scaffolding',
      '',
      '---',
      '',
      '## Original Skill Definition (follow all rules below — especially the canonical 24-section template, Heading Hierarchy Rules, and the Section 19/20/21 field formats)',
      '',
      skillPrompt,
    ].join('\n');

    const narrowedContext: Record<string, unknown> = {
      ...contextPacket,
      currentFocusStory: storyId,
    };

    // 4. Call the AI with 429 retry/backoff.
    let aiResponse: string;
    try {
      aiResponse = await this.callAiServiceWithRetry(focusedPrompt, narrowedContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI call failed';
      this.logger.error(`SKILL-05 per-story ${storyId}: ${msg}`);
      throw err;
    }

    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for ${storyId}`);
    }

    // 5. Split + 6. Append.
    const sections = this.splitIntoSections(humanDocument);
    const addedKeys: string[] = [];
    for (const section of sections) {
      // Skip empty / whitespace-only sections; they're not meaningful and
      // the renderer would just show a blank node.
      if (!section.content.trim()) continue;
      const created = await this.prisma.baArtifactSection.create({
        data: {
          artifactId: artifact.id,
          sectionKey: section.key,
          sectionLabel: section.label,
          aiGenerated: true,
          content: section.content,
        },
      });
      addedKeys.push(created.sectionKey);
    }

    this.logger.log(
      `SKILL-05 per-story ${storyId}: appended ${addedKeys.length} section(s) to ${artifact.id}`,
    );

    return {
      storyId,
      artifactId: artifact.id,
      added: addedKeys.length,
      sectionKeys: addedKeys,
      skipped: false,
    };
  }

  /**
   * Wrap callAiService with backoff on 429 (rate-limit). Three attempts with
   * 15s / 30s / 60s waits — matches the behaviour we briefly had on the
   * reverted per-story loop.
   */
  private async callAiServiceWithRetry(
    systemPrompt: string,
    contextPacket: Record<string, unknown>,
  ): Promise<string> {
    const delays = [15_000, 30_000, 60_000];
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await this.callAiService(systemPrompt, contextPacket);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : '';
        const is429 = /\b429\b|rate.?limit|quota/i.test(msg);
        if (!is429 || attempt === delays.length) throw err;
        const wait = delays[attempt];
        this.logger.warn(
          `AI 429 on attempt ${attempt + 1}/${delays.length + 1} — waiting ${wait / 1000}s before retry`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('AI call failed after retries');
  }

  /**
   * Slice the user-stories document down to the chunk that belongs to one
   * story. Looks for a heading containing the storyId and returns from there
   * up to (but not including) the next story heading.
   */
  private extractStorySlice(fullDoc: string, storyId: string): string | null {
    const headingRe = new RegExp(
      `(#{1,4}\\s*[^\\n]*${storyId.replace(/-/g, '\\-')}[^\\n]*\\n)`,
      'g',
    );
    const match = headingRe.exec(fullDoc);
    if (!match) return null;
    const start = match.index;
    const nextRe = /#{1,4}\s*[^\n]*US-\d{3,}[^\n]*\n/g;
    nextRe.lastIndex = start + match[0].length;
    const nextMatch = nextRe.exec(fullDoc);
    const end = nextMatch ? nextMatch.index : fullDoc.length;
    return fullDoc.slice(start, end);
  }

  // ─── SKILL-07-FTC per-feature append-mode ─────────────────────────────
  //
  // Generate test cases for ONE feature at a time and APPEND the resulting
  // BaTestCase rows to the module's FTC artifact. Mirrors the SKILL-05
  // per-story append pattern.
  //
  // Why per-feature instead of per-story or single-shot:
  //  - Single-shot blows the response token budget (~16-32K out) — the AI
  //    settles for ~10-20 TCs covering one feature group, leaving the other
  //    ~8 features with no coverage.
  //  - Per-story would fragment the FTC artifact (the "Coverage Summary"
  //    is naturally feature-scoped, and many stories under one feature
  //    share scenario groups).
  //  - Per-feature is the right grain: each call produces ~10-15 TCs
  //    spanning all stories under that feature, in proper ```tc id=...```
  //    format so BaFtcParser picks them up.

  /** Enumerate features for a module from RTM rows. */
  async listFeaturesForFtc(
    moduleDbId: string,
  ): Promise<Array<{ featureId: string; featureName: string; featureStatus: string }>> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      select: { moduleId: true, projectId: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const rtmRows = await this.prisma.baRtmRow.findMany({
      where: { projectId: mod.projectId, moduleId: mod.moduleId },
      select: { featureId: true, featureName: true, featureStatus: true },
    });
    // RTM rows from old runs sometimes carry markdown-parsing artifacts
    // in the featureId column (e.g. "** F-04-02", "| F-04-06 ... |").
    // Only accept clean F-NN-NN ids; the garbage ones get silently dropped.
    const FEATURE_ID_RE = /^F-\d+-\d+$/;
    const seen = new Map<string, { featureId: string; featureName: string; featureStatus: string }>();
    for (const r of rtmRows) {
      const fid = r.featureId?.trim();
      if (!fid || !FEATURE_ID_RE.test(fid) || seen.has(fid)) continue;
      seen.set(fid, {
        featureId: fid,
        featureName: r.featureName ?? '',
        featureStatus: (r.featureStatus ?? '').replace(/^"(.+)",?$/, '$1'),
      });
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.featureId.localeCompare(b.featureId, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }

  /**
   * Generate test cases for one feature and append the parsed BaTestCase
   * rows to the module's FTC artifact (creating the artifact on the first
   * call). Returns a summary so callers (a script or a UI loop) can show
   * progress.
   */
  async executeSkill07ForFeature(
    moduleDbId: string,
    featureId: string,
  ): Promise<{
    featureId: string;
    artifactId: string;
    tcsAdded: number;
    sectionsAdded: number;
    skipped: boolean;
    reason?: string;
  }> {
    if (!/^F-\d+-\d+$/.test(featureId)) {
      throw new Error(`Invalid featureId "${featureId}". Expected F-NN-NN.`);
    }

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: {
        project: true,
        skillExecutions: {
          where: { status: BaExecutionStatus.APPROVED },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // 1. Find or create the FTC artifact. Suffix = "playwright" or whatever
    //    the architect picked in BaFtcConfig (matches the existing single-
    //    shot path's deriveFtcSuffix output).
    let artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.FTC },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      const suffix = await this.deriveFtcSuffix(moduleDbId);
      artifact = await this.prisma.baArtifact.create({
        data: {
          moduleDbId,
          artifactType: BaArtifactType.FTC,
          artifactId: `FTC-${mod.moduleId}-${suffix}`,
          status: BaArtifactStatus.DRAFT,
        },
      });
      // Refresh BaModule.ftcArtifactId so frontend reads (which key off the
      // pointer) see the new artifact immediately. Without this, the
      // pointer can stay stale (pointing at a deleted artifact from a
      // previous wipe) and getFtcArtifact returns null even though the
      // artifact exists.
      await this.prisma.baModule.update({
        where: { id: moduleDbId },
        data: { ftcArtifactId: artifact.id, ftcCompletedAt: new Date() },
      });
    }

    // 2. Idempotency — skip when this feature already has TCs on the
    //    artifact. We detect via the linkedFeatureIds array on existing
    //    BaTestCase rows; if any TC already references this featureId,
    //    we assume the feature is done.
    const existingTcs = await this.prisma.baTestCase.findMany({
      where: {
        artifactDbId: artifact.id,
        linkedFeatureIds: { has: featureId },
      },
      select: { id: true },
    });
    if (existingTcs.length > 0) {
      this.logger.log(
        `SKILL-07-FTC per-feature: skipping ${featureId} — already has ${existingTcs.length} test case(s)`,
      );
      return {
        featureId,
        artifactId: artifact.id,
        tcsAdded: 0,
        sectionsAdded: 0,
        skipped: true,
        reason: `${existingTcs.length} test case(s) for ${featureId} already on the FTC artifact; delete them first to regenerate`,
      };
    }

    // 3. Build the FTC context (same shape as single-shot SKILL-07-FTC).
    const skillPrompt = this.loadSkillFile('SKILL-07-FTC');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-07-FTC');

    // 4. Compose the per-feature focus override on top of the existing
    //    parser-shape wrapper. The wrapper enforces the ```tc id=...```
    //    format; we add the single-feature scope on top.
    // Per-feature TC ID prefix — this guarantees uniqueness across the per-
    // feature loop. Without it, every call would start at TC-001 and silently
    // collide on the (artifactDbId, testCaseId) unique constraint, so only
    // the first feature's TCs would actually land in the DB.
    // Format: F-04-01 → 04-01 → TC-04-01-001 / Neg_TC-04-01-002 / …
    const featureSuffix = featureId.replace(/^F-/, '');
    const featureTcPrefix = `TC-${featureSuffix}-`;
    const featureNegTcPrefix = `Neg_TC-${featureSuffix}-`;

    const featureFocusedPrompt = [
      '## 🎯 SKILL-07-FTC FEATURE FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      `You are running as part of a per-feature loop. Each call generates test cases for ONE feature only — the orchestrator runs you once per feature and appends each response's TCs to the same FTC artifact.`,
      '',
      `**CURRENT FEATURE: ${featureId}**`,
      '',
      'Generate test cases for **all user stories under this feature only**. Do',
      'not produce TCs for any other feature — those are processed in their own',
      'sub-calls.',
      '',
      '### TC ID convention (CRITICAL — non-negotiable)',
      '',
      'In per-feature mode, plain `TC-001` numbering causes silent collisions',
      'across feature calls (every call would start at 001 and the DB unique-',
      'constraint drops the second through ninth occurrences). USE FEATURE-',
      'PREFIXED IDS instead:',
      '',
      `- Positive cases: \`${featureTcPrefix}001\`, \`${featureTcPrefix}002\`, \`${featureTcPrefix}003\`, …`,
      `- Negative cases: \`${featureNegTcPrefix}004\`, \`${featureNegTcPrefix}005\`, … (single shared sequence; \`Neg_\` prefix is formatting only — the authoritative signal is \`testKind=negative\` in the fenced-block header)`,
      '',
      `Number sequentially within THIS feature only, starting at 001. Every TC ID you emit MUST start with \`${featureTcPrefix}\` (positive) or \`${featureNegTcPrefix}\` (negative). Do NOT use plain \`TC-001\` / \`Neg_TC-002\` — those collide across the loop. Do NOT use story-coded IDs like \`TC-US074-BE-003\` — feature-prefixed is the convention here.`,
      '',
      '### Linking rules',
      '',
      'Every TC you emit MUST set `linkedFeatureIds` to ONLY this feature',
      `(\`linkedFeatureIds: ${featureId}\`) — do not fan out to other features in`,
      'this list, otherwise the UI cannot attribute the TC correctly. Populate',
      '`linkedEpicIds`, `linkedStoryIds`, and `linkedSubtaskIds` from the actual',
      'EPIC / story / subtask IDs in the input context — leaving them blank',
      'breaks RTM traceability.',
      '',
      'Set `scenarioGroup` to a short HUMAN LABEL describing the scenario',
      '(e.g. "Search — Happy Path", "Search — Validation", "Login Flow"). DO',
      `NOT use the feature ID itself as the scenarioGroup — \`${featureId}\` is`,
      'already captured in `linkedFeatureIds`. Several TCs may share the same',
      'scenarioGroup; the UI groups them in a single bucket.',
      '',
      'Coverage requirements per story under this feature:',
      '- ≥1 happy-path TC',
      '- ≥1 negative TC (`Neg_TC-...` id prefix, `testKind=negative`)',
      '- Boundary / edge TCs where the AC mentions limits, ranges, or quotas',
      '- For CONFIRMED-PARTIAL stories with TBD-Future stubs: include a',
      '  stub-integration TC marked `category=Integration` and explicitly',
      '  reference the stub in the `### Pre Condition` H3 block',
      '',
      'Do NOT emit module-wide narrative sections (§1–§5, §9–§12, §14–§16) —',
      'those are produced by the narrative-only pass (mode 3) AFTER all per-',
      'feature calls complete. Just emit the §6 / §7 / §8 content (TC bodies +',
      'OWASP entries that apply + AC coverage rows) for THIS feature, with',
      'every TC also repeated verbatim in the §17 Test Case Appendix.',
      '',
      'Each TC body MUST contain ALL 10 canonical `### ` sub-section blocks in',
      'order — `### Test Data`, `### Pre Condition`, `### E2E Flow`, `### Test',
      'Steps`, `### Expected`, `### Post Validation`, `### SQL Setup`, `### SQL',
      'Verify`, `### Playwright Hint`, `### Developer Hints`. Missing blocks =',
      'NULL columns in the database and broken CSV exports. See the wrapped',
      'parser-contract example below for the exact shape.',
      '',
      '---',
      '',
      // Reuse the same parser-contract wrapper used by single-shot — keeps
      // the ```tc id=...``` format requirement front and centre.
      this.wrapSkill07Prompt(skillPrompt, contextPacket),
    ].join('\n');

    // 5. Call the AI with retry-on-429.
    const runStartedAt = new Date();
    const aiResponse = await this.callAiServiceWithRetry(
      featureFocusedPrompt,
      { ...contextPacket, currentFocusFeature: featureId },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for ${featureId}`);
    }

    // 6. Run the FTC parser. parseAndStore is idempotent at the section
    //    level (warns and continues on duplicate sectionKey conflicts) and
    //    creates new BaTestCase rows for any TC IDs it sees. With the
    //    feature-prefixed TC ID convention (TC-04-01-NNN), IDs are
    //    naturally unique across the per-feature loop so duplicate-key
    //    drops no longer occur.
    const before = await this.prisma.baTestCase.count({
      where: { artifactDbId: artifact.id },
    });
    const parsed = await this.ftcParser.parseAndStore(humanDocument, artifact.id);
    const after = await this.prisma.baTestCase.count({
      where: { artifactDbId: artifact.id },
    });
    const tcsAdded = after - before;

    // 7. Backfill linkedFeatureIds on TCs created in THIS run only — the
    //    AI may forget to set it explicitly, and we know which feature
    //    this call was for. Critical: scope the update to TCs created
    //    after `runStartedAt` so we don't pollute earlier features' TCs
    //    with this feature's ID (the previous OR-based query was the
    //    source of every TC accumulating all 9 features in its list).
    const newTcs = await this.prisma.baTestCase.findMany({
      where: {
        artifactDbId: artifact.id,
        createdAt: { gte: runStartedAt },
        NOT: { linkedFeatureIds: { has: featureId } },
      },
      select: { id: true, linkedFeatureIds: true },
    });
    for (const tc of newTcs) {
      const updated = Array.from(new Set([...(tc.linkedFeatureIds ?? []), featureId]));
      await this.prisma.baTestCase.update({
        where: { id: tc.id },
        data: { linkedFeatureIds: updated },
      });
    }

    this.logger.log(
      `SKILL-07-FTC per-feature ${featureId}: appended ${tcsAdded} test case(s) to ${artifact.id}`,
    );

    return {
      featureId,
      artifactId: artifact.id,
      tcsAdded,
      sectionsAdded: parsed.sectionsCreated,
      skipped: false,
    };
  }

  // ─── SKILL-07-FTC per-category coverage pass (mode 2b) ────────────────
  //
  // Per-feature mode 2 budgets each AI call for ~10–15 TCs and the AI
  // spends them on happy-path + negative + boundary + integration cases.
  // It rarely emits Security / UI / Performance / Accessibility TCs even
  // when those test types are selected in `ftcConfig.testTypes`. Result:
  // the FTC tree shows only "Functional" and "Integration" category
  // groups for per-feature modules, while single-shot modules show all
  // selected categories.
  //
  // This per-category pass closes the gap. It runs ONE AI call per
  // missing category (not per feature × category — too expensive). The
  // call asks the AI to produce TCs of the given category spanning every
  // feature in the module. TC IDs are prefixed with the category code
  // (TC-SEC-001, TC-UI-001, TC-PERF-001, …) so they don't collide with
  // per-feature IDs (TC-04-01-NNN).
  //
  // Categories supported here are the synthetic tree groups beyond
  // Functional / Integration that the per-feature pass already covers:
  //   - Security (with optional OWASP A01–A10 / LLM01–LLM10 tagging)
  //   - UI       (visual / interaction TCs for user-facing screens)
  //   - Performance (latency / throughput / load TCs)
  //   - Accessibility (WCAG, screen-reader, keyboard nav)
  //   - Data     (boundary / format / serialization TCs)
  //   - Smoke    (happy-path-only quick-run TCs)
  //   - Regression (whole-feature regression suite TCs)

  private readonly CATEGORY_PREFIXES: Record<string, string> = {
    Security: 'SEC',
    UI: 'UI',
    Performance: 'PERF',
    Accessibility: 'A11Y',
    Data: 'DATA',
    Smoke: 'SMK',
    Regression: 'REG',
  };

  /**
   * Generate TCs for ONE category across all features in the module and
   * append them to the existing FTC artifact. Idempotent: skips when the
   * artifact already has TCs tagged with this category.
   */
  async executeSkill07ForCategory(
    moduleDbId: string,
    category: string,
  ): Promise<{
    category: string;
    artifactId: string;
    tcsAdded: number;
    skipped: boolean;
    reason?: string;
  }> {
    const prefix = this.CATEGORY_PREFIXES[category];
    if (!prefix) {
      throw new Error(
        `Unsupported category "${category}". Supported: ${Object.keys(this.CATEGORY_PREFIXES).join(', ')}`,
      );
    }

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    let artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.FTC },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      const suffix = await this.deriveFtcSuffix(moduleDbId);
      artifact = await this.prisma.baArtifact.create({
        data: {
          moduleDbId,
          artifactType: BaArtifactType.FTC,
          artifactId: `FTC-${mod.moduleId}-${suffix}`,
          status: BaArtifactStatus.DRAFT,
        },
      });
      // Refresh BaModule.ftcArtifactId pointer (see executeSkill07ForFeature
      // for rationale) — keeps frontend reads pointing at the live artifact.
      await this.prisma.baModule.update({
        where: { id: moduleDbId },
        data: { ftcArtifactId: artifact.id, ftcCompletedAt: new Date() },
      });
    }

    // Idempotency — skip when category-tagged TCs already exist on the
    // artifact. Architects who want to regenerate must delete the
    // category's TCs first.
    const existingCategoryTcs = await this.prisma.baTestCase.findMany({
      where: { artifactDbId: artifact.id, category },
      select: { id: true },
    });
    if (existingCategoryTcs.length > 0) {
      this.logger.log(
        `SKILL-07-FTC per-category: skipping ${category} — ${existingCategoryTcs.length} TC(s) already exist`,
      );
      return {
        category,
        artifactId: artifact.id,
        tcsAdded: 0,
        skipped: true,
        reason: `${existingCategoryTcs.length} TC(s) tagged category=${category} already on the FTC artifact; delete them first to regenerate.`,
      };
    }

    // Enumerate features for this module — the AI's TCs will reference
    // `linkedFeatureIds` from this list.
    const features = await this.listFeaturesForFtc(moduleDbId);
    if (features.length === 0) {
      throw new Error(`No features found for module ${mod.moduleId} — RTM is empty`);
    }
    const featureList = features.map((f) => `- ${f.featureId}: ${f.featureName}`).join('\n');

    const skillPrompt = this.loadSkillFile('SKILL-07-FTC');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-07-FTC');

    // Category-specific guidance — what the AI should focus on per type.
    const CATEGORY_FOCUS: Record<string, string> = {
      Security: [
        'Generate security-focused TCs with OWASP Web Top 10 (A01–A10) or LLM Top 10 (LLM01–LLM10) tagging.',
        'Cover injection, broken access control, sensitive data exposure, XSS, CSRF, authn/authz failures, SSRF, and (for AI-assisted features) prompt injection.',
        'Tag every TC with `category=Security` and the most appropriate `owasp` code.',
        'Use `testKind=negative` for every TC unless it is a security control validation (which is positive).',
      ].join('\n'),
      UI: [
        'Generate UI/UX-focused TCs covering visual rendering, interaction states, responsive behaviour, error display, loading states, and form-field interactions.',
        'Tag every TC with `category=UI`. These run in Playwright and assert against DOM / visible state, not API responses.',
        'Mix positive (happy-path interaction) and negative (invalid input UX) TCs.',
      ].join('\n'),
      Performance: [
        'Generate performance-focused TCs covering latency SLAs, throughput, concurrent-user load, and resource consumption.',
        'Tag every TC with `category=Performance`. Use k6 or JMeter `### k6 Script` blocks instead of Playwright when applicable.',
        'Cite specific SLA numbers (e.g. p95 < 500 ms, 100 concurrent users) in `### Expected`.',
      ].join('\n'),
      Accessibility: [
        'Generate accessibility-focused TCs covering WCAG 2.1 AA, keyboard navigation, screen-reader landmarks, color contrast, focus management, and ARIA labelling.',
        'Tag every TC with `category=Accessibility`. Use Playwright + axe-core in `### Playwright Hint` where applicable.',
      ].join('\n'),
      Data: [
        'Generate data-focused TCs covering boundary values, format validation, serialization round-trips, encoding, and timezone handling.',
        'Tag every TC with `category=Data`. Mix positive (valid boundary) and negative (just-over boundary) TCs.',
      ].join('\n'),
      Smoke: [
        'Generate smoke TCs — fast happy-path-only TCs that cover the critical-path of each feature in under 30 s of execution time.',
        'Tag every TC with `category=Smoke` and `testKind=positive`. One TC per feature is the right grain.',
      ].join('\n'),
      Regression: [
        'Generate regression TCs — broad-coverage TCs that re-verify previously-fixed defect areas and high-risk integrations.',
        'Tag every TC with `category=Regression`. Mix positive and negative; reference any defect IDs from input context if available.',
      ].join('\n'),
    };

    const tcPrefix = `TC-${prefix}-`;
    const negTcPrefix = `Neg_TC-${prefix}-`;

    const categoryFocusedPrompt = [
      '## 🎯 SKILL-07-FTC PER-CATEGORY FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      `You are running as part of a per-category coverage pass. Each call generates test cases for ONE category that spans ALL features of this module — the orchestrator runs you once per category, AFTER the per-feature loop (mode 2) has produced Functional / Integration coverage.`,
      '',
      `**CURRENT CATEGORY: ${category}**`,
      '',
      '### Category focus',
      '',
      CATEGORY_FOCUS[category] ?? `Generate TCs of category=${category} appropriate to this module.`,
      '',
      '### Features in this module (every TC must link to at least one)',
      '',
      featureList,
      '',
      '### TC ID convention (CRITICAL — non-negotiable)',
      '',
      `Use category-prefixed TC IDs to avoid colliding with per-feature mode-2 IDs (TC-04-01-NNN) and previous category-pass IDs:`,
      '',
      `- Positive cases: \`${tcPrefix}001\`, \`${tcPrefix}002\`, \`${tcPrefix}003\`, …`,
      `- Negative cases: \`${negTcPrefix}004\`, \`${negTcPrefix}005\`, … (single shared sequence; \`Neg_\` prefix is formatting only — the authoritative signal is \`testKind=negative\` in the fenced-block header)`,
      '',
      `Number sequentially within THIS category only, starting at 001. Every TC ID you emit MUST start with \`${tcPrefix}\` (positive) or \`${negTcPrefix}\` (negative). Do NOT use plain \`TC-001\` or feature-prefixed IDs like \`TC-04-01-001\` — those collide with the per-feature loop.`,
      '',
      '### Linking + scenarioGroup rules',
      '',
      `Every TC MUST set \`category: ${category}\` in the fenced-block header. Every TC MUST tag at least one feature in \`linkedFeatureIds\` (use the feature list above). Set \`linkedEpicIds\`, \`linkedStoryIds\`, \`linkedSubtaskIds\` from the actual EPIC / story / subtask IDs in the input context wherever applicable.`,
      '',
      'Set `scenarioGroup` to a short HUMAN LABEL describing the scenario',
      `(e.g. for ${category}: ${category === 'Security' ? '"Auth — Session Hijack", "API — SQL Injection"' : category === 'UI' ? '"Login Form — Visual States", "Dashboard — Loading"' : category === 'Performance' ? '"Search — p95 Latency", "Bulk Import — Throughput"' : '"<scenario name>"'}). DO NOT use a feature ID as the scenarioGroup.`,
      '',
      '### Coverage target',
      '',
      `Aim for ${category === 'Smoke' ? '1 TC per feature (≈ ' + features.length + ' total)' : '8–15 TCs total'} spanning the most relevant features. Skip features where this category does not apply (e.g. backend-only features for Accessibility) and note that in scenarioGroup.`,
      '',
      'Do NOT emit module-wide narrative sections (§1–§5, §9–§12, §14–§16) —',
      'those are produced by the narrative-only pass (mode 3). Just emit the',
      '§6 / §7 / §8 content (TC bodies + OWASP entries that apply + AC',
      'coverage rows) for THIS category, with every TC also repeated verbatim',
      'in the §17 Test Case Appendix.',
      '',
      'Each TC body MUST contain ALL 10 canonical `### ` sub-section blocks in',
      'order — `### Test Data`, `### Pre Condition`, `### E2E Flow`, `### Test',
      'Steps`, `### Expected`, `### Post Validation`, `### SQL Setup`, `### SQL',
      'Verify`, `### Playwright Hint`, `### Developer Hints`. Missing blocks =',
      'NULL columns in the database and broken CSV exports.',
      '',
      '---',
      '',
      this.wrapSkill07Prompt(skillPrompt, contextPacket),
    ].join('\n');

    const runStartedAt = new Date();
    const aiResponse = await this.callAiServiceWithRetry(
      categoryFocusedPrompt,
      { ...contextPacket, currentFocusCategory: category },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for category ${category}`);
    }

    const before = await this.prisma.baTestCase.count({
      where: { artifactDbId: artifact.id },
    });
    await this.ftcParser.parseAndStore(humanDocument, artifact.id);
    const after = await this.prisma.baTestCase.count({
      where: { artifactDbId: artifact.id },
    });
    const tcsAdded = after - before;

    // Backfill: AI may forget to tag `category` on every TC. Enforce it
    // on TCs created in this run.
    const newTcs = await this.prisma.baTestCase.findMany({
      where: {
        artifactDbId: artifact.id,
        createdAt: { gte: runStartedAt },
      },
      select: { id: true, category: true },
    });
    for (const tc of newTcs) {
      if (tc.category !== category) {
        await this.prisma.baTestCase.update({
          where: { id: tc.id },
          data: { category },
        });
      }
    }

    this.logger.log(
      `SKILL-07-FTC per-category ${category}: appended ${tcsAdded} test case(s) to ${artifact.id}`,
    );
    return {
      category,
      artifactId: artifact.id,
      tcsAdded,
      skipped: false,
    };
  }

  /**
   * Read `ftcConfig.testTypes` and return the categories that need a
   * per-category pass. Functional and Integration are excluded — they
   * are produced by the per-feature loop (mode 2). Returns the subset
   * of testTypes that map to a valid category prefix.
   */
  async listMissingCategoriesForCoverage(moduleDbId: string): Promise<string[]> {
    const config = await this.prisma.baFtcConfig.findUnique({
      where: { moduleDbId },
    });
    const testTypes = (config?.testTypes ?? []) as string[];
    if (testTypes.length === 0) {
      // No filter set → architect implicitly wants all supported categories
      // beyond the per-feature loop's defaults.
      return Object.keys(this.CATEGORY_PREFIXES);
    }
    return testTypes.filter(
      (t) => t !== 'Functional' && t !== 'Integration' && this.CATEGORY_PREFIXES[t] !== undefined,
    );
  }

  // ─── SKILL-07-FTC per-feature WHITE-BOX coverage pass (mode 2c) ───────
  //
  // After per-feature mode 2 (black-box Functional / Integration) and per-
  // category mode 2b (Security / UI / Performance / etc.) have populated
  // the FTC artifact, white-box test cases are still missing — by design.
  // The skill file's §3 says §8 White-Box Test Cases is OMITTED when
  // `lldContext` is absent. Once the LLD artifact exists for the module,
  // this mode fills the gap: per-feature focused AI calls that emit white-
  // box TCs scoped to the LLD's classes/methods.
  //
  // What "white-box" means here (versus the existing 98 black-box TCs):
  //   - scope=white_box (not black_box)
  //   - Asserts internal class invariants, algorithm-step coverage,
  //     exception paths, mocked-collaborator behaviour
  //   - linkedPseudoFileIds populated with the LLD's BaPseudoFile UUIDs
  //   - linkedLldArtifactId populated with the module's LLD artifact id
  //   - Tests run with a unit-test framework (Vitest / JUnit / pytest unit)
  //     not Playwright / k6
  //
  // Idempotent: skips when this feature already has white-box TCs.
  // Prerequisite: an LLD artifact must exist for the module (else throws).

  /**
   * Generate white-box TCs for ONE feature and append the parsed
   * BaTestCase rows to the module's FTC artifact. Mirrors the per-feature
   * mode-2 loop but scoped to white-box only.
   */
  async executeSkill07ForFeatureWhiteBox(
    moduleDbId: string,
    featureId: string,
  ): Promise<{
    featureId: string;
    artifactId: string;
    tcsAdded: number;
    skipped: boolean;
    reason?: string;
  }> {
    if (!/^F-\d+-\d+$/.test(featureId)) {
      throw new Error(`Invalid featureId "${featureId}". Expected F-NN-NN.`);
    }

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // Prerequisite: LLD artifact must exist (white-box can't reference
    // class/method names that aren't in any LLD pseudo-file).
    const lldArtifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.LLD },
      orderBy: { createdAt: 'desc' },
    });
    if (!lldArtifact) {
      throw new Error(
        `Cannot generate white-box TCs for ${mod.moduleId}: no LLD artifact exists. ` +
        `Click "Generate LLD" on the AI LLD Workbench first.`,
      );
    }

    // Prerequisite: FTC artifact must exist (white-box appends to the
    // existing module FTC, doesn't create a new one).
    let ftcArtifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.FTC },
      orderBy: { createdAt: 'desc' },
    });
    if (!ftcArtifact) {
      // Edge case — architect ran LLD before any FTC. Create the artifact
      // so the white-box TCs land somewhere; mode 3 narrative will fill
      // sections later.
      const suffix = await this.deriveFtcSuffix(moduleDbId);
      ftcArtifact = await this.prisma.baArtifact.create({
        data: {
          moduleDbId,
          artifactType: BaArtifactType.FTC,
          artifactId: `FTC-${mod.moduleId}-${suffix}`,
          status: BaArtifactStatus.DRAFT,
        },
      });
      // Refresh BaModule.ftcArtifactId pointer (see executeSkill07ForFeature
      // for rationale) — keeps frontend reads pointing at the live artifact.
      await this.prisma.baModule.update({
        where: { id: moduleDbId },
        data: { ftcArtifactId: ftcArtifact.id, ftcCompletedAt: new Date() },
      });
    }

    // Idempotency — skip when this feature already has white-box TCs on
    // the artifact.
    const existingWhiteBox = await this.prisma.baTestCase.findMany({
      where: {
        artifactDbId: ftcArtifact.id,
        scope: 'white_box',
        linkedFeatureIds: { has: featureId },
      },
      select: { id: true },
    });
    if (existingWhiteBox.length > 0) {
      this.logger.log(
        `SKILL-07-FTC white-box: skipping ${featureId} — already has ${existingWhiteBox.length} white-box TC(s)`,
      );
      return {
        featureId,
        artifactId: ftcArtifact.id,
        tcsAdded: 0,
        skipped: true,
        reason: `${existingWhiteBox.length} white-box TC(s) for ${featureId} already on the FTC artifact; delete them first to regenerate.`,
      };
    }

    // Filter LLD pseudo-files to those that mention this feature's ID in
    // their content (Traceability docstring). These are the classes/files
    // the white-box TCs will target.
    const allPseudoFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: lldArtifact.id },
      select: { id: true, path: true, language: true, aiContent: true, editedContent: true },
    });
    const featurePseudoFiles = allPseudoFiles.filter((f) => {
      const text = `${f.path}\n${f.editedContent ?? f.aiContent ?? ''}`;
      return text.includes(featureId);
    });
    if (featurePseudoFiles.length === 0) {
      this.logger.log(
        `SKILL-07-FTC white-box: skipping ${featureId} — no LLD pseudo-files reference this feature`,
      );
      return {
        featureId,
        artifactId: ftcArtifact.id,
        tcsAdded: 0,
        skipped: true,
        reason: `No LLD pseudo-files reference ${featureId}. Edit one or more LLD pseudo-files in the editor to add ${featureId} to the Traceability docstring, then re-run.`,
      };
    }

    // Build the FTC context.
    const skillPrompt = this.loadSkillFile('SKILL-07-FTC');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-07-FTC');

    // Compose the file list as a compact summary for the AI: path +
    // 5-line opening of the content (class signature + first method).
    const featureFileSummary = featurePseudoFiles
      .map((f) => {
        const body = (f.editedContent ?? f.aiContent ?? '').split(/\r?\n/).slice(0, 12).join('\n');
        return `**${f.path}** (${f.language})\n\`\`\`${f.language}\n${body}\n\`\`\``;
      })
      .join('\n\n');

    // White-box TC ID convention: feature-prefixed with "WB" prefix, e.g.
    // WB-04-01-001 (positive) and Neg_WB-04-01-002 (negative). Avoids
    // collision with TC-04-01-NNN (mode 2 black-box) and TC-SEC-NNN etc.
    const featureSuffix = featureId.replace(/^F-/, '');
    const tcPrefix = `WB-${featureSuffix}-`;
    const negTcPrefix = `Neg_WB-${featureSuffix}-`;

    const whiteBoxFocusedPrompt = [
      '## 🎯 SKILL-07-FTC WHITE-BOX FOCUS — ORCHESTRATOR OVERRIDE (mode 2c)',
      '',
      `You are running as part of a per-feature WHITE-BOX coverage pass. The module's LLD artifact is complete. The FTC artifact already has black-box (Functional / Integration / Security / UI / Performance) TCs. Your job is to add WHITE-BOX TCs for ONE feature that target the LLD's classes / methods directly.`,
      '',
      `**CURRENT FEATURE: ${featureId}**`,
      '',
      `**LLD ARTIFACT ID: ${lldArtifact.artifactId}** (lldArtifactDbId: ${lldArtifact.id})`,
      '',
      '### What "white-box" means here',
      '',
      'White-box TCs differ from the existing black-box ones in three ways:',
      '',
      '1. **Set `scope=white_box`** in the fenced-block header (NOT `scope=black_box`).',
      '2. **Assertions target internal class/method contracts**, not user-visible behaviour:',
      '   - Class invariants (state of private fields after operations)',
      '   - Each Algorithm step from the LLD JavaDoc/JSDoc — one TC per step where applicable',
      '   - Exception paths (each `@throws` in the docstring)',
      '   - Mocked-collaborator behaviour (verify the right method was called with the right args)',
      '   - Edge cases at the algorithmic level (off-by-one, null/empty inputs at internal boundaries)',
      '3. **Test framework is unit-level**: Vitest / JUnit / pytest-unit / Mocha — NOT Playwright / k6 / Cypress. Use `### Vitest Hint` (or `### JUnit Hint` / `### pytest Hint`) heading instead of `### Playwright Hint`.',
      '',
      '### Mandatory header attrs for every TC',
      '',
      '- `scope=white_box` (NOT `black_box`)',
      '- `category=Functional` is the default; use `Integration` only when the white-box test verifies a class-to-class boundary that crosses module/service lines',
      '- `testKind=positive` or `testKind=negative` — both are needed; aim for ≥ 1 positive happy-path + ≥ 2 negative (exception/edge) per significant class',
      '- `priority=P1` for happy-path white-box; `P2` for edge cases',
      '- `owasp` blank (white-box rarely maps to OWASP categories — those live in the per-category Security pass)',
      '',
      '### TC ID convention (CRITICAL — avoid collision with existing IDs)',
      '',
      `Use feature-prefixed white-box IDs:`,
      '',
      `- Positive cases: \`${tcPrefix}001\`, \`${tcPrefix}002\`, …`,
      `- Negative cases: \`${negTcPrefix}003\`, \`${negTcPrefix}004\`, … (single shared sequence; \`Neg_\` prefix is formatting only)`,
      '',
      `Do NOT use plain \`TC-001\` (collides with single-shot mode 1) or \`TC-04-01-001\` (collides with mode 2 black-box) or \`TC-SEC-001\` etc. (collides with mode 2b per-category). Every white-box TC ID MUST start with \`${tcPrefix}\` or \`${negTcPrefix}\`.`,
      '',
      '### Mandatory linkage',
      '',
      `- \`linkedFeatureIds: ${featureId}\` (this feature only — do NOT fan out)`,
      `- \`linkedLldArtifactId: ${lldArtifact.artifactId}\` (the module's LLD artifact id)`,
      `- \`linkedPseudoFileIds: <comma-separated paths from the file list below>\` — emit the PATHS verbatim (e.g. \`backend/service/research-chat.service.ts\`); the orchestrator backfills these to BaPseudoFile UUIDs after parsing.`,
      `- \`linkedEpicIds\` / \`linkedStoryIds\` / \`linkedSubtaskIds\` — populate from the input context where applicable`,
      '',
      '### Pseudo-files in scope (white-box assertions go here)',
      '',
      'These are the LLD pseudo-files that reference ' + featureId + ' in their Traceability docstring. Every white-box TC you emit MUST cite at least one of these paths in `linkedPseudoFileIds` and mention the class/method by name in the test body.',
      '',
      featureFileSummary,
      '',
      '### Coverage target',
      '',
      `Aim for **5–10 white-box TCs** total spanning the classes above. One TC per public method + one per exception path is a reasonable floor. Skip getters/setters and trivial DTOs.`,
      '',
      '### What NOT to emit',
      '',
      '- Do NOT emit module-wide narrative sections (§1–§5, §9–§12, §14–§16) — those exist already.',
      '- Do NOT emit `## Functional Test Cases` / `## Integration Test Cases` headings — your TCs go under §8 White-Box Test Cases (the structural-sections renderer auto-routes by `scope=white_box`).',
      '- Do NOT regenerate the per-feature black-box TCs — they already exist.',
      '- Do NOT invent class/method names that are not in the file list above.',
      '',
      'Each TC body MUST contain ALL 10 canonical `### ` sub-section blocks — `### Test Data`, `### Pre Condition`, `### E2E Flow` (use "N/A — unit test" for white-box), `### Test Steps`, `### Expected`, `### Post Validation`, `### SQL Setup` (often "-- N/A"), `### SQL Verify` (often "-- N/A"), `### Vitest Hint` (or framework-appropriate name) replacing Playwright Hint, `### Developer Hints` — same rules as the existing black-box TCs.',
      '',
      'Every TC MUST appear in the §17 Test Case Appendix verbatim. The parser reads from the appendix.',
      '',
      '---',
      '',
      this.wrapSkill07Prompt(skillPrompt, contextPacket),
    ].join('\n');

    // Call the AI.
    const runStartedAt = new Date();
    const aiResponse = await this.callAiServiceWithRetry(
      whiteBoxFocusedPrompt,
      {
        ...contextPacket,
        currentFocusFeature: featureId,
        whiteBoxMode: true,
        lldArtifactId: lldArtifact.artifactId,
        lldArtifactDbId: lldArtifact.id,
      },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for white-box ${featureId}`);
    }

    // Parse and store. Parser is idempotent at the section level.
    const before = await this.prisma.baTestCase.count({
      where: { artifactDbId: ftcArtifact.id },
    });
    await this.ftcParser.parseAndStore(humanDocument, ftcArtifact.id);
    const after = await this.prisma.baTestCase.count({
      where: { artifactDbId: ftcArtifact.id },
    });
    const tcsAdded = after - before;

    // Backfill the white-box-specific fields on TCs created in this run.
    // The AI may forget any of: scope=white_box, linkedLldArtifactId,
    // linkedFeatureIds, linkedPseudoFileIds. Enforce them deterministically.
    const newTcs = await this.prisma.baTestCase.findMany({
      where: {
        artifactDbId: ftcArtifact.id,
        createdAt: { gte: runStartedAt },
      },
      select: {
        id: true,
        scope: true,
        linkedFeatureIds: true,
        linkedLldArtifactId: true,
        linkedPseudoFileIds: true,
        aiContent: true,
      },
    });
    const pathToId = new Map(allPseudoFiles.map((f) => [f.path, f.id]));
    for (const tc of newTcs) {
      const data: Record<string, unknown> = {};
      if (tc.scope !== 'white_box') data.scope = 'white_box';
      if (tc.linkedLldArtifactId !== lldArtifact.artifactId) {
        data.linkedLldArtifactId = lldArtifact.artifactId;
      }
      if (!(tc.linkedFeatureIds ?? []).includes(featureId)) {
        data.linkedFeatureIds = Array.from(new Set([...(tc.linkedFeatureIds ?? []), featureId]));
      }
      // Resolve pseudo-file paths (mentioned in TC content or in
      // linkedPseudoFileIds as path strings) to BaPseudoFile UUIDs.
      const tcText = `${tc.aiContent ?? ''}\n${(tc.linkedPseudoFileIds ?? []).join('\n')}`;
      const referencedIds = new Set<string>();
      for (const [path, id] of pathToId) {
        if (tcText.includes(path)) referencedIds.add(id);
      }
      // Also keep any UUIDs already on the TC that match real pseudo-files.
      const validIdSet = new Set(allPseudoFiles.map((f) => f.id));
      for (const existing of tc.linkedPseudoFileIds ?? []) {
        if (validIdSet.has(existing)) referencedIds.add(existing);
      }
      const resolvedIds = Array.from(referencedIds);
      const currentIds = (tc.linkedPseudoFileIds ?? []).slice().sort();
      const newIds = resolvedIds.slice().sort();
      if (resolvedIds.length > 0 && currentIds.join(',') !== newIds.join(',')) {
        data.linkedPseudoFileIds = resolvedIds;
      }
      if (Object.keys(data).length > 0) {
        await this.prisma.baTestCase.update({
          where: { id: tc.id },
          data,
        });
      }
    }

    this.logger.log(
      `SKILL-07-FTC white-box ${featureId}: appended ${tcsAdded} white-box TC(s) to ${ftcArtifact.id}`,
    );
    return {
      featureId,
      artifactId: ftcArtifact.id,
      tcsAdded,
      skipped: false,
    };
  }

  /**
   * Return the list of features that have NO white-box TCs yet on the
   * module's FTC artifact. Used by the complete-pipeline gate.
   */
  async listFeaturesMissingWhiteBox(moduleDbId: string): Promise<string[]> {
    const features = await this.listFeaturesForFtc(moduleDbId);
    if (features.length === 0) return [];
    const ftcArtifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.FTC },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!ftcArtifact) {
      // No FTC yet — every feature is "missing" white-box TCs.
      return features.map((f) => f.featureId);
    }
    const whiteBox = await this.prisma.baTestCase.findMany({
      where: { artifactDbId: ftcArtifact.id, scope: 'white_box' },
      select: { linkedFeatureIds: true },
    });
    const covered = new Set<string>();
    for (const tc of whiteBox) for (const fid of tc.linkedFeatureIds ?? []) covered.add(fid);
    return features.map((f) => f.featureId).filter((fid) => !covered.has(fid));
  }

  /**
   * SKILL-07-FTC narrative-only mode (mode 3 from the skill file). Runs
   * AFTER the per-feature loop (mode 2) has populated all TCs. Generates
   * the §1–§5 + §9–§12 + §14–§16 narrative sections that mode 2
   * deliberately suppressed — Summary, Test Strategy, OWASP Coverage
   * Maps, Traceability Summary, Applied Best-Practice Defaults, etc.
   *
   * Why this is a separate pass:
   *   - Mode 2 produces TCs but tells the AI to skip the module-wide
   *     narrative ("you'll get those at the end") — otherwise each per-
   *     feature call would emit duplicate Summary / Traceability / OWASP
   *     content and we'd have N drafts of every section.
   *   - Mode 3 is the "stitcher" that mode 2's prompt promises. It reads
   *     the existing TCs from the artifact, passes their IDs / OWASP
   *     tags / categories as input context, and asks the AI to produce
   *     ONLY the narrative sections referencing those real TC IDs.
   *
   * Idempotent: skips when the artifact already has > 4 BaArtifactSection
   * rows (the narrative pass typically writes ~11 sections; mode 2 may
   * write 0–2 stragglers; > 4 means narrative has already run).
   */
  async executeSkill07Narrative(
    moduleDbId: string,
  ): Promise<{
    artifactId: string;
    sectionsAdded: number;
    skipped: boolean;
    reason?: string;
  }> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    const artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.FTC },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      throw new Error(`No FTC artifact for module ${mod.moduleId}. Run mode 1 (single-shot) or mode 2 (per-feature) first.`);
    }

    // Skip-check looks for canonical narrative section keys, not raw count.
    // Each per-feature mode-2 call writes a `test_case_appendix` section, so
    // the previous "> 4 sections" threshold falsely triggered after just 5
    // features even though no narrative had run yet. The narrative-only pass
    // emits these specific keys (mapped from the §1–§5 + §9–§16 headings in
    // FINAL-SKILL-07-create-ftc.md) — checking for any of them is the right
    // signal that narrative content already exists on the artifact.
    const NARRATIVE_KEYS = [
      'summary',
      'test_strategy',
      'test_environment',
      'master_data_setup',
      'owasp_web_coverage',
      'owasp_llm_coverage',
      'data_cleanup',
      'playwright_readiness',
      'traceability_summary',
      'open_questions_tbd',
      'applied_defaults',
    ];
    const existingSections = await this.prisma.baArtifactSection.findMany({
      where: { artifactId: artifact.id },
      select: { id: true, sectionKey: true },
    });
    const existingNarrativeKeys = existingSections
      .map((s) => s.sectionKey)
      .filter((k) => NARRATIVE_KEYS.includes(k));
    // Always render structural sections (Test Cases Index, Functional /
    // Integration / White-Box Test Cases) deterministically from the TC
    // catalogue. No AI cost. Runs before the narrative skip-check so a
    // module whose narrative was already produced still gets its
    // structural sections refreshed (e.g. after TC edits).
    const structuralSectionsAdded = await this.ftcParser.renderStructuralSections(artifact.id);

    if (existingNarrativeKeys.length >= 3) {
      return {
        artifactId: artifact.id,
        sectionsAdded: structuralSectionsAdded,
        skipped: true,
        reason: `Artifact already has ${existingNarrativeKeys.length} canonical narrative section(s) (${existingNarrativeKeys.join(', ')}) — narrative pass skipped. Structural sections refreshed (${structuralSectionsAdded}). Delete narrative section rows first to regenerate AI narrative.`,
      };
    }

    // Pull every TC on the artifact as context for OWASP / Traceability
    // tables. The AI uses these IDs in §10/§11 OWASP Coverage rows and
    // §14 Traceability Summary; without them the narrative would be
    // generic and disconnected from the real TC catalogue.
    const existingTcs = await this.prisma.baTestCase.findMany({
      where: { artifactDbId: artifact.id },
      select: {
        testCaseId: true,
        title: true,
        scope: true,
        testKind: true,
        category: true,
        priority: true,
        owaspCategory: true,
        isIntegrationTest: true,
        scenarioGroup: true,
        linkedFeatureIds: true,
        linkedStoryIds: true,
      },
      orderBy: { testCaseId: 'asc' },
    });

    const skillPrompt = this.loadSkillFile('SKILL-07-FTC');
    const baseContext = await this.assembleContext(moduleDbId, 'SKILL-07-FTC');
    // Squeeze the existing TCs into the context as a compact summary.
    // The AI uses this list when filling OWASP coverage rows + the
    // Traceability Summary, so the references in those sections actually
    // resolve to TCs already in the database.
    const tcSummary = existingTcs.map((tc) => ({
      id: tc.testCaseId,
      title: tc.title?.slice(0, 120) ?? null,
      scope: tc.scope,
      kind: tc.testKind,
      category: tc.category,
      priority: tc.priority,
      owasp: tc.owaspCategory,
      integration: tc.isIntegrationTest,
      group: tc.scenarioGroup,
      features: tc.linkedFeatureIds,
      stories: tc.linkedStoryIds,
    }));
    const narrativeContext = {
      ...baseContext,
      ftcMode: 'narrative-only',
      existingTestCaseSummary: tcSummary,
      existingTestCaseCount: existingTcs.length,
    };

    const narrativeFocusedPrompt = [
      '## 🎯 SKILL-07-FTC NARRATIVE-ONLY MODE — ORCHESTRATOR OVERRIDE',
      '',
      'You are running in mode 3 (narrative-only append). The FTC artifact already has its test cases populated (see `existingTestCaseSummary` in context — every TC ID, OWASP tag, category, scenario group, and linked feature/story is provided). Your job is to produce ONLY the module-wide narrative sections that mode 2 deliberately omitted.',
      '',
      `**EXISTING TEST CASES: ${existingTcs.length}**`,
      '',
      '### What to output NOW',
      '',
      'Emit these narrative sections ONLY, in this order, each as a `## ` (level-2) heading with the EXACT canonical labels (the parser matches on these):',
      '',
      '- `## Summary`',
      '- `## Test Strategy`',
      '- `## Test Environment & Dependencies`',
      '- `## Master Data Setup`',
      '- `## OWASP Web Top 10 Coverage Matrix` *(reference real TC IDs from `existingTestCaseSummary` where `owasp` matches A01–A10)*',
      '- `## OWASP LLM Top 10 Coverage Matrix` *(omit row content if module has no AI/LLM content; keep heading + a one-line note)*',
      '- `## Data Cleanup / Teardown`',
      '- `## Playwright Automation Readiness`',
      '- `## Traceability Summary` *(FRD → EPIC → US → ST → LLD → TC, using real TC IDs from `existingTestCaseSummary`)*',
      '- `## Open Questions / TBD-Future Reconciliation`',
      '- `## Applied Best-Practice Defaults`',
      '',
      '### What to SKIP',
      '',
      '- Do NOT emit any ```tc id=...``` fenced block. The TCs already exist; emitting them again would create duplicate-key warnings in the parser. Only the narrative section bodies are needed.',
      '- Do NOT emit `## Functional Test Cases`, `## Integration Test Cases`, `## Security Test Cases`, `## UI Test Cases`, or `## White-Box Test Cases`. Mode 2 already populated those via the per-feature TC bodies.',
      '- Do NOT emit a `## Test Case Appendix` heading or content. The appendix is irrelevant in narrative-only mode (TCs already in DB).',
      '',
      '### Coverage rules (use the existing TC summary)',
      '',
      '- §9 OWASP Web Coverage table: build a 10-row table A01–A10. For each control, list the TC IDs from `existingTestCaseSummary` whose `owasp` field equals that code. If a control has no covering TC, mark it ❌ NOT COVERED and add a one-line gap reason.',
      '- §10 OWASP LLM Coverage table: same shape for LLM01–LLM10. Omit the table content (keep heading + "N/A — module has no LLM/AI surface") if the module is purely backend CRUD with no AI prompts.',
      '- §14 Traceability Summary: reference TC IDs grouped by `linkedFeatureIds` and `linkedStoryIds` from the summary. Should read like "F-04-08 (Manage Verification Quota) — covered by 12 TCs across US-073/074/075: [list]".',
      '',
      '---',
      '',
      '## Original Skill Definition (the canonical labels above match §3 of the skill file; refer to §1b mode 3 author rules for full details)',
      '',
      skillPrompt,
    ].join('\n');

    const aiResponse = await this.callAiServiceWithRetry(
      narrativeFocusedPrompt,
      narrativeContext,
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for narrative-only pass on ${mod.moduleId}`);
    }

    const before = await this.prisma.baArtifactSection.count({
      where: { artifactId: artifact.id },
    });
    await this.ftcParser.parseAndStore(humanDocument, artifact.id);
    const after = await this.prisma.baArtifactSection.count({
      where: { artifactId: artifact.id },
    });
    const sectionsAdded = after - before;

    this.logger.log(
      `SKILL-07-FTC narrative-only: appended ${sectionsAdded} section(s) to ${artifact.id}`,
    );

    return {
      artifactId: artifact.id,
      sectionsAdded,
      skipped: false,
    };
  }

  // ─── SKILL-07-FTC complete pipeline (one-shot for the stepper) ────────
  //
  // Runs every SKILL-07-FTC mode in the right order so the FTC stepper
  // button on the BA tool can produce a complete, well-categorized FTC
  // artifact in one click — no need for the architect to know about
  // mode 2 / mode 2b / mode 2c / mode 3 separately.
  //
  // Pipeline:
  //   1. Per-feature loop (mode 2) — happy / negative / boundary /
  //      integration TCs grouped by feature (BLACK-BOX).
  //   2. Per-category passes (mode 2b) — Security, UI, Performance, etc.
  //      for any testType in `ftcConfig.testTypes` not already covered
  //      by mode 2 (Functional + Integration). Still BLACK-BOX.
  //   2c. Per-feature WHITE-BOX loop — only runs when an LLD artifact
  //      exists for the module. Adds class/method-level white-box TCs
  //      that link to LLD pseudo-files. Skipped silently when no LLD.
  //   3. Narrative pass (mode 3) — Summary, Test Strategy, OWASP
  //      Coverage Maps, Traceability Summary, Applied Best-Practice
  //      Defaults, plus the structural sections (Test Cases Index, §6
  //      Functional / §7 Integration / §8 White-Box body sections).
  //
  // Each step is idempotent. Re-running the pipeline only fills the
  // missing pieces (e.g. if an architect adds a new feature later, the
  // per-feature loop picks up just that feature; if they enable a new
  // test type, the per-category pass picks up just that category; if
  // they generate the LLD AFTER the FTC pipeline ran, re-running adds
  // white-box TCs without touching the existing black-box ones).

  /**
   * Run the complete FTC pipeline (mode 2 + mode 2b + mode 2c + mode 3)
   * for a module. Returns a per-step summary so the UI can show progress.
   */
  async executeSkill07Complete(
    moduleDbId: string,
  ): Promise<{
    artifactId: string;
    perFeature: Array<{ featureId: string; tcsAdded: number; skipped: boolean }>;
    perCategory: Array<{ category: string; tcsAdded: number; skipped: boolean }>;
    perFeatureWhiteBox: Array<{ featureId: string; tcsAdded: number; skipped: boolean }>;
    narrative: { sectionsAdded: number; skipped: boolean };
    totalTcs: number;
  }> {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // Step 1: per-feature loop (black-box).
    const features = await this.listFeaturesForFtc(moduleDbId);
    const perFeature: Array<{ featureId: string; tcsAdded: number; skipped: boolean }> = [];
    for (const f of features) {
      try {
        const r = await this.executeSkill07ForFeature(moduleDbId, f.featureId);
        perFeature.push({ featureId: f.featureId, tcsAdded: r.tcsAdded, skipped: r.skipped });
      } catch (err) {
        this.logger.warn(
          `SKILL-07-FTC complete: per-feature ${f.featureId} failed — ${err instanceof Error ? err.message : 'unknown'}; continuing`,
        );
        perFeature.push({ featureId: f.featureId, tcsAdded: 0, skipped: true });
      }
    }

    // Step 2: per-category passes for missing categories (still black-box).
    const missingCategories = await this.listMissingCategoriesForCoverage(moduleDbId);
    const perCategory: Array<{ category: string; tcsAdded: number; skipped: boolean }> = [];
    for (const cat of missingCategories) {
      try {
        const r = await this.executeSkill07ForCategory(moduleDbId, cat);
        perCategory.push({ category: cat, tcsAdded: r.tcsAdded, skipped: r.skipped });
      } catch (err) {
        this.logger.warn(
          `SKILL-07-FTC complete: per-category ${cat} failed — ${err instanceof Error ? err.message : 'unknown'}; continuing`,
        );
        perCategory.push({ category: cat, tcsAdded: 0, skipped: true });
      }
    }

    // Step 2c: per-feature WHITE-BOX loop — only when an LLD artifact
    // exists for the module. Each call cites LLD pseudo-files and emits
    // class/method-level assertions with scope=white_box. Silently skips
    // when there is no LLD (modules without an LLD have no class/method
    // surface to cite, so white-box would be hallucinated).
    const perFeatureWhiteBox: Array<{ featureId: string; tcsAdded: number; skipped: boolean }> = [];
    const lldArtifactExists = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.LLD },
      select: { id: true },
    });
    if (lldArtifactExists) {
      for (const f of features) {
        try {
          const r = await this.executeSkill07ForFeatureWhiteBox(moduleDbId, f.featureId);
          perFeatureWhiteBox.push({ featureId: f.featureId, tcsAdded: r.tcsAdded, skipped: r.skipped });
        } catch (err) {
          this.logger.warn(
            `SKILL-07-FTC complete: white-box ${f.featureId} failed — ${err instanceof Error ? err.message : 'unknown'}; continuing`,
          );
          perFeatureWhiteBox.push({ featureId: f.featureId, tcsAdded: 0, skipped: true });
        }
      }
    } else {
      this.logger.log(
        `SKILL-07-FTC complete: skipping white-box loop — no LLD artifact exists for ${mod.moduleId}`,
      );
    }

    // Step 3: narrative + structural sections.
    let narrative: { sectionsAdded: number; skipped: boolean } = { sectionsAdded: 0, skipped: true };
    try {
      const r = await this.executeSkill07Narrative(moduleDbId);
      narrative = { sectionsAdded: r.sectionsAdded, skipped: r.skipped };
    } catch (err) {
      this.logger.warn(
        `SKILL-07-FTC complete: narrative pass failed — ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    const artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.FTC },
      orderBy: { createdAt: 'desc' },
    });
    const totalTcs = artifact
      ? await this.prisma.baTestCase.count({ where: { artifactDbId: artifact.id } })
      : 0;

    this.logger.log(
      `SKILL-07-FTC complete pipeline finished for ${mod.moduleId}: ` +
      `features=${perFeature.length}, categories=${perCategory.length}, ` +
      `whiteBox=${perFeatureWhiteBox.length}, ` +
      `narrative=${narrative.sectionsAdded}, totalTCs=${totalTcs}`,
    );

    return {
      artifactId: artifact?.id ?? '',
      perFeature,
      perCategory,
      perFeatureWhiteBox,
      narrative,
      totalTcs,
    };
  }

  // ─── SKILL-04 per-feature user-story regeneration (mode 04b) ──────────
  //
  // The single-shot SKILL-04 path already runs a per-feature loop internally
  // (`callAiServiceSkill04PerFeature`), but that loop is gated by the RTM
  // row catalog. When the upstream FRD under-emits features (observed on
  // MOD-05: 20 screens, but FRD only declared F-05-03), the loop runs once
  // and the EPIC's other 9 feature ids (F-05-01..F-05-10) never get
  // their own user stories. The validator surfaces "1 user story for
  // 20 screens" but offers no targeted fix.
  //
  // Mode 04b is that targeted fix: an architect calls it with one
  // featureId, the orchestrator looks the feature up in EPIC content
  // (so it works even when RTM is sparse), and produces 2-3 stories
  // for THAT feature only. Output is appended to the existing
  // USER_STORY artifact via splitIntoSections (idempotent per section
  // key — re-runs that produce the same key update in place).
  //
  // Cost: ~$0.10 / call. Idempotent: features that already have ≥3
  // stories cited in the artifact short-circuit before any AI spend.

  /**
   * Generate User Stories for ONE feature on the module's existing
   * USER_STORY artifact. Reads feature info from RTM if present, else
   * from EPIC artifact section content (so MOD-05-class gaps where the
   * EPIC sees more features than the FRD/RTM are still fillable). Story
   * numbers reserved via `computeNextUserStoryNumber` so re-runs across
   * the project never collide.
   */
  async executeSkill04ForFeature(
    moduleDbId: string,
    featureId: string,
  ): Promise<{
    featureId: string;
    artifactId: string;
    storiesAdded: number;
    storyIds: string[];
    skipped: boolean;
    reason?: string;
  }> {
    if (!/^F-\d+-\d+$/.test(featureId)) {
      throw new Error(`Invalid featureId "${featureId}". Expected F-NN-NN.`);
    }

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // Prerequisite: USER_STORY artifact must exist (we're appending stories,
    // not bootstrapping from scratch). If it doesn't, the architect should
    // run SKILL-04 once first — analogous to mode 06c's LLD prereq.
    const usArtifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.USER_STORY },
      orderBy: { createdAt: 'desc' },
    });
    if (!usArtifact) {
      throw new Error(
        `Cannot regenerate per-feature User Stories for ${mod.moduleId} / ${featureId}: ` +
        `no USER_STORY artifact exists. Run "Generate User Stories" (single-shot) first.`,
      );
    }

    // Resolve feature name. Prefer RTM, then EPIC content, then a generic
    // fallback that just uses the feature ID.
    const rtmRow = mod.projectId
      ? await this.prisma.baRtmRow.findFirst({
          where: { projectId: mod.projectId, moduleId: mod.moduleId, featureId },
          select: { featureName: true, featureStatus: true, priority: true, screenRef: true },
        })
      : null;
    let featureName = rtmRow?.featureName?.trim() || '';
    let featureStatus = rtmRow?.featureStatus?.trim() || '';
    let featurePriority = rtmRow?.priority?.trim() || '';
    let featureScreenRef = rtmRow?.screenRef?.trim() || '';
    if (!featureName) {
      // Fall back to EPIC content scan. EPIC tables typically have rows of
      // the shape `| F-05-04 | <feature name> | ...` — pull the name field.
      const epicArtifact = await this.prisma.baArtifact.findFirst({
        where: { moduleDbId, artifactType: BaArtifactType.EPIC },
        orderBy: { createdAt: 'desc' },
      });
      if (epicArtifact) {
        const epicSections = await this.prisma.baArtifactSection.findMany({
          where: { artifactId: epicArtifact.id },
          select: { content: true },
        });
        const epicText = epicSections.map((s) => s.content || '').join('\n');
        const escapedFid = featureId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tableRowRe = new RegExp(`\\|\\s*${escapedFid}\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, 'i');
        const tableMatch = epicText.match(tableRowRe);
        if (tableMatch) featureName = tableMatch[1].trim();
        // Also try `F-05-04 — <name>` or `**F-05-04: <name>**` patterns.
        if (!featureName) {
          const proseRe = new RegExp(`${escapedFid}\\s*[—:\\-]\\s*([^\\n*|]{3,80})`, 'i');
          const proseMatch = epicText.match(proseRe);
          if (proseMatch) featureName = proseMatch[1].trim().replace(/\*+$/, '').trim();
        }
      }
    }
    if (!featureName) featureName = `Feature ${featureId}`;
    if (!featureStatus) featureStatus = 'CONFIRMED';
    if (!featurePriority) featurePriority = 'Must';

    // Idempotency — count distinct US-NNN ids in the existing artifact's
    // sections that mention THIS feature. ≥3 stories means we likely have
    // Frontend / Backend / Integration covered; skip without spending AI.
    const existingSections = await this.prisma.baArtifactSection.findMany({
      where: { artifactId: usArtifact.id },
      select: { sectionKey: true, sectionLabel: true, content: true },
    });
    const escapedFidForScan = featureId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const featureCiteRe = new RegExp(`\\b${escapedFidForScan}\\b`);
    const featureUsIds = new Set<string>();
    for (const s of existingSections) {
      const blob = `${s.sectionKey}\n${s.sectionLabel}\n${s.content || ''}`;
      if (!featureCiteRe.test(blob)) continue;
      for (const m of blob.matchAll(/\bUS-\d{3,}\b/g)) featureUsIds.add(m[0]);
    }
    if (featureUsIds.size >= 3) {
      return {
        featureId,
        artifactId: usArtifact.id,
        storiesAdded: 0,
        storyIds: [],
        skipped: true,
        reason:
          `Feature ${featureId} already has ${featureUsIds.size} user story/stories ` +
          `(${[...featureUsIds].sort().join(', ')}) cited in the artifact — no regen needed. ` +
          `Delete one or more of these sections manually if you want to force a regen.`,
      };
    }

    const skillPrompt = this.loadSkillFile('SKILL-04');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-04');

    // Reserve a US-NNN starting number that won't collide with any
    // existing story across the project.
    const nextUsNumber = await this.computeNextUserStoryNumber(mod.moduleId);

    const focusOverride = [
      '## 🎯 SKILL-04 PER-FEATURE FOCUS — ORCHESTRATOR OVERRIDE (mode 04b)',
      '',
      'You are running in per-feature User Story regeneration mode. The module already has a USER_STORY artifact with some stories populated. The orchestrator has identified that **this feature** is missing complete user-story coverage. Your job is to produce User Stories for THIS feature only.',
      '',
      `**TARGET FEATURE: ${featureId} — ${featureName}**`,
      `- Module:   ${mod.moduleId} — ${mod.moduleName}`,
      `- Status:   ${featureStatus}`,
      `- Priority: ${featurePriority}`,
      featureScreenRef ? `- Screens:  ${featureScreenRef}` : '',
      `- Existing US ids on this feature: ${featureUsIds.size > 0 ? [...featureUsIds].sort().join(', ') : '(none — this is the first story batch for the feature)'}`,
      '',
      '### What to emit',
      '',
      `1. A single \`## User Stories for ${featureId}\` heading.`,
      '2. **2–3 complete User Stories** for this feature only — covering Backend, Frontend, and Integration roles where applicable. CONFIRMED-PARTIAL features with TBD-Future integrations MUST include the Integration story; pure UI features can skip Integration.',
      '3. Each story uses the full 27-section template from the skill definition (Section 0 Traceability Header through Section 27 Linked SubTasks). Sections that are not applicable still get a heading + a one-line N/A note — do not skip them.',
      `4. Number stories starting at **US-${String(nextUsNumber).padStart(3, '0')}** and increment by 1 for each subsequent story.`,
      '5. Every story\'s Section 5 (FRD Feature Reference) MUST cite `' + featureId + '` exactly so the RTM extender can link them.',
      '',
      '### What to SKIP',
      '',
      '- Do NOT write a Coverage Summary table — those live at the top of the parent artifact.',
      '- Do NOT mention or write stories for any feature OTHER than ' + featureId + '.',
      '- Do NOT emit an RTM Extension table — the orchestrator extends RTM from the story headings after this call returns.',
      '- Do NOT repeat introductory module-level prose like "This document covers..." — the artifact already has that.',
      '- Do NOT re-emit any existing US-NNN id listed above (under "Existing US ids on this feature").',
      '',
      '### Hard rules',
      '',
      '- Story headings MUST be `### US-NNN — <Story Name>` so the parser locates them.',
      '- Cite the screen IDs for the feature in the canonical `SCR-NN — <Screen Title>` form (per the Screen Citation Format in the skill rules).',
      '- Acceptance Criteria, Algorithm Outline, and API Contract sections are mandatory and non-empty — these are what SKILL-05 / SKILL-06 / SKILL-07 read downstream.',
      '- Output is one markdown document starting with the `## User Stories for ' + featureId + '` heading. No preamble, no closing summary.',
      '',
      '---',
      '',
      '## Original Skill Definition (apply Section 4 Story Template + Screen Citation Format + Hard rules from §Rules section, constrained by the override above)',
      '',
      skillPrompt,
    ].filter((l) => l !== '').join('\n');

    const runStartedAt = new Date();
    const aiResponse = await this.callAiServiceWithRetry(
      focusOverride,
      { ...contextPacket, currentFocusFeature: featureId },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for feature ${featureId}`);
    }

    // Persist the AI response so the architect can audit what was emitted
    // (matches mode 06c's pattern). The execution row is APPROVED status
    // because the artifact is the canonical record — review happens there,
    // not on the execution.
    const execRow = await this.prisma.baSkillExecution.create({
      data: {
        moduleDbId,
        skillName: 'SKILL-04',
        status: BaExecutionStatus.AWAITING_REVIEW,
        humanDocument,
        startedAt: runStartedAt,
        completedAt: new Date(),
      },
    });
    this.logger.log(
      `SKILL-04 per-feature ${featureId}: AI response stored in execution ${execRow.id} (${humanDocument.length} chars)`,
    );

    // Append new sections to the existing USER_STORY artifact. Idempotent:
    // a section key that already exists is updated in place (when AI-
    // generated) or skipped (when human-modified) — same contract used by
    // the LLD parser. We don't have a dedicated user-story parser, but
    // splitIntoSections + per-row upsert covers the common case.
    const sections = this.splitIntoSections(humanDocument);
    const newStoryIds: string[] = [];
    for (const section of sections) {
      // Track US-NNN ids in the new sections so we can report them.
      for (const m of `${section.label}\n${section.content}`.matchAll(/\bUS-\d{3,}\b/g)) {
        if (!newStoryIds.includes(m[0])) newStoryIds.push(m[0]);
      }
      const existing = await this.prisma.baArtifactSection.findFirst({
        where: { artifactId: usArtifact.id, sectionKey: section.key },
        select: { id: true, isHumanModified: true },
      });
      if (existing) {
        if (existing.isHumanModified) {
          this.logger.warn(
            `SKILL-04 per-feature ${featureId}: skipped overwrite of section ${section.key} — human-modified`,
          );
          continue;
        }
        try {
          await this.prisma.baArtifactSection.update({
            where: { id: existing.id },
            data: { content: section.content, sectionLabel: section.label },
          });
        } catch (err) {
          this.logger.warn(
            `SKILL-04 per-feature ${featureId}: failed to update section ${section.key}: ${err instanceof Error ? err.message : 'unknown'}`,
          );
        }
        continue;
      }
      try {
        await this.prisma.baArtifactSection.create({
          data: {
            artifactId: usArtifact.id,
            sectionKey: section.key,
            sectionLabel: section.label,
            aiGenerated: true,
            isHumanModified: false,
            content: section.content,
          },
        });
      } catch (err) {
        this.logger.warn(
          `SKILL-04 per-feature ${featureId}: failed to insert section ${section.key}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    // Extend RTM so the new stories are linked to their feature row(s).
    if (mod.projectId) {
      try {
        await this.extendRtmWithStories(moduleDbId, mod.projectId, humanDocument);
      } catch (err) {
        this.logger.warn(
          `SKILL-04 per-feature ${featureId}: RTM extend failed — ${err instanceof Error ? err.message : 'unknown'}; non-fatal`,
        );
      }
    }

    // Filter newStoryIds to ones that didn't already exist on this feature
    // — those are the *added* stories. The AI may echo an existing story
    // id in cross-references (e.g. "supersedes US-051"); those are not
    // counted as adds.
    const addedStoryIds = newStoryIds.filter((sid) => !featureUsIds.has(sid));

    this.logger.log(
      `SKILL-04 per-feature ${featureId}: appended ${addedStoryIds.length} story(ies) to ${usArtifact.id} (${addedStoryIds.join(', ') || 'none'})`,
    );

    return {
      featureId,
      artifactId: usArtifact.id,
      storiesAdded: addedStoryIds.length,
      storyIds: addedStoryIds,
      skipped: false,
    };
  }

  // ─── SKILL-06-LLD per-section regeneration (mode 06b) ─────────────────
  //
  // Single-shot LLD generation can truncate later sections or under-emit
  // pseudo-files when a module is large (10+ features). This per-section
  // mode does ONE focused AI call to regenerate exactly one canonical
  // section without touching any other section. Used to fill gaps
  // surfaced by `BaLldParserService.validateCompleteness`.
  //
  // Cost: ~$0.05/call (small focused prompt) vs ~$0.50 for a full re-run.
  // Idempotent: skips when the target section is human-modified.

  /**
   * Map of canonical LLD sectionKey → human label + per-section AI focus.
   * The focus blurb is woven into the override prompt so the AI knows
   * exactly what content to emit for that single section. Keys mirror
   * BaLldParserService.CANONICAL_SECTIONS.
   */
  private readonly LLD_SECTION_FOCUS: Record<string, { label: string; focus: string }> = {
    summary: {
      label: 'Summary',
      focus: 'A 2-3 paragraph executive summary of the LLD: what this module is, who it serves, the high-level architecture choice, and the major risks / open questions. Cite the module ID + name.',
    },
    technology_stack: {
      label: 'Technology Stack',
      focus: 'Table of every layer (frontend / backend / database / streaming / caching / storage / cloud / architecture / DevOps) with: chosen tech, version, rationale (1-2 sentences each), and a "why-not alternatives" line. Use the exact stack from `lldConfig.stacks` in the input context — do not invent.',
    },
    architecture_overview: {
      label: 'Architecture Overview',
      focus: 'Architecture style (monolith / micro-service / event-driven / hexagonal / clean) with rationale. Include a Mermaid `architecture-beta` or `flowchart LR` diagram showing the top-level components and their data flow. Reference EPICs by ID where relevant.',
    },
    module_dependency_graph: {
      label: 'Module Dependency Graph',
      focus: 'Mermaid `flowchart TD` showing every internal module / package this LLD module depends on (or is depended on by), at the package level. List external dependencies (npm / maven / pip packages) separately as a markdown table. Annotate cycles if any.',
    },
    class_diagram: {
      label: 'Class Diagram',
      focus: 'Mermaid `classDiagram` for every domain class this module owns. Include: properties with types, public methods with signatures, inheritance arrows, association arrows. Cite the EPIC / User Story / SubTask each class implements in JavaDoc-style comments.',
    },
    sequence_diagrams: {
      label: 'Sequence Diagrams',
      focus: 'Mermaid `sequenceDiagram` for the 3-5 most critical flows in this module (one per section). Show actors → controllers → services → repositories → external integrations. Cite the User Story ID each flow implements.',
    },
    non_functional_requirements: {
      label: 'Non-Functional Requirements',
      focus: 'Table mapping each NFR (Scalability, Security, Performance, Responsive, Availability, Maintainability, etc.) → target value → mitigation pattern → which class/component owns it. Use NFR values from the input context (`nfr` field) as the source of truth — do not invent.',
    },
    api_contract_manifest: {
      label: 'API Contract Manifest',
      focus: 'Table of every REST endpoint this module exposes: `METHOD /path` | request schema (link to §9 Data Models) | response schema | error codes | auth required (Y/N) | rate limit. Group by feature. Cite EPIC/US IDs per endpoint.',
    },
    data_model_definitions: {
      label: 'Data Model Definitions',
      focus: 'For every entity / DTO / value object: TypeScript-style interface with field name, type, constraint (required, unique, fk to X), and a 1-line description. Group by aggregate root.',
    },
    schema_diagram: {
      label: 'Schema Diagram',
      focus: 'Mermaid `erDiagram` showing every database table / collection this module owns, with columns, primary/foreign keys, and relationships (1:1, 1:N, N:N). Include indices that matter for hot queries.',
    },
    integration_points: {
      label: 'Integration Points',
      focus: 'Class-level integration map: every external system this module calls (HTTP API, Kafka topic, gRPC service, S3 bucket, …) and the class/method that owns each one. Include retry / circuit-breaker policy per integration. Cross-reference the TBD-Future Integration Registry from input context.',
    },
    cross_cutting_concerns: {
      label: 'Cross-Cutting Concerns',
      focus: 'Table covering logging, error handling, transactions, audit trails, feature flags, i18n / l10n, request tracing, and metrics: which class / decorator / interceptor implements each, and where the configuration lives.',
    },
    env_var_secret_catalog: {
      label: 'Env Var / Secret Catalog',
      focus: 'Table of every env var / secret this module reads: name | type | example value | required (Y/N) | source (Vault, AWS Secrets Manager, .env, config map) | which class / config-loader consumes it.',
    },
    test_scaffold_hints: {
      label: 'Test Scaffold Hints',
      focus: 'Per-class test scaffold: list each public class → recommended test types (unit / integration / contract / e2e) → mocking strategy → coverage target. Mention the test framework that matches the chosen backend / frontend stack.',
    },
    build_ci_hooks: {
      label: 'Build / CI Hooks',
      focus: 'Build pipeline overview: build tool, test command, lint command, type-check command, container build, image tag scheme, deployment hook (Helm chart / Terraform / serverless deploy). One paragraph + a flow diagram if helpful.',
    },
    project_structure: {
      label: 'Project Structure',
      focus: 'Tree (text-based, like `tree -L 3` output) showing the source folder layout for this module: src/, tests/, configs/, etc. Use the architect-uploaded `projectStructureId` template (from input context) as the canonical reference — do not deviate from it.',
    },
    traceability_summary: {
      label: 'Traceability Summary',
      focus: 'Table mapping every FRD Feature → EPIC → User Story → SubTask → Class / Method (from the §5 Class Diagram) → Pseudo-File path (from `## Pseudo-Code Files`). Use real IDs from the input context (`rtmRows`).',
    },
    open_questions_tbd: {
      label: 'Open Questions / TBD-Future References',
      focus: 'Bulleted list of: (1) every TBD-Future integration from the registry that surfaced in this LLD, (2) open architectural questions the architect needs to resolve, (3) decisions that were made by AI default and need human review.',
    },
    applied_defaults: {
      label: 'Applied Best-Practice Defaults',
      focus: 'Bulleted list of every choice the AI made because input was missing or ambiguous: tech-stack defaults (when an `lldConfig.stacks.*` slot was null), architecture defaults, NFR target defaults, integration retry defaults. Each bullet: "Default applied: X | Reason: Y | Override by: filling in `lldConfig.<field>` and re-running."',
    },
  };

  /**
   * Generate ONE canonical LLD section and append/update it in place on
   * the existing artifact. Idempotent: skips when the section is human-
   * modified (preserves manual edits). Returns a summary the UI can
   * surface.
   */
  async executeSkill06ForSection(
    moduleDbId: string,
    sectionKey: string,
  ): Promise<{
    sectionKey: string;
    sectionLabel: string;
    artifactId: string;
    sectionWritten: boolean;
    skipped: boolean;
    reason?: string;
  }> {
    const focus = this.LLD_SECTION_FOCUS[sectionKey];
    if (!focus) {
      throw new Error(
        `Unknown LLD section key "${sectionKey}". Supported: ${Object.keys(this.LLD_SECTION_FOCUS).join(', ')}`,
      );
    }

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    const artifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.LLD },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      throw new Error(
        `No LLD artifact for module ${mod.moduleId}. Run "Generate LLD" (single-shot) first; per-section regeneration only fills gaps in an existing artifact.`,
      );
    }

    // Idempotency — preserve human edits.
    const existing = await this.prisma.baArtifactSection.findFirst({
      where: { artifactId: artifact.id, sectionKey },
      select: { id: true, isHumanModified: true },
    });
    if (existing?.isHumanModified) {
      return {
        sectionKey,
        sectionLabel: focus.label,
        artifactId: artifact.id,
        sectionWritten: false,
        skipped: true,
        reason: `Section ${focus.label} is human-modified; per-section regeneration skipped to preserve edits. Manually clear the row in the editor first if you want to overwrite.`,
      };
    }

    const skillPrompt = this.loadSkillFile('SKILL-06-LLD');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-06-LLD');

    // Pull existing section keys so the AI knows what's already populated
    // (so it doesn't repeat earlier sections in cross-references). Also
    // pull the existing summary + tech-stack content if any, so the AI's
    // section stays consistent with what came before.
    const existingSections = await this.prisma.baArtifactSection.findMany({
      where: { artifactId: artifact.id },
      select: { sectionKey: true, sectionLabel: true, content: true },
    });
    const populatedKeys = existingSections
      .filter((s) => (s.content?.length ?? 0) >= 80)
      .map((s) => s.sectionKey);

    const sectionFocusedPrompt = [
      '## 🎯 SKILL-06-LLD PER-SECTION FOCUS — ORCHESTRATOR OVERRIDE',
      '',
      'You are running in per-section regeneration mode. The LLD artifact already exists; your job is to produce ONLY the single canonical section listed below, suitable for in-place replacement of the existing row.',
      '',
      `**TARGET SECTION: § ${focus.label}** (sectionKey: \`${sectionKey}\`)`,
      '',
      '### What to emit',
      '',
      `Emit a single \`## ${focus.label}\` heading followed by the section body. Do NOT emit any other section. Do NOT emit pseudo-code files. Do NOT emit a Test Case Appendix.`,
      '',
      '### Section-specific focus',
      '',
      focus.focus,
      '',
      '### Sections that ALREADY EXIST on this artifact (do not repeat)',
      '',
      populatedKeys.length > 0
        ? populatedKeys.map((k) => `- \`${k}\``).join('\n')
        : '- (none — this is the first section being populated)',
      '',
      '### Hard rules',
      '',
      '- One `## ` heading exactly, with the canonical label above. The parser matches case-insensitively.',
      '- Body content ≥ 200 characters (the validator flags shorter sections as truncated).',
      '- Cite EPIC / User Story / SubTask / Feature IDs from the input context wherever applicable — never invent IDs.',
      '- Use the architect-saved tech stack from `lldConfig.stacks` (input context) — never substitute a different stack.',
      '- Stay consistent with the existing populated sections listed above.',
      '',
      '---',
      '',
      '## Original Skill Definition (for context — focus on the target section above; do not emit other sections)',
      '',
      skillPrompt,
    ].join('\n');

    const aiResponse = await this.callAiServiceWithRetry(
      sectionFocusedPrompt,
      { ...contextPacket, currentFocusSection: sectionKey },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for section ${sectionKey}`);
    }

    // The parser is idempotent — first-wins for human-modified rows, in-
    // place update for AI-generated ones. The AI may have emitted other
    // sections inadvertently; the parser will store all of them but the
    // target sectionKey is the one we report on.
    await this.lldParser.parseAndStore(humanDocument, artifact.id);

    const after = await this.prisma.baArtifactSection.findFirst({
      where: { artifactId: artifact.id, sectionKey },
      select: { content: true },
    });
    const sectionWritten = !!after && (after.content?.length ?? 0) >= 80;

    this.logger.log(
      `SKILL-06-LLD per-section ${sectionKey}: ${sectionWritten ? 'wrote' : 'failed to write'} on ${artifact.id}`,
    );
    return {
      sectionKey,
      sectionLabel: focus.label,
      artifactId: artifact.id,
      sectionWritten,
      skipped: false,
    };
  }

  // ─── SKILL-06-LLD per-feature pseudo-file regeneration (mode 06c) ─────
  //
  // Single-shot LLD generation can under-emit pseudo-files for a given
  // feature when the module is large — e.g. the AI dumps frontend pages
  // for every feature but skips the backend service / controller / DTOs /
  // entity / SQL migration files for one feature in particular. The
  // validator's "Features without pseudo-file coverage" panel surfaces
  // this. Per-section regen (mode 06b) cannot fix this: §11 Integration
  // Points / §16 Project Structure are SECTIONS, not pseudo-files. The
  // pseudo-file gap requires a dedicated per-feature focused AI call.
  //
  // Mode 06c does that: one focused AI call that emits ONLY new pseudo-
  // files for the focus feature, citing the feature's user stories +
  // subtasks in their Traceability docstrings. Existing pseudo-files for
  // OTHER features are untouched. Existing files for THIS feature that
  // are AI-generated are skipped (idempotency via DB unique-path
  // constraint + per-feature reference scan).
  //
  // Cost: ~$0.10 / call (medium prompt, focused output). Idempotent:
  // re-runs against a feature that already has pseudo-file coverage are
  // a fast no-op.

  /**
   * Generate pseudo-files for ONE feature on the module's existing LLD
   * artifact. Pulls user stories + subtasks for the feature from RTM /
   * BaSubTask rows, builds a focused prompt, runs the AI, parses the
   * pseudo-file fenced blocks, and appends them to the artifact.
   */
  async executeSkill06ForFeature(
    moduleDbId: string,
    featureId: string,
  ): Promise<{
    featureId: string;
    artifactId: string;
    pseudoFilesAdded: number;
    skipped: boolean;
    reason?: string;
    /**
     * Result of the diagram-refresh chain that auto-fires when this run
     * actually adds pseudo-files. `null` when the chain didn't run (no
     * pseudo-files added, or this run was skipped). Populated when the
     * chain ran successfully or threw — see `error` for the non-success
     * case. The chain failure never bubbles up; the caller still gets
     * the pseudo-file result so a transient AI hiccup on the diagram
     * refresh can be retried later via the standalone /diagrams endpoint.
     */
    diagramsRefreshed: {
      sectionsRefreshed: string[];
      sectionsSkippedHuman: string[];
      sectionsFailed: string[];
      skipped: boolean;
      reason?: string;
      error?: string;
    } | null;
  }> {
    if (!/^F-\d+-\d+$/.test(featureId)) {
      throw new Error(`Invalid featureId "${featureId}". Expected F-NN-NN.`);
    }

    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // Prerequisite: LLD artifact must exist (we're appending pseudo-files
    // to it, not creating from scratch).
    const lldArtifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.LLD },
      orderBy: { createdAt: 'desc' },
    });
    if (!lldArtifact) {
      throw new Error(
        `Cannot regenerate per-feature pseudo-files for ${mod.moduleId} / ${featureId}: ` +
        `no LLD artifact exists. Click "Generate LLD" first.`,
      );
    }

    // Pull user stories + subtasks for the feature from the structured
    // tables. These drive the AI's understanding of WHAT to implement
    // (vs the LLD's narrative sections, which describe the SHAPE).
    const featureRtmRows = await this.prisma.baRtmRow.findMany({
      where: { projectId: mod.projectId ?? '', moduleId: mod.moduleId, featureId },
      select: { storyId: true },
    });
    const storyIds = Array.from(new Set(
      featureRtmRows.map((r) => r.storyId).filter((s): s is string => !!s),
    )).sort();

    const subtasks = await this.prisma.baSubTask.findMany({
      where: { moduleDbId, featureId },
      orderBy: { subtaskId: 'asc' },
      select: {
        subtaskId: true, subtaskName: true, team: true, userStoryId: true,
        className: true, methodName: true, tbdFutureRefs: true,
      },
    });

    if (storyIds.length === 0 && subtasks.length === 0) {
      return {
        featureId,
        artifactId: lldArtifact.id,
        pseudoFilesAdded: 0,
        skipped: true,
        reason: `No user stories or subtasks found for ${featureId}. Run SKILL-04 + SKILL-05 first to populate the implementation surface this regen needs to target.`,
        diagramsRefreshed: null,
      };
    }

    // Existing pseudo-files: which ones already cite this feature?
    // We list them so the AI doesn't duplicate them, AND so we can
    // surface "skipped — already covered" when the gap is already filled.
    const allPseudoFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: lldArtifact.id },
      select: { id: true, path: true, language: true, aiContent: true, editedContent: true },
    });
    const existingForFeature = allPseudoFiles.filter((f) => {
      const text = `${f.path}\n${f.editedContent ?? f.aiContent ?? ''}`;
      return text.includes(featureId);
    });
    // Heuristic backend coverage check. We consider a feature "complete"
    // only when ALL canonical scaffold pieces are present: backend service,
    // backend controller, AND either entity model or SQL migration. The
    // earlier (looser) check skipped features that had service+controller
    // but lacked the persistence layer, leaving SQL/entity gaps unfixed.
    const hasBackendService = existingForFeature.some(
      (f) => /\/backend\/(service|services|src\/service)\//.test(f.path) && /\.service\.(ts|js|py|java)$/.test(f.path),
    );
    const hasBackendController = existingForFeature.some(
      (f) => /\/backend\/(controller|controllers|src\/controller)\//.test(f.path) && /\.controller\.(ts|js|py|java)$/.test(f.path),
    );
    const hasEntityOrMigration = existingForFeature.some(
      (f) =>
        /\.sql$/.test(f.path)
        || /\/(migrations|database\/migrations)\//.test(f.path)
        || /\.entity\.(ts|js)$/.test(f.path)
        || /\.prisma$/.test(f.path)
        || /\/(entities|entity|models|schemas)\//.test(f.path),
    );
    if (
      existingForFeature.length >= 6
      && hasBackendService
      && hasBackendController
      && hasEntityOrMigration
    ) {
      return {
        featureId,
        artifactId: lldArtifact.id,
        pseudoFilesAdded: 0,
        skipped: true,
        reason: `Feature ${featureId} already has ${existingForFeature.length} pseudo-file(s) including a backend service, controller, and entity/migration — no regen needed. Delete one or more files manually if you want to force a regen.`,
        diagramsRefreshed: null,
      };
    }

    const skillPrompt = this.loadSkillFile('SKILL-06-LLD');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-06-LLD');

    // Format the subtasks compactly for the prompt — one line per
    // subtask with class/method when known, so the AI can target them.
    const subtaskLines = subtasks.length > 0
      ? subtasks.map((s) => {
          const parts = [s.subtaskId, `team=${s.team}`, `story=${s.userStoryId ?? '?'}`];
          if (s.className) parts.push(`class=${s.className}${s.methodName ? '.' + s.methodName : ''}`);
          if (s.tbdFutureRefs && s.tbdFutureRefs.length > 0) parts.push(`tbd=${s.tbdFutureRefs.join(',')}`);
          return `- ${parts.join(' | ')} :: ${s.subtaskName}`;
        }).join('\n')
      : '(no subtasks found in BaSubTask table — AI must infer from EPIC/User Story content)';

    const existingFileLines = existingForFeature.length > 0
      ? existingForFeature.map((f) => `- ${f.path} (${f.language})`).join('\n')
      : '(none — this feature has no pseudo-files yet)';

    const featureFocusedPrompt = [
      '## 🎯 SKILL-06-LLD PER-FEATURE FOCUS — ORCHESTRATOR OVERRIDE (mode 06c)',
      '',
      `You are running in per-feature pseudo-file regeneration mode. The module's LLD already has its 19 narrative sections (Summary, Tech Stack, Architecture Overview, Class Diagram, …) populated. Some features have pseudo-file coverage; **${featureId}** does NOT (or has only partial coverage). Your job is to produce the missing pseudo-files for THIS feature only.`,
      '',
      `**TARGET FEATURE: ${featureId}** (module ${mod.moduleId})`,
      '',
      `**LLD ARTIFACT: ${lldArtifact.artifactId}** (id: ${lldArtifact.id})`,
      '',
      '### What to emit',
      '',
      `Emit ONLY a \`## Pseudo-Code Files\` heading followed by fenced code blocks — one per file. Do NOT emit any of the 19 narrative sections (\`## 1. Summary\`, \`## 2. Technology Stack\`, etc.) — those already exist. Do NOT emit pseudo-files for any feature OTHER than ${featureId}.`,
      '',
      '### User stories under this feature',
      '',
      storyIds.length > 0 ? storyIds.map((s) => `- ${s}`).join('\n') : '- (no user stories found in RTM)',
      '',
      '### SubTasks for this feature (use these as the implementation surface)',
      '',
      'Each line below is a `BaSubTask` row from the SUBTASK artifact. The `class` field is the AI\'s recommended class name; the `method` is the public method to scaffold. Generate pseudo-files that implement these subtasks. Every pseudo-file you emit MUST cite the relevant `ST-USNNN-XX-NN` IDs in its Traceability docstring.',
      '',
      subtaskLines,
      '',
      '### Existing pseudo-files for this feature (do NOT duplicate)',
      '',
      existingFileLines,
      '',
      '### What to produce (canonical scaffold for a CONFIRMED-PARTIAL feature)',
      '',
      'For each backend story, produce ALL of these pseudo-files (when applicable to the feature\'s surface):',
      '',
      '1. **Backend controller** — `backend/controller/<feature-slug>.controller.ts` (NestJS @Controller decorator + @Post/@Get methods + DTOs + auth guard reference). Cite the controller subtask in Traceability.',
      '2. **Backend service** — `backend/service/<feature-slug>.service.ts` (class with public methods matching the subtask `method` field). Cite the service subtask + every method-level subtask. JavaDoc on each method with Algorithm step-by-step (3-8 steps).',
      '3. **DTO** — `backend/dto/<verb>-<noun>.dto.ts` for each request and response shape. Use `class-validator` decorators (`@IsString`, `@IsUUID`, etc.).',
      '4. **Entity / Prisma model** — `backend/entities/<noun>.entity.ts` OR `database/schema.prisma` fragment. Match the field types from §10 Schema Diagram.',
      '5. **SQL migration** — `database/migrations/NNN_create_<table>.sql` with `CREATE TABLE` matching the entity. Include indices for hot lookup columns. Top-of-file comment cites §9 Data Model Definitions.',
      '6. **TBD-Future stub** — for each `tbd=TBD-NNN` flag on a subtask, emit `backend/integration/<external-service>.service.stub.ts` with the contract spelled out + `// TODO:` placeholder bodies. Document the `TBD-NNN` ref in the docstring.',
      '7. **Frontend page** — if the feature is user-facing, emit `frontend/app/<feature-slug>/page.tsx` (Next.js App Router; mark `\'use client\'` only when interactivity requires it). Use Tailwind utility classes.',
      '8. **Frontend route handler** — `frontend/app/api/<resource>/route.ts` if the frontend mediates calls (vs calling the backend directly via api-client hooks).',
      '9. **Frontend api-client hook** — `frontend/features/<feature-slug>/<feature-slug>api.ts` (RTK Query / Tanstack Query / fetch wrapper).',
      '10. **Frontend component(s)** — `frontend/components/<feature-slug>/<ComponentName>.tsx` for each UI primitive the page needs.',
      '11. **Backend test** — `tests/backend/services/<feature-slug>.service.spec.ts` (Vitest / pytest unit). Cover happy path + each `@throws` from the service docstring.',
      '12. **Frontend test** — `tests/frontend/components/<feature-slug>/<ComponentName>.test.tsx` (Vitest + React Testing Library).',
      '',
      '### Mandatory rules',
      '',
      '- Every pseudo-file MUST start with a class/file docstring carrying a Traceability block citing real IDs from the input: FRD: ' + featureId + ' / EPIC: <from RTM> / US: <comma-separated> / ST: <comma-separated>.',
      '- Every public method MUST carry a method-level docstring with Traceability + Algorithm (3-8 steps) drawn from the subtask\'s `subtaskName` description.',
      '- Method bodies are `// TODO:` comments only — no compilable logic.',
      '- Use the architect-saved tech stack from `lldConfig.stacks` (input context) — for MOD-04 that is **NestJS + Postgres backend, Next.js + Tailwind frontend** unless the input says otherwise. Never substitute a different stack.',
      '- Mermaid syntax rules in the original skill definition still apply (parens / slashes in graph labels need quoting; erDiagram types must be lowercase) — but you should NOT emit any Mermaid blocks here, only pseudo-files.',
      '- Output is a single markdown document starting with `## Pseudo-Code Files` (no preamble). Each file is a code block opened with **THREE BACKTICKS** (not tildes) and an info-string in the format `<language> path=<relative-path>`. The closing fence is also three backticks. Example shape (replace BACKTICK-BACKTICK-BACKTICK with literal triple backticks; rendering shows tildes here only because this prompt itself is markdown):',
      '',
      '    ## Pseudo-Code Files',
      '',
      '    BACKTICK-BACKTICK-BACKTICKtypescript path=backend/controller/research-conversation.controller.ts',
      '    /** ... Traceability: FRD: F-04-02 / EPIC: EPIC-04 / US: US-055,US-056,US-057 / ST: ST-US056-BE-01 */',
      '    class ResearchConversationController { ... // TODO: ... }',
      '    BACKTICK-BACKTICK-BACKTICK',
      '',
      '   In your actual output, replace `BACKTICK-BACKTICK-BACKTICK` with three literal backtick characters (the standard markdown code-fence delimiter). Do NOT use `~~~` (tildes) — the backend parser regex only matches triple backticks.',
      '',
      '### Hard constraints',
      '',
      '- Do NOT regenerate the 19 narrative sections.',
      '- Do NOT emit pseudo-files for features other than ' + featureId + '.',
      '- Do NOT duplicate any of the existing files listed above.',
      '- DO produce 6-12 new pseudo-files (the canonical scaffold above) covering controller / service / DTOs / entity / SQL / stubs / frontend / tests.',
      '',
      '---',
      '',
      '## Original Skill Definition (for context — apply the pseudo-file format rules from §3 + the Frontend pseudo-file quota section + the Hard rules section)',
      '',
      skillPrompt,
    ].join('\n');

    const runStartedAt = new Date();
    const aiResponse = await this.callAiServiceWithRetry(
      featureFocusedPrompt,
      { ...contextPacket, currentFocusFeature: featureId },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for feature ${featureId}`);
    }

    // Persist the AI response to a BaSkillExecution row so the architect
    // can inspect what the AI emitted (especially when no pseudo-files
    // got added). Mirrors what executeSkill() does for the standard
    // skill path.
    const execRow = await this.prisma.baSkillExecution.create({
      data: {
        moduleDbId,
        skillName: 'SKILL-06-LLD',
        status: BaExecutionStatus.AWAITING_REVIEW,
        humanDocument,
        startedAt: runStartedAt,
        completedAt: new Date(),
      },
    });
    this.logger.log(
      `SKILL-06-LLD per-feature ${featureId}: AI response stored in execution ${execRow.id} (${humanDocument.length} chars)`,
    );

    // Parser is idempotent: it splits the document on `## Pseudo-Code
    // Files` and inserts new pseudo-files. Existing rows with the same
    // path get a unique-constraint warning and are skipped (per the
    // parser's per-row try/catch).
    await this.lldParser.parseAndStore(humanDocument, lldArtifact.id);

    // Count newly-added pseudo-files by createdAt window so we can
    // report accurately even when the AI emits a file with the same
    // path as an existing one (which the parser silently drops).
    const newFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: lldArtifact.id, createdAt: { gte: runStartedAt } },
      select: { path: true },
    });

    // Extend RTM with the new pseudo-file refs so the trace runs
    // FRD → EPIC → US → ST → Class.method → Pseudo-File. Reuse the same
    // helper the SKILL-06 post-processing path uses.
    if (mod.projectId) {
      try {
        await this.extendRtmWithLld(moduleDbId, mod.projectId, lldArtifact.id);
      } catch (err) {
        this.logger.warn(
          `SKILL-06-LLD per-feature ${featureId}: RTM extend failed — ${err instanceof Error ? err.message : 'unknown'}; non-fatal`,
        );
      }
    }

    this.logger.log(
      `SKILL-06-LLD per-feature ${featureId}: appended ${newFiles.length} pseudo-file(s) to ${lldArtifact.id}`,
    );

    // Auto-chain (mode 06d): when this run actually added pseudo-files,
    // refresh the four module-level diagrams so they reflect the new
    // entities / SQL migrations / classes. We deliberately swallow chain
    // errors — the caller still gets the pseudo-file result, and a
    // transient AI hiccup on the diagram refresh can be retried later
    // via the standalone /diagrams endpoint. When `pseudoFilesAdded === 0`
    // the AI returned but produced no new files; there is nothing for the
    // diagrams to catch up to, so we skip the chain.
    let diagramsRefreshed: {
      sectionsRefreshed: string[];
      sectionsSkippedHuman: string[];
      sectionsFailed: string[];
      skipped: boolean;
      reason?: string;
      error?: string;
    } | null = null;
    if (newFiles.length > 0) {
      try {
        const r = await this.executeSkill06ForDiagrams(moduleDbId);
        diagramsRefreshed = {
          sectionsRefreshed: r.sectionsRefreshed,
          sectionsSkippedHuman: r.sectionsSkippedHuman,
          sectionsFailed: r.sectionsFailed,
          skipped: r.skipped,
          reason: r.reason,
        };
        this.logger.log(
          `SKILL-06-LLD per-feature ${featureId}: auto-chained diagram refresh — refreshed=${r.sectionsRefreshed.length} skippedHuman=${r.sectionsSkippedHuman.length} failed=${r.sectionsFailed.length}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(
          `SKILL-06-LLD per-feature ${featureId}: auto-chained diagram refresh failed — ${message}; non-fatal, retry via /diagrams endpoint`,
        );
        diagramsRefreshed = {
          sectionsRefreshed: [],
          sectionsSkippedHuman: [],
          sectionsFailed: [...this.DIAGRAM_SECTION_KEYS],
          skipped: false,
          error: message,
        };
      }
    }

    return {
      featureId,
      artifactId: lldArtifact.id,
      pseudoFilesAdded: newFiles.length,
      skipped: false,
      diagramsRefreshed,
    };
  }

  // ─── SKILL-06-LLD diagram refresh (mode 06d) ──────────────────────────
  //
  // The four module-level Mermaid diagrams (Module Dependency Graph, Class
  // Diagram, Sequence Diagrams, Schema Diagram) are produced by the initial
  // SKILL-06 run together with the pseudo-files. Once mode 06b (per-section)
  // or mode 06c (per-feature pseudo-file) is invoked to fill gaps, the
  // pseudo-files / entities / SQL migrations move forward but the diagrams
  // stay frozen at the initial-gen snapshot. This mode does ONE focused AI
  // call that regenerates exactly those four sections, reading the current
  // pseudo-file surface + §9 Data Model Definitions + §8 API Contract
  // Manifest as the ground truth so the diagrams catch up.
  //
  // Cost: ~$0.05/call (small focused prompt, four diagrams in one shot so
  // they stay internally consistent). Idempotent: any of the four sections
  // marked `isHumanModified` is preserved untouched (the parser enforces
  // this — orchestrator only short-circuits the AI call when ALL four are
  // human-modified).

  /** Section keys this mode targets. Order matches the LLD document order. */
  private readonly DIAGRAM_SECTION_KEYS = [
    'module_dependency_graph',
    'class_diagram',
    'sequence_diagrams',
    'schema_diagram',
  ] as const;

  /**
   * Refresh the four module-level diagram sections so they reflect the
   * current pseudo-file / data-model surface. Returns which diagrams were
   * actually updated, which were preserved as human edits, and which the
   * AI failed to emit.
   */
  async executeSkill06ForDiagrams(
    moduleDbId: string,
  ): Promise<{
    artifactId: string;
    sectionsRefreshed: string[];
    sectionsSkippedHuman: string[];
    sectionsFailed: string[];
    skipped: boolean;
    reason?: string;
  }> {
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      include: { project: true },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);

    // Prerequisite: LLD artifact must exist (we're upserting four sections
    // on it, not creating from scratch).
    const lldArtifact = await this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: BaArtifactType.LLD },
      orderBy: { createdAt: 'desc' },
    });
    if (!lldArtifact) {
      throw new Error(
        `Cannot refresh diagrams for ${mod.moduleId}: no LLD artifact exists. Click "Generate LLD" first.`,
      );
    }

    // Snapshot the four target sections plus the source-of-truth sections
    // we feed back into the prompt. Done in one fetch to minimise round-
    // trips and keep section-state consistent across the workflow.
    const allSections = await this.prisma.baArtifactSection.findMany({
      where: { artifactId: lldArtifact.id },
      select: {
        sectionKey: true,
        sectionLabel: true,
        content: true,
        isHumanModified: true,
        updatedAt: true,
      },
    });
    const byKey = new Map(allSections.map((s) => [s.sectionKey, s]));

    const targetState = this.DIAGRAM_SECTION_KEYS.map((key) => {
      const row = byKey.get(key);
      return {
        key,
        existed: !!row,
        humanModified: row?.isHumanModified ?? false,
        currentContent: row?.content ?? '',
        previousUpdatedAt: row?.updatedAt ?? null,
      };
    });

    const allHumanModified = targetState.every((t) => t.existed && t.humanModified);
    if (allHumanModified) {
      return {
        artifactId: lldArtifact.id,
        sectionsRefreshed: [],
        sectionsSkippedHuman: targetState.map((t) => t.key),
        sectionsFailed: [],
        skipped: true,
        reason:
          'All four diagram sections (Module Dependency Graph, Class Diagram, Sequence Diagrams, Schema Diagram) are human-modified. ' +
          'Manually clear the human-modified flag on at least one section in the editor first if you want the diagram refresh to overwrite it.',
      };
    }

    // Surface which diagrams the AI is allowed to overwrite vs preserve.
    // The parser enforces preservation regardless, but listing both lists in
    // the prompt makes the AI's intent match what will actually be written.
    const editableKeys = targetState.filter((t) => !t.humanModified).map((t) => t.key);
    const preservedKeys = targetState.filter((t) => t.humanModified).map((t) => t.key);

    // Source-of-truth context for the AI: data model definitions, API
    // contracts, integration map, current pseudo-files. The AI MUST derive
    // the four diagrams from this surface — not hallucinate new entities.
    const dataModelContent = byKey.get('data_model_definitions')?.content ?? '';
    const apiContractContent = byKey.get('api_contract_manifest')?.content ?? '';
    const integrationContent = byKey.get('integration_points')?.content ?? '';
    const summaryContent = byKey.get('summary')?.content ?? '';

    const pseudoFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: lldArtifact.id },
      select: { path: true, language: true },
      orderBy: { path: 'asc' },
    });
    const pseudoFilePaths = pseudoFiles
      .map((f) => `- ${f.path} (${f.language})`)
      .join('\n');

    // RTM rows give the AI the FRD → EPIC → US → Feature breakdown so the
    // sequence diagrams reflect every flow, not just the ones the AI guesses
    // are important.
    const rtmRows = mod.projectId
      ? await this.prisma.baRtmRow.findMany({
          where: { projectId: mod.projectId, moduleId: mod.moduleId },
          select: { featureId: true, storyId: true, epicId: true },
          orderBy: [{ featureId: 'asc' }, { storyId: 'asc' }],
        })
      : [];
    const rtmLines = rtmRows.length > 0
      ? rtmRows.map((r) => `- ${r.featureId ?? '?'} | ${r.epicId ?? '?'} | ${r.storyId ?? '?'}`).join('\n')
      : '(no RTM rows — derive flows from EPIC scope)';

    const editableLabels = editableKeys.map((k) => {
      const focus = this.LLD_SECTION_FOCUS[k];
      return `- \`${k}\` — ${focus?.label ?? k} :: ${focus?.focus ?? ''}`;
    }).join('\n');

    const preservedNote = preservedKeys.length > 0
      ? preservedKeys.map((k) => `- \`${k}\` (${this.LLD_SECTION_FOCUS[k]?.label ?? k}) — human edits will be preserved; do NOT emit this section.`).join('\n')
      : '- (none — all four diagrams are open for refresh)';

    const skillPrompt = this.loadSkillFile('SKILL-06-LLD');
    const contextPacket = await this.assembleContext(moduleDbId, 'SKILL-06-LLD');

    const diagramFocusedPrompt = [
      '## 🎯 SKILL-06-LLD DIAGRAM REFRESH — ORCHESTRATOR OVERRIDE (mode 06d)',
      '',
      `You are running in diagram-only refresh mode. The LLD artifact for module **${mod.moduleId}** already exists with all narrative sections, data models, API contracts, and pseudo-files populated. The four module-level Mermaid diagrams (Module Dependency Graph, Class Diagram, Sequence Diagrams, Schema Diagram) date from the initial generation and now lag the current pseudo-file / data-model surface. Your job is to regenerate ONLY those four diagrams (or the subset listed below as editable) so they reflect the current state.`,
      '',
      `**LLD ARTIFACT: ${lldArtifact.artifactId}** (id: ${lldArtifact.id})`,
      '',
      '### Sections to emit (editable — overwrite-allowed)',
      '',
      editableLabels.length > 0 ? editableLabels : '- (none — bail out)',
      '',
      '### Sections to NOT emit (human-modified — preserved untouched)',
      '',
      preservedNote,
      '',
      '### Source of truth for diagram content',
      '',
      'Derive the diagrams from the existing sections + pseudo-file surface below. Do NOT invent entities, classes, or flows that are not represented in this material.',
      '',
      '#### §1 Summary (current)',
      '',
      summaryContent ? this.truncateForPrompt(summaryContent, 1500) : '(empty)',
      '',
      '#### §8 API Contract Manifest (current)',
      '',
      apiContractContent ? this.truncateForPrompt(apiContractContent, 3000) : '(empty)',
      '',
      '#### §9 Data Model Definitions (current)',
      '',
      dataModelContent ? this.truncateForPrompt(dataModelContent, 4000) : '(empty)',
      '',
      '#### §11 Integration Points (current)',
      '',
      integrationContent ? this.truncateForPrompt(integrationContent, 2000) : '(empty)',
      '',
      `#### Pseudo-files on this artifact (${pseudoFiles.length} files)`,
      '',
      pseudoFilePaths.length > 0 ? pseudoFilePaths : '(none)',
      '',
      '#### RTM rows (FRD Feature | EPIC | User Story)',
      '',
      rtmLines,
      '',
      '### What to emit',
      '',
      'For each editable section above, emit a single `## ` heading using the canonical label, followed by the diagram body. Keep the original Mermaid block tags exactly:',
      '',
      '- `## Module Dependency Graph` → fenced ```mermaid block opened by `flowchart TD`',
      '- `## Class Diagram` → fenced ```mermaid block opened by `classDiagram`',
      '- `## Sequence Diagrams` → ONE fenced ```mermaid block per major flow opened by `sequenceDiagram`. Group by user story; cite the US-NNN id in the title.',
      '- `## Schema Diagram` → fenced ```mermaid block opened by `erDiagram`',
      '',
      '### Hard rules',
      '',
      '- Do NOT emit any of the other 15 narrative sections (Summary, Tech Stack, NFRs, etc.) — they already exist and you would be overwriting them.',
      '- Do NOT emit pseudo-code files (no `## Pseudo-Code Files` heading, no path-tagged code fences).',
      '- Use ONLY entities listed in §9 Data Model Definitions for `erDiagram` and `classDiagram` blocks.',
      '- Use ONLY user stories listed in the RTM rows for `sequenceDiagram` titles.',
      '- Mermaid syntax rules from the original skill definition still apply: lowercase erDiagram types, parens/slashes in graph labels need quoting, every `classDiagram` arrow uses ASCII (`-->`, `--|>`, `..>`).',
      '- Output is one markdown document with the editable section headings only. No preamble, no closing summary.',
      '',
      '---',
      '',
      '## Original Skill Definition (for context — apply the Mermaid syntax rules from the diagram sections only)',
      '',
      skillPrompt,
    ].join('\n');

    const runStartedAt = new Date();
    const aiResponse = await this.callAiServiceWithRetry(
      diagramFocusedPrompt,
      { ...contextPacket, currentFocusMode: 'mode-06d-diagrams' },
    );
    const { humanDocument } = this.parseAiOutput(aiResponse);
    if (!humanDocument || !humanDocument.trim()) {
      throw new Error(`AI returned empty humanDocument for diagram refresh on ${mod.moduleId}`);
    }

    // Persist the AI response so the architect can inspect what was emitted
    // even when one of the diagrams failed to land. Mirrors mode 06c.
    const execRow = await this.prisma.baSkillExecution.create({
      data: {
        moduleDbId,
        skillName: 'SKILL-06-LLD',
        status: BaExecutionStatus.AWAITING_REVIEW,
        humanDocument,
        startedAt: runStartedAt,
        completedAt: new Date(),
      },
    });
    this.logger.log(
      `SKILL-06-LLD diagram refresh: AI response stored in execution ${execRow.id} (${humanDocument.length} chars)`,
    );

    // Parser is idempotent — AI-modified rows updated in place, human-
    // modified rows preserved. The parser may also pick up an inadvertent
    // narrative section the AI emitted; we count only the four target keys.
    await this.lldParser.parseAndStore(humanDocument, lldArtifact.id);

    // Re-read the four target rows to figure out which were actually
    // refreshed in this run vs preserved (human-modified) vs failed
    // (AI didn't emit them).
    const after = await this.prisma.baArtifactSection.findMany({
      where: {
        artifactId: lldArtifact.id,
        sectionKey: { in: [...this.DIAGRAM_SECTION_KEYS] },
      },
      select: { sectionKey: true, content: true, updatedAt: true, isHumanModified: true },
    });
    const afterByKey = new Map(after.map((s) => [s.sectionKey, s]));

    const sectionsRefreshed: string[] = [];
    const sectionsSkippedHuman: string[] = [];
    const sectionsFailed: string[] = [];
    for (const t of targetState) {
      if (t.humanModified) {
        sectionsSkippedHuman.push(t.key);
        continue;
      }
      const row = afterByKey.get(t.key);
      if (!row) {
        sectionsFailed.push(t.key);
        continue;
      }
      // Refreshed when updatedAt advanced past our snapshot OR when the
      // row was just created (didn't exist before).
      const wasRefreshed = !t.previousUpdatedAt
        || row.updatedAt.getTime() > t.previousUpdatedAt.getTime();
      if (wasRefreshed) sectionsRefreshed.push(t.key);
      else sectionsFailed.push(t.key);
    }

    this.logger.log(
      `SKILL-06-LLD diagram refresh: refreshed=${sectionsRefreshed.length} skippedHuman=${sectionsSkippedHuman.length} failed=${sectionsFailed.length} on ${lldArtifact.id}`,
    );

    return {
      artifactId: lldArtifact.id,
      sectionsRefreshed,
      sectionsSkippedHuman,
      sectionsFailed,
      skipped: false,
    };
  }

  /**
   * Trim large source-of-truth sections to a budget so the diagram-refresh
   * prompt stays under the AI service's context limit on big modules. Keeps
   * the head of the section (which carries the headings + first paragraphs)
   * and appends a marker when truncation occurred.
   */
  private truncateForPrompt(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n…(truncated ${text.length - maxChars} chars for prompt budget)`;
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

  // ─── SKILL-01-S 9-attribute contract validator ────────────────────────
  //
  // Every feature in the module MUST be emitted as a `#### F-XX-XX:` heading
  // block carrying all 9 mandatory attributes (Description, Screen Reference,
  // Trigger, Pre-Conditions, Post-Conditions, Business Rules, Validations,
  // Integration Signals, Acceptance Criteria). Without this guard, SKILL-01-S
  // can silently emit a catalog-table-only FRD (observed on MOD-05 — 21
  // features in the table, 0 detail blocks, 17/21 features with zero
  // attribute coverage). Downstream skills then ingest a degraded FRD and
  // the artifact tree shows only a handful of features.

  private validateSkill01SOutput(
    humanDocument: string,
    handoffPacket: Record<string, unknown> | null,
  ): { ok: boolean; missingFeatures: string[]; partialFeatures: { featureId: string; missingAttributes: string[] }[]; summary: string } {
    const expectedIds = this.expectedSkill01SFeatureIds(humanDocument, handoffPacket);
    if (expectedIds.length === 0) {
      return {
        ok: false,
        missingFeatures: [],
        partialFeatures: [],
        summary: 'No feature IDs detected in SKILL-01-S output (neither handoff packet nor markdown contains any F-XX-XX). Output is unusable.',
      };
    }

    const blockMap = this.extractFeatureDetailBlocks(humanDocument);
    const missingFeatures: string[] = [];
    const partialFeatures: { featureId: string; missingAttributes: string[] }[] = [];
    for (const fid of expectedIds) {
      const block = blockMap.get(fid);
      if (!block) {
        missingFeatures.push(fid);
        continue;
      }
      const missing = this.findMissingFeatureAttributes(block);
      if (missing.length > 0) {
        partialFeatures.push({ featureId: fid, missingAttributes: missing });
      }
    }

    const ok = missingFeatures.length === 0 && partialFeatures.length === 0;
    const summary = ok
      ? `All ${expectedIds.length} features have complete 9-attribute detail blocks.`
      : `SKILL-01-S 9-attribute contract violation. Expected ${expectedIds.length} feature(s) with #### F-XX-XX: heading blocks; missing ${missingFeatures.length}, incomplete ${partialFeatures.length}.`;
    return { ok, missingFeatures, partialFeatures, summary };
  }

  private expectedSkill01SFeatureIds(humanDocument: string, handoffPacket: Record<string, unknown> | null): string[] {
    const ids = new Set<string>();
    if (handoffPacket && typeof handoffPacket === 'object') {
      const features = (handoffPacket as { features?: unknown }).features;
      if (Array.isArray(features)) {
        for (const f of features) {
          const fid = (f as { featureId?: unknown }).featureId;
          if (typeof fid === 'string' && /^F-\d+-\d+$/.test(fid)) ids.add(fid);
        }
      }
    }
    if (ids.size === 0) {
      // Fallback: scan markdown for any F-XX-XX mentions (catalog table rows,
      // narrative refs, etc.). Used when the handoff packet lacks a features
      // array — older outputs sometimes nest features under modules[0].
      for (const m of humanDocument.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) ids.add(m[0]);
    }
    return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  private extractFeatureDetailBlocks(humanDocument: string): Map<string, string> {
    const blocks = new Map<string, string>();
    const lines = humanDocument.split('\n');
    const featureHeadingRe = /^#{4}\s+\*?\*?\s*(F-\d+-\d+)\s*[:\s—\-*].*$/;
    const stopHeadingRe = /^#{1,3}\s/; // any H1/H2/H3 ends the feature block
    const peerFeatureRe = /^#{4}\s+\*?\*?\s*F-\d+-\d+/;

    let currentId: string | null = null;
    let buf: string[] = [];
    const flush = (): void => {
      if (currentId) {
        const prev = blocks.get(currentId) ?? '';
        blocks.set(currentId, prev ? `${prev}\n${buf.join('\n')}` : buf.join('\n'));
      }
      buf = [];
    };

    for (const line of lines) {
      const m = line.match(featureHeadingRe);
      if (m) {
        flush();
        currentId = m[1];
        continue;
      }
      if (currentId && (stopHeadingRe.test(line) || peerFeatureRe.test(line))) {
        flush();
        currentId = null;
      } else if (currentId) {
        buf.push(line);
      }
    }
    flush();
    return blocks;
  }

  private findMissingFeatureAttributes(block: string): string[] {
    const ATTRS: { name: string; pattern: RegExp }[] = [
      { name: 'Description', pattern: /\*?\*?\s*(?:Feature\s+)?Description\s*\*?\*?\s*[:\-]/i },
      { name: 'Screen Reference', pattern: /\*?\*?\s*Screen\s*Reference\s*\*?\*?\s*[:\-]/i },
      { name: 'Trigger', pattern: /\*?\*?\s*Trigger\s*\*?\*?\s*[:\-]/i },
      { name: 'Pre-Conditions', pattern: /\*?\*?\s*Pre[-\s]*conditions?\s*\*?\*?\s*[:\-]/i },
      { name: 'Post-Conditions', pattern: /\*?\*?\s*Post[-\s]*conditions?\s*\*?\*?\s*[:\-]/i },
      { name: 'Business Rules', pattern: /\*?\*?\s*Business\s*Rules?\s*\*?\*?\s*[:\-]/i },
      { name: 'Validations', pattern: /\*?\*?\s*Validations?\s*\*?\*?\s*[:\-]/i },
      { name: 'Integration Signals', pattern: /\*?\*?\s*Integration\s*Signals?\s*\*?\*?\s*[:\-]/i },
      { name: 'Acceptance Criteria', pattern: /\*?\*?\s*Acceptance\s*Criteria\s*\*?\*?\s*[:\-]/i },
    ];
    return ATTRS.filter((a) => !a.pattern.test(block)).map((a) => a.name);
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

    // Combine backend + frontend stacks (when both selected) into a hyphenated
    // suffix that reflects the full stack at a glance, e.g. `nestjs-tailwind`.
    // Falls back to architecture or `default` if neither stack is selected.
    // Resolves each id → master-data entry → its `value` (preferred) or `name`.
    const slugFor = async (id: string | null): Promise<string | null> => {
      if (!id) return null;
      const entry = await this.prisma.baMasterDataEntry.findUnique({
        where: { id },
        select: { value: true, name: true },
      });
      const raw = (entry?.value ?? entry?.name ?? '').toLowerCase();
      const cleaned = raw.replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      return cleaned || null;
    };

    const backendSlug = await slugFor(config.backendStackId);
    const frontendSlug = await slugFor(config.frontendStackId);
    const archSlug = await slugFor(config.architectureId);

    let base: string;
    if (backendSlug && frontendSlug) {
      base = `${backendSlug}-${frontendSlug}`;
    } else if (backendSlug) {
      base = backendSlug;
    } else if (frontendSlug) {
      base = frontendSlug;
    } else if (archSlug) {
      base = archSlug;
    } else {
      base = 'default';
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

  /**
   * Extract every Feature declared in an FRD humanDocument. Recognises
   * BOTH authoring shapes the SKILL-01-S prompt is allowed to emit:
   *
   *   1. **Heading + KV block** — `#### **F-NN-NN: Name**` followed by a
   *      prose / bullet block carrying `Status`, `Priority`, `Screen
   *      Reference` lines. This is the legacy shape the SKILL-01-S
   *      example output uses.
   *
   *   2. **Markdown table catalog** — a `| Feature ID | Feature Name | …`
   *      header row followed by one row per feature. This is what the
   *      newer SKILL-01-S runs produce when the module has 10+ features
   *      (the AI condenses the catalog so the response stays under the
   *      token budget). MOD-05's 21-feature FRD uses this shape.
   *
   * The previous implementation only handled (1), which silently dropped
   * 20 of MOD-05's 21 features from the RTM seeding pass. Now both shapes
   * are walked and merged by featureId — the heading form wins on
   * duplicates because its KV block usually carries fuller metadata.
   */
  private parseFrdFeatures(markdown: string): Array<{ featureId: string; featureName: string; status: string; priority: string; screenRef: string }> {
    const out = new Map<string, { featureId: string; featureName: string; status: string; priority: string; screenRef: string }>();

    // ── Shape 1: heading-form features ────────────────────────────────
    const re = /#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=#{1,4}\s+\*{0,2}F-\d+-\d+|---\s*\n\s*#{1,4}\s+\*{0,2}F-|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      const featureId = m[1];
      // Skip if we already have a heading-form record for this id (prefer the
      // first occurrence — usually the canonical declaration; later headings
      // tend to be cross-references / examples).
      if (out.has(featureId)) continue;
      const featureName = m[2].replace(/\*+/g, '').trim();
      const block = m[3];
      out.set(featureId, {
        featureId,
        featureName,
        status: this.extractField(block, ['Status', 'Feature Status']) || 'CONFIRMED',
        priority: this.extractField(block, ['Priority', 'MoSCoW']) || 'Must',
        screenRef: this.extractField(block, ['Screen Reference', 'Screen Ref', 'Screen']) || '',
      });
    }

    // ── Shape 2: markdown table catalog ───────────────────────────────
    for (const row of this.parseFrdFeatureTableRows(markdown)) {
      // Heading form wins on collision; table fills the gaps for features
      // declared only in the catalog table.
      if (out.has(row.featureId)) continue;
      out.set(row.featureId, row);
    }

    return [...out.values()];
  }

  /**
   * Walk markdown tables in the document and return every row whose
   * "Feature ID" column carries a `F-NN-NN` value. Header-driven
   * (column positions detected from the header row) so it tolerates
   * the column-order shifts SKILL-01-S has used over time:
   *
   *   | Feature ID | Feature Name | Status | Priority | Screen Ref | … |
   *   | Module ID | Module Name | Package | Feature ID | Feature Name | Priority | Status | Screen Ref | … |
   *
   * Returns an empty list when the document has no recognisable feature
   * table — safe to call on every FRD.
   */
  private parseFrdFeatureTableRows(
    markdown: string,
  ): Array<{ featureId: string; featureName: string; status: string; priority: string; screenRef: string }> {
    const out: Array<{ featureId: string; featureName: string; status: string; priority: string; screenRef: string }> = [];
    const lines = markdown.split(/\r?\n/);

    const splitRow = (raw: string): string[] => {
      // `| A | B | C |` → ['A', 'B', 'C']. Walk cell-by-cell rather than
      // a naive split() so empty cells (e.g. blank TBD-Future Ref) are
      // preserved positionally.
      const trimmed = raw.trim();
      if (!trimmed.startsWith('|')) return [];
      const inner = trimmed.replace(/^\|/, '').replace(/\|\s*$/, '');
      return inner.split('|').map((c) => c.trim());
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/^\s*\|/.test(line)) continue;
      const header = splitRow(line);
      if (header.length === 0) continue;

      const findCol = (re: RegExp): number => header.findIndex((h) => re.test(h));
      const idIdx = findCol(/^feature\s*id$/i);
      if (idIdx < 0) continue;
      const nameIdx = findCol(/^feature\s*name$/i);
      const statusIdx = findCol(/^(feature\s*)?status$/i);
      const priorityIdx = findCol(/^(priority|moscow)$/i);
      const screenIdx = findCol(/^screen(\s*(ref|reference|s))?$/i);

      // Optional separator row (`|---|---|---|`); skip if present.
      let j = i + 1;
      if (j < lines.length && /^\s*\|[\s|:-]+\|\s*$/.test(lines[j])) j++;

      // Walk data rows until the table ends.
      for (; j < lines.length; j++) {
        const dataLine = lines[j];
        if (!/^\s*\|/.test(dataLine)) break;
        const cells = splitRow(dataLine);
        if (cells.length === 0) break;
        const cellAt = (idx: number): string => (idx >= 0 && idx < cells.length ? cells[idx] : '');
        const featureId = cellAt(idIdx).replace(/\*+/g, '').trim();
        if (!/^F-\d+-\d+$/.test(featureId)) {
          // Non-feature row (e.g. summary, footer, "Total" line) — table
          // body has ended for our purposes.
          continue;
        }
        const rawName = cellAt(nameIdx).replace(/\*+/g, '').trim();
        out.push({
          featureId,
          featureName: rawName || `Feature ${featureId}`,
          status: this.normaliseStatus(cellAt(statusIdx)) || 'CONFIRMED',
          priority: this.normalisePriority(cellAt(priorityIdx)) || 'Must',
          screenRef: cellAt(screenIdx).replace(/^["']|["']$/g, '').trim(),
        });
      }
      i = j - 1; // skip past this table
    }
    return out;
  }

  /** Map common SKILL-01-S status strings to the RTM canonical form. */
  private normaliseStatus(raw: string): string {
    const v = raw.toUpperCase();
    if (v.includes('PARTIAL')) return 'CONFIRMED-PARTIAL';
    if (v.includes('CONFIRMED')) return 'CONFIRMED';
    if (v.includes('DRAFT')) return 'DRAFT';
    return raw.trim();
  }

  /** Map "Must Have"/"Should Have"/etc to MoSCoW short form for RTM. */
  private normalisePriority(raw: string): string {
    const v = raw.toLowerCase();
    if (v.includes('must')) return 'Must';
    if (v.includes('should')) return 'Should';
    if (v.includes('could')) return 'Could';
    if (v.includes('would') || v.includes("won't") || v.includes('wont')) return "Won't";
    return raw.trim();
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

  /**
   * Split a markdown document into one DB-row section per `^#`, `^##`, or
   * `^###` heading.
   *
   * Defensive clamp for SubTask bodies: when the current section header
   * begins with `## ST-US...` (a SubTask separator), any `###` heading found
   * before the next `^#` or `^##` is treated as body content — NOT a new
   * section. This prevents the 2737-fragment regression where the AI emits
   * `### Section N — Field` inside a SubTask body and the splitter shreds
   * the body into 24 rows. The skill prompt already mandates `####` for
   * those nested headings; this clamp is the belt-and-suspenders safety so
   * a future prompt slip can't break SubTask rendering.
   *
   * Non-SubTask artifacts (FRD, EPIC, USER_STORY, SCREEN_ANALYSIS) never
   * carry a `## ST-US...` heading, so the clamp is a no-op for them.
   */
  private splitIntoSections(markdown: string): { key: string; label: string; content: string }[] {
    const lines = markdown.split('\n');
    const sections: { key: string; label: string; content: string }[] = [];
    let currentLabel = 'Introduction';
    let currentKey = 'introduction';
    let currentContent: string[] = [];
    let insideSubtaskBody = false;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        const depth = headingMatch[1].length;
        const text = headingMatch[2].trim();

        // Defensive clamp — `### Section N` inside a SubTask body is body
        // content, not a new section. Recognise the SubTask boundary by the
        // ## ST-US... heading, plus also `## SubTask Decomposition for US-...`
        // (which is the per-story group intro) and `## QA SubTasks ...`.
        if (insideSubtaskBody && depth === 3) {
          currentContent.push(line);
          continue;
        }

        // Track entry/exit of a SubTask body window. Anything at depth 1 or 2
        // closes the window; a `## ST-US...` opens it.
        if (depth <= 2) {
          insideSubtaskBody = /^ST-US\d+\b/i.test(text);
        }

        if (currentContent.length > 0) {
          sections.push({
            key: currentKey,
            label: currentLabel,
            content: currentContent.join('\n').trim(),
          });
        }
        currentLabel = text;
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
