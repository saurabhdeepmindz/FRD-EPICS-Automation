import { Injectable, NotFoundException } from '@nestjs/common';
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
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../export/pdf.service';
import { generateBaArtifactHtml, type BaArtifactDoc } from './templates/artifact-html';

@Injectable()
export class BaArtifactExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  private async loadArtifactDoc(artifactId: string): Promise<BaArtifactDoc> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactId },
      include: {
        sections: { orderBy: { createdAt: 'asc' } },
        module: {
          include: {
            project: true,
            screens: { orderBy: { displayOrder: 'asc' }, select: { screenId: true, screenTitle: true, screenType: true, fileData: true } },
          },
        },
      },
    });
    if (!artifact) throw new NotFoundException(`BA Artifact ${artifactId} not found`);

    const p = artifact.module.project as unknown as {
      name: string; projectCode: string;
      productName: string | null; clientName: string | null; submittedBy: string | null; clientLogo: string | null;
    };

    return {
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      status: artifact.status,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
      sections: artifact.sections.map((s, idx) => ({
        id: s.id,
        sectionKey: s.sectionKey,
        sectionLabel: s.sectionLabel,
        content: s.content,
        editedContent: s.editedContent,
        isHumanModified: s.isHumanModified,
        aiGenerated: s.aiGenerated,
        displayOrder: idx,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      module: {
        moduleId: artifact.module.moduleId,
        moduleName: artifact.module.moduleName,
        packageName: artifact.module.packageName,
        screens: ((artifact.module as { screens?: Array<{ screenId: string; screenTitle: string; screenType: string | null; fileData: string }> }).screens ?? []),
      },
      project: {
        name: p.name,
        projectCode: p.projectCode,
        productName: p.productName ?? null,
        clientName: p.clientName ?? null,
        submittedBy: p.submittedBy ?? null,
        clientLogo: p.clientLogo ?? null,
      },
    };
  }

  async renderHtml(artifactId: string): Promise<{ html: string; fileStem: string; typeLabel: string }> {
    const doc = await this.loadArtifactDoc(artifactId);
    let html = generateBaArtifactHtml(doc);
    // v4: for LLD artifacts, append the pseudo-file tree as a final appendix
    if (doc.artifactType === 'LLD') {
      const pseudoAppendix = await this.renderPseudoFilesAppendix(artifactId);
      if (pseudoAppendix) {
        html = html.replace('</body>', pseudoAppendix + '</body>');
      }
    }
    const fileStem = `${doc.artifactId}-${doc.module.moduleId}`.replace(/\s+/g, '_');
    return { html, fileStem, typeLabel: doc.artifactType };
  }

  /**
   * Fetch pseudo-files for an LLD artifact and render them as an HTML
   * appendix — sorted tree listing + per-file code blocks.
   */
  private async renderPseudoFilesAppendix(artifactId: string): Promise<string> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: artifactId },
      include: {
        sections: { select: { id: true } },
        pseudoFiles: { orderBy: { path: 'asc' } },
      },
    });
    if (!artifact || artifact.pseudoFiles.length === 0) return '';
    const files = artifact.pseudoFiles;
    // Positional: pseudo-code files is the N+1th section where N = sections
    // already stored for this LLD (after parser tidy-up).
    const sectionNumber = artifact.sections.length + 1;

    const escapeHtml = (s: string): string => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const indexItems = files
      .map((f, idx) => {
        const basename = f.path.split('/').pop() ?? '';
        return `<li><a href="#pseudo-${f.id}"><strong>${sectionNumber}.${idx + 1}</strong> <code>${escapeHtml(basename)}</code></a> <span style="color:#94a3b8;font-size:9pt;">${escapeHtml(f.path)}</span></li>`;
      })
      .join('');

    const blocks = files.map((f, idx) => {
      const content = f.isHumanModified && f.editedContent ? f.editedContent : f.aiContent;
      const humanBadge = f.isHumanModified ? ' <span class="badge badge-edited">Edited</span>' : '';
      const basename = f.path.split('/').pop() ?? '';
      return `<section id="pseudo-${f.id}" class="doc-section">
        <h3 style="font-size:12pt;">${sectionNumber}.${idx + 1} ${escapeHtml(basename)}${humanBadge}</h3>
        <p style="font-size:9pt;color:#64748b;margin:2px 0 6px;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(f.path)} <span style="background:#f1f5f9;padding:1px 6px;border-radius:3px;margin-left:6px;text-transform:uppercase;font-size:8pt;">${escapeHtml(f.language)}</span></p>
        <div class="section-body">
          <pre class="code lang-${escapeHtml(f.language)}"><code>${escapeHtml(content)}</code></pre>
        </div>
      </section>`;
    }).join('\n');

    return `
      <hr/>
      <div class="container" style="page-break-before:always">
        <h2 style="border-bottom:2px solid #f97316;padding-bottom:6px;">${sectionNumber}. Pseudo-Code Files <span style="font-size:9pt;color:#94a3b8;font-weight:normal">(${files.length})</span></h2>
        <ul style="font-size:10pt;list-style:none;padding-left:0;">${indexItems}</ul>
        ${blocks}
      </div>
    `;
  }

  async renderPdf(artifactId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { html, fileStem, typeLabel } = await this.renderHtml(artifactId);
    const buffer = await this.pdfService.generatePdfFromHtml(html, {
      headerLabel: `${typeLabel.replace(/_/g, ' ')} — ${fileStem}`,
    });
    return { buffer, filename: `${fileStem}.pdf` };
  }

  // ─── SubTask export ────────────────────────────────────────────────────

  private async loadSubTaskDoc(subtaskId: string): Promise<BaArtifactDoc> {
    const st = await this.prisma.baSubTask.findUnique({
      where: { id: subtaskId },
      include: {
        sections: { orderBy: { sectionNumber: 'asc' } },
        module: {
          include: {
            project: true,
            screens: { orderBy: { displayOrder: 'asc' }, select: { screenId: true, screenTitle: true, screenType: true, fileData: true } },
          },
        },
      },
    });
    if (!st) throw new NotFoundException(`BA SubTask ${subtaskId} not found`);

    const p = st.module.project as unknown as {
      name: string; projectCode: string;
      productName: string | null; clientName: string | null; submittedBy: string | null; clientLogo: string | null;
    };

    return {
      artifactId: st.subtaskId,
      artifactType: 'SUBTASK',
      status: st.status,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
      sections: st.sections.map((s) => ({
        id: s.id,
        sectionKey: s.sectionKey,
        sectionLabel: s.sectionLabel,
        content: s.aiContent,
        editedContent: s.editedContent,
        isHumanModified: s.isHumanModified,
        aiGenerated: true, // all SubTask sections start as AI-generated
        displayOrder: s.sectionNumber,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      module: {
        moduleId: st.module.moduleId,
        moduleName: st.module.moduleName,
        packageName: st.module.packageName,
        screens: ((st.module as { screens?: Array<{ screenId: string; screenTitle: string; screenType: string | null; fileData: string }> }).screens ?? []),
      },
      project: {
        name: p.name,
        projectCode: p.projectCode,
        productName: p.productName ?? null,
        clientName: p.clientName ?? null,
        submittedBy: p.submittedBy ?? null,
        clientLogo: p.clientLogo ?? null,
      },
    };
  }

  async renderSubTaskHtml(subtaskId: string): Promise<{ html: string; fileStem: string; typeLabel: string }> {
    const doc = await this.loadSubTaskDoc(subtaskId);
    const html = generateBaArtifactHtml(doc);
    const fileStem = `${doc.artifactId}-${doc.module.moduleId}`.replace(/\s+/g, '_');
    return { html, fileStem, typeLabel: 'SUBTASK' };
  }

  async renderSubTaskPdf(subtaskId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { html, fileStem } = await this.renderSubTaskHtml(subtaskId);
    const buffer = await this.pdfService.generatePdfFromHtml(html, {
      headerLabel: `SubTask — ${fileStem}`,
    });
    return { buffer, filename: `${fileStem}.pdf` };
  }

  async renderSubTaskDocx(subtaskId: string): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.loadSubTaskDoc(subtaskId);
    const fileStem = `${doc.artifactId}-${doc.module.moduleId}`.replace(/\s+/g, '_');
    const buffer = await this.buildDocxFromDoc(doc);
    return { buffer, filename: `${fileStem}.docx` };
  }

  async renderDocx(artifactId: string): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.loadArtifactDoc(artifactId);
    const fileStem = `${doc.artifactId}-${doc.module.moduleId}`.replace(/\s+/g, '_');
    const buffer = await this.buildDocxFromDoc(doc);
    return { buffer, filename: `${fileStem}.docx` };
  }

  // ─── Proper DOCX builder using the `docx` library ───────────────────────

  /**
   * Previously this code path relied on `html-docx-js` (which wasn't actually
   * installed) and fell through to saving raw HTML with a .docx extension —
   * Word correctly rejected it as "we found a problem with its contents".
   *
   * Now we build a real OOXML document programmatically. Keeps it simple and
   * predictable: cover header → per-section heading + markdown body rendered
   * as paragraphs + tables. Avoids html-docx-js' known failures on large
   * artifacts (150 KB+ of User Story content) and embedded base64 images.
   */
  private async buildDocxFromDoc(doc: BaArtifactDoc): Promise<Buffer> {
    const children: Array<Paragraph | Table> = [];

    // Title page
    const projectLabel = doc.project.productName?.trim() || doc.project.name;
    children.push(new Paragraph({
      text: `${projectLabel} — ${doc.artifactType.replace(/_/g, ' ')}`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }));
    children.push(new Paragraph({ text: doc.artifactId, alignment: AlignmentType.CENTER }));
    children.push(new Paragraph({
      text: `Module: ${doc.module.moduleId} — ${doc.module.moduleName}`,
      alignment: AlignmentType.CENTER,
    }));
    children.push(new Paragraph({
      text: `Project: ${doc.project.projectCode}`,
      alignment: AlignmentType.CENTER,
    }));
    if (doc.project.clientName) {
      children.push(new Paragraph({
        text: `Client: ${doc.project.clientName}`,
        alignment: AlignmentType.CENTER,
      }));
    }
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ text: '' }));

    // Sort sections by displayOrder then createdAt for stable output.
    const sorted = [...doc.sections].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    });

    for (const section of sorted) {
      const body = section.isHumanModified && section.editedContent ? section.editedContent : section.content;
      if (!body || !body.trim()) continue;
      children.push(new Paragraph({
        text: section.sectionLabel || section.sectionKey.replace(/_/g, ' '),
        heading: HeadingLevel.HEADING_1,
      }));
      for (const node of this.markdownBlocksToDocx(body)) {
        children.push(node);
      }
      children.push(new Paragraph({ text: '' }));
    }

    const document = new Document({
      creator: 'BA Tool',
      title: doc.artifactId,
      description: `${doc.artifactType} for module ${doc.module.moduleId}`,
      sections: [{ children }],
    });

    return Packer.toBuffer(document);
  }

  /**
   * Very small, predictable markdown → docx block converter.
   * Handles: headings (#..######), tables (| col | col |), bullet lists,
   * numbered lists, blank-line paragraphs, fenced code blocks (as preformatted).
   * Not a full markdown parser — intentional, keeps DOCX deterministic.
   */
  private markdownBlocksToDocx(md: string): Array<Paragraph | Table> {
    const blocks: Array<Paragraph | Table> = [];
    const lines = md.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Blank line → skip
      if (!line.trim()) { i++; continue; }

      // Headings: #, ##, ..., ######
      const hMatch = /^(#{1,6})\s+(.*)$/.exec(line);
      if (hMatch) {
        const level = hMatch[1].length;
        const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_2, // already under a H1 section header
          2: HeadingLevel.HEADING_3,
          3: HeadingLevel.HEADING_4,
          4: HeadingLevel.HEADING_5,
          5: HeadingLevel.HEADING_6,
          6: HeadingLevel.HEADING_6,
        };
        blocks.push(new Paragraph({ text: hMatch[2].trim(), heading: levelMap[level] }));
        i++;
        continue;
      }

      // Fenced code block — ```lang ... ```
      if (line.trim().startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // skip closing ```
        blocks.push(this.buildPreformattedBlock(codeLines));
        continue;
      }

      // C-style block comment — the AI's Traceability Header uses `/* ... */`
      // with ` * Key: Value` lines. Detect the opening `/*`, collect until
      // `*/`, strip the leading ` * ` prefix, then either emit as a 2-column
      // key-value table (if most lines match Key: Value) or as preformatted
      // monospace text. Without this, line breaks got collapsed and the whole
      // block rendered as one garbled paragraph.
      if (/^\s*\/\*/.test(line)) {
        const commentLines: string[] = [];
        // First line may have content after `/*`
        const firstTail = line.replace(/^\s*\/\*\*?/, '').replace(/\*\/\s*$/, '');
        if (firstTail.trim()) commentLines.push(firstTail);
        const isClosingOnFirst = /\*\/\s*$/.test(line);
        if (!isClosingOnFirst) {
          i++;
          while (i < lines.length && !/\*\/\s*$/.test(lines[i])) {
            commentLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) {
            const lastHead = lines[i].replace(/\*\/\s*$/, '');
            if (lastHead.trim()) commentLines.push(lastHead);
            i++;
          }
        } else {
          i++;
        }
        // Strip leading ` * ` or `*` per line — docstring convention
        const cleaned = commentLines
          .map((l) => l.replace(/^\s*\*\s?/, '').replace(/\s+$/, ''))
          .filter((l, idx, arr) => !(idx === 0 && l === '') && !(idx === arr.length - 1 && l === ''));
        // If most non-empty lines look like Key: Value, render as table
        const nonEmpty = cleaned.filter((l) => l.trim() && !/^=+$/.test(l));
        const kvLines = nonEmpty.filter((l) => /^[\w\s().\-/]+:\s+\S/.test(l));
        if (nonEmpty.length >= 3 && kvLines.length / nonEmpty.length >= 0.6) {
          const rows: Array<[string, string]> = [];
          let pendingTitle: string | null = null;
          for (const l of cleaned) {
            if (!l.trim()) continue;
            if (/^=+$/.test(l)) continue;
            const kv = /^([^:]+):\s+(.*)$/.exec(l);
            if (kv) {
              rows.push([kv[1].trim(), kv[2].trim()]);
            } else if (l.trim().length > 0 && !pendingTitle) {
              pendingTitle = l.trim();
            }
          }
          if (pendingTitle) {
            blocks.push(new Paragraph({
              children: [new TextRun({ text: pendingTitle, bold: true })],
            }));
          }
          if (rows.length > 0) {
            blocks.push(this.buildKvTable(rows));
            continue;
          }
        }
        // Fallback — preformatted
        blocks.push(this.buildPreformattedBlock(cleaned));
        continue;
      }

      // Table — consecutive `| col | col |` lines (skip separator row)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const parsed = this.parseMarkdownTable(tableLines);
        if (parsed) {
          blocks.push(this.buildDocxTable(parsed));
          continue;
        }
        // Fall through and treat as paragraph if parse failed
        for (const t of tableLines) {
          blocks.push(new Paragraph({ children: this.inlineRuns(t) }));
        }
        continue;
      }

      // Bullet list
      if (/^\s*[-*+]\s+/.test(line)) {
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const m = /^\s*[-*+]\s+(.*)$/.exec(lines[i])!;
          blocks.push(new Paragraph({
            children: this.inlineRuns(m[1]),
            bullet: { level: 0 },
          }));
          i++;
        }
        continue;
      }

      // Numbered list
      if (/^\s*\d+\.\s+/.test(line)) {
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const m = /^\s*(\d+)\.\s+(.*)$/.exec(lines[i])!;
          blocks.push(new Paragraph({
            children: [
              new TextRun({ text: `${m[1]}. `, bold: true }),
              ...this.inlineRuns(m[2]),
            ],
          }));
          i++;
        }
        continue;
      }

      // Plain paragraph — collect contiguous non-empty non-special lines.
      // We used to `.join(' ')` which destroyed hard line breaks (visible
      // symptom: Traceability Headers and key-value lists all merged into
      // one long line). Now we preserve line breaks via TextRun break: 1.
      const paraLines: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,6})\s+/.test(lines[i]) &&
        !lines[i].trim().startsWith('```') &&
        !/^\s*\/\*/.test(lines[i]) &&
        !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      const runs: TextRun[] = [];
      paraLines.forEach((pl, idx) => {
        runs.push(...this.inlineRuns(pl));
        if (idx < paraLines.length - 1) runs.push(new TextRun({ text: '', break: 1 }));
      });
      blocks.push(new Paragraph({ children: runs }));
    }

    return blocks;
  }

  /** Parse a markdown table's lines (including separator) into a 2D cell matrix. */
  private parseMarkdownTable(lines: string[]): { header: string[]; rows: string[][] } | null {
    if (lines.length < 2) return null;
    const parseRow = (raw: string): string[] => raw
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

    const header = parseRow(lines[0]);
    // Line 1 should be a separator of `---` cells; skip it.
    const startDataIdx = /^[\s|:-]+$/.test(lines[1].trim()) ? 2 : 1;
    const rows: string[][] = [];
    for (let idx = startDataIdx; idx < lines.length; idx++) {
      rows.push(parseRow(lines[idx]));
    }
    if (header.length === 0) return null;
    return { header, rows };
  }

  /**
   * Paragraph with preserved line breaks in Consolas — used for fenced code
   * blocks and comment blocks where newline structure matters.
   */
  private buildPreformattedBlock(lines: string[]): Paragraph {
    const runs: TextRun[] = [];
    lines.forEach((l, idx) => {
      runs.push(new TextRun({ text: l, font: 'Consolas', size: 18 }));
      if (idx < lines.length - 1) {
        runs.push(new TextRun({ text: '', break: 1 }));
      }
    });
    return new Paragraph({ children: runs });
  }

  /** 2-column key/value Word table. Used for Traceability Header blocks etc. */
  private buildKvTable(rows: Array<[string, string]>): Table {
    const makeCell = (text: string, bold: boolean, widthPct: number): TableCell => new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        children: [new TextRun({ text, bold, size: 20 })],
      })],
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(([k, v]) => new TableRow({
        children: [makeCell(k, true, 30), makeCell(v, false, 70)],
      })),
    });
  }

  private buildDocxTable(table: { header: string[]; rows: string[][] }): Table {
    const makeCell = (text: string, header: boolean): TableCell => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: header, size: 20 })],
      })],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: table.header.map((c) => makeCell(c, true)),
          tableHeader: true,
        }),
        ...table.rows.map((r) => new TableRow({
          children: r.map((c) => makeCell(c, false)),
        })),
      ],
    });
  }

  /**
   * Inline formatting: **bold**, *italic*, `code`, and plain text. Keeps
   * markup lightweight and predictable for Word.
   */
  private inlineRuns(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      const bold = remaining.match(/^\*\*([^*]+)\*\*/);
      if (bold) {
        runs.push(new TextRun({ text: bold[1], bold: true }));
        remaining = remaining.slice(bold[0].length);
        continue;
      }
      const code = remaining.match(/^`([^`]+)`/);
      if (code) {
        runs.push(new TextRun({ text: code[1], font: 'Consolas', size: 18 }));
        remaining = remaining.slice(code[0].length);
        continue;
      }
      const italic = remaining.match(/^\*([^*]+)\*/);
      if (italic && !remaining.startsWith('**')) {
        runs.push(new TextRun({ text: italic[1], italics: true }));
        remaining = remaining.slice(italic[0].length);
        continue;
      }
      // Take text up to next marker or end
      const plainMatch = remaining.match(/^[^*`]+/);
      if (plainMatch) {
        runs.push(new TextRun({ text: plainMatch[0] }));
        remaining = remaining.slice(plainMatch[0].length);
        continue;
      }
      // Single-char fallback
      runs.push(new TextRun({ text: remaining[0] }));
      remaining = remaining.slice(1);
    }
    return runs.length > 0 ? runs : [new TextRun({ text: '' })];
  }
}
