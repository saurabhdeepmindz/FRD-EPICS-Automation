import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AC Coverage Verifier — two entry points:
 *
 *   1. Populated at generation time by `BaFtcParserService.parseAndStore`
 *      reading the skill's §13 AC Coverage Verification section.
 *
 *   2. Re-runnable on demand via `analyze(artifactId)` — extracts ACs from
 *      upstream EPIC / User Story / SubTask artifacts for the same module,
 *      extracts TC summaries from the FTC artifact, and asks the Python AI
 *      to produce a fresh coverage map. Stored with source=POST_GEN_CHECK.
 */

interface AcInput {
  acSource: string;
  acSourceType: 'EPIC' | 'USER_STORY' | 'SUBTASK' | 'FEATURE';
  acText: string;
  sourceRef: string;
}

interface TcInput {
  testCaseId: string;
  title: string;
  category: string | null;
  scope: string;
  steps: string;
  expected: string;
  postValidation: string;
  linkedStoryIds: string[];
  linkedSubtaskIds: string[];
  linkedFeatureIds: string[];
}

interface AiCoverageResult {
  acSource: string;
  status: 'COVERED' | 'PARTIAL' | 'UNCOVERED';
  coveringTcRefs: string[];
  rationale: string;
}

@Injectable()
export class BaAcCoverageService {
  private readonly logger = new Logger(BaAcCoverageService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:5000';
  }

  async listForArtifact(ftcArtifactDbId: string) {
    const rows = await this.prisma.baAcCoverage.findMany({
      where: { artifactDbId: ftcArtifactDbId },
      orderBy: [{ acSourceType: 'asc' }, { acSource: 'asc' }],
    });
    const covered = rows.filter((r) => r.status === 'COVERED').length;
    const partial = rows.filter((r) => r.status === 'PARTIAL').length;
    const uncovered = rows.filter((r) => r.status === 'UNCOVERED').length;
    return {
      rows,
      summary: { covered, partial, uncovered, total: rows.length },
    };
  }

