import { Injectable, NotFoundException } from '@nestjs/common';
import { PrdStatus, SectionStatus, ChangeType, ChangeSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrdDto } from './dto/create-prd.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

/** Labels for all 22 PRD sections — used when initialising a new PRD */
const SECTION_NAMES: Record<number, string> = {
  1: 'Overview / Objective',
  2: 'High-Level Scope',
  3: 'Out of Scope',
  4: 'Assumptions and Constraints',
  5: 'Actors / User Types',
  6: 'Functional Requirements',
  7: 'Integration Requirements',
  8: 'Customer Journeys / Flows',
  9: 'Functional Landscape',
  10: 'Non-Functional Requirements',
  11: 'Technology',
  12: 'DevOps and Observability',
  13: 'UI/UX Requirements',
  14: 'Branding Requirements',
  15: 'Compliance Requirements',
  16: 'Testing Requirements',
  17: 'Key Deliverables',
  18: 'Receivables',
  19: 'Environment',
  20: 'High-Level Timelines',
  21: 'Success Criteria',
  22: 'Miscellaneous Requirements',
};

@Injectable()
export class PrdService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new PRD and initialise all 22 sections as NOT_STARTED */
  async create(dto: CreatePrdDto) {
    const prd = await this.prisma.prd.create({
      data: {
        prdCode: dto.prdCode,
        productName: dto.productName,
        version: dto.version ?? '1.0',
        author: dto.author,
        clientName: dto.clientName,
        submittedBy: dto.submittedBy,
        sourceText: dto.sourceText,
        sourceFileName: dto.sourceFileName,
        sourceFileData: dto.sourceFileData,
        status: PrdStatus.DRAFT,
        sections: {
          create: Array.from({ length: 22 }, (_, i) => ({
            sectionNumber: i + 1,
            sectionName: SECTION_NAMES[i + 1],
            status: SectionStatus.NOT_STARTED,
            content: {},
          })),
        },
      },
      include: { sections: { orderBy: { sectionNumber: 'asc' } } },
    });

    // Write initial audit entry
    await this.prisma.prdAuditLog.create({
      data: {
        prdId: prd.id,
        sectionNumber: 0,
        fieldKey: '_prd',
        changeType: ChangeType.CREATED,
        source: ChangeSource.MANUAL,
        previousValue: null,
        newValue: `PRD created: ${dto.prdCode} — ${dto.productName}`,
        version: '1.0',
      },
    });

    return prd;
  }

  /** List all PRDs (summary — no section content) */
  async findAll() {
    return this.prisma.prd.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sections: {
          select: { sectionNumber: true, sectionName: true, status: true },
          orderBy: { sectionNumber: 'asc' },
        },
      },
    });
  }

  /** Fetch a single PRD with all section content */
  async findOne(id: string) {
    const prd = await this.prisma.prd.findUnique({
      where: { id },
      include: { sections: { orderBy: { sectionNumber: 'asc' } } },
    });
    if (!prd) throw new NotFoundException(`PRD ${id} not found`);
    return prd;
  }

  /** Update the content of a single section; auto-mark COMPLETE; write audit diff */
  async updateSection(id: string, sectionNumber: number, dto: UpdateSectionDto) {
    await this.findOne(id);

    const section = await this.prisma.prdSection.findUnique({
      where: { prdId_sectionNumber: { prdId: id, sectionNumber } },
    });
    if (!section) throw new NotFoundException(`Section ${sectionNumber} not found for PRD ${id}`);

    const oldContent = (section.content ?? {}) as Record<string, unknown>;
    const newContent = dto.content;
    const isAi = dto.aiSuggested ?? false;

    // Compute next version number
    const lastLog = await this.prisma.prdAuditLog.findFirst({
      where: { prdId: id },
      orderBy: { createdAt: 'desc' },
    });
    const lastVersion = lastLog?.version ?? '1.0';
    const [major, minor] = lastVersion.split('.').map(Number);
    const nextVersion = `${major}.${minor + 1}`;

    // Diff old vs new content and collect audit entries
    const auditEntries = this.diffContent(
      id,
      sectionNumber,
      oldContent,
      newContent,
      isAi,
      nextVersion,
    );

    // Persist the section update
    const hasContent = Object.keys(newContent).length > 0;
    const newStatus: SectionStatus = hasContent
      ? SectionStatus.COMPLETE
      : SectionStatus.IN_PROGRESS;

    const updated = await this.prisma.prdSection.update({
      where: { prdId_sectionNumber: { prdId: id, sectionNumber } },
      data: {
        content: newContent as object,
        aiSuggested: isAi,
        status: newStatus,
        completedAt: newStatus === SectionStatus.COMPLETE ? new Date() : null,
      },
    });

    // Write audit entries
    if (auditEntries.length > 0) {
      await this.prisma.prdAuditLog.createMany({ data: auditEntries });
    }

    return updated;
  }

  /** Diff two content objects and return audit log entries */
  private diffContent(
    prdId: string,
    sectionNumber: number,
    oldContent: Record<string, unknown>,
    newContent: Record<string, unknown>,
    isAi: boolean,
    version: string,
  ) {
    const entries: {
      prdId: string;
      sectionNumber: number;
      fieldKey: string;
      changeType: ChangeType;
      source: ChangeSource;
      previousValue: string | null;
      newValue: string | null;
      version: string;
    }[] = [];

    const source = isAi ? ChangeSource.AI : ChangeSource.MANUAL;
    const allKeys = new Set([...Object.keys(oldContent), ...Object.keys(newContent)]);

    for (const key of allKeys) {
      const oldVal = this.stringify(oldContent[key]);
      const newVal = this.stringify(newContent[key]);

      if (oldVal === newVal) continue; // No change

      // Determine change type
      let changeType: ChangeType;
      if (oldVal === '' && newVal !== '') {
        changeType = isAi ? ChangeType.AI_GENERATED : ChangeType.CREATED;
      } else {
        changeType = isAi ? ChangeType.AI_MODIFIED : ChangeType.MODIFIED;
      }

      entries.push({
        prdId,
        sectionNumber,
        fieldKey: key,
        changeType,
        source,
        previousValue: oldVal || null,
        newValue: newVal || null,
        version,
      });
    }

    return entries;
  }

  private stringify(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  }

  /** Get audit history for a PRD */
  async getHistory(id: string) {
    await this.findOne(id); // 404 check
    return this.prisma.prdAuditLog.findMany({
      where: { prdId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Return completion status for every section in a PRD */
  async getCompletion(id: string) {
    const prd = await this.prisma.prd.findUnique({
      where: { id },
      include: {
        sections: {
          select: { sectionNumber: true, sectionName: true, status: true, completedAt: true },
          orderBy: { sectionNumber: 'asc' },
        },
      },
    });
    if (!prd) throw new NotFoundException(`PRD ${id} not found`);

    const total = prd.sections.length;
    const completed = prd.sections.filter((s) => s.status === SectionStatus.COMPLETE).length;

    return {
      prdId: id,
      productName: prd.productName,
      totalSections: total,
      completedSections: completed,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
      sections: prd.sections,
    };
  }

  /** Get original source text/file for a PRD */
  async getSource(id: string) {
    const prd = await this.prisma.prd.findUnique({
      where: { id },
      select: {
        sourceText: true,
        sourceFileName: true,
        sourceFileData: true,
        createdAt: true,
      },
    });
    if (!prd) throw new NotFoundException(`PRD ${id} not found`);
    return prd;
  }

  /** Update PRD-level metadata (clientName, submittedBy, clientLogo) */
  async updateMeta(
    id: string,
    data: { clientName?: string; submittedBy?: string; clientLogo?: string },
  ) {
    await this.findOne(id);
    return this.prisma.prd.update({
      where: { id },
      data,
      include: { sections: { orderBy: { sectionNumber: 'asc' } } },
    });
  }

  /** Delete a PRD and all its sections + audit logs (cascade) */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.prd.delete({ where: { id } });
  }
}
