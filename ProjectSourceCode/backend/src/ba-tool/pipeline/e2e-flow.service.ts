import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, BaE2eNodeType } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectFolderService } from './project-folder.service';
import { flattenSections } from './section-normalizer';

/** The downstream pipeline stages a flow step elaborates through (R-P3). */
export const E2E_STAGES = ['EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC', 'WTC'] as const;
/** The four Mermaid diagram keys per flow (R-P5). */
export const E2E_DIAGRAM_KEYS = ['functional', 'classMethod', 'dbEntities', 'integrations'] as const;

interface AiStep {
  stepId: string;
  sequenceNum?: number;
  nodeType?: string;
  nextStepIds?: string[];
  branchLabels?: Record<string, string>;
  moduleRef?: string; // MOD-01 or module name — mapped to moduleDbId (AI path)
  moduleDbId?: string; // direct module id (manual/UI path)
  screenId?: string;
  screenshotName?: string;
  role?: string;
  triggerLabel?: string;
  outcome?: string;
  condition?: string;
  layer?: string;
  integrationRef?: string; // vendor name (AI path)
  thirdPartyIntegrationId?: string; // direct integration id (manual/UI path)
}
interface AiFlow {
  flowKey: string;
  flowName: string;
  journeyType?: string;
  primaryRole?: string;
  secondaryRoles?: string[];
  spannedModuleRefs?: string[];
  steps?: AiStep[];
  mermaidDiagrams?: Record<string, string>;
}
interface AiE2eResponse {
  flows: AiFlow[];
  integrations?: Array<{ vendorName: string; category?: string; endpoint?: string; authScheme?: string }>;
  gaps?: Array<{ question: string }>;
}

const NODE_TYPES = new Set(['START', 'STEP', 'DECISION', 'JOIN', 'END']);

/**
 * R-P1 — E2E-Flow generation + CRUD. Project-scoped (like PRD/HLD): pulls FRDs +
 * module/screen context + config, calls the AI `/e2e-flow-generate` endpoint,
 * and persists `BaE2eFlow` + `BaE2eFlowStep` (decision-graph) + Mermaid diagrams.
 * Also provides manual CRUD (for the R-P2 builder) and the third-party
 * integration registry (auto-seeded from the HLD integrations section).
 */
