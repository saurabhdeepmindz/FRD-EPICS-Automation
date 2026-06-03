import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, ParseUUIDPipe,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { E2eFlowService } from './e2e-flow.service';
import { E2eElaborationService, type E2eStage } from './e2e-elaboration.service';
import { E2eMappingService } from './e2e-mapping.service';
import { E2eDiagramService } from './e2e-diagram.service';
import { E2eTestService } from './e2e-test.service';

/**
 * R-P1 — REST surface for project-scoped E2E flows (Track R).
 * Base: /api/ba/projects/:id/e2e-flows/*
 *
 * Static-segment routes (config / integrations / generate) are declared BEFORE
 * the `:flowId` routes so they resolve first (otherwise ParseUUIDPipe rejects
 * "config" etc.).
 */
@Controller('ba/projects/:id/e2e-flows')
export class E2eFlowController {
  constructor(
    private readonly e2e: E2eFlowService,
    private readonly elaboration: E2eElaborationService,
    private readonly mapping: E2eMappingService,
    private readonly diagrams: E2eDiagramService,
    private readonly e2eTests: E2eTestService,
  ) {}

  // ── Config ───────────────────────────────────────────────────────────────

  @Get('config')
  async getConfig(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.e2e.getConfig(id) };
  }

  @Put('config')
  async putConfig(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return { success: true, data: await this.e2e.upsertConfig(id, body) };
  }

  // ── Third-party integrations ─────────────────────────────────────────────

  @Get('integrations')
  async listIntegrations(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.e2e.listIntegrations(id) };
  }

  @Put('integrations')
  async upsertIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { id?: string; vendorName: string; category: string; endpoint?: string; authScheme?: string; status?: string; notes?: string },
  ) {
    return { success: true, data: await this.e2e.upsertIntegration(id, body) };
  }

  @Post('integrations/seed-from-hld')
  async seedIntegrations(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.e2e.seedIntegrationsFromHld(id) };
  }

  /** R-P4 — stamp `e2e_flow_mapping` sections onto module artifacts + RTM columns. */
  @Post('sync-mappings')
  async syncMappings(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.mapping.syncArtifactMappings(id) };
  }

  // ── Module screens (for the step Screen picker — reuse analyzed screens) ────

  @Get('screens/:moduleDbId')
  async listModuleScreens(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
  ) {
    return { success: true, data: await this.e2e.listModuleScreens(moduleDbId) };
  }

  @Get('screens/:moduleDbId/:screenId/image')
  async moduleScreenImage(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('moduleDbId', ParseUUIDPipe) moduleDbId: string,
    @Param('screenId') screenId: string,
  ) {
    return { success: true, data: await this.e2e.getModuleScreenImage(moduleDbId, screenId) };
  }

  /** Bulk-import flows + steps from parsed CSV rows (Excel → Save As CSV). */
  @Post('import')
  async importFlows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rows: Array<Record<string, string>> },
  ) {
    return { success: true, data: await this.e2e.importFlows(id, body?.rows ?? []) };
  }

  @Delete('integrations/:intId')
  async deleteIntegration(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('intId', ParseUUIDPipe) intId: string,
  ) {
    return { success: true, data: await this.e2e.deleteIntegration(intId) };
  }

  // ── Generate (AI) ─────────────────────────────────────────────────────────

  @Post('generate')
  async generate(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.e2e.generate(id) };
  }

  // ── Flows (list + manual CRUD) ────────────────────────────────────────────

  @Get()
  async listFlows(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.e2e.listFlows(id) };
  }

  @Post()
  async createFlow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { flowKey: string; flowName: string; journeyType?: string; primaryRole?: string; secondaryRoles?: string[]; spannedModuleIds?: string[] },
  ) {
    return { success: true, data: await this.e2e.createFlow(id, body) };
  }

  @Get(':flowId')
  async getFlow(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
  ) {
    return { success: true, data: await this.e2e.getFlow(flowId) };
  }

  @Patch(':flowId')
  async updateFlow(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return { success: true, data: await this.e2e.updateFlow(flowId, body) };
  }

  @Delete(':flowId')
  async deleteFlow(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
  ) {
    return { success: true, data: await this.e2e.deleteFlow(flowId) };
  }

  // ── Downstream elaboration (R-P3) ─────────────────────────────────────────

  /** Elaborate one stage (EPIC/USER_STORY/SUBTASK/LLD/FTC/WTC) onto the flow's steps. */
  @Post(':flowId/elaborate/:stage')
  async elaborate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Param('stage') stage: string,
  ) {
    return { success: true, data: await this.elaboration.elaborate(id, flowId, stage as E2eStage) };
  }

  /** R-P5 — (re)build the 4 Mermaid diagrams deterministically from the flow data. */
  @Post(':flowId/build-diagrams')
  async buildDiagrams(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
  ) {
    return { success: true, data: await this.diagrams.buildDiagrams(id, flowId) };
  }

  // ── E2E test execution (R-P6) ─────────────────────────────────────────────

  /** Compose the cross-module test plan (FTC coverage + layered assertions per step). */
  @Get(':flowId/test-plan')
  async testPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
  ) {
    return { success: true, data: await this.e2eTests.composeTestPlan(id, flowId) };
  }

  /** Execute the journey — runs the FTC suite for each spanned module (reuses Track Q). */
  @Post(':flowId/run-tests')
  async runTests(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
  ) {
    return { success: true, data: await this.e2eTests.runE2eTests(id, flowId) };
  }

  /** Per-step × per-stage fill matrix (surfaces design gaps). */
  @Get(':flowId/gaps')
  async gaps(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
  ) {
    return { success: true, data: await this.elaboration.gapReport(id, flowId) };
  }

  @Put(':flowId/steps')
  async upsertStep(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return { success: true, data: await this.e2e.upsertStep(flowId, body as never) };
  }

  @Delete(':flowId/steps/:stepId')
  async deleteStep(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Param('stepId') stepId: string,
  ) {
    return { success: true, data: await this.e2e.deleteStep(flowId, stepId) };
  }

  /** Upload a custom screenshot for a step (multipart). */
  @Post(':flowId/steps/:stepId/screenshot')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadStepScreenshot(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Param('stepId') stepId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    return { success: true, data: await this.e2e.setStepScreenshot(flowId, stepId, file) };
  }

  @Delete(':flowId/steps/:stepId/screenshot')
  async clearStepScreenshot(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Param('stepId') stepId: string,
  ) {
    return { success: true, data: await this.e2e.clearStepScreenshot(flowId, stepId) };
  }
}
