import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface SaveTesterRcaPayload {
  rootCause: string;
  contributingFactors?: string[];
  proposedFix?: string | null;
  createdBy?: string | null;
}

interface AiRcaResponse {
  rootCause: string;
  contributingFactors: string[];
  proposedFix: string;
  confidence: number;
  classification: string;
  model: string;
}

@Injectable()
export class BaRcaService {
  private readonly logger = new Logger(BaRcaService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:5000';
  }

  async listRcas(defectId: string) {
    return this.prisma.baRca.findMany({
      where: { defectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Ask the Python AI for a fresh RCA on this defect. Prior AI + tester
   * RCAs are sent as context so the AI can refine or dissent rather than
   * repeat itself.
   */
  async analyzeWithAi(defectId: string) {
    const defect = await this.prisma.baDefect.findUnique({
      where: { id: defectId },
      include: {
        testCase: true,
        rcas: { orderBy: { createdAt: 'desc' }, take: 4 },
      },
    });
    if (!defect) throw new NotFoundException(`Defect ${defectId} not found`);

    // Pull a bounded slice of LLD context when the TC has a linked LLD,
    // so the AI can cite real classes/methods.
    let lldContext = '';
    if (defect.testCase.linkedLldArtifactId) {
      lldContext = await this.buildLldContextSnippet(defect.testCase.linkedLldArtifactId, defect.testCase.linkedPseudoFileIds);
    }

    const priorAi = defect.rcas.find((r) => r.source === 'AI');
    const priorTester = defect.rcas.find((r) => r.source === 'TESTER');

    const payload = {
      defectTitle: defect.title,
      defectDescription: defect.description ?? '',
      reproductionSteps: defect.reproductionSteps ?? '',
      environment: defect.environment,
      testCaseId: defect.testCase.testCaseId,
      testCaseTitle: defect.testCase.title,
      testCaseSteps: defect.testCase.steps ?? '',
      testCaseExpected: defect.testCase.expected ?? '',
      testCasePostValidation: defect.testCase.postValidation ?? '',
      testCasePlaywrightHint: defect.testCase.playwrightHint ?? null,
      lldContext,
      priorAiRca: priorAi
        ? `${priorAi.rootCause}\nProposed fix: ${priorAi.proposedFix ?? '(none)'}`
        : null,
      priorTesterRca: priorTester
        ? `${priorTester.rootCause}\nProposed fix: ${priorTester.proposedFix ?? '(none)'}`
        : null,
    };

    let aiResult: AiRcaResponse;
    try {
      const { data } = await axios.post<AiRcaResponse>(
        `${this.aiServiceUrl}/ba/rca-analyze`,
        payload,
        { timeout: 90_000 },
      );
      aiResult = data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      throw new BadRequestException(`AI RCA failed: ${msg}`);
    }

    const created = await this.prisma.baRca.create({
      data: {
        defectId,
        source: 'AI',
        rootCause: aiResult.rootCause,
        contributingFactors: aiResult.contributingFactors,
        proposedFix: aiResult.proposedFix || null,
        confidence: aiResult.confidence,
        createdBy: `AI (${aiResult.model})`,
      },
    });
    return { rca: created, classification: aiResult.classification };
  }

  async saveTesterRca(defectId: string, payload: SaveTesterRcaPayload) {
    const defect = await this.prisma.baDefect.findUnique({ where: { id: defectId } });
    if (!defect) throw new NotFoundException(`Defect ${defectId} not found`);
    if (!payload.rootCause?.trim()) {
      throw new BadRequestException('rootCause is required');
    }
    return this.prisma.baRca.create({
      data: {
        defectId,
        source: 'TESTER',
        rootCause: payload.rootCause.trim(),
        contributingFactors: payload.contributingFactors?.filter((s) => s.trim()) ?? [],
        proposedFix: payload.proposedFix?.trim() || null,
        confidence: null,
        createdBy: payload.createdBy?.trim() || null,
      },
    });
  }

  private async buildLldContextSnippet(lldArtifactRef: string, pseudoFileIds: string[]): Promise<string> {
    // linkedLldArtifactId is stored as the human-readable artifactId (e.g.
    // LLD-MOD-01-langchain-v3). Look up the DB row.
    const lld = await this.prisma.baArtifact.findFirst({
      where: { artifactId: lldArtifactRef, artifactType: 'LLD' },
      include: {
        pseudoFiles: {
          where: pseudoFileIds.length > 0 ? { id: { in: pseudoFileIds } } : undefined,
          orderBy: { path: 'asc' },
          take: 8,
        },
      },
    });
    if (!lld) return '';
    const parts: string[] = [];
    for (const f of lld.pseudoFiles) {
      const content = (f.editedContent || f.aiContent || '').slice(0, 1500);
      parts.push(`=== ${f.path} ===\n${content}`);
    }
    return parts.join('\n\n').slice(0, 8000);
  }
}
