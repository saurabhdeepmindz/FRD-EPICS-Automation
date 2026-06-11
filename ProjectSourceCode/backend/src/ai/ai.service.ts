import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import { SuggestDto } from './dto/suggest.dto';
import { ParseDto } from './dto/parse.dto';
import { GapCheckDto } from './dto/gap-check.dto';

export interface SuggestResponse {
  suggestion: string;
  section: number;
  field: string;
  model: string;
}

export interface ParseResponse {
  sections: Record<string, unknown>;
  gaps: { section: number; question: string }[];
}

export interface GapCheckResponse {
  updatedSections: Record<string, unknown>;
  remainingGaps: { section: number; question: string }[];
  gapCount: number;
}

export interface TranscribeResponse {
  text: string;
  provider: string;
}

export interface GenerateWftRequest {
  rawTranscript: string;
  domainContext?: string;
  languageHint?: string;
}

export interface WftConcept {
  name: string;
  context: string;
}

export interface GenerateWftResponse {
  cleanedText?: string;
  paraphrased?: string;
  concepts?: WftConcept[];
  actionItems?: string[];
  openQuestions?: string[];
  detectedLanguage?: string;
  model?: string;
}

export interface GenerateBrdRequest {
  wftParaphrased: string;
  wftConcepts: { name: string; context: string }[];
  wftActionItems: string[];
  wftOpenQuestions: string[];
  productName?: string;
  audience?: 'internal-tool' | 'end-client-product';
}

export interface FrTableRow {
  id: string;
  requirement: string;
  testable: boolean;
}

export interface GenerateBrdResponse {
  sections: Record<string, string>;
  frTable: FrTableRow[];
  openItems: string[];
  detectedAudience?: string;
  model?: string;
}

export interface GenerateApproachNoteRequest {
  brdSections: Record<string, string>;
  brdFrTable: { id: string; requirement: string; testable: boolean }[];
  brdOpenItems: string[];
  productName?: string;
  audience?: 'internal-tool' | 'end-client-product';
  changesRequested?: string;
}

export interface AnBrandTokens {
  primary: string;
  surface: string;
  cta: string;
  logo: string | null;
  productName: string;
}

export interface AnDecision {
  question: string;
  decision: string;
}

export interface AnOpenQuestion {
  number: number;
  question: string;
  default: string;
}

// ─── §12 PRD-Readiness Bridge types ─────────────────────────────────────
// Mirror of the Python AnPrdReadiness models. Each sub-section maps 1:1 to a
// PRD template section so a downstream PRD generator can lift items directly.

export interface AnActor {
  role: string;
  type: string;
  description: string;
  permissions: string;
}

export interface AnIntegration {
  name: string;
  type: string;
  purpose: string;
  criticality: string;
  phase: string;
}

export interface AnCustomerJourney {
  name: string;
  primaryActor: string;
  trigger: string;
  steps: string[];
  successOutcome: string;
  failureModes: string[];
}

export interface AnFunctionalLandscapeRow {
  module: string;
  purpose: string;
  frRefs: string[];
}

export interface AnUiUxRequirements {
  interactionPatterns: string;
  accessibility: string;
  responsive: string;
  emptyErrorStates: string;
  microcopyTone: string;
  internationalization: string;
}

export interface AnComplianceRow {
  standard: string;
  applicability: string;
  phase1Controls: string;
}

export interface AnTestType {
  coverageTarget: string;
  tools: string;
  owner: string;
}

export interface AnTestingRequirements {
  unit: AnTestType;
  integration: AnTestType;
  e2e: AnTestType;
  evalHarness: AnTestType;
  accessibility: AnTestType;
  performance: AnTestType;
  security: AnTestType;
}

export interface AnReceivable {
  item: string;
  ownerClient: string;
  neededByWeek: number | null;
  blocking: boolean;
}

export interface AnEnvironment {
  environment: string;
  purpose: string;
  phase1Hosting: string;
  phase2Hosting: string;
}

export interface AnPrdReadiness {
  actors: AnActor[];
  integrations: AnIntegration[];
  customerJourneys: AnCustomerJourney[];
  functionalLandscape: AnFunctionalLandscapeRow[];
  uiUxRequirements: AnUiUxRequirements;
  complianceRequirements: AnComplianceRow[];
  testingRequirements: AnTestingRequirements;
  keyDeliverables: string[];
  receivables: AnReceivable[];
  environmentList: AnEnvironment[];
  miscellaneous: string;
}

export interface GenerateApproachNoteResponse {
  sections: Record<string, string>;
  brandTokens: AnBrandTokens;
  decisionsLocked: AnDecision[];
  openQuestions: AnOpenQuestion[];
  prdReadiness: AnPrdReadiness;
  detectedAudience?: string;
  model?: string;
}

