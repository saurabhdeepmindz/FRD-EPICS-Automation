import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedFtcSection {
  sectionKey: string;
  sectionLabel: string;
  content: string;
}

interface ParsedAcCoverage {
  acSource: string;       // US-001 AC#3
  acSourceType: 'EPIC' | 'USER_STORY' | 'SUBTASK' | 'FEATURE';
  acText: string;
  coveringTcRefs: string[];
  status: 'COVERED' | 'PARTIAL' | 'UNCOVERED';
  rationale: string | null;
}

interface ParsedTestCase {
  testCaseId: string;
  title: string;
  parent: string | null;
  scope: 'black_box' | 'white_box';
  testKind: 'positive' | 'negative' | 'edge';
  category: string | null;
  priority: string | null;
  owaspCategory: string | null;
  isIntegrationTest: boolean;
  sprintId: string | null;
  executionStatus: string;
  scenarioGroup: string | null;
  linkedFeatureIds: string[];
  linkedEpicIds: string[];
  linkedStoryIds: string[];
  linkedSubtaskIds: string[];
  linkedPseudoFileIds: string[];
  linkedLldArtifactId: string | null;
  tags: string[];
  supportingDocs: string[];
  defectIds: string[];
  testData: string | null;
  e2eFlow: string | null;
  preconditions: string | null;
  steps: string;
  expected: string;
  postValidation: string | null;
  sqlSetup: string | null;
  sqlVerify: string | null;
  playwrightHint: string | null;
  developerHints: string | null;
  /** Raw markdown of the whole TC block (without the ```tc fence wrapper) — stored as aiContent. */
  raw: string;
}

/**
 * Parse the SKILL-07-FTC output into structured records:
 *   - ~15 `BaArtifactSection` rows (one per FTC canonical section)
 *   - N   `BaTestCase` rows (one per `` ```tc ... ``` `` fenced block in the Test Case Appendix)
 *
 * Tolerant parser: drift in section headings is folded; TC blocks missing
 * mandatory fields are skipped with a warning.
 */
@Injectable()
export class BaFtcParserService {
  private readonly logger = new Logger(BaFtcParserService.name);

