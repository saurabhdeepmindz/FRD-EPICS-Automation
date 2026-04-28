import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface FtcConfigPayload {
  /** Multi-select since v4.3. See `testingFramework` for the legacy singular shape. */
  testingFrameworks?: string[] | null;
  /** Multi-select since v4.3 — filters which TC categories the skill emits. */
  testTypes?: string[] | null;
  coverageTarget?: string | null;
  owaspWebEnabled?: boolean | null;
  owaspLlmEnabled?: boolean | null;
  excludedOwaspWeb?: string[] | null;
  excludedOwaspLlm?: string[] | null;
  includeLldReferences?: boolean | null;
  ftcTemplateId?: string | null;
  customNotes?: string | null;
  narrative?: string | null;
  useAsAdditional?: boolean | null;
}

@Injectable()
export class BaFtcService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const config = await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });
    return {
      config,
      moduleStatus: mod.moduleStatus,
      ftcCompletedAt: mod.ftcCompletedAt,
      ftcArtifactId: mod.ftcArtifactId,
    };
  }

  async saveConfig(moduleDbId: string, payload: FtcConfigPayload) {
    const existing = await this.prisma.baFtcConfig.findUnique({ where: { moduleDbId } });
    const data: Record<string, unknown> = {
      testingFrameworks: payload.testingFrameworks ?? [],
      testTypes: payload.testTypes ?? [],
      coverageTarget: payload.coverageTarget ?? null,
      excludedOwaspWeb: payload.excludedOwaspWeb ?? [],
      excludedOwaspLlm: payload.excludedOwaspLlm ?? [],
      ftcTemplateId: payload.ftcTemplateId ?? null,
      customNotes: payload.customNotes ?? null,
      ...(payload.owaspWebEnabled !== undefined && payload.owaspWebEnabled !== null
        ? { owaspWebEnabled: payload.owaspWebEnabled }
        : {}),
      ...(payload.owaspLlmEnabled !== undefined && payload.owaspLlmEnabled !== null
        ? { owaspLlmEnabled: payload.owaspLlmEnabled }
        : {}),
      ...(payload.includeLldReferences !== undefined && payload.includeLldReferences !== null
        ? { includeLldReferences: payload.includeLldReferences }
        : {}),
      ...(payload.narrative !== undefined ? { narrative: payload.narrative } : {}),
      ...(payload.useAsAdditional !== undefined && payload.useAsAdditional !== null
        ? { useAsAdditional: payload.useAsAdditional }
        : {}),
    };
    if (existing) {
      return this.prisma.baFtcConfig.update({ where: { moduleDbId }, data });
    }
    return this.prisma.baFtcConfig.create({ data: { moduleDbId, ...data } });
  }

  async getFtcArtifact(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    // Resolution order:
    //   1. mod.ftcArtifactId (denormalised pointer) — fast, used when fresh
    //   2. Latest FTC artifact for this module — fallback when the pointer
    //      is null OR points to a deleted row (e.g. after a wipe + per-
    //      feature recreation, where the orchestrator's per-feature
    //      paths create the artifact directly without bumping the
    //      pointer). This makes the lookup self-healing.
    if (mod.ftcArtifactId) {
      const byPointer = await this.prisma.baArtifact.findUnique({
        where: { id: mod.ftcArtifactId },
        include: { sections: { orderBy: { createdAt: 'asc' } } },
      });
      if (byPointer) return byPointer;
    }
    return this.prisma.baArtifact.findFirst({
      where: { moduleDbId, artifactType: 'FTC' },
      orderBy: { createdAt: 'desc' },
      include: { sections: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async listFtcArtifactsForModule(moduleDbId: string) {
    const mod = await this.prisma.baModule.findUnique({ where: { id: moduleDbId } });
    if (!mod) throw new NotFoundException(`Module ${moduleDbId} not found`);
    const artifacts = await this.prisma.baArtifact.findMany({
      where: { moduleDbId, artifactType: 'FTC' },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: { select: { id: true } },
        testCases: { select: { id: true, scope: true, owaspCategory: true } },
      },
    });
    return artifacts.map((a) => ({
      id: a.id,
      artifactId: a.artifactId,
      status: a.status,
      approvedAt: a.approvedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      sectionCount: a.sections.length,
      testCaseCount: a.testCases.length,
      whiteBoxCount: a.testCases.filter((tc) => tc.scope === 'white_box').length,
      owaspCategories: Array.from(
        new Set(a.testCases.map((tc) => tc.owaspCategory).filter((x): x is string => !!x)),
      ).sort(),
      isCurrent: mod.ftcArtifactId === a.id,
    }));
  }

  async listTestCases(artifactDbId: string) {
    return this.prisma.baTestCase.findMany({
      where: { artifactDbId },
      orderBy: [{ parentTestCaseId: 'asc' }, { testCaseId: 'asc' }],
    });
  }

  async getTestCase(id: string) {
    const tc = await this.prisma.baTestCase.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException(`Test case ${id} not found`);
    return tc;
  }

  async updateTestCase(id: string, editedContent: string) {
    const tc = await this.prisma.baTestCase.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException(`Test case ${id} not found`);
    return this.prisma.baTestCase.update({
      where: { id },
      data: { editedContent, isHumanModified: true },
    });
  }

  /**
   * Export an FTC artifact's test cases as CSV, matching the sample template
   * the client supplied (same column headers + order). Three extra columns
   * surface context the sample template lacked: OWASP, scope, linked IDs.
   *
   * Header order:
   *   TC ID | Sprint ID | Status (Pass/Fail) | Test Data | Pre Condition |
   *   Test Scenario/Module | E2E Test Cases/Test Case | Test Steps |
   *   Post Validation / Email Validation | Document | Defects |
   *   OWASP Category | White/Black Box | Linked IDs (F/US/ST/TC)
   *
   * Separator rows (matching the CSV pattern "Signup ( Starter ) Positive Tc"
   * / "Negative Tc") are emitted between scenarioGroup + testKind transitions
   * so the output is drop-in compatible with QA teams' existing templates.
   */
  async exportTestCasesCsv(artifactDbId: string): Promise<{ csv: string; filename: string }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactDbId },
      include: {
        testCases: {
          orderBy: [
            { scenarioGroup: 'asc' },
            { testKind: 'asc' },
            { testCaseId: 'asc' },
          ],
        },
      },
    });
    if (!artifact) throw new NotFoundException(`FTC artifact ${artifactDbId} not found`);

    const headers = [
      'TC ID', 'Sprint ID', 'Status (Pass/Fail)', 'Test Data', 'Pre Condition',
      'Test Scenario/Module', 'E2E Test Cases/Test Case', 'Test Steps',
      'Post Validation / Email Validation', 'Document', 'Defects',
      'OWASP Category', 'Scope (White/Black)', 'Linked IDs',
    ];

    const rows: string[][] = [headers];

    let lastGroup: string | null = null;
    let lastKind: string | null = null;
    for (const tc of artifact.testCases) {
      const group = tc.scenarioGroup ?? 'Ungrouped';
      const kind = tc.testKind ?? 'positive';
      if (group !== lastGroup || kind !== lastKind) {
        // Emit a separator row like the sample CSV
        const kindLabel = kind === 'negative' ? 'Negative Tc' : kind === 'edge' ? 'Edge Tc' : 'Positive Tc';
        const sep = new Array(headers.length).fill('');
        sep[5] = `${group} — ${kindLabel}`;
        rows.push(sep);
        lastGroup = group;
        lastKind = kind;
      }

      const linkedIds = [
        ...tc.linkedFeatureIds,
        ...tc.linkedEpicIds,
        ...tc.linkedStoryIds,
        ...tc.linkedSubtaskIds,
      ].join('; ');

      rows.push([
        tc.testCaseId,
        tc.sprintId ?? '',
        tc.executionStatus ?? 'NOT_RUN',
        tc.testData ?? '',
        tc.preconditions ?? '',
        tc.title ?? '',
        tc.e2eFlow ?? '',
        tc.steps ?? '',
        [tc.expected, tc.postValidation].filter(Boolean).join('\n\n'),
        (tc.supportingDocs ?? []).join('; '),
        (tc.defectIds ?? []).join('; '),
        tc.owaspCategory ?? '',
        tc.scope ?? 'black_box',
        linkedIds,
      ]);
    }

    const csv = rows
      .map((row) => row.map((cell) => this.csvEscape(cell)).join(','))
      .join('\r\n');

    const filename = `${artifact.artifactId ?? 'ftc'}-test-cases.csv`;
    return { csv, filename };
  }

  private csvEscape(value: string): string {
    if (value == null) return '""';
    const s = String(value);
    // RFC 4180: wrap in quotes, double internal quotes. Always quote so Excel
    // handles multi-line cells (TC steps often have embedded newlines).
    return `"${s.replace(/"/g, '""')}"`;
  }
}
