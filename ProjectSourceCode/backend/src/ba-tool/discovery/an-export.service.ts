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
import { generateAnHtml, type AnHtmlInput } from './templates/an-html';

const SECTION_TITLES: Record<string, string> = {
  '1': 'Executive Verdict',
  '2': 'Feature / Model Palette',
  '3': 'Requirement-by-Requirement Fit',
  '4': 'Solution Architecture',
  '5': 'Model Routing Strategy',
  '6': 'Coverage Summary',
  '7': 'Decision Inputs vs Alternatives',
  '8': 'Decisions Locked & Open Questions',
  '9': 'Phase 1 (PoC) Scope',
  '10': 'Open Items for Next Version',
  '11': 'Phase 2 Roadmap',
  '12': 'PRD-Readiness Bridge',
};
const SECTION_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

interface AnDecision { question: string; decision: string }
interface AnOpenQuestion { number: number; question: string; default: string }

export type AnEdition = 'internal' | 'client';

@Injectable()
export class AnExportService {
  private readonly logger = new Logger(AnExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  private async loadAnInput(
    versionId: string,
    edition: AnEdition,
  ): Promise<AnHtmlInput> {
    const version = await this.prisma.baApproachNoteVersion.findUnique({
      where: { id: versionId },
      include: { approachNote: { include: { project: true } } },
    });
    if (!version) throw new NotFoundException(`AN version ${versionId} not found`);

    const sections = (version.sections as Record<string, string> | null) ?? {};
    const brandTokens = version.brandTokens as AnHtmlInput['brandTokens'];
    const decisionsLocked = (version.decisionsLocked as AnDecision[] | null) ?? [];
    const openQuestions = (version.openQuestions as AnOpenQuestion[] | null) ?? [];
    const prdReadiness = (version.prdReadiness as AnHtmlInput['prdReadiness']) ?? null;
    const meta = version.meta as AnHtmlInput['meta'];

    return {
      approachNoteId: version.approachNoteId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      changesSince: version.changesSince,
      sections,
      brandTokens,
      decisionsLocked,
      openQuestions,
      prdReadiness,
      meta,
      generatedAt: version.generatedAt.toISOString(),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
      project: {
        name: version.approachNote.project.name,
        projectCode: version.approachNote.project.projectCode,
        productName: version.approachNote.project.productName,
        clientName: version.approachNote.project.clientName,
        submittedBy: version.approachNote.project.submittedBy,
        clientLogo: version.approachNote.project.clientLogo,
      },
      clientEdition: edition === 'client',
    };
  }

  private filename(input: AnHtmlInput, ext: 'pdf' | 'docx' | 'html' | 'md'): string {
    const stem = (input.brandTokens?.productName ?? input.project.productName ?? input.project.name ?? input.versionId)
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .slice(0, 60) || 'AN';
    const editionTag = input.clientEdition ? '-client' : '';
    return `Approach-Note-${stem}${editionTag}-v${input.versionNumber}.${ext}`;
  }

  async renderHtml(versionId: string, edition: AnEdition): Promise<{ html: string; filename: string }> {
    const input = await this.loadAnInput(versionId, edition);
    return { html: generateAnHtml(input), filename: this.filename(input, 'html') };
  }

  /**
   * Render the Approach Note as a single Markdown document. The 12 sections
   * are already authored in markdown by the AI, so the output is a faithful
   * concatenation with project metadata, an optional "Changes since" log
   * (internal edition only, v2+), and structured appendices for §3 brand
   * tokens, §8 decisions/open questions, and §12 PRD-readiness data when
   * those structured fields exist (mirroring the DOCX behaviour).
   */
  async renderMarkdown(
    versionId: string,
    edition: AnEdition,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const input = await this.loadAnInput(versionId, edition);
    const md = this.buildMarkdown(input);
    return {
      buffer: Buffer.from(md, 'utf-8'),
      filename: this.filename(input, 'md'),
    };
  }

  private buildMarkdown(input: AnHtmlInput): string {
    const productName =
      input.brandTokens?.productName ?? input.project.productName ?? input.project.name;
    const lines: string[] = [];

    lines.push(`# ${productName}`);
    lines.push('');
    lines.push(
      `> **Approach Note** · v${input.versionNumber}` +
        (input.clientEdition ? ' · _Client edition_' : ' · _Internal edition_'),
    );
    lines.push('>');
    lines.push(`> **Project:** ${input.project.name} · \`${input.project.projectCode}\``);
    if (input.project.clientName) lines.push(`> **Client:** ${input.project.clientName}`);
    if (input.project.submittedBy) lines.push(`> **Submitted by:** ${input.project.submittedBy}`);
    lines.push(`> **Audience:** ${String(input.meta?.audience ?? '—')}`);
    lines.push(`> **Status:** ${input.status}`);
    lines.push(
      `> **Generated:** ${this.formatDate(input.meta?.generatedAt ?? input.generatedAt)}`,
    );
    lines.push('');

    if (!input.clientEdition && input.changesSince && input.versionNumber > 1) {
      lines.push(`## Changes since v${input.versionNumber - 1}`);
      lines.push('');
      lines.push(input.changesSince.trim());
      lines.push('');
    }

    for (const key of SECTION_ORDER) {
      const body = (input.sections[key] ?? '').trim();
      lines.push(`## §${key}. ${SECTION_TITLES[key]}`);
      lines.push('');
      lines.push(body || '_— empty —_');
      lines.push('');

      if (key === '3' && input.brandTokens) {
        lines.push('### Brand tokens');
        lines.push('');
        lines.push('| Token | Value |');
        lines.push('| --- | --- |');
        lines.push(`| Primary | \`${input.brandTokens.primary}\` |`);
        lines.push(`| Surface | \`${input.brandTokens.surface}\` |`);
        lines.push(`| CTA | \`${input.brandTokens.cta}\` |`);
        lines.push(`| Product | ${input.brandTokens.productName} |`);
        lines.push('');
      }

      if (key === '8') {
        if (input.decisionsLocked.length > 0) {
          lines.push('### Decisions locked');
          lines.push('');
          lines.push('| Question | Decision |');
          lines.push('| --- | --- |');
          for (const d of input.decisionsLocked) {
            lines.push(`| ${escapePipes(d.question)} | ${escapePipes(d.decision)} |`);
          }
          lines.push('');
        }
        if (input.openQuestions.length > 0) {
          lines.push('### Open questions');
          lines.push('');
          lines.push('| # | Question | Default |');
          lines.push('| --- | --- | --- |');
          for (const q of input.openQuestions) {
            lines.push(
              `| ${q.number} | ${escapePipes(q.question)} | ${escapePipes(q.default)} |`,
            );
          }
          lines.push('');
        }
      }

      if (key === '12' && input.prdReadiness) {
        const prd = input.prdReadiness;
        if (prd.actors?.length) {
          lines.push('### Actors');
          lines.push('');
          lines.push('| Role | Type | Description | Permissions |');
          lines.push('| --- | --- | --- | --- |');
          for (const a of prd.actors) {
            lines.push(
              `| ${escapePipes(a.role)} | ${escapePipes(a.type)} | ${escapePipes(a.description)} | ${escapePipes(a.permissions)} |`,
            );
          }
          lines.push('');
        }
        if (prd.integrations?.length) {
          lines.push('### Integrations');
          lines.push('');
          lines.push('| Name | Type | Purpose | Criticality | Phase |');
          lines.push('| --- | --- | --- | --- | --- |');
          for (const i of prd.integrations) {
            lines.push(
              `| ${escapePipes(i.name)} | ${escapePipes(i.type)} | ${escapePipes(i.purpose)} | ${escapePipes(i.criticality)} | ${escapePipes(i.phase)} |`,
            );
          }
          lines.push('');
        }
        if (prd.keyDeliverables?.length) {
          lines.push('### Key deliverables');
          lines.push('');
          for (const k of prd.keyDeliverables) lines.push(`- ${k}`);
          lines.push('');
        }
        if (prd.environmentList?.length) {
          lines.push('### Environments');
          lines.push('');
          lines.push('| Environment | Purpose | Phase 1 hosting | Phase 2 hosting |');
          lines.push('| --- | --- | --- | --- |');
          for (const e of prd.environmentList) {
            lines.push(
              `| ${escapePipes(e.environment)} | ${escapePipes(e.purpose)} | ${escapePipes(e.phase1Hosting)} | ${escapePipes(e.phase2Hosting)} |`,
            );
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  async renderPdf(versionId: string, edition: AnEdition): Promise<{ buffer: Buffer; filename: string }> {
    const input = await this.loadAnInput(versionId, edition);
    const html = generateAnHtml(input);
    const buffer = await this.pdfService.generatePdfFromHtml(html, {
      headerLabel: `Approach Note v${input.versionNumber}${input.clientEdition ? ' · Client edition' : ''}`,
    });
    return { buffer, filename: this.filename(input, 'pdf') };
  }

  async renderDocx(versionId: string, edition: AnEdition): Promise<{ buffer: Buffer; filename: string }> {
    const input = await this.loadAnInput(versionId, edition);
    const productName =
      input.brandTokens?.productName ?? input.project.productName ?? input.project.name;

    const children: (Paragraph | Table)[] = [];

    // Cover
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: `APPROACH NOTE · v${input.versionNumber}${input.clientEdition ? ' · CLIENT EDITION' : ' · INTERNAL'}`,
            bold: true,
            size: 22,
            color: '71717A',
          }),
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
      this.kvParagraph('Generated', this.formatDate(input.meta?.generatedAt ?? input.generatedAt)),
      new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
    );

    // Changes since (only on internal edition, v2+)
    if (!input.clientEdition && input.changesSince && input.versionNumber > 1) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `Changes since v${input.versionNumber - 1}`, bold: true })],
          spacing: { before: 160, after: 80 },
        }),
        ...input.changesSince
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => new Paragraph({ text: l })),
        new Paragraph({ text: '', spacing: { after: 200 } }),
      );
    }

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
        for (const para of this.markdownToParagraphs(body)) children.push(para);
      }

      // §3 brand tokens
      if (key === '3' && input.brandTokens) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Brand tokens', bold: true })],
            spacing: { before: 180, after: 80 },
          }),
          this.kvParagraph('Primary', input.brandTokens.primary),
          this.kvParagraph('Surface', input.brandTokens.surface),
          this.kvParagraph('CTA', input.brandTokens.cta),
          this.kvParagraph('Product', input.brandTokens.productName),
        );
      }

      // §8 decisions + open questions
      if (key === '8') {
        if (input.decisionsLocked.length > 0) {
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: `Decisions Locked (${input.decisionsLocked.length})`, bold: true })],
              spacing: { before: 180, after: 80 },
            }),
            this.decisionsTable(input.decisionsLocked),
          );
        }
        if (input.openQuestions.length > 0) {
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: `Open questions (${input.openQuestions.length})`, bold: true })],
              spacing: { before: 180, after: 80 },
            }),
          );
          for (const q of input.openQuestions) {
            const text = q.default ? `${q.question} — default: ${q.default}` : q.question;
            children.push(new Paragraph({ text: `• ${text}` }));
          }
        }
      }

      // §12 PRD-Readiness Bridge — structured rendering
      if (key === '12' && input.prdReadiness) {
        const p = input.prdReadiness;
        const subhead = (txt: string): Paragraph =>
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: txt, bold: true })],
            spacing: { before: 180, after: 80 },
          });

        children.push(subhead(`12.1 Actors / User Types (${p.actors.length})`));
        if (p.actors.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          children.push(this.bridgeTable(['Role', 'Type', 'Description', 'Permissions'], p.actors.map((a) => [a.role, a.type, a.description, a.permissions])));
        }

        children.push(subhead(`12.2 Integration Requirements (${p.integrations.length})`));
        if (p.integrations.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          children.push(this.bridgeTable(['Name', 'Type', 'Purpose', 'Criticality', 'Phase'], p.integrations.map((i) => [i.name, i.type, i.purpose, i.criticality, i.phase])));
        }

        children.push(subhead(`12.3 Customer Journeys (${p.customerJourneys.length})`));
        if (p.customerJourneys.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          for (const j of p.customerJourneys) {
            children.push(
              new Paragraph({ children: [new TextRun({ text: j.name, bold: true })], spacing: { before: 120, after: 40 } }),
              this.kvParagraph('Primary actor', j.primaryActor),
              this.kvParagraph('Trigger', j.trigger),
            );
            if (j.steps.length > 0) {
              children.push(new Paragraph({ children: [new TextRun({ text: 'Steps:', bold: true })], spacing: { before: 60 } }));
              j.steps.forEach((s, i) => children.push(new Paragraph({ text: `${i + 1}. ${s}` })));
            }
            children.push(this.kvParagraph('Success', j.successOutcome));
            if (j.failureModes.length > 0) {
              children.push(this.kvParagraph('Failure modes', j.failureModes.join('; ')));
            }
          }
        }

        children.push(subhead(`12.4 Functional Landscape (${p.functionalLandscape.length})`));
        if (p.functionalLandscape.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          children.push(this.bridgeTable(['Module', 'Purpose', 'FR refs'], p.functionalLandscape.map((m) => [m.module, m.purpose, m.frRefs.join(', ')])));
        }

        children.push(subhead('12.5 UI/UX Requirements'));
        children.push(
          this.kvParagraph('Interaction patterns', p.uiUxRequirements.interactionPatterns),
          this.kvParagraph('Accessibility', p.uiUxRequirements.accessibility),
          this.kvParagraph('Responsive', p.uiUxRequirements.responsive),
          this.kvParagraph('Empty / error states', p.uiUxRequirements.emptyErrorStates),
          this.kvParagraph('Microcopy tone', p.uiUxRequirements.microcopyTone),
          this.kvParagraph('Internationalization', p.uiUxRequirements.internationalization),
        );

        children.push(subhead(`12.6 Compliance Requirements (Phase 1) (${p.complianceRequirements.length})`));
        if (p.complianceRequirements.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          children.push(this.bridgeTable(['Standard', 'Applicability', 'Phase 1 controls'], p.complianceRequirements.map((c) => [c.standard, c.applicability, c.phase1Controls])));
        }

        children.push(subhead('12.7 Testing Requirements'));
        const tr = p.testingRequirements;
        children.push(
          this.bridgeTable(
            ['Test type', 'Coverage target', 'Tools', 'Owner'],
            [
              ['Unit', tr.unit.coverageTarget, tr.unit.tools, tr.unit.owner],
              ['Integration', tr.integration.coverageTarget, tr.integration.tools, tr.integration.owner],
              ['E2E', tr.e2e.coverageTarget, tr.e2e.tools, tr.e2e.owner],
              ['Eval harness', tr.evalHarness.coverageTarget, tr.evalHarness.tools, tr.evalHarness.owner],
              ['Accessibility', tr.accessibility.coverageTarget, tr.accessibility.tools, tr.accessibility.owner],
              ['Performance', tr.performance.coverageTarget, tr.performance.tools, tr.performance.owner],
              ['Security', tr.security.coverageTarget, tr.security.tools, tr.security.owner],
            ],
          ),
        );

        children.push(subhead(`12.8 Key Deliverables (${p.keyDeliverables.length})`));
        if (p.keyDeliverables.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          for (const d of p.keyDeliverables) children.push(new Paragraph({ text: `• ${d}` }));
        }

        children.push(subhead(`12.9 Receivables (${p.receivables.length})`));
        if (p.receivables.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          children.push(
            this.bridgeTable(
              ['Item', 'Owner (client)', 'Needed by week', 'Blocking?'],
              p.receivables.map((r) => [
                r.item,
                r.ownerClient,
                r.neededByWeek == null ? '—' : `Week ${r.neededByWeek}`,
                r.blocking ? 'Yes' : 'No',
              ]),
            ),
          );
        }

        children.push(subhead(`12.10 Environment list (${p.environmentList.length})`));
        if (p.environmentList.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '— none —', italics: true, color: '71717A' })] }));
        } else {
          children.push(
            this.bridgeTable(
              ['Env', 'Purpose', 'Phase 1 hosting', 'Phase 2 hosting'],
              p.environmentList.map((e) => [e.environment, e.purpose, e.phase1Hosting, e.phase2Hosting]),
            ),
          );
        }

        if (p.miscellaneous) {
          children.push(subhead('12.11 Miscellaneous'));
          children.push(new Paragraph({ text: p.miscellaneous }));
        }
      }
    }

    const doc = new Document({ sections: [{ properties: {}, children }] });
    const buffer = await Packer.toBuffer(doc);
    return { buffer, filename: this.filename(input, 'docx') };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

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
      if (!line) { flushParagraph(); continue; }
      if (/^##\s+§?\d+\.?\s/.test(line)) continue;
      if (/^#{1,6}\s+/.test(line)) {
        flushParagraph();
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: line.replace(/^#{1,6}\s+/, ''), bold: true })],
            spacing: { before: 120, after: 60 },
          }),
        );
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        paragraphs.push(new Paragraph({ text: `• ${line.replace(/^[-*]\s+/, '')}` }));
        continue;
      }
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        flushParagraph();
        paragraphs.push(new Paragraph({ text: `${numMatch[1]}. ${numMatch[2]}` }));
        continue;
      }
      if (/^\|.*\|$/.test(line)) {
        flushParagraph();
        paragraphs.push(
          new Paragraph({ children: [new TextRun({ text: line, font: 'Consolas', size: 18 })] }),
        );
        continue;
      }
      if (/^```/.test(line)) { flushParagraph(); continue; }
      buffer.push(line);
    }
    flushParagraph();
    return paragraphs;
  }

  private decisionsTable(rows: AnDecision[]): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        this.tcell('Question', { bold: true, shaded: true, width: 35 }),
        this.tcell('Decision', { bold: true, shaded: true, width: 65 }),
      ],
    });
    const dataRows = rows.map(
      (r) =>
        new TableRow({
          children: [
            this.tcell(r.question, { width: 35 }),
            this.tcell(r.decision, { width: 65 }),
          ],
        }),
    );
    return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  /** Generic table builder for §12 PRD-Readiness Bridge sub-sections. */
  private bridgeTable(headers: string[], rows: string[][]): Table {
    const colWidth = Math.floor(100 / headers.length);
    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map((h) => this.tcell(h, { bold: true, shaded: true, width: colWidth })),
    });
    const dataRows = rows.map(
      (r) =>
        new TableRow({
          children: r.map((cell) => this.tcell(cell ?? '', { width: colWidth })),
        }),
    );
    return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  private tcell(text: string, opts: { bold?: boolean; shaded?: boolean; width?: number } = {}): TableCell {
    return new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.shaded ? { fill: 'F4F4F5' } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold ?? false })] })],
    });
  }
}

/** Escape pipe characters so cell content does not break a markdown table row. */
function escapePipes(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
