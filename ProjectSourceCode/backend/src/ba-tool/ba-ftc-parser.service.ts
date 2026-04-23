import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedFtcSection {
  sectionKey: string;
  sectionLabel: string;
  content: string;
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
  }> {
    const sections = this.parseSections(rawMarkdown);
    const testCases = this.parseTestCases(rawMarkdown);

    for (const s of sections) {
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

    this.logger.log(
      `FTC parser: created ${sections.length} sections + ${testCases.length} test cases for artifact ${ftcArtifactDbId}`,
    );
    return { sectionsCreated: sections.length, testCasesCreated: testCases.length };
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
      // Respect code-fence boundaries so "## " inside a ```tc block doesn't split
      if (/^```/.test(line)) {
        if (!insideTcFence && /^```tc\b/.test(line)) insideTcFence = true;
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
}