@Injectable()
export class E2eFlowService {
  private readonly logger = new Logger(E2eFlowService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly projectFolders: ProjectFolderService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  // ── Config ───────────────────────────────────────────────────────────────

  async getConfig(projectId: string) {
    return this.prisma.baE2eFlowConfig.findUnique({ where: { projectId } });
  }

  async upsertConfig(
    projectId: string,
    data: {
      referenceJourneys?: string[];
      defaultRoles?: string[];
      coverageTarget?: string;
      targetEnv?: string;
      baseUrl?: string;
      narrative?: string;
      useAsAdditional?: boolean;
    },
  ) {
    return this.prisma.baE2eFlowConfig.upsert({
      where: { projectId },
      update: { ...data },
      create: { projectId, ...data },
    });
  }

  // ── Flows (read + manual CRUD) ───────────────────────────────────────────

  async listFlows(projectId: string) {
    return this.prisma.baE2eFlow.findMany({
      where: { projectId },
      orderBy: { flowKey: 'asc' },
      select: {
        id: true, flowKey: true, flowName: true, journeyType: true, primaryRole: true,
        secondaryRoles: true, status: true, spannedModuleIds: true, createdAt: true,
        _count: { select: { steps: true } },
      },
    });
  }

  async getFlow(flowId: string) {
    const flow = await this.prisma.baE2eFlow.findUnique({
      where: { id: flowId },
      include: { steps: { orderBy: { sequenceNum: 'asc' } } },
    });
    if (!flow) throw new NotFoundException(`E2E flow ${flowId} not found`);
    return flow;
  }

  async createFlow(
    projectId: string,
    data: { flowKey: string; flowName: string; journeyType?: string; primaryRole?: string; secondaryRoles?: string[]; spannedModuleIds?: string[] },
  ) {
    if (!data.flowKey?.trim() || !data.flowName?.trim()) {
      throw new BadRequestException('flowKey and flowName are required.');
    }
    return this.prisma.baE2eFlow.create({
      data: {
        projectId,
        flowKey: data.flowKey.trim(),
        flowName: data.flowName.trim(),
        journeyType: data.journeyType,
        primaryRole: data.primaryRole,
        secondaryRoles: data.secondaryRoles ?? [],
        spannedModuleIds: data.spannedModuleIds ?? [],
      },
    });
  }

  async updateFlow(flowId: string, data: Record<string, unknown>) {
    await this.getFlow(flowId);
    return this.prisma.baE2eFlow.update({ where: { id: flowId }, data: data as Prisma.BaE2eFlowUpdateInput });
  }

  async deleteFlow(flowId: string) {
    await this.getFlow(flowId);
    await this.prisma.baE2eFlow.delete({ where: { id: flowId } });
    return { deleted: true };
  }

  async upsertStep(flowId: string, step: AiStep) {
    await this.getFlow(flowId);
    if (!step.stepId?.trim()) throw new BadRequestException('stepId is required.');
    const data = this.toStepData(step);
    return this.prisma.baE2eFlowStep.upsert({
      where: { e2eFlowId_stepId: { e2eFlowId: flowId, stepId: step.stepId } },
      update: data,
      create: { e2eFlowId: flowId, stepId: step.stepId, ...data },
    });
  }

  async deleteStep(flowId: string, stepId: string) {
    await this.prisma.baE2eFlowStep.deleteMany({ where: { e2eFlowId: flowId, stepId } });
    return { deleted: true };
  }

  // ── AI generation ────────────────────────────────────────────────────────

  async generate(projectId: string): Promise<{ flowsCreated: number; gaps: AiE2eResponse['gaps'] }> {
    const project = await this.prisma.baProject.findUnique({
      where: { id: projectId },
      select: { name: true, productName: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const prd = await this.prisma.baProjectPrd.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true, sections: true },
    });
    if (!prd) throw new BadRequestException('No PRD+FRD found. Generate the PRD first (Stage 2).');

    // M-06 — record which upstream versions this E2E generation was built from.
    const latestHld = await this.prisma.baHld.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const sourceArtifactVersions = {
      prdVersion: prd.version,
      ...(latestHld ? { hldVersion: latestHld.version } : {}),
    } as Prisma.InputJsonValue;

    const modules = await this.prisma.baModule.findMany({
      where: { projectId },
      select: {
        id: true, moduleId: true, moduleName: true,
        screens: { orderBy: { displayOrder: 'asc' }, select: { screenId: true, screenTitle: true } },
      },
    });
    const config = await this.getConfig(projectId);

    let ai: AiE2eResponse;
    try {
      const { data } = await axios.post<AiE2eResponse>(
        `${this.aiServiceUrl}/e2e-flow-generate`,
        {
          project_id: projectId,
          product_name: project.productName ?? project.name,
          frd_sections: flattenSections(prd.sections as Record<string, unknown>),
          modules: modules.map((m) => ({
            moduleId: m.moduleId,
            moduleName: m.moduleName,
            screens: m.screens.map((s) => ({ screenId: s.screenId, title: s.screenTitle })),
          })),
          config: config
            ? { referenceJourneys: config.referenceJourneys, defaultRoles: config.defaultRoles, narrative: config.narrative }
            : null,
        },
        { timeout: 300_000 },
      );
      ai = data;
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail ?? err.message
        : err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`AI E2E-flow generation failed: ${msg}`);
      throw new BadRequestException(`AI E2E-flow generation failed: ${msg}`);
    }

    const moduleByRef = new Map<string, string>(); // moduleId code / name → db id
    for (const m of modules) {
      moduleByRef.set(m.moduleId.toLowerCase(), m.id);
      moduleByRef.set(m.moduleName.toLowerCase(), m.id);
    }
    const mapModule = (ref?: string) => (ref ? moduleByRef.get(ref.toLowerCase()) ?? null : null);

    let flowsCreated = 0;
    for (const f of ai.flows ?? []) {
      if (!f.flowKey || !f.flowName) continue;
      const spannedModuleIds = (f.spannedModuleRefs ?? [])
        .map(mapModule)
        .filter((x): x is string => Boolean(x));
      const mermaid: Record<string, string> = {};
      for (const k of E2E_DIAGRAM_KEYS) if (f.mermaidDiagrams?.[k]) mermaid[k] = f.mermaidDiagrams[k];

      const flow = await this.prisma.baE2eFlow.upsert({
        where: { projectId_flowKey: { projectId, flowKey: f.flowKey } },
        update: {
          flowName: f.flowName, journeyType: f.journeyType, primaryRole: f.primaryRole,
          secondaryRoles: f.secondaryRoles ?? [], spannedModuleIds,
          mermaidDiagrams: mermaid as Prisma.InputJsonValue, triggeredBy: 'MANUAL_EDIT',
          sourceArtifactVersions,
        },
        create: {
          projectId, flowKey: f.flowKey, flowName: f.flowName, journeyType: f.journeyType,
          primaryRole: f.primaryRole, secondaryRoles: f.secondaryRoles ?? [], spannedModuleIds,
          mermaidDiagrams: mermaid as Prisma.InputJsonValue,
          sourceArtifactVersions,
        },
      });

      // Replace steps with the freshly generated set.
      await this.prisma.baE2eFlowStep.deleteMany({ where: { e2eFlowId: flow.id } });
      const steps = (f.steps ?? []).filter((s) => s.stepId);
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await this.prisma.baE2eFlowStep.create({
          data: {
            e2eFlowId: flow.id,
            stepId: s.stepId,
            ...this.toStepData(s, mapModule(s.moduleRef)),
            sequenceNum: s.sequenceNum ?? i + 1,
          },
        });
      }
      flowsCreated++;
    }