  private readonly CANONICAL_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'summary', label: 'Summary' },
    { key: 'test_strategy', label: 'Test Strategy' },
    { key: 'test_environment', label: 'Test Environment & Dependencies' },
    { key: 'master_data_setup', label: 'Master Data Setup' },
    { key: 'test_cases_index', label: 'Test Cases Index' },
    { key: 'functional_test_cases', label: 'Functional Test Cases' },
    { key: 'integration_test_cases', label: 'Integration Test Cases' },
    { key: 'white_box_test_cases', label: 'White-Box Test Cases' },
    { key: 'owasp_web_coverage', label: 'OWASP Web Top 10 Coverage Matrix' },
    { key: 'owasp_llm_coverage', label: 'OWASP LLM Top 10 Coverage Matrix' },
    { key: 'data_cleanup', label: 'Data Cleanup / Teardown' },
    { key: 'playwright_readiness', label: 'Playwright Automation Readiness' },
    { key: 'ac_coverage_verification', label: 'AC Coverage Verification' },
    { key: 'traceability_summary', label: 'Traceability Summary' },
    { key: 'open_questions_tbd', label: 'Open Questions / TBD-Future Reconciliation' },
    { key: 'applied_defaults', label: 'Applied Best-Practice Defaults' },
    { key: 'test_case_appendix', label: 'Test Case Appendix' },
  ];

  private readonly OWASP_WEB = new Set(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']);
  private readonly OWASP_LLM = new Set([
    'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  async parseAndStore(rawMarkdown: string, ftcArtifactDbId: string): Promise<{
    sectionsCreated: number;
    testCasesCreated: number;
    acCoverageCreated: number;
  }> {
    const sections = this.parseSections(rawMarkdown);
    const testCases = this.parseTestCases(rawMarkdown);
    const acCoverage = this.parseAcCoverage(rawMarkdown);

    // Section storage is idempotent per (artifactId, sectionKey):
    //   - test_case_appendix: APPEND new content to existing row (per-feature
    //     mode 2 calls each emit one appendix; we want a single consolidated
    //     section, not 9 duplicates).
    //   - All other keys (narrative + Test Cases Index + Functional /
    //     Integration / White-Box test case body sections): first-wins.
    //     Subsequent calls log a warning rather than overwrite or duplicate.
    const APPEND_KEYS = new Set(['test_case_appendix']);
    for (const s of sections) {
      const existing = await this.prisma.baArtifactSection.findFirst({
        where: { artifactId: ftcArtifactDbId, sectionKey: s.sectionKey },
        select: { id: true, content: true, isHumanModified: true },
      });
      if (existing) {
        if (APPEND_KEYS.has(s.sectionKey)) {
          if (existing.isHumanModified) {
            this.logger.warn(
              `FTC parser: skipped append to ${s.sectionKey} — section was edited by a human`,
            );
            continue;
          }
          const merged = `${existing.content ?? ''}\n\n${s.content}`.trim();
          try {
            await this.prisma.baArtifactSection.update({
              where: { id: existing.id },
              data: { content: merged },
            });
          } catch (err) {
            this.logger.warn(
              `FTC parser: failed to append to ${s.sectionKey}: ${err instanceof Error ? err.message : 'unknown'}`,
            );
          }
        } else {
          this.logger.warn(
            `FTC parser: skipped duplicate section ${s.sectionKey} (first-wins)`,
          );
        }
        continue;
      }
      try {
        await this.prisma.baArtifactSection.create({
          data: {
            artifactId: ftcArtifactDbId,
            sectionKey: s.sectionKey,
            sectionLabel: s.sectionLabel,
            content: s.content,
            aiGenerated: true,
            isHumanModified: false,
          },
        });
      } catch (err) {
        this.logger.warn(
          `FTC parser: failed to insert section ${s.sectionKey}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    for (const tc of testCases) {
      try {
        await this.prisma.baTestCase.create({
          data: {
            artifactDbId: ftcArtifactDbId,
            testCaseId: tc.testCaseId,
            title: tc.title,
            parentTestCaseId: tc.parent,
            scope: tc.scope,
            testKind: tc.testKind,
            category: tc.category,
            priority: tc.priority,
            owaspCategory: tc.owaspCategory,
            isIntegrationTest: tc.isIntegrationTest,
            sprintId: tc.sprintId,
            executionStatus: tc.executionStatus,
            scenarioGroup: tc.scenarioGroup,
            linkedFeatureIds: tc.linkedFeatureIds,
            linkedEpicIds: tc.linkedEpicIds,
            linkedStoryIds: tc.linkedStoryIds,
            linkedSubtaskIds: tc.linkedSubtaskIds,
            linkedPseudoFileIds: tc.linkedPseudoFileIds,
            linkedLldArtifactId: tc.linkedLldArtifactId,
            tags: tc.tags,
            supportingDocs: tc.supportingDocs,
            defectIds: tc.defectIds,
            testData: tc.testData,
            e2eFlow: tc.e2eFlow,
            preconditions: tc.preconditions,
            steps: tc.steps,
            expected: tc.expected,
            postValidation: tc.postValidation,
            sqlSetup: tc.sqlSetup,
            sqlVerify: tc.sqlVerify,
            playwrightHint: tc.playwrightHint,
            developerHints: tc.developerHints,
            aiContent: tc.raw,
            isHumanModified: false,
          },
        });
      } catch (err) {
        this.logger.warn(
          `FTC parser: failed to insert TC ${tc.testCaseId}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    // ─── AC Coverage rows ───
    // Build a tc-ref → tc-db-id map so human-readable coveringTcRefs (TC-001,
    // Neg_TC-002) can be linked to actual BaTestCase.id values for queryable
    // traceability from the AC rows.
    const tcRefToDbId = new Map<string, string>();
    const createdTCs = await this.prisma.baTestCase.findMany({
      where: { artifactDbId: ftcArtifactDbId },
      select: { id: true, testCaseId: true },
    });
    for (const tc of createdTCs) tcRefToDbId.set(tc.testCaseId, tc.id);

    for (const ac of acCoverage) {
      const tcIds = ac.coveringTcRefs
        .map((ref) => tcRefToDbId.get(ref))
        .filter((x): x is string => !!x);
      try {
        await this.prisma.baAcCoverage.create({
          data: {
            artifactDbId: ftcArtifactDbId,
            acSource: ac.acSource,
            acSourceType: ac.acSourceType,
            acText: ac.acText,
            coveringTcIds: tcIds,
            coveringTcRefs: ac.coveringTcRefs,
            status: ac.status,
            rationale: ac.rationale,
            source: 'AI_SKILL',
          },
        });
      } catch (err) {
        this.logger.warn(
          `FTC parser: failed to insert AC ${ac.acSource}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    this.logger.log(
      `FTC parser: created ${sections.length} sections + ${testCases.length} test cases + ${acCoverage.length} AC rows for artifact ${ftcArtifactDbId}`,
    );
    return {
      sectionsCreated: sections.length,
      testCasesCreated: testCases.length,
      acCoverageCreated: acCoverage.length,
    };
  }

  // ─── Deterministic structural sections (no AI) ────────────────────────
  //
  // Per-feature mode 2 only emits a `## Test Case Appendix` section per
  // call — it does not produce the canonical §5 Test Cases Index, §6
  // Functional Test Cases, §7 Integration Test Cases, §8 White-Box Test
  // Cases sections that single-shot mode 1 emits. Without those, the
  // preview TOC for a per-feature module is missing structural context
  // that mode-1 modules have.
  //
  // This method synthesizes those four sections deterministically from
  // existing BaTestCase rows — no AI call, no token spend. It is safe
  // to re-run: existing rows for these section keys are deleted first
  // and re-created with current TC content.

  /**
   * Render §5 Test Cases Index, §6 Functional Test Cases, §7 Integration
   * Test Cases, §8 White-Box Test Cases as fresh BaArtifactSection rows
   * for the given FTC artifact. Returns a count of sections written.
   *
   * Existing rows for these four keys are deleted first so the output
   * reflects current TCs (not stale post-edit content).
   */
  async renderStructuralSections(ftcArtifactDbId: string): Promise<number> {
    const tcs = await this.prisma.baTestCase.findMany({
      where: { artifactDbId: ftcArtifactDbId },
      orderBy: [
        { linkedFeatureIds: 'asc' },
        { scenarioGroup: 'asc' },
        { testKind: 'asc' },
        { testCaseId: 'asc' },
      ],
    });
    if (tcs.length === 0) {
      this.logger.warn(
        `FTC structural-sections: no test cases for artifact ${ftcArtifactDbId} — skipping render`,
      );
      return 0;
    }

    // Wipe stale structural rows so the render is idempotent.
    const STRUCTURAL_KEYS = [
      'test_cases_index',
      'functional_test_cases',
      'integration_test_cases',
      'white_box_test_cases',
    ];
    await this.prisma.baArtifactSection.deleteMany({
      where: {
        artifactId: ftcArtifactDbId,
        sectionKey: { in: STRUCTURAL_KEYS },
        isHumanModified: false,
      },
    });

    const indexBody = this.renderTestCasesIndex(tcs);
    const functionalTcs = tcs.filter(
      (tc) => !tc.isIntegrationTest && tc.scope !== 'white_box',
    );
    const integrationTcs = tcs.filter((tc) => tc.isIntegrationTest);
    const whiteBoxTcs = tcs.filter((tc) => tc.scope === 'white_box');

    const sections: Array<{ key: string; label: string; content: string }> = [
      { key: 'test_cases_index', label: 'Test Cases Index', content: indexBody },
      {
        key: 'functional_test_cases',
        label: 'Functional Test Cases',
        content: this.renderTcBodies(functionalTcs, 'No functional test cases were generated for this module.'),
      },
      {
        key: 'integration_test_cases',
        label: 'Integration Test Cases',
        content: this.renderTcBodies(integrationTcs, 'No integration test cases were generated for this module.'),
      },
    ];
    if (whiteBoxTcs.length > 0) {
      // Only emit white-box section when LLD-linked TCs exist — matches
      // SKILL-07 §3 which says "OMIT THIS SECTION when lldContext is
      // absent" and avoids an empty section in the preview TOC.
      sections.push({
        key: 'white_box_test_cases',
        label: 'White-Box Test Cases',
        content: this.renderTcBodies(whiteBoxTcs, ''),
      });
    }

    let written = 0;
    for (const s of sections) {
      try {
        await this.prisma.baArtifactSection.create({
          data: {
            artifactId: ftcArtifactDbId,
            sectionKey: s.key,
            sectionLabel: s.label,
            content: s.content,
            aiGenerated: false,
            isHumanModified: false,
          },
        });
        written++;
      } catch (err) {
        this.logger.warn(
          `FTC structural-sections: failed to write ${s.key}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
    this.logger.log(
      `FTC structural-sections: rendered ${written} section(s) for artifact ${ftcArtifactDbId} from ${tcs.length} TCs`,
    );
    return written;
  }

  private renderTestCasesIndex(
    tcs: Array<{
      testCaseId: string;
      title: string | null;
      testKind: string;
      scenarioGroup: string | null;
      linkedFeatureIds: string[];
      linkedEpicIds: string[];
    }>,
  ): string {
    // Group by EPIC → feature → scenarioGroup, then split positive vs negative.
    type GroupBucket = { positives: typeof tcs; negatives: typeof tcs };
    type FeatureBucket = Map<string, GroupBucket>; // scenarioGroup → bucket
    type EpicBucket = Map<string, FeatureBucket>; // featureId → featureBucket
    const tree = new Map<string, EpicBucket>(); // epicId → epicBucket

    for (const tc of tcs) {
      const epic = tc.linkedEpicIds[0] ?? '(no EPIC)';
      const feature = tc.linkedFeatureIds[0] ?? '(no feature)';
      const group = tc.scenarioGroup?.trim() || 'Ungrouped';
      if (!tree.has(epic)) tree.set(epic, new Map());
      const epicBucket = tree.get(epic)!;
      if (!epicBucket.has(feature)) epicBucket.set(feature, new Map());
      const featureBucket = epicBucket.get(feature)!;
      if (!featureBucket.has(group)) featureBucket.set(group, { positives: [], negatives: [] });
      const slot = featureBucket.get(group)!;
      if (tc.testKind === 'negative') slot.negatives.push(tc);
      else slot.positives.push(tc);
    }

    const lines: string[] = [];
    for (const [epic, epicBucket] of tree) {
      lines.push(`### ${epic}`);
      lines.push('');
      for (const [feature, featureBucket] of epicBucket) {
        lines.push(`#### ${feature}`);
        lines.push('');
        for (const [group, slot] of featureBucket) {
          lines.push(`- **Scenario: ${group}**`);
          if (slot.positives.length > 0) {
            const ids = slot.positives.map((tc) => `\`${tc.testCaseId}\``).join(', ');
            lines.push(`  - Positive: ${ids}`);
          }
          if (slot.negatives.length > 0) {
            const ids = slot.negatives.map((tc) => `\`${tc.testCaseId}\``).join(', ');
            lines.push(`  - Negative: ${ids}`);
          }
        }
        lines.push('');
      }
    }
    return lines.join('\n').trim();
  }

  private renderTcBodies(
    tcs: Array<{
      testCaseId: string;
      title: string | null;
      testKind: string;
      category: string | null;
      priority: string | null;
      owaspCategory: string | null;
      scope: string;
      isIntegrationTest: boolean;
      executionStatus: string;
      parentTestCaseId: string | null;
      sprintId: string | null;
      scenarioGroup: string | null;
      aiContent: string | null;
      editedContent: string | null;
    }>,
    emptyMessage: string,
  ): string {
    if (tcs.length === 0) return emptyMessage;
    const out: string[] = [];
    for (const tc of tcs) {
      const headerAttrs = [
        `id=${tc.testCaseId}`,
        `parent=${tc.parentTestCaseId ?? ''}`,
        `scope=${tc.scope}`,
        `testKind=${tc.testKind}`,
        `category=${tc.category ?? ''}`,
        `priority=${tc.priority ?? ''}`,
        `owasp=${tc.owaspCategory ?? ''}`,
        `isIntegrationTest=${tc.isIntegrationTest}`,
        `sprintId=${tc.sprintId ?? ''}`,
        `executionStatus=${tc.executionStatus}`,
        `scenarioGroup=${tc.scenarioGroup ?? ''}`,
      ].join(' ');
      out.push(`### ${tc.testCaseId} — ${tc.title ?? '(untitled)'}`);
      out.push('');
      out.push('```tc ' + headerAttrs);
      out.push(tc.editedContent ?? tc.aiContent ?? '');
      out.push('```');
      out.push('');
    }
    return out.join('\n').trim();
  }

  // ─── Section parsing ──────────────────────────────────────────────────

  private parseSections(markdown: string): ParsedFtcSection[] {
    const lines = markdown.split('\n');
    const canonicalByKey = new Map(this.CANONICAL_SECTIONS.map((s) => [s.key, s.label]));

    type Bucket = { key: string; label: string; body: string[] };
    const buckets: Bucket[] = [];
    let current: Bucket | null = null;
    let insideTcFence = false;

    for (const line of lines) {
      // Respect code-fence boundaries so "## " inside a ```tc or ```ac block
      // doesn't split. Treat tc + ac fences identically for this purpose.
      if (/^```/.test(line)) {
        if (!insideTcFence && /^```(tc|ac)\b/.test(line)) insideTcFence = true;
        else if (insideTcFence) insideTcFence = false;
        if (current) current.body.push(line);
        continue;
      }
      if (insideTcFence) {
        if (current) current.body.push(line);
        continue;
      }

      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) {
        const heading = h2[1].replace(/^\d+[.)]\s*/, '').trim();
        const key = this.canonicalKey(heading);
        if (key) {
          current = { key, label: canonicalByKey.get(key) ?? heading, body: [] };
          buckets.push(current);
          continue;
        }
        // Non-canonical H2 → fold into the preceding section as H3
        if (current) current.body.push(`### ${heading}`);
        continue;
      }
      if (current) current.body.push(line);
    }

    return buckets.map((b) => ({
      sectionKey: b.key,
      sectionLabel: b.label,
      content: b.body.join('\n').trim(),
    }));
  }

  private canonicalKey(heading: string): string | null {
    const normalized = heading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    for (const { key, label } of this.CANONICAL_SECTIONS) {
      const labelNorm = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (normalized === key || normalized === labelNorm) return key;
      // prefix match (e.g. "summary" ≈ "summary_of_changes")
      if (normalized.startsWith(key) && key.length >= 6) return key;
    }
    return null;
  }

  // ─── Test case parsing ────────────────────────────────────────────────

  /**
   * Find every ```tc id=... ... ``` fence in the markdown and turn each into
   * a ParsedTestCase. Only blocks appearing in the Test Case Appendix are the
   * authoritative copy — duplicates from body sections are deduplicated by id
   * (first wins).
   */
  private parseTestCases(markdown: string): ParsedTestCase[] {
    const out: ParsedTestCase[] = [];
    const seen = new Set<string>();
    // Match ```tc <headerattrs>\n<body>\n```
    const fenceRegex = /```tc\s+([^\n]*)\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = fenceRegex.exec(markdown)) !== null) {
      const headerLine = m[1];
      const body = m[2];
      try {
        const parsed = this.parseOneTestCase(headerLine, body);
        if (!parsed) continue;
        if (seen.has(parsed.testCaseId)) continue;
        seen.add(parsed.testCaseId);
        out.push(parsed);
      } catch (err) {
        this.logger.warn(
          `FTC parser: dropped malformed TC block (${err instanceof Error ? err.message : 'unknown'})`,
        );
      }
    }
    return out;
  }

  private parseOneTestCase(headerLine: string, body: string): ParsedTestCase | null {
    // Header attrs: id=TC-001 parent= scope=black_box testKind=positive category=Functional
    //   priority=P1 owasp= isIntegrationTest=false sprintId= executionStatus=NOT_RUN scenarioGroup=Login
    const attrs = this.parseAttrs(headerLine);
    const testCaseId = attrs.id?.trim();
    if (!testCaseId) {
      this.logger.warn('FTC parser: TC block missing id=');
      return null;
    }

    const scopeRaw = (attrs.scope ?? 'black_box').toLowerCase();
    const scope: 'black_box' | 'white_box' = scopeRaw === 'white_box' ? 'white_box' : 'black_box';

    const testKindRaw = (attrs.testKind ?? '').toLowerCase();
    let testKind: 'positive' | 'negative' | 'edge';
    if (testKindRaw === 'negative' || testKindRaw === 'edge' || testKindRaw === 'positive') {
      testKind = testKindRaw;
    } else if (/^neg_/i.test(testCaseId)) {
      // Fall back on the `Neg_` ID convention when header attr is missing
      testKind = 'negative';
    } else {
      testKind = 'positive';
    }

    const isInt = /^true$/i.test(attrs.isIntegrationTest ?? 'false');
    const owaspRaw = attrs.owasp?.trim().toUpperCase() || null;
    const owasp = owaspRaw && (this.OWASP_WEB.has(owaspRaw) || this.OWASP_LLM.has(owaspRaw))
      ? owaspRaw
      : null;

    const executionStatusRaw = (attrs.executionStatus ?? 'NOT_RUN').toUpperCase();
    const VALID_STATUS = new Set(['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED']);
    const executionStatus = VALID_STATUS.has(executionStatusRaw) ? executionStatusRaw : 'NOT_RUN';

    const firstH3 = body.search(/^###\s+/m);
    const headerBlock = firstH3 >= 0 ? body.slice(0, firstH3) : body;
    const restBlock = firstH3 >= 0 ? body.slice(firstH3) : '';

    const kv = this.parseKeyValueLines(headerBlock);
    const sections = this.splitH3Sections(restBlock);

    return {
      testCaseId,
      title: kv.title ?? '',
      parent: (attrs.parent && attrs.parent.trim()) || null,
      scope,
      testKind,
      category: attrs.category?.trim() || null,
      priority: attrs.priority?.trim() || null,
      owaspCategory: owasp,
      isIntegrationTest: isInt,
      sprintId: (attrs.sprintId && attrs.sprintId.trim()) || null,
      executionStatus,
      scenarioGroup: (attrs.scenarioGroup && attrs.scenarioGroup.trim().replace(/_/g, ' ')) || null,
      linkedFeatureIds: this.splitList(kv.linkedFeatureIds),
      linkedEpicIds: this.splitList(kv.linkedEpicIds),
      linkedStoryIds: this.splitList(kv.linkedStoryIds),
      linkedSubtaskIds: this.splitList(kv.linkedSubtaskIds),
      linkedPseudoFileIds: this.splitList(kv.linkedPseudoFileIds),
      linkedLldArtifactId: (kv.linkedLldArtifactId && kv.linkedLldArtifactId.trim()) || null,
      tags: this.splitList(kv.tags),
      supportingDocs: this.splitList(kv.supportingDocs),
      defectIds: this.splitList(kv.defectIds),
      testData: sections['test data'] ?? null,
      e2eFlow: sections['e2e flow'] ?? null,
      preconditions: sections['pre condition'] ?? sections['preconditions'] ?? null,
      steps: sections['test steps'] ?? sections['steps'] ?? '',
      expected: sections['expected'] ?? '',
      postValidation: sections['post validation'] ?? null,
      sqlSetup: sections['sql setup'] ?? null,
      sqlVerify: sections['sql verify'] ?? null,
      playwrightHint: sections['playwright hint'] ?? null,
      developerHints: sections['developer hints'] ?? null,
      raw: body.trim(),
    };
  }

  private parseAttrs(line: string): Record<string, string> {
    const out: Record<string, string> = {};
    const regex = /(\w+)=([^\s]*)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) out[m[1]] = m[2] ?? '';
    return out;
  }

  private parseKeyValueLines(block: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('###')) continue;
      const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
      if (kv) out[kv[1]] = kv[2].trim();
    }
    return out;
  }

  private splitH3Sections(block: string): Record<string, string> {
    const out: Record<string, string> = {};
    const lines = block.split('\n');
    let currentKey: string | null = null;
    let buf: string[] = [];
    const flush = () => {
      if (currentKey !== null) {
        out[currentKey] = buf.join('\n').trim();
      }
    };
    for (const line of lines) {
      const h = line.match(/^###\s+(.+?)\s*$/);
      if (h) {
        flush();
        currentKey = h[1].trim().toLowerCase();
        buf = [];
        continue;
      }
      buf.push(line);
    }
    flush();
    return out;
  }

  private splitList(raw: string | undefined | null): string[] {
    if (!raw) return [];
    return raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ─── AC Coverage parsing ──────────────────────────────────────────────

  /**
   * Extract every ```ac id=... ... ``` block from the document. The skill
   * emits these under §13 AC Coverage Verification. Each block becomes a
   * BaAcCoverage row with status COVERED / PARTIAL / UNCOVERED.
   */
  private parseAcCoverage(markdown: string): ParsedAcCoverage[] {
    const out: ParsedAcCoverage[] = [];
    const seen = new Set<string>();
    const fenceRegex = /```ac\s+([^\n]*)\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = fenceRegex.exec(markdown)) !== null) {
      try {
        const parsed = this.parseOneAc(m[1], m[2]);
        if (!parsed) continue;
        if (seen.has(parsed.acSource)) continue; // id collision — first wins
        seen.add(parsed.acSource);
        out.push(parsed);
      } catch (err) {
        this.logger.warn(
          `FTC parser: dropped malformed ac block (${err instanceof Error ? err.message : 'unknown'})`,
        );
      }
    }
    return out;
  }

  private parseOneAc(headerLine: string, body: string): ParsedAcCoverage | null {
    // Header attrs: id=US-001-AC-1 source=USER_STORY sourceRef=US-001
    //   status=COVERED coveringTcs=TC-001,Neg_TC-002
    const attrs = this.parseAttrs(headerLine);
    const id = attrs.id?.trim();
    const sourceType = (attrs.source ?? '').toUpperCase();
    const sourceRef = attrs.sourceRef?.trim();
    if (!id || !sourceRef) {
      this.logger.warn('FTC parser: AC block missing id / sourceRef');
      return null;
    }
    const VALID_TYPES = new Set(['EPIC', 'USER_STORY', 'SUBTASK', 'FEATURE']);
    const acSourceType = (VALID_TYPES.has(sourceType) ? sourceType : 'USER_STORY') as ParsedAcCoverage['acSourceType'];

    const statusRaw = (attrs.status ?? '').toUpperCase();
    const VALID_STATUS = new Set(['COVERED', 'PARTIAL', 'UNCOVERED']);
    const status = (VALID_STATUS.has(statusRaw) ? statusRaw : 'UNCOVERED') as ParsedAcCoverage['status'];

    // Body: key-value lines (text:, rationale:)
    const kv: Record<string, string> = {};
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
      if (match) kv[match[1]] = match[2].trim();
      else if (kv.rationale !== undefined) {
        // Append continuation lines to rationale (multi-line rationale).
        kv.rationale = `${kv.rationale}\n${trimmed}`;
      }
    }
    const text = kv.text ?? '';
    if (!text) {
      this.logger.warn(`FTC parser: AC ${id} missing text field`);
      return null;
    }

    return {
      acSource: id,
      acSourceType,
      acText: text,
      coveringTcRefs: this.splitList(attrs.coveringTcs),
      status,
      rationale: kv.rationale?.trim() || null,
    };
  }
}