  /**
   * Standalone re-analysis: extract ACs from upstream artifacts + TC summaries
   * from this FTC, ask the Python AI for a coverage map, replace any existing
   * POST_GEN_CHECK rows (keeping AI_SKILL rows untouched as the original audit).
   */
  async analyze(ftcArtifactDbId: string) {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: ftcArtifactDbId },
      include: {
        module: { include: { artifacts: { include: { sections: true } } } },
        testCases: true,
      },
    });
    if (!artifact) throw new NotFoundException(`FTC artifact ${ftcArtifactDbId} not found`);
    if (artifact.artifactType !== 'FTC') {
      throw new NotFoundException(`Artifact ${ftcArtifactDbId} is not an FTC artifact`);
    }

    // SubTask ACs live in a separate table — pull them alongside artifact ACs.
    const subtasks = await this.prisma.baSubTask.findMany({
      where: { moduleDbId: artifact.moduleDbId },
      include: { sections: { where: { sectionKey: 'acceptance_criteria' } } },
    });

    const acs = [
      ...this.extractUpstreamAcs(artifact.module.artifacts),
      ...this.extractSubtaskAcs(subtasks),
    ];
    if (acs.length === 0) {
      this.logger.warn(`analyze: no upstream ACs found for artifact ${ftcArtifactDbId}`);
      return { rows: [], summary: { covered: 0, partial: 0, uncovered: 0, total: 0 }, model: null };
    }

    const tcs: TcInput[] = artifact.testCases.map((tc) => ({
      testCaseId: tc.testCaseId,
      title: tc.title,
      category: tc.category,
      scope: tc.scope,
      steps: tc.steps ?? '',
      expected: tc.expected ?? '',
      postValidation: tc.postValidation ?? '',
      linkedStoryIds: tc.linkedStoryIds,
      linkedSubtaskIds: tc.linkedSubtaskIds,
      linkedFeatureIds: tc.linkedFeatureIds,
    }));

    let aiResults: AiCoverageResult[] = [];
    let model: string | null = null;
    try {
      const { data } = await axios.post<{ results: AiCoverageResult[]; model: string; summary: Record<string, number> }>(
        `${this.aiServiceUrl}/ba/ac-coverage-check`,
        { acs, tcs },
        { timeout: 120_000 },
      );
      aiResults = data.results ?? [];
      model = data.model;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      throw new NotFoundException(`AC coverage check failed: ${msg}`);
    }

    // Replace POST_GEN_CHECK rows only. AI_SKILL rows from the original
    // generation stay as an audit trail.
    await this.prisma.baAcCoverage.deleteMany({
      where: { artifactDbId: ftcArtifactDbId, source: 'POST_GEN_CHECK' },
    });

    const tcRefToDbId = new Map(artifact.testCases.map((tc) => [tc.testCaseId, tc.id]));
    const acByRef = new Map(acs.map((ac) => [ac.acSource, ac]));

    for (const r of aiResults) {
      const ac = acByRef.get(r.acSource);
      if (!ac) continue;
      const coveringTcIds = r.coveringTcRefs
        .map((ref) => tcRefToDbId.get(ref))
        .filter((x): x is string => !!x);
      await this.prisma.baAcCoverage.create({
        data: {
          artifactDbId: ftcArtifactDbId,
          acSource: ac.acSource,
          acSourceType: ac.acSourceType,
          acText: ac.acText,
          coveringTcIds,
          coveringTcRefs: r.coveringTcRefs,
          status: r.status,
          rationale: r.rationale,
          source: 'POST_GEN_CHECK',
        },
      });
    }

    return { ...(await this.listForArtifact(ftcArtifactDbId)), model };
  }

  // ─── Upstream AC extraction ─────────────────────────────────────────────

  /**
   * Extract acceptance criteria from EPIC / User Story / SubTask artifacts.
   *
   * Deliberately EXCLUDES FRD artifacts — FRD's "Output Checklist (Definition
   * of Done)" is BA-process metadata ("RTM saved to path", "Handoff Packet
   * produced") and is not user-facing testable behaviour.
   *
   * Extraction per artifact:
   *   1. Pick a canonical sourceRef from the first embedded id in any section
   *      label (e.g. "US-001 — ...", "EPIC-01", "ST-US001-BE-03"). Fall back
   *      to the artifact's own artifactId when no embedded id is found.
   *   2. Walk each section:
   *        a. Sections labeled "Acceptance Criteria" → try Given/When/Then
   *           splitter first, fall back to bullet splitter.
   *        b. Sections labeled "Definition of Done" / "Done Criteria" →
   *           bullet splitter.
   *        c. Any section containing `**Given**` blocks inline → G/W/T
   *           splitter on the whole section (covers EPIC ACs embedded
   *           inside the "Section N — ..." EPIC body).
   *        d. `### Acceptance Criteria` or `#### Acceptance Criteria`
   *           sub-headings inside any section → bullets.
   */
  private extractUpstreamAcs(
    artifacts: Array<{ artifactType: string; artifactId: string; sections: Array<{ sectionLabel: string; content: string }> }>,
  ): AcInput[] {
    const acs: AcInput[] = [];
    for (const a of artifacts) {
      const sourceType = this.mapArtifactType(a.artifactType);
      if (!sourceType) continue;

      const canonicalRef = this.findFirstEmbeddedId(a.sections) ?? a.artifactId;
      let idxAc = 0;
      let idxDod = 0;

      const pushAc = (rawText: string, prefix: 'AC' | 'DOD') => {
        const cleaned = this.cleanAcText(rawText);
        if (cleaned.length < 8) return;
        const idx = prefix === 'AC' ? ++idxAc : ++idxDod;
        acs.push({
          acSource: `${canonicalRef}-${prefix}-${idx}`,
          acSourceType: sourceType,
          acText: cleaned.slice(0, 500),
          sourceRef: canonicalRef,
        });
      };

      for (const section of a.sections) {
        const label = section.sectionLabel;
        const content = section.content;
        const isAc = /acceptance criter/i.test(label);
        const isDod = /definition of done|done criteria/i.test(label);

        // (a) AC-labelled section: prefer Given/When/Then, then bullets.
        if (isAc) {
          const gwt = this.splitGivenWhenThen(content);
          if (gwt.length > 0) {
            for (const item of gwt) pushAc(item, 'AC');
          } else {
            for (const item of this.splitBullets(content)) pushAc(item, 'AC');
          }
          continue;
        }

        // (b) DoD-labelled section: bullets only.
        if (isDod) {
          for (const item of this.splitBullets(content)) pushAc(item, 'DOD');
          continue;
        }

        // (c) Section body contains Given/When/Then (EPIC body pattern).
        if (/\*\*Given\*\*/i.test(content)) {
          for (const item of this.splitGivenWhenThen(content)) pushAc(item, 'AC');
        }

        // (d) `### Acceptance Criteria` sub-heading inside a larger section.
        const subRegex = /^###{1,2}\s+Acceptance Criter[^\n]*\n([\s\S]*?)(?=^###{1,2}\s|\Z)/gim;
        let m: RegExpExecArray | null;
        while ((m = subRegex.exec(content)) !== null) {
          const gwt = this.splitGivenWhenThen(m[1]);
          if (gwt.length > 0) {
            for (const item of gwt) pushAc(item, 'AC');
          } else {
            for (const item of this.splitBullets(m[1])) pushAc(item, 'AC');
          }
        }
      }
    }
    return acs;
  }

  /**
   * Extract ACs from SubTask `acceptance_criteria` sections (stored in the
   * dedicated ba_subtask_sections table, distinct from ba_artifact_sections).
   * Each SubTask's AC section is one or more bullets or a Given/When/Then
   * block. Uses the subtask's subtaskId as canonical sourceRef so AC rows
   * align with TC.linkedSubtaskIds.
   */
  private extractSubtaskAcs(
    subtasks: Array<{ subtaskId: string; sections: Array<{ aiContent: string; editedContent: string | null }> }>,
  ): AcInput[] {
    const acs: AcInput[] = [];
    for (const st of subtasks) {
      const section = st.sections[0];
      if (!section) continue;
      const content = section.editedContent || section.aiContent || '';
      if (!content.trim()) continue;

      // Try Given/When/Then first, fall back to bullets.
      let items = this.splitGivenWhenThen(content);
      if (items.length === 0) items = this.splitBullets(content);

      items.forEach((item, idx) => {
        const cleaned = this.cleanAcText(item);
        if (cleaned.length < 8) return;
        acs.push({
          acSource: `${st.subtaskId}-AC-${idx + 1}`,
          acSourceType: 'SUBTASK',
          acText: cleaned.slice(0, 500),
          sourceRef: st.subtaskId,
        });
      });
    }
    return acs;
  }

  /**
   * Pick the first embedded story / feature / epic / subtask id from any
   * section label in an artifact. Used as the canonical sourceRef so AC rows
   * align with TC linkedStoryIds / linkedSubtaskIds / linkedFeatureIds.
   */
  private findFirstEmbeddedId(sections: Array<{ sectionLabel: string }>): string | null {
    for (const s of sections) {
      const id = this.extractIdFromLabel(s.sectionLabel);
      if (id) return id;
    }
    return null;
  }

  /** Find a structured id inside a section label. */
  private extractIdFromLabel(label: string): string | null {
    // ST-US001-BE-03, US-001, EPIC-01, F-01-06 — probe specific patterns in order.
    const patterns = [
      /\bST-US\d+-[A-Z]+-\d+\b/,
      /\bUS-\d+\b/,
      /\bEPIC-\d+\b/,
      /\bF-\d{2}-\d{2}\b/,
    ];
    for (const re of patterns) {
      const m = label.match(re);
      if (m) return m[0];
    }
    return null;
  }

  /**
   * Split a Given/When/Then block into individual ACs. Each AC starts at a
   * `**Given**` marker and runs until the next `**Given**` (or end of input).
   * Horizontal rules (`---`) between blocks are stripped.
   */
  private splitGivenWhenThen(content: string): string[] {
    const acs: string[] = [];
    const parts = content.split(/(?=\*\*Given\*\*)/i);
    for (const part of parts) {
      if (!/\*\*Given\*\*/i.test(part)) continue;
      const cleaned = part
        .replace(/^---\s*$/gm, '')
        .replace(/\*\*(Given|When|Then|And)\*\*\s*/g, '$1 ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length >= 20) acs.push(cleaned);
    }
    return acs;
  }

  private mapArtifactType(type: string): AcInput['acSourceType'] | null {
    switch (type) {
      case 'EPIC': return 'EPIC';
      case 'USER_STORY': return 'USER_STORY';
      case 'SUBTASK': return 'SUBTASK';
      // FRD DoD is BA-process metadata (saved-to paths, sign-off, RTM
      // updates) — not testable software behaviour. Do NOT include.
      default: return null;
    }
  }

  /** Split section content into individual bullets (markdown list items or numbered lines). */
  private splitBullets(content: string): string[] {
    const lines = content.split('\n');
    const bullets: string[] = [];
    let buf: string[] = [];
    const flush = () => {
      const joined = buf.join(' ').trim();
      if (joined.length >= 8) bullets.push(joined);
      buf = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      const bulletMatch = trimmed.match(/^(?:[-*+]|\d+[.)])\s+(.*)/);
      if (bulletMatch) {
        flush();
        buf.push(bulletMatch[1]);
      } else if (buf.length > 0) {
        buf.push(trimmed);
      }
    }
    flush();
    return bullets;
  }

  /** Strip markdown checkbox prefix `[x]` / `[ ]` and leading bullet chars. */
  private cleanAcText(s: string): string {
    return s
      .replace(/^[\s\-*+]*\[[ xX]\]\s*/, '')
      .replace(/^[\s\-*+]+/, '')
      .trim();
  }
}