    // Auto-seed any integrations the AI surfaced.
    for (const i of ai.integrations ?? []) {
      if (!i.vendorName) continue;
      await this.upsertIntegration(projectId, {
        vendorName: i.vendorName, category: i.category ?? 'OTHER',
        endpoint: i.endpoint, authScheme: i.authScheme, source: 'E2E_SKILL', status: 'ASSUMED',
      }).catch(() => undefined);
    }

    await this.prisma.baProject
      .update({ where: { id: projectId }, data: { e2eFlowCompletedAt: new Date() } })
      .catch(() => undefined);

    this.logger.log(`Generated ${flowsCreated} E2E flow(s) for ${project.name}`);
    return { flowsCreated, gaps: ai.gaps ?? [] };
  }

  // ── Module screens (reuse analyzed screens for the step Screen picker) ─────

  /** List a module's analyzed screens (id + title) for the step Screen dropdown. */
  async listModuleScreens(moduleDbId: string) {
    return this.prisma.baScreen.findMany({
      where: { moduleDbId },
      orderBy: { displayOrder: 'asc' },
      select: { screenId: true, screenTitle: true, screenType: true },
    });
  }

  /** Return a module screen's image as a data-URI (for the selected-screen preview). */
  async getModuleScreenImage(moduleDbId: string, screenId: string): Promise<{ dataUri: string | null }> {
    const screen = await this.prisma.baScreen.findFirst({
      where: { moduleDbId, screenId },
      select: { fileData: true, mimeType: true },
    });
    if (!screen?.fileData) return { dataUri: null };
    const dataUri = screen.fileData.startsWith('data:')
      ? screen.fileData
      : `data:${screen.mimeType || 'image/png'};base64,${screen.fileData}`;
    return { dataUri };
  }

  // ── Step screenshot (custom upload) ────────────────────────────────────────

  async setStepScreenshot(
    flowId: string, stepId: string, file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No image uploaded.');
    if (!/^image\//.test(file.mimetype)) throw new BadRequestException('File must be an image.');
    const step = await this.prisma.baE2eFlowStep.findFirst({ where: { e2eFlowId: flowId, stepId }, select: { id: true } });
    if (!step) throw new NotFoundException(`Step ${stepId} not found in flow ${flowId}`);
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.prisma.baE2eFlowStep.update({
      where: { id: step.id },
      data: { screenshotData: dataUri, screenshotName: file.originalname?.slice(0, 200) ?? 'screenshot' },
      select: { id: true, stepId: true, screenshotName: true },
    });
  }

  async clearStepScreenshot(flowId: string, stepId: string) {
    await this.prisma.baE2eFlowStep.updateMany({
      where: { e2eFlowId: flowId, stepId },
      data: { screenshotData: null, screenshotName: null },
    });
    return { cleared: true };
  }

  // ── Bulk import (CSV/Excel-as-CSV) ────────────────────────────────────────

  /**
   * Import flows + decision-graph steps from parsed CSV rows. Each row is a step;
   * rows sharing `flowKey` (or a key derived from `flowName`) form one flow.
   * Re-importing a flowKey replaces that flow's steps (idempotent).
   */
  async importFlows(
    projectId: string,
    rows: Array<Record<string, string>>,
  ): Promise<{ flowsImported: number; stepsImported: number; integrationsAdded: number; errors: string[] }> {
    const project = await this.prisma.baProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!Array.isArray(rows) || !rows.length) throw new BadRequestException('No rows to import.');

    const modules = await this.prisma.baModule.findMany({
      where: { projectId }, select: { id: true, moduleId: true, moduleName: true },
    });
    const moduleByRef = new Map<string, string>();
    for (const m of modules) {
      moduleByRef.set(m.moduleId.toLowerCase(), m.id);
      moduleByRef.set(m.moduleName.toLowerCase(), m.id);
    }

    // Group rows by flow.
    interface Group { flowKey: string; flowName: string; journeyType?: string; primaryRole?: string; steps: Array<Record<string, string>> }
    const groups = new Map<string, Group>();
    for (const r of rows) {
      const flowName = (r.flowName ?? r.flowname ?? '').trim();
      const rawKey = (r.flowKey ?? r.flowkey ?? '').trim();
      const flowKey = (rawKey || (flowName ? `E2E-${flowName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}` : '')).slice(0, 40);
      if (!flowKey) continue;
      const g = groups.get(flowKey) ?? { flowKey, flowName: flowName || flowKey, steps: [] };
      if (flowName) g.flowName = flowName;
      if (r.journeyType?.trim()) g.journeyType = r.journeyType.trim();
      if (r.primaryRole?.trim()) g.primaryRole = r.primaryRole.trim();
      if ((r.stepId ?? r.stepid ?? '').trim()) g.steps.push(r);
      groups.set(flowKey, g);
    }
    if (!groups.size) throw new BadRequestException('No valid flows found (need a flowName or flowKey per row).');

    let flowsImported = 0, stepsImported = 0, integrationsAdded = 0;
    const errors: string[] = [];
    const seenVendors = new Set(
      (await this.prisma.baThirdPartyIntegration.findMany({ where: { projectId }, select: { vendorName: true } }))
        .map((v) => v.vendorName.toLowerCase()),
    );

    for (const g of groups.values()) {
      try {
        const flow = await this.prisma.baE2eFlow.upsert({
          where: { projectId_flowKey: { projectId, flowKey: g.flowKey } },
          update: { flowName: g.flowName, journeyType: g.journeyType, primaryRole: g.primaryRole, triggeredBy: 'MANUAL_EDIT' },
          create: { projectId, flowKey: g.flowKey, flowName: g.flowName, journeyType: g.journeyType, primaryRole: g.primaryRole },
        });
        await this.prisma.baE2eFlowStep.deleteMany({ where: { e2eFlowId: flow.id } });

        const spanned = new Set<string>();
        let seq = 0;
        for (const r of g.steps) {
          seq++;
          const moduleRef = (r.moduleId ?? r.moduleid ?? '').trim();
          const moduleDbId = moduleRef ? moduleByRef.get(moduleRef.toLowerCase()) ?? null : null;
          if (moduleDbId) spanned.add(moduleDbId);
          const stepId = (r.stepId ?? r.stepid ?? '').trim();
          await this.prisma.baE2eFlowStep.create({
            data: {
              e2eFlowId: flow.id,
              stepId,
              sequenceNum: Number(r.sequenceNum ?? r.sequencenum) || seq,
              nodeType: validNode(r.nodeType),
              nextStepIds: splitList(r.nextStepIds ?? r.nextstepids),
              branchLabels: parseBranchLabels(r.branchLabels ?? r.branchlabels) as Prisma.InputJsonValue | undefined,
              moduleDbId,
              screenId: clean(r.screenId ?? r.screenid),
              role: clean(r.role),
              triggerLabel: clean(r.triggerLabel ?? r.triggerlabel),
              outcome: clean(r.outcome),
              condition: clean(r.condition),
              layer: clean(r.layer),
            },
          });
          stepsImported++;

          const vendor = (r.integration ?? '').trim();
          if (vendor && !seenVendors.has(vendor.toLowerCase())) {
            seenVendors.add(vendor.toLowerCase());
            await this.prisma.baThirdPartyIntegration.create({
              data: { projectId, vendorName: vendor, category: 'OTHER', source: 'IMPORT', status: 'ASSUMED' },
            }).then(() => { integrationsAdded++; }).catch(() => undefined);
          }
        }

        await this.prisma.baE2eFlow.update({ where: { id: flow.id }, data: { spannedModuleIds: [...spanned] } });
        flowsImported++;
      } catch (e) {
        errors.push(`${g.flowKey}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    this.logger.log(`Imported ${flowsImported} flow(s), ${stepsImported} step(s) for project ${projectId}`);
    return { flowsImported, stepsImported, integrationsAdded, errors };
  }

  // ── Third-party integrations ─────────────────────────────────────────────

  async listIntegrations(projectId: string) {
    return this.prisma.baThirdPartyIntegration.findMany({
      where: { projectId },
      orderBy: { vendorName: 'asc' },
    });
  }

  async upsertIntegration(
    projectId: string,
    data: { id?: string; vendorName: string; category: string; endpoint?: string; authScheme?: string; status?: string; source?: string; notes?: string },
  ) {
    if (data.id) {
      return this.prisma.baThirdPartyIntegration.update({
        where: { id: data.id },
        data: { vendorName: data.vendorName, category: data.category, endpoint: data.endpoint, authScheme: data.authScheme, status: data.status, notes: data.notes },
      });
    }
    return this.prisma.baThirdPartyIntegration.create({
      data: { projectId, vendorName: data.vendorName, category: data.category, endpoint: data.endpoint, authScheme: data.authScheme, status: data.status ?? 'ASSUMED', source: data.source ?? 'MANUAL', notes: data.notes },
    });
  }

  async deleteIntegration(id: string) {
    await this.prisma.baThirdPartyIntegration.delete({ where: { id } }).catch(() => undefined);
    return { deleted: true };
  }

  /** Seed integrations from the HLD "integrations" section (best-effort, idempotent). */
  async seedIntegrationsFromHld(projectId: string): Promise<{ seeded: number }> {
    const hld = await this.prisma.baHld.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { sections: true },
    });
    if (!hld) return { seeded: 0 };
    const section = (hld.sections as Record<string, unknown>)?.integrations;
    const vendors = extractVendors(section);
    const existing = new Set(
      (await this.prisma.baThirdPartyIntegration.findMany({ where: { projectId }, select: { vendorName: true } }))
        .map((r) => r.vendorName.toLowerCase()),
    );
    let seeded = 0;
    for (const v of vendors) {
      if (existing.has(v.vendorName.toLowerCase())) continue;
      await this.prisma.baThirdPartyIntegration.create({
        data: { projectId, vendorName: v.vendorName, category: v.category, source: 'HLD', status: 'ASSUMED' },
      });
      seeded++;
    }
    this.logger.log(`Seeded ${seeded} integration(s) from HLD for project ${projectId}`);
    return { seeded };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private toStepData(s: AiStep, moduleDbId?: string | null) {
    const nodeType: BaE2eNodeType = s.nodeType && NODE_TYPES.has(s.nodeType.toUpperCase())
      ? (s.nodeType.toUpperCase() as BaE2eNodeType)
      : 'STEP';
    return {
      sequenceNum: s.sequenceNum ?? 0,
      nodeType,
      nextStepIds: s.nextStepIds ?? [],
      branchLabels: (s.branchLabels ?? undefined) as Prisma.InputJsonValue | undefined,
      moduleDbId: moduleDbId ?? s.moduleDbId ?? null,
      screenId: s.screenId ?? null,
      role: s.role ?? null,
      triggerLabel: s.triggerLabel ?? null,
      outcome: s.outcome ?? null,
      condition: s.condition ?? null,
      layer: s.layer ?? null,
      thirdPartyIntegrationId: s.thirdPartyIntegrationId ?? null,
    };
  }
}

function clean(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t || null;
}
function splitList(v: string | undefined): string[] {
  return (v ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}
function validNode(v: string | undefined): BaE2eNodeType {
  const u = (v ?? '').trim().toUpperCase();
  return (NODE_TYPES.has(u) ? u : 'STEP') as BaE2eNodeType;
}
/** Parse "S02=valid;S03=invalid" (or `:` separator) into { S02: 'valid', S03: 'invalid' }. */
function parseBranchLabels(v: string | undefined): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const pair of (v ?? '').split(';')) {
    const m = pair.split(/[=:]/);
    if (m.length >= 2 && m[0].trim()) out[m[0].trim()] = m.slice(1).join('=').trim();
  }
  return Object.keys(out).length ? out : undefined;
}

/** Pull vendor + rough category out of an HLD integrations section (any shape). */
function extractVendors(section: unknown): Array<{ vendorName: string; category: string }> {
  const text = typeof section === 'string' ? section : JSON.stringify(section ?? '');
  const found = new Map<string, string>();
  const KNOWN: Array<[RegExp, string, string]> = [
    [/stripe/i, 'Stripe', 'PAYMENT'],
    [/razorpay/i, 'Razorpay', 'PAYMENT'],
    [/paypal/i, 'PayPal', 'PAYMENT'],
    [/twilio/i, 'Twilio', 'SMS_OTP'],
    [/sendgrid/i, 'SendGrid', 'EMAIL'],
    [/\bses\b|amazon ses/i, 'Amazon SES', 'EMAIL'],
    [/firebase auth|oauth|auth0|okta|cognito/i, 'OAuth/Identity Provider', 'AUTH'],
    [/webhook/i, 'Webhook', 'WEBHOOK'],
  ];
  for (const [re, name, cat] of KNOWN) if (re.test(text)) found.set(name, cat);
  return [...found.entries()].map(([vendorName, category]) => ({ vendorName, category }));
}