export interface ExtractBrandTokensResponse {
  primary: string;
  surface: string;
  cta: string;
  productName: string;
  model?: string;
}

export interface WireframeCalloutPayload {
  n: number | string;
  description: string;
  mappedTo: string;
}

export interface WireframeComponentPayload {
  file: string;
  purpose: string;
}

export interface WireframeScreenPayload {
  sequenceNum: number;
  slug: string;
  title: string;
  pattern?: string | null;
  callouts: WireframeCalloutPayload[];
  components: WireframeComponentPayload[];
  mdContent?: string | null;
  htmlContent?: string | null;
  frRefs?: string[];
}

export interface GenerateWireframesRequest {
  anSections: Record<string, string>;
  frTable: { id: string; requirement: string; testable: boolean }[];
  brandTokens: { primary: string; surface: string; cta: string; productName: string };
  selectedPatterns?: string[];
  productName?: string;
}

export interface GenerateWireframesResponse {
  screens: WireframeScreenPayload[];
  coverageNotes?: string | null;
  model?: string;
}

export interface HifiCalloutPayload {
  n: number | string;
  description: string;
  mappedTo: string;
}

export interface HifiScreenPayload {
  sequenceNum: number;
  slug: string;
  title: string;
  callouts: HifiCalloutPayload[];
  htmlContent: string;
}

export interface GenerateHifiRequest {
  lofiScreens: Array<{
    sequenceNum: number;
    slug: string;
    title: string;
    pattern?: string | null;
    callouts: { n: number | string; description: string; mappedTo: string }[];
    mdContent?: string | null;
  }>;
  brandTokens: { primary: string; surface: string; cta: string; productName: string };
  syntheticSeed?: Record<string, string> | null;
  productName?: string;
  /** v9 GG-03: "lofi" → grey-box wireframe; "hifi" (default) → branded mockup. */
  fidelity?: 'lofi' | 'hifi';
}

export interface GenerateHifiResponse {
  screens: HifiScreenPayload[];
  syntheticDataNotes?: string | null;
  model?: string;
}

export interface BaRefineSectionRequest {
  artifactType: string;
  sectionLabel: string;
  currentText: string;
  moduleContext?: string;
  instruction?: string;
}

export interface BaRefineSectionResponse {
  suggestion: string;
  model: string;
}

