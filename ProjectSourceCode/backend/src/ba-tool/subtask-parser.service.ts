import { Injectable, Logger } from '@nestjs/common';
import { SubTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Maps section number to key and label */
const SECTION_MAP: Record<number, { key: string; label: string }> = {
  1: { key: 'subtask_id', label: 'SubTask ID' },
  2: { key: 'subtask_name', label: 'SubTask Name' },
  3: { key: 'subtask_type', label: 'SubTask Type' },
  4: { key: 'description', label: 'Description' },
  5: { key: 'prerequisites', label: 'Pre-requisites' },
  6: { key: 'source_file_name', label: 'Source File Name' },
  7: { key: 'class_name', label: 'Class Name' },
  8: { key: 'class_description', label: 'Class Description' },
  9: { key: 'method_name', label: 'Method Name' },
  10: { key: 'method_description', label: 'Method Description' },
  11: { key: 'arguments', label: 'Arguments' },
  12: { key: 'return_type', label: 'Return Type' },
  13: { key: 'validations', label: 'Validations' },
  14: { key: 'algorithm', label: 'Algorithm' },
  15: { key: 'integration_points', label: 'Integration Points' },
  16: { key: 'error_handling', label: 'Error Handling' },
  17: { key: 'database_operations', label: 'Database Operations' },
  18: { key: 'technical_notes', label: 'Technical Notes' },
  19: { key: 'traceability_header', label: 'Traceability Header' },
  20: { key: 'project_structure', label: 'Project Structure Definition' },
  21: { key: 'sequence_diagram', label: 'Sequence Diagram Inputs' },
  22: { key: 'end_to_end_flow', label: 'End-to-End Integration Flow / Test Case IDs' },
  23: { key: 'acceptance_criteria', label: 'Acceptance Criteria' },
  24: { key: 'testing_notes', label: 'Testing Notes' },
};

interface ParsedSubTask {
  subtaskId: string;
  subtaskName: string;
  subtaskType: string;
  team: string;
  userStoryId: string;
  epicId: string;
  featureId: string;
  moduleId: string;
  packageName: string;
  assignedTo: string;
  estimatedEffort: string;
  prerequisites: string[];
  tbdFutureRefs: string[];
  sourceFileName: string;
  className: string;
  methodName: string;
  priority: string;
  sections: { sectionNumber: number; sectionKey: string; sectionLabel: string; content: string }[];
}

@Injectable()
export class SubTaskParserService {
  private readonly logger = new Logger(SubTaskParserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse raw SKILL-05 markdown output into structured BaSubTask + BaSubTaskSection records.
   * Returns array of created SubTask database IDs.
   */
  async parseAndStore(
    rawMarkdown: string,
    moduleDbId: string,
    artifactDbId: string | null,
  ): Promise<string[]> {
    // Build a feature-name → feature-id catalog from the module's RTM rows
    // so parseMarkdown can resolve per-story group headings whose third
    // tuple slot carries a feature *name* like "Signup (Firm Plan)" instead
    // of a feature *id* like "F-05-04". Without this fallback, ~20% of MOD-05
    // subtasks ended up with featureId=NULL because the LLM emitted names.
    // Module-scoped (not project-scoped) so cross-module name collisions
    // (e.g. "Login" appearing in two modules) resolve to the right feature.
    const featureCatalog = await this.buildFeatureCatalog(moduleDbId);
    const parsed = this.parseMarkdown(rawMarkdown, featureCatalog);
    this.logger.log(
      `Parsed ${parsed.length} SubTasks from SKILL-05 output (feature catalog: ${featureCatalog.size} entries)`,
    );

    const createdIds: string[] = [];

    for (const st of parsed) {
      try {
        // Upsert — skip if already exists
        const existing = await this.prisma.baSubTask.findUnique({
          where: { moduleDbId_subtaskId: { moduleDbId, subtaskId: st.subtaskId } },
        });
        if (existing) {
          this.logger.log(`SubTask ${st.subtaskId} already exists, skipping`);
          createdIds.push(existing.id);
          continue;
        }

        const record = await this.prisma.baSubTask.create({
          data: {
            moduleDbId,
            artifactDbId,
            subtaskId: st.subtaskId,
            subtaskName: st.subtaskName,
            subtaskType: st.subtaskType || null,
            team: st.team || null,
            userStoryId: st.userStoryId || null,
            epicId: st.epicId || null,
            featureId: st.featureId || null,
            moduleId: st.moduleId || null,
            packageName: st.packageName || null,
            assignedTo: st.assignedTo || null,
            estimatedEffort: st.estimatedEffort || null,
            prerequisites: st.prerequisites,
            status: SubTaskStatus.DRAFT,
            priority: st.priority || null,
            tbdFutureRefs: st.tbdFutureRefs,
            sourceFileName: st.sourceFileName || null,
            className: st.className || null,
            methodName: st.methodName || null,
            sections: {
              create: st.sections.map((s) => ({
                sectionNumber: s.sectionNumber,
                sectionKey: s.sectionKey,
                sectionLabel: s.sectionLabel,
                aiContent: s.content,
              })),
            },
          },
        });

        createdIds.push(record.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Failed to store SubTask ${st.subtaskId}: ${msg}`);
      }
    }

    this.logger.log(`Stored ${createdIds.length} SubTasks for module ${moduleDbId}`);
    return createdIds;
  }

  /**
   * Parse raw markdown into structured SubTask objects (no DB writes).
   *
   * Cross-referencing strategy for the userStoryId / featureId / moduleId
   * fields uses three sources, in priority order:
   *
   *  1. The subtask's own header block — `User Story ID:`, `Feature ID:`,
   *     `Module ID:` lines extracted by parseHeader. Used by SKILL-05 outputs
   *     that emit explicit metadata above each subtask body (MOD-04 shape).
   *
   *  2. Per-story group heading — `## SubTask Decomposition for US-NNN —
   *     <title> (<status>, <module>, <feature>)`. The third tuple slot
   *     usually contains the Feature ID (e.g. `F-05-08`); the second is
   *     the module (`MOD-05`). Used as fallback when (1) is empty — which
   *     is the case for SKILL-05 outputs that put traceability inside a
   *     `* Feature: ...` comment block (the `Feature:` token doesn't match
   *     parseHeader's `Feature ID:` regex).
   *
   *  3. The subtask ID itself — `ST-USNNN-TEAM-NN` is structurally
   *     guaranteed to encode the user story id (`US-NNN`). Used as
   *     last-resort fallback for `userStoryId` so the RTM linkage cannot
   *     be silently NULL even when both metadata sources are absent.
   *
   * MOD-04 already populates path (1), so this fix is additive and does
   * not alter MOD-04's parsed output.
   *
   * The optional `featureCatalog` parameter provides a fourth fallback
   * source: a module-scoped Map<normalizedFeatureName, featureId> built
   * from BaRtmRow rows. Used when the per-story group heading carries a
   * feature *name* in the third tuple slot (e.g. `(DRAFT, MOD-05, Signup
   * (Firm Plan))`) instead of a feature *id*. Caller (parseAndStore)
   * builds and passes this map; direct callers (test scripts) may omit
   * it and the parser degrades gracefully to the prior 3-source chain.
   */
  parseMarkdown(rawMarkdown: string, featureCatalog?: Map<string, string>): ParsedSubTask[] {
    const results: ParsedSubTask[] = [];

    // First pass: scan for per-story group headings to build a US-NNN →
    // metadata map. Heading shape (from the SKILL-05 per-story prompt):
    //   ## SubTask Decomposition for US-NNN — <title> (<status>, <module>, <feature>)
    // The trailing parenthesised tuple is the source of truth for the
    // story's module and feature when the subtask body lacks them.
    const storyMeta = new Map<string, { featureId?: string; moduleId?: string; epicId?: string }>();
    const groupHeadingRe = /^## SubTask Decomposition for (US-\d{3,})[^\n]*?\(([^)\n]*)\)/gm;
    let gm: RegExpExecArray | null;
    while ((gm = groupHeadingRe.exec(rawMarkdown)) !== null) {
      const us = gm[1];
      const inside = gm[2];
      const fMatch = inside.match(/\bF-\d+-\d+\b/);
      const modMatch = inside.match(/\bMOD-\d+\b/);
      const epicMatch = inside.match(/\bEPIC-\d+(?:-\d+)?\b/);

      // If the third tuple slot carries a feature name instead of an ID,
      // try to resolve it via the catalog. Tuple is comma-separated; the
      // feature token is everything after the second comma (preserves any
      // commas inside the feature name itself, though SKILL-05 doesn't
      // typically emit those). Normalize aggressively (lowercase, strip
      // all non-alphanumerics) so "Signup (Firm Plan" matches "Signup —
      // Firm Plan" in the catalog regardless of punctuation differences.
      let featureIdResolved = fMatch?.[0];
      if (!featureIdResolved && featureCatalog && featureCatalog.size > 0) {
        const tuple = inside.split(',').map((s) => s.trim());
        if (tuple.length >= 3) {
          const featureToken = tuple.slice(2).join(',').trim();
          const key = SubTaskParserService.normalizeFeatureName(featureToken);
          if (key) {
            const hit = featureCatalog.get(key);
            if (hit) featureIdResolved = hit;
          }
        }
      }

      storyMeta.set(us, {
        featureId: featureIdResolved,
        moduleId: modMatch?.[0],
        epicId: epicMatch?.[0],
      });
    }

    // Second pass: split by SubTask boundaries (## ST- or ## SubTask: ST-)
    // and extract per-subtask records.
    const chunks = rawMarkdown.split(/(?=^## (?:SubTask:\s*)?ST-)/m);

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;

      // Extract SubTask ID from heading
      const headingMatch = chunk.match(/^## (?:SubTask:\s*)?(ST-[A-Za-z0-9-]+)/m);
      if (!headingMatch) continue;

      const subtaskId = headingMatch[1];
      const team = this.extractTeam(subtaskId);

      // Parse header block (MOD-04 shape — explicit metadata lines)
      const header = this.parseHeader(chunk);

      // Parse sections
      const sections = this.parseSections(chunk);

      // Resolve userStoryId / featureId / moduleId / epicId via the three-
      // source fallback chain: header → per-story group → subtask ID.
      let userStoryId = header.userStoryId;
      if (!userStoryId) {
        const m = subtaskId.match(/^ST-(US\d+)-/);
        if (m) userStoryId = m[1].replace(/^US/, 'US-');
      }

      const meta = userStoryId ? storyMeta.get(userStoryId) : undefined;
      const featureId = header.featureId || meta?.featureId || '';
      const moduleId = header.moduleId || meta?.moduleId || '';
      const epicId = header.epicId || meta?.epicId || '';

      // Extract key fields from sections
      const subtaskName = this.getSectionContent(sections, 2) || header.subtaskName || subtaskId;
      const subtaskType = this.getSectionContent(sections, 3) || '';
      const sourceFileName = this.getSectionContent(sections, 6) || '';
      const className = this.getSectionContent(sections, 7) || '';
      const methodName = this.getSectionContent(sections, 9) || '';

      // Parse prerequisites from Section 5
      const prereqContent = this.getSectionContent(sections, 5);
      const prerequisites = prereqContent
        ? prereqContent.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.startsWith('ST-'))
        : [];

      results.push({
        subtaskId,
        subtaskName,
        subtaskType,
        team,
        userStoryId,
        epicId,
        featureId,
        moduleId,
        packageName: header.packageName,
        assignedTo: header.assignedTo,
        estimatedEffort: header.estimatedEffort,
        prerequisites,
        tbdFutureRefs: header.tbdFutureRefs,
        sourceFileName,
        className,
        methodName,
        priority: header.priority,
        sections,
      });
    }

    return results;
  }

  private extractTeam(subtaskId: string): string {
    if (subtaskId.includes('-FE-')) return 'FE';
    if (subtaskId.includes('-BE-')) return 'BE';
    if (subtaskId.includes('-IN-')) return 'IN';
    if (subtaskId.includes('-QA-')) return 'QA';
    return '';
  }

  /**
   * Build a normalized feature-name → feature-id catalog from the module's
   * RTM rows. Used as the tertiary fallback in parseMarkdown when a per-
   * story group heading carries a feature *name* instead of a feature *id*.
   *
   * Rules:
   *  - Module-scoped (not project-scoped) so cross-module name collisions
   *    don't resolve to the wrong feature.
   *  - Names that normalize to the same key from multiple feature ids are
   *    treated as ambiguous and excluded entirely. The fallback then
   *    correctly returns "no match" instead of arbitrarily picking one.
   */
  private async buildFeatureCatalog(moduleDbId: string): Promise<Map<string, string>> {
    const catalog = new Map<string, string>();
    const mod = await this.prisma.baModule.findUnique({
      where: { id: moduleDbId },
      select: { moduleId: true, projectId: true },
    });
    if (!mod || !mod.projectId) return catalog;

    const rows = await this.prisma.baRtmRow.findMany({
      where: { projectId: mod.projectId, moduleId: mod.moduleId },
      select: { featureId: true, featureName: true },
    });

    // Count distinct feature-ids per normalized name to detect ambiguity.
    const idsPerKey = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!r.featureId || !r.featureName) continue;
      const key = SubTaskParserService.normalizeFeatureName(r.featureName);
      if (!key) continue;
      const set = idsPerKey.get(key) ?? new Set<string>();
      set.add(r.featureId);
      idsPerKey.set(key, set);
    }
    for (const [key, ids] of idsPerKey.entries()) {
      if (ids.size === 1) catalog.set(key, [...ids][0]);
    }
    return catalog;
  }

  /**
   * Normalize a feature name to a lookup key by lowercasing and stripping
   * every non-alphanumeric character. This makes the lookup tolerant to
   * em-dashes vs parens vs hyphens and to whitespace differences:
   *   "Signup — Firm Plan"  → "signupfirmplan"
   *   "Signup (Firm Plan)"  → "signupfirmplan"
   *   "Signup (Firm Plan"   → "signupfirmplan"   ← regex eats trailing `)` for nested parens; that's fine
   *   "Sign Up Firm Plan"   → "signupfirmplan"
   * Returns empty string if input is falsy or contains no alphanumerics.
   */
  private static normalizeFeatureName(name: string): string {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private parseHeader(chunk: string): {
    subtaskName: string; userStoryId: string; epicId: string; featureId: string;
    moduleId: string; packageName: string; assignedTo: string; estimatedEffort: string;
    tbdFutureRefs: string[]; priority: string;
  } {
    const get = (label: string): string => {
      const regex = new RegExp(`${label}[:\\s]+(.+)`, 'im');
      const match = chunk.match(regex);
      return match ? match[1].trim() : '';
    };

    const tbdRaw = get('TBD-Future Refs');
    const tbdFutureRefs = tbdRaw
      ? tbdRaw.split(/[,\s]+/).filter((s) => s.startsWith('TBD-'))
      : [];

    return {
      subtaskName: get('SubTask Name') || get('SubTask ID'),
      userStoryId: get('User Story ID'),
      epicId: get('EPIC ID'),
      featureId: get('Feature ID'),
      moduleId: get('Module ID'),
      packageName: get('Package Name'),
      assignedTo: get('Assigned To'),
      estimatedEffort: get('Estimated Effort'),
      tbdFutureRefs,
      priority: get('Priority') || '',
    };
  }

  private parseSections(chunk: string): { sectionNumber: number; sectionKey: string; sectionLabel: string; content: string }[] {
    const sections: { sectionNumber: number; sectionKey: string; sectionLabel: string; content: string }[] = [];

    // Match #### Section N — Label or #### Section N: Label
    const sectionRegex = /####\s+Section\s+(\d+)\s*[—:\-]\s*(.+)\n([\s\S]*?)(?=####\s+Section\s+\d+|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = sectionRegex.exec(chunk)) !== null) {
      const num = parseInt(match[1], 10);
      const content = match[3].trim();
      const mapping = SECTION_MAP[num];

      sections.push({
        sectionNumber: num,
        sectionKey: mapping?.key ?? `section_${num}`,
        sectionLabel: mapping?.label ?? match[2].trim(),
        content,
      });
    }

    return sections;
  }

  private getSectionContent(
    sections: { sectionNumber: number; content: string }[],
    num: number,
  ): string {
    const section = sections.find((s) => s.sectionNumber === num);
    return section?.content ?? '';
  }
}
