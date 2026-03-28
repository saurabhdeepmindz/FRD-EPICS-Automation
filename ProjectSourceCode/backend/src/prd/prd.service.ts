import { Injectable, NotFoundException } from '@nestjs/common';
import { PrdStatus, SectionStatus } from '@prisma/client';
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
    return this.prisma.prd.create({
      data: {
        prdCode: dto.prdCode,
        productName: dto.productName,
        version: dto.version ?? '1.0',
        author: dto.author,
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

  /** Update the content of a single section; auto-mark COMPLETE when content is non-empty */
  async updateSection(id: string, sectionNumber: number, dto: UpdateSectionDto) {
    // Verify PRD exists first
    await this.findOne(id);

    const section = await this.prisma.prdSection.findUnique({
      where: { prdId_sectionNumber: { prdId: id, sectionNumber } },
    });
    if (!section) throw new NotFoundException(`Section ${sectionNumber} not found for PRD ${id}`);

    const hasContent = Object.keys(dto.content).length > 0;
    const newStatus: SectionStatus = hasContent
      ? SectionStatus.COMPLETE
      : SectionStatus.IN_PROGRESS;

    return this.prisma.prdSection.update({
      where: { prdId_sectionNumber: { prdId: id, sectionNumber } },
      data: {
        content: dto.content,
        aiSuggested: dto.aiSuggested ?? false,
        status: newStatus,
        completedAt: newStatus === SectionStatus.COMPLETE ? new Date() : null,
      },
    });
  }

  /**
   * Return completion status for every section in a PRD.
   * Also computes overall % complete.
   */
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

  /** Delete a PRD and all its sections (cascade handled by Prisma schema) */
  async remove(id: string) {
    await this.findOne(id);   // 404 if not found
    return this.prisma.prd.delete({ where: { id } });
  }
}