// ── v12 · Track WC — Wireframe Copilot ai-service contracts ─────────────────────
export interface WireframeScreenCtxPayload {
  slug: string;
  title?: string;
  module?: string | null;
  callouts?: unknown[];
  html?: string;
}
export interface WireframeChatRequest {
  provider?: string;
  scope_label: string;
  screens: WireframeScreenCtxPayload[];
  design_tokens: Record<string, unknown>;
  reference_screens: { slug: string; html: string }[];
  prd_context?: string;
  history?: { role: string; content: string }[];
  user_message: string;
}
export interface WireframeChatResponse {
  markdown: string;
  model: string;
}
export interface WireframeExtractedItem {
  description: string;
  targetScreens?: string[];
  scopeAll?: boolean;
  kind?: string;
  phase?: string;
  priority?: string;
  calloutRef?: string | null;
  actionable?: boolean;
  rationale?: string;
}
export interface WireframeExtractRequest {
  provider?: string;
  scope_label: string;
  screens: WireframeScreenCtxPayload[];
  user_message: string;
  assistant_reply?: string;
}
export interface WireframeExtractResponse {
  items: WireframeExtractedItem[];
  model?: string;
}
export interface WireframeEditRequest {
  provider?: string;
  htmlContent: string;
  changeRequest: string;
  designTokens: Record<string, unknown>;
  referenceScreens?: { slug: string; html: string }[];
  callouts?: unknown[];
  fidelity?: 'lofi' | 'hifi';
}
export interface WireframeEditResponse {
  editedHtml: string;
  rationale?: string;
  calloutsPreserved?: boolean;
  model?: string;
}
export interface WireframeParseFeedbackItem {
  description: string;
  calloutRef?: string | null;
  phase?: string;
  priority?: string;
}
export interface WireframeParseFeedbackScreen {
  moduleRef?: string;
  screenRef?: string;
  slug?: string | null;
  items: WireframeParseFeedbackItem[];
}
export interface WireframeParseFeedbackRequest {
  provider?: string;
  rawText: string;
  screens: WireframeScreenCtxPayload[];
}
export interface WireframeParseFeedbackResponse {
  general: WireframeParseFeedbackItem[];
  designSystem: WireframeParseFeedbackItem[];
  screens: WireframeParseFeedbackScreen[];
  unmatched: { screenRef?: string; items: WireframeParseFeedbackItem[] }[];
  model?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:5000');
  }

  async suggest(dto: SuggestDto): Promise<SuggestResponse> {
    try {
      const { data } = await axios.post<SuggestResponse>(
        `${this.aiServiceUrl}/suggest`,
        {
          section: dto.section,
          field: dto.field,
          context: dto.context ?? '',
        },
        { timeout: 30_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          `AI service returned ${error.response.status}: ${JSON.stringify(error.response.data)}`,
        );
        throw new HttpException(
          error.response.data?.detail ?? 'AI service error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy to Python /parse endpoint */
  async parse(dto: ParseDto): Promise<ParseResponse> {
    try {
      const { data } = await axios.post<ParseResponse>(
        `${this.aiServiceUrl}/parse`,
        { text: dto.text, mode: dto.mode ?? 'all_in_one' },
        { timeout: 180_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /parse returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'AI parse error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /parse', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy to Python /gap-check endpoint */
  async gapCheck(dto: GapCheckDto): Promise<GapCheckResponse> {
    try {
      const { data } = await axios.post<GapCheckResponse>(
        `${this.aiServiceUrl}/gap-check`,
        { sections: dto.sections, answers: dto.answers ?? '' },
        { timeout: 180_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /gap-check returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'AI gap-check error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /gap-check', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy to Python /ba/refine-section endpoint — refine BA artifact section text */
  async refineBaSection(dto: BaRefineSectionRequest): Promise<BaRefineSectionResponse> {
    try {
      const { data } = await axios.post<BaRefineSectionResponse>(
        `${this.aiServiceUrl}/ba/refine-section`,
        {
          artifactType: dto.artifactType,
          sectionLabel: dto.sectionLabel,
          currentText: dto.currentText,
          moduleContext: dto.moduleContext ?? '',
          instruction: dto.instruction ?? '',
        },
        { timeout: 60_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /ba/refine-section returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'AI refine error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /ba/refine-section', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /**
   * Proxy to Python /wft-generate endpoint — produce a 7-section Well-formed
   * Text artefact from one or more concatenated raw transcripts. Per skill 01.
   */
  async generateWft(req: GenerateWftRequest): Promise<GenerateWftResponse> {
    try {
      const { data } = await axios.post<GenerateWftResponse>(
        `${this.aiServiceUrl}/wft-generate`,
        {
          rawTranscript: req.rawTranscript,
          domainContext: req.domainContext ?? '',
          languageHint: req.languageHint ?? 'auto',
        },
        { timeout: 120_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /wft-generate returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'WFT generation error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /wft-generate', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /**
   * Proxy to Python /brd-generate endpoint — produce a 15-section BRD from
   * a Well-formed Text artefact. Per skill 02.
   */
  async generateBrd(req: GenerateBrdRequest): Promise<GenerateBrdResponse> {
    try {
      const { data } = await axios.post<GenerateBrdResponse>(
        `${this.aiServiceUrl}/brd-generate`,
        {
          wftParaphrased: req.wftParaphrased,
          wftConcepts: req.wftConcepts,
          wftActionItems: req.wftActionItems,
          wftOpenQuestions: req.wftOpenQuestions,
          productName: req.productName ?? '',
          audience: req.audience ?? '',
        },
        { timeout: 180_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /brd-generate returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'BRD generation error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /brd-generate', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /**
   * Proxy to Python /an-generate endpoint — produce an 11-section Approach
   * Note from a BRD plus structured brandTokens / decisionsLocked / openQuestions.
   * Per skill 03.
   */
  async generateApproachNote(
    req: GenerateApproachNoteRequest,
  ): Promise<GenerateApproachNoteResponse> {
    try {
      const { data } = await axios.post<GenerateApproachNoteResponse>(
        `${this.aiServiceUrl}/an-generate`,
        {
          brdSections: req.brdSections,
          brdFrTable: req.brdFrTable,
          brdOpenItems: req.brdOpenItems,
          productName: req.productName ?? '',
          audience: req.audience ?? '',
          changesRequested: req.changesRequested ?? '',
        },
        { timeout: 300_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /an-generate returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'Approach Note generation error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /an-generate', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /**
   * Proxy to Python /wireframes-generate — produce a complete lo-fi wireframe
   * set from an Approach Note (skill 04). Returns 7-14 screens with markdown
   * bodies + HTML rendering + structured callouts + components inventory.
   */
  async generateWireframes(req: GenerateWireframesRequest): Promise<GenerateWireframesResponse> {
    try {
      const { data } = await axios.post<GenerateWireframesResponse>(
        `${this.aiServiceUrl}/wireframes-generate`,
        {
          anSections: req.anSections,
          frTable: req.frTable,
          brandTokens: req.brandTokens,
          selectedPatterns: req.selectedPatterns ?? [],
          productName: req.productName ?? '',
        },
        { timeout: 360_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /wireframes-generate returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'Wireframe generation error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /wireframes-generate', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /**
   * Proxy to Python /hifi-generate — polish lo-fi wireframes into branded
   * hi-fi HTML mockups (skill 05). Callout numbers preserved 1:1 from the
   * lo-fi parent; the NestJS hifi.service runs a deterministic parity
   * validator after this returns.
   */
  async generateHifi(req: GenerateHifiRequest): Promise<GenerateHifiResponse> {
    try {
      const { data } = await axios.post<GenerateHifiResponse>(
        `${this.aiServiceUrl}/hifi-generate`,
        {
          lofiScreens: req.lofiScreens,
          brandTokens: req.brandTokens,
          syntheticSeed: req.syntheticSeed ?? {},
          productName: req.productName ?? '',
          fidelity: req.fidelity ?? 'hifi',
        },
        { timeout: 480_000 },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /hifi-generate returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'Hi-fi generation error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /hifi-generate', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /**
   * Proxy to Python /extract-brand-tokens — uses Vision to derive a 3-color
   * palette + product name from a reference image (website screenshot, brand
   * guide page, logo). Used by the AN §3.10 brand-tokens editor.
   */
  async extractBrandTokens(file: Express.Multer.File): Promise<ExtractBrandTokensResponse> {
    const form = new FormData();
    form.append('image', file.buffer, {
      filename: file.originalname || 'reference.png',
      contentType: file.mimetype || 'image/png',
    });

    try {
      const { data } = await axios.post<ExtractBrandTokensResponse>(
        `${this.aiServiceUrl}/extract-brand-tokens`,
        form,
        {
          timeout: 60_000,
          headers: form.getHeaders(),
        },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /extract-brand-tokens returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'Brand extraction error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /extract-brand-tokens', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  /** Proxy audio to Python /transcribe endpoint */
  async transcribe(file: Express.Multer.File): Promise<TranscribeResponse> {
    const form = new FormData();
    form.append('audio', file.buffer, {
      filename: file.originalname || 'audio.webm',
      contentType: file.mimetype || 'audio/webm',
    });

    try {
      const { data } = await axios.post<TranscribeResponse>(
        `${this.aiServiceUrl}/transcribe`,
        form,
        {
          timeout: 30_000,
          headers: form.getHeaders(),
        },
      );
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI /transcribe returned ${error.response.status}`);
        throw new HttpException(
          error.response.data?.detail ?? 'Transcription error',
          error.response.status,
        );
      }
      this.logger.error('AI service unreachable for /transcribe', error);
      throw new HttpException('AI service unavailable', 502);
    }
  }

  // ── v12 · Track WC — Wireframe Copilot ────────────────────────────────────────
  async wireframeChat(req: WireframeChatRequest): Promise<WireframeChatResponse> {
    return this.postAi<WireframeChatResponse>('/wireframe-chat', req, 120_000, 'Wireframe chat error');
  }

  async wireframeExtractChanges(req: WireframeExtractRequest): Promise<WireframeExtractResponse> {
    return this.postAi<WireframeExtractResponse>('/wireframe-extract-changes', req, 120_000, 'Wireframe change extraction error');
  }

  async wireframeEditScreen(req: WireframeEditRequest): Promise<WireframeEditResponse> {
    return this.postAi<WireframeEditResponse>('/wireframe-edit-screen', req, 300_000, 'Wireframe edit error');
  }

  async wireframeParseFeedback(req: WireframeParseFeedbackRequest): Promise<WireframeParseFeedbackResponse> {
    return this.postAi<WireframeParseFeedbackResponse>('/wireframe-parse-feedback', req, 180_000, 'Wireframe feedback parse error');
  }

  /** Shared POST → ai-service with the standard axios→HttpException error mapping. */
  private async postAi<T>(path: string, body: unknown, timeout: number, errLabel: string): Promise<T> {
    try {
      const { data } = await axios.post<T>(`${this.aiServiceUrl}${path}`, body, { timeout });
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`AI ${path} returned ${error.response.status}`);
        throw new HttpException(
          (error.response.data as { detail?: string })?.detail ?? errLabel,
          error.response.status,
        );
      }
      this.logger.error(`AI service unreachable for ${path}`, error);
      throw new HttpException('AI service unavailable', 502);
    }
  }
}
