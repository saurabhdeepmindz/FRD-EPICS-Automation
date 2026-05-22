import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
} from 'docx';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService } from '../../export/pdf.service';
import { generateBrdHtml, type BrdHtmlInput } from './templates/brd-html';

const SECTION_TITLES: Record<string, string> = {
  '1': 'Background',
  '2': 'Problem Statement',
  '3': 'Business Objectives',
  '4': 'Scope',
  '5': 'Stakeholders',
  '6': 'Functional Requirements',
  '7': 'Data Requirements',
  '8': 'Non-Functional Requirements',
  '9': 'Success Metrics',
  '10': 'Assumptions',
  '11': 'Constraints',
  '12': 'Risks & Mitigation',
  '13': 'High-Level Solution Architecture',
  '14': 'Next Steps',
  '15': 'Open Items',
};
const SECTION_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];

interface FrRow {
  id: string;
  requirement: string;
  testable: boolean;
}

@Injectable()
export class BrdExportService {
  private readonly logger = new Logger(BrdExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  private async loadBrdInput(brdId: string): Promise<BrdHtmlInput> {
    const brd = await this.prisma.baBrd.findUnique({
      where: { id: brdId },
      include: { project: true },
    });
    if (!brd) throw new NotFoundException(`BRD ${brdId} not found`);

    const sections = (brd.sections as Record<string, string> | null) ?? {};
    const frTable = (brd.frTable as FrRow[] | null) ?? [];
    const openItems = (brd.openItems as string[] | null) ?? [];
    const meta = brd.meta as BrdHtmlInput['meta'];

    return {
      brdId: brd.id,
      status: brd.status,
      createdAt: brd.createdAt.toISOString(),
      updatedAt: brd.updatedAt.toISOString(),
      sections,
      frTable,
      openItems,
      meta,
      project: {
        name: brd.project.name,
        projectCode: brd.project.projectCode,
        productName: brd.project.productName,
        clientName: brd.project.clientName,
        submittedBy: brd.project.submittedBy,
        clientLogo: brd.project.clientLogo,
      },
    };
  }

  private filename(input: BrdHtmlInput, ext: 'pdf' | 'docx' | 'html'): string {
    const stem = (input.project.productName ?? input.project.name ?? input.brdId)
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .slice(0, 60) || 'BRD';
    return `BRD-${stem}.${ext}`;
  }

  async renderHtml(brdId: string): Promise<{ html: string; filename: string }> {
    const input = await this.loadBrdInput(brdId);
    return { html: generateBrdHtml(input), filename: this.filename(input, 'html') };
  }

  async renderPdf(brdId: string): Promise<{ buffer: Buffer; filename: string }> {
    const input = await this.loadBrdInput(brdId);
    const html = generateBrdHtml(input);
    const buffer = await this.pdfService.generatePdfFromHtml(html, {
      headerLabel: 'Business Requirements Document',
    });
    return { buffer, filename: this.filename(input, 'pdf') };
  }

  async renderDocx(brdId: string): Promise<{ buffer: Buffer; filename: string }> {
    const input = await this.loadBrdInput(brdId);
    const productName = input.project.productName ?? input.project.name;

    const children: (Paragraph | Table)[] = [];

    // Cover
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: 'BUSINESS REQUIREMENTS DOCUMENT', bold: true, size: 22, color: '71717A' }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: productName, bold: true, size: 48 })],
        spacing: { after: 240 },
      }),
      this.kvParagraph('Project', `${input.project.name} · ${input.project.projectCode}`),
      ...(input.project.clientName ? [this.kvParagraph('Client', input.project.clientName)] : []),
      ...(input.project.submittedBy ? [this.kvParagraph('Submitted by', input.project.submittedBy)] : []),
      this.kvParagraph('Audience', String(input.meta?.audience ?? '—')),
      this.kvParagraph('Status', input.status),
      this.kvParagraph('Generated', this.formatDate(input.meta?.generatedAt ?? input.createdAt)),
      new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
    );

    // Sections
    for (const key of SECTION_ORDER) {
      const body = (input.sections[key] ?? '').trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: `§${key}. ${SECTION_TITLES[key]}`, bold: true })],
          spacing: { before: 240, after: 120 },
        }),
      );
      if (!body) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '— empty —', italics: true, color: '71717A' })],
          }),
        );
      } else {
        // Render markdown body as a series of paragraphs.
        // Tables in the body remain plain-text; the structured FR table for §6
        // and the open-items list for §15 are rendered as proper DOCX tables / lists below.
        for (const para of this.markdownToParagraphs(body)) children.push(para);
      }

      if (key === '6' && input.frTable.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Structured FR table', bold: true })],
            spacing: { before: 180, after: 80 },
          }),
        );
        children.push(this.frTable(input.frTable));
      }

      if (key === '15' && input.openItems.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Open items (parsed list)', bold: true })],
            spacing: { before: 180, after: 80 },
          }),
        );
        for (const item of input.openItems) {
          children.push(new Paragraph({ text: `• ${item}` }));
        }
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    const buffer = await Packer.toBuffer(doc);
    return { buffer, filename: this.filename(input, 'docx') };
  }

  private kvParagraph(key: string, value: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({ text: `${key}:  `, bold: true, color: '71717A' }),
        new TextRun({ text: value }),
      ],
      spacing: { after: 60 },
    });
  }

  private formatDate(d: string | Date | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** Minimal markdown → DOCX paragraph splitter — preserves bullets / numbered / plain text. */
  private markdownToParagraphs(md: string): Paragraph[] {
    const lines = md.split(/\r?\n/);
    const paragraphs: Paragraph[] = [];
    let buffer: string[] = [];

    const flushParagraph = () => {
      const text = buffer.join(' ').trim();
      if (text) paragraphs.push(new Paragraph({ text }));
      buffer = [];
    };

    for (const raw of lines) {
      const line = raw.trim();

      if (!line) {
        flushParagraph();
        continue;
      }

      // Skip the AI-generated H2 markdown headers (we already emit one per section)
      if (/^##\s+§?\d+\.?\s/.test(line)) continue;
      if (/^#{1,6}\s+/.test(line)) {
        flushParagraph();
        const stripped = line.replace(/^#{1,6}\s+/, '');
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: stripped, bold: true })],
            spacing: { before: 120, after: 60 },
          }),
        );
        continue;
      }

      // Bullets
      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        paragraphs.push(new Paragraph({ text: `• ${line.replace(/^[-*]\s+/, '')}` }));
        continue;
      }

      // Numbered list
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        flushParagraph();
        paragraphs.push(new Paragraph({ text: `${numMatch[1]}. ${numMatch[2]}` }));
        continue;
      }

      // Pipe table row — convert into "| col | col |" plain text
      if (/^\|.*\|$/.test(line)) {
        flushParagraph();
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line, font: 'Consolas', size: 18 })],
          }),
        );
        continue;
      }

      // Code fence — accumulate as monospace
      if (/^```/.test(line)) {
        flushParagraph();
        continue;
      }

      buffer.push(line);
    }
    flushParagraph();
    return paragraphs;
  }

  private frTable(rows: FrRow[]): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        this.tcell('ID', { bold: true, shaded: true, width: 12 }),
        this.tcell('Requirement', { bold: true, shaded: true, width: 70 }),
        this.tcell('Quality', { bold: true, shaded: true, width: 18 }),
      ],
    });

    const dataRows = rows.map(
      (r) =>
        new TableRow({
          children: [
            this.tcell(r.id, { width: 12 }),
            this.tcell(r.requirement, { width: 70 }),
            this.tcell(r.testable ? '✓ testable' : '⚠ review', { width: 18 }),
          ],
        }),
    );

    return new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
  }

  private tcell(
    text: string,
    opts: { bold?: boolean; shaded?: boolean; width?: number } = {},
  ): TableCell {
    return new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.shaded ? { fill: 'F4F4F5' } : undefined,
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: opts.bold ?? false })],
        }),
      ],
    });
  }
}
