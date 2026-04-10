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
    const parsed = this.parseMarkdown(rawMarkdown);
    this.logger.log(`Parsed ${parsed.length} SubTasks from SKILL-05 output`);

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
   */
  parseMarkdown(rawMarkdown: string): ParsedSubTask[] {
    const results: ParsedSubTask[] = [];

    // Split by SubTask boundaries: ## ST- or ## SubTask: ST-
    const chunks = rawMarkdown.split(/(?=^## (?:SubTask:\s*)?ST-)/m);

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;

      // Extract SubTask ID from heading
      const headingMatch = chunk.match(/^## (?:SubTask:\s*)?(ST-[A-Za-z0-9-]+)/m);
      if (!headingMatch) continue;

      const subtaskId = headingMatch[1];
      const team = this.extractTeam(subtaskId);

      // Parse header block
      const header = this.parseHeader(chunk);

      // Parse sections
      const sections = this.parseSections(chunk);

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
        userStoryId: header.userStoryId,
        epicId: header.epicId,
        featureId: header.featureId,
        moduleId: header.moduleId,
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
