import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
} from 'docx';

interface MermaidImage {
  buffer: Buffer;
  width: number;
  height: number;
}
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../export/pdf.service';
import { generateBaArtifactHtml, type BaArtifactDoc } from './templates/artifact-html';

@Injectable()
export class BaArtifactExportService {
  private readonly logger = new Logger(BaArtifactExportService.name);

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
    // Render any Mermaid diagrams to PNG up front so the DOCX shows real
    // swim-lane visuals instead of the source code. One Chromium instance is
    // reused across diagrams. If puppeteer is unavailable or rendering
    // fails, callers fall back to the preformatted source text per-block.
    const mermaidImages = await this.prepareMermaidImages(doc);

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
      for (const node of this.markdownBlocksToDocx(body, mermaidImages)) {
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
  private markdownBlocksToDocx(
    md: string,
    mermaidImages?: Map<string, MermaidImage>,
  ): Array<Paragraph | Table> {
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
        const fenceLang = line.trim().slice(3).trim().toLowerCase();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // skip closing ```

        // Mermaid → embed pre-rendered PNG (see prepareMermaidImages).
        // Falls back to source-as-preformatted when puppeteer rendering
        // produced no buffer (e.g. browser unavailable).
        const codeBody = codeLines.join('\n').trim();
        const isMermaid =
          /^(mermaid|uml)$/.test(fenceLang) ||
          /^(sequenceDiagram|classDiagram|erDiagram|flowchart|graph|stateDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|c4|requirementDiagram)\b/.test(codeBody);
        if (isMermaid) {
          const png = mermaidImages?.get(codeBody);
          if (png) {
            blocks.push(new Paragraph({
              children: [
                new ImageRun({
                  data: png.buffer,
                  transformation: this.scaleImageForDocx(png.width, png.height, 600),
                  // docx>=9 requires `type` for ImageRun.
                  type: 'png',
                }),
              ],
            }));
            continue;
          }
          // Render unavailable — keep the Mermaid source so the diagram can
          // still be regenerated by the reader.
          blocks.push(this.buildPreformattedBlock(codeLines));
          continue;
        }

        // When the fenced block contains a /* ... */ Traceability Header
        // (common pattern for `26. Traceability Header Content` sections),
        // render it as one or more proper Word tables — not a preformatted
        // monospace wall. The Traceability header carries a "TBD-Future
        // Dependencies:" sub-block that gets emitted as its own table so
        // the AI's two-section structure stays visible in Word.
        const asKvGroups = this.extractKvBlockAsGroups(codeLines);
        if (asKvGroups) {
          for (const g of asKvGroups) {
            if (g.title) {
              blocks.push(new Paragraph({
                children: [new TextRun({ text: g.title, bold: true })],
              }));
            }
            blocks.push(this.buildKvTable(g.rows));
          }
          continue;
        }

        // Project Structure inside a fenced block (e.g. ```text\nProject
        // Structure:\n  ...```). The AI sometimes wraps Section 20 in a
        // fence so structured layout is preserved verbatim. Treat the
        // fence body as if it were a paragraph for KV-table rendering.
        const psFenced = this.extractProjectStructureBlock(codeLines);
        if (psFenced) {
          if (psFenced.kv.length > 0) {
            blocks.push(new Paragraph({
              children: [new TextRun({ text: 'Project Structure', bold: true })],
            }));
            blocks.push(this.buildKvTable(psFenced.kv));
          }
          if (psFenced.treeLines.length > 0) {
            blocks.push(new Paragraph({
              children: [new TextRun({ text: 'Directory Map', bold: true })],
            }));
            blocks.push(this.buildPreformattedBlock(psFenced.treeLines));
          }
          if (psFenced.remainder.length > 0) {
            blocks.push(this.buildPreformattedBlock(psFenced.remainder));
          }
          continue;
        }

        blocks.push(this.buildPreformattedBlock(codeLines));
        continue;
      }

      // C-style block comment — the AI's Traceability Header uses `/* ... */`
      // with ` * Key: Value` lines. When written OUTSIDE a fenced code block
      // this handler catches it; when written INSIDE (same pattern but
      // wrapped in ```), the fenced-code branch above handles it via
      // extractKvBlockAsGroups.
      if (/^\s*\/\*/.test(line)) {
        const commentLines: string[] = [];
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
        const asGroups = this.extractKvBlockAsGroups(commentLines);
        if (asGroups) {
          for (const g of asGroups) {
            if (g.title) {
              blocks.push(new Paragraph({
                children: [new TextRun({ text: g.title, bold: true })],
              }));
            }
            blocks.push(this.buildKvTable(g.rows));
          }
          continue;
        }
        // Fallback — preformatted with the `*` prefixes stripped for legibility
        const cleaned = commentLines.map((l) => l.replace(/^\s*\*\s?/, '').replace(/\s+$/, ''));
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

      // Project Structure detection: when a paragraph begins with
      // "Project Structure:" followed by Key:Value lines, render the keys as
      // a 2-col KV table and the (optional) trailing Directory Map as a
      // preformatted monospace block. This matches the on-screen renderer.
      const ps = this.extractProjectStructureBlock(paraLines);
      if (ps) {
        if (ps.kv.length > 0) {
          blocks.push(new Paragraph({
            children: [new TextRun({ text: 'Project Structure', bold: true })],
          }));
          blocks.push(this.buildKvTable(ps.kv));
        }
        if (ps.treeLines.length > 0) {
          blocks.push(new Paragraph({
            children: [new TextRun({ text: 'Directory Map', bold: true })],
          }));
          blocks.push(this.buildPreformattedBlock(ps.treeLines));
        }
        if (ps.remainder.length > 0) {
          const runs: TextRun[] = [];
          ps.remainder.forEach((pl, idx) => {
            runs.push(...this.inlineRuns(pl));
            if (idx < ps.remainder.length - 1) runs.push(new TextRun({ text: '', break: 1 }));
          });
          blocks.push(new Paragraph({ children: runs }));
        }
        continue;
      }

      // Standalone "Directory Map:" paragraph — render as preformatted
      if (/^\s*directory\s+map\s*:?\s*$/i.test(paraLines[0])) {
        blocks.push(new Paragraph({
          children: [new TextRun({ text: 'Directory Map', bold: true })],
        }));
        blocks.push(this.buildPreformattedBlock(paraLines.slice(1)));
        continue;
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

  /**
   * Project Structure detector — matches a Section 20 block of the form:
   *
   *     Project Structure:
   *       Language/Framework: TypeScript / NestJS
   *       Base Directory:     src/
   *       ...
   *       Full File Path:     src/.../foo.controller.ts
   *
   *       Directory Map:
   *         src/
   *         └── modules/...
   *
   * Returns null when the first line isn't "Project Structure:".
   */
  private extractProjectStructureBlock(
    lines: string[],
  ): { kv: Array<[string, string]>; treeLines: string[]; remainder: string[] } | null {
    if (lines.length === 0) return null;
    if (!/^\s*project\s+structure\s*:?\s*$/i.test(lines[0])) return null;

    const kv: Array<[string, string]> = [];
    let i = 1;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) {
        if (kv.length > 0) break;
        continue;
      }
      const m = /^\s*([A-Za-z][\w\s/().\-]+?)\s*:\s+(.+)$/.exec(l);
      if (m) {
        kv.push([m[1].trim(), m[2].trim()]);
        continue;
      }
      // Hit a non-KV line in the KV pass — stop.
      break;
    }
    if (kv.length < 2) return null;

    while (i < lines.length && !lines[i].trim()) i++;
    let treeLines: string[] = [];
    if (i < lines.length && /^\s*directory\s+map\s*:?\s*$/i.test(lines[i])) {
      i++;
      while (i < lines.length) {
        if (!lines[i].trim()) {
          if (treeLines.length === 0) break;
          treeLines.push('');
          i++;
          continue;
        }
        treeLines.push(lines[i]);
        i++;
      }
      while (treeLines.length > 0 && !treeLines[treeLines.length - 1].trim()) treeLines.pop();
    }
    return { kv, treeLines, remainder: lines.slice(i) };
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
   * Split a Traceability /* ... *\/ block (or fenced equivalent) into one or
   * more KV-table groups. The block typically has two natural sections:
   *
   *   1. Module / Feature / User Story / ... Generated metadata
   *   2. TBD-Future Dependencies (TBD-002, Assumed, Stub, Affected, Resolution)
   *
   * The "TBD-Future Dependencies:" line acts as a section break — everything
   * before it goes into the main "Traceability" group, everything after into
   * the "TBD-Future Dependencies" group. Each becomes its own Word table so
   * the visual separation matches the AI's two-section authoring intent.
   */
  private extractKvBlockAsGroups(
    rawLines: string[],
  ): Array<{ title: string | null; rows: Array<[string, string]> }> | null {
    const cleaned = rawLines
      .map((l) =>
        l
          .replace(/^\s*\/\*+/, '')
          .replace(/\*\/\s*$/, '')
          .replace(/^\s*\*\s?/, '')
          .replace(/\s+$/, ''),
      )
      .filter((_, idx, arr) => {
        const head = idx === 0 && !arr[0].trim();
        const tail = idx === arr.length - 1 && !arr[arr.length - 1].trim();
        return !head && !tail;
      });

    const nonEmpty = cleaned.filter((l) => l.trim() && !/^=+$/.test(l.trim()));
    const kvLines = nonEmpty.filter((l) => /^[\w\s().\-/]+:\s*\S/.test(l));
    if (nonEmpty.length < 3 || kvLines.length / nonEmpty.length < 0.6) return null;

    const groups: Array<{ title: string | null; rows: Array<[string, string]> }> = [];
    let currentTitle: string | null = null;
    let currentRows: Array<[string, string]> = [];
    let seenTbdHeader = false;
    const flush = (): void => {
      // TBD-Future group with no KV rows → insert a placeholder so the
      // second Word table is always rendered (matches the "two tables in
      // Section 19, always" UX contract).
      if (currentTitle === 'TBD-Future Dependencies' && currentRows.length === 0) {
        currentRows.push(['Status', 'None — this SubTask has no TBD-Future dependencies']);
      }
      if (currentRows.length > 0) {
        groups.push({ title: currentTitle, rows: currentRows });
      }
      currentTitle = null;
      currentRows = [];
    };

    for (const l of cleaned) {
      const t = l.trim();
      if (!t) continue;
      if (/^=+$/.test(t)) continue;
      // "TBD-Future Dependencies:" (with empty value) is a section break.
      if (/^TBD[-\s]Future\s+Dependencies\s*:?\s*$/i.test(t)) {
        flush();
        currentTitle = 'TBD-Future Dependencies';
        seenTbdHeader = true;
        continue;
      }
      const kv = /^([^:]+):\s*(.*)$/.exec(l);
      if (kv && kv[2].trim()) {
        currentRows.push([kv[1].trim(), kv[2].trim()]);
      } else if (!currentTitle && !/^\/\*|\*\/$/.test(t)) {
        // First non-KV non-divider line becomes the current group's title.
        currentTitle = t.replace(/^\/\*+/, '').replace(/\*\/$/, '').trim();
      }
    }
    flush();
    // AI omitted the literal "TBD-Future Dependencies:" header → append
    // the placeholder group so DOCX still renders both tables.
    if (!seenTbdHeader && groups.length > 0) {
      groups.push({
        title: 'TBD-Future Dependencies',
        rows: [['Status', 'None — this SubTask has no TBD-Future dependencies']],
      });
    }
    if (groups.length === 0) return null;
    return groups;
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
   * Scan all section bodies, find Mermaid fenced blocks, render each unique
   * source to a PNG buffer with a single shared headless Chromium instance.
   * Returns a Map keyed by the trimmed Mermaid source so the markdown→DOCX
   * pass can look up the image by source string.
   *
   * Failures are silent — the block-level fallback writes the source as
   * preformatted text so the export never breaks.
   */
  private async prepareMermaidImages(doc: BaArtifactDoc): Promise<Map<string, MermaidImage>> {
    const out = new Map<string, MermaidImage>();
    const fenceRe = /```(\w+)?\s*\n([\s\S]*?)```/g;
    const seen = new Set<string>();
    const sources: string[] = [];

    for (const s of doc.sections) {
      const body = s.isHumanModified && s.editedContent ? s.editedContent : s.content;
      if (!body) continue;
      let m: RegExpExecArray | null;
      fenceRe.lastIndex = 0;
      while ((m = fenceRe.exec(body)) !== null) {
        const lang = (m[1] ?? '').toLowerCase();
        const inner = m[2].trim();
        const looksMermaid =
          /^(mermaid|uml)$/.test(lang) ||
          /^(sequenceDiagram|classDiagram|erDiagram|flowchart|graph|stateDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|c4|requirementDiagram)\b/.test(inner);
        if (!looksMermaid) continue;
        if (seen.has(inner)) continue;
        seen.add(inner);
        sources.push(inner);
      }
    }

    if (sources.length === 0) return out;

    let puppeteer: typeof import('puppeteer');
    try {
      puppeteer = await import('puppeteer');
    } catch {
      this.logger.warn('Puppeteer unavailable — DOCX will keep Mermaid source as preformatted text');
      return out;
    }

    let browser: import('puppeteer').Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      for (const src of sources) {
        try {
          const img = await this.renderMermaidWithBrowser(browser, src);
          if (img) out.set(src, img);
        } catch (err) {
          this.logger.warn(`Mermaid render failed for one diagram: ${(err as Error).message}`);
        }
      }
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    return out;
  }

  /**
   * Render a single Mermaid source to a PNG buffer + dimensions using a
   * shared puppeteer Browser. Returns null on parse / render failure.
   */
  private async renderMermaidWithBrowser(
    browser: import('puppeteer').Browser,
    source: string,
  ): Promise<MermaidImage | null> {
    const page = await browser.newPage();
    try {
      // Match the on-screen renderer's theme/security so the swim-lane looks
      // identical in DOCX and the editor view.
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;}
#wrap{display:inline-block;padding:16px;}
.mermaid svg{max-width:none !important;}
</style></head><body><div id="wrap"><div class="mermaid">${this.escapeHtml(source)}</div></div>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
const el = document.querySelector('.mermaid');
const src = el.textContent;
mermaid.render('mm-export-1', src).then(({ svg }) => {
  el.innerHTML = svg;
  document.body.dataset.ready = '1';
}).catch((e) => { document.body.dataset.error = e.message || 'render failed'; });
</script></body></html>`;
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15_000 });
      await page.waitForFunction(
        () => document.body.dataset.ready === '1' || document.body.dataset.error,
        { timeout: 12_000 },
      );
      const error = await page.evaluate(() => document.body.dataset.error || null);
      if (error) {
        this.logger.warn(`Mermaid client-side error: ${error}`);
        return null;
      }
      const wrap = await page.$('#wrap');
      if (!wrap) return null;
      const box = await wrap.boundingBox();
      if (!box) return null;
      const buffer = await wrap.screenshot({
        type: 'png',
        omitBackground: false,
      });
      return {
        buffer: Buffer.from(buffer),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Compute pixel dimensions for an ImageRun that fits within `maxWidthPx`
   * while preserving aspect ratio. The `docx` lib treats transformation
   * width/height as pixels; A4 portrait page width with default margins is
   * ~600px at typical DOCX rendering.
   */
  private scaleImageForDocx(
    pxWidth: number,
    pxHeight: number,
    maxWidthPx = 600,
  ): { width: number; height: number } {
    if (pxWidth <= 0 || pxHeight <= 0) return { width: maxWidthPx, height: maxWidthPx };
    const targetW = Math.min(maxWidthPx, pxWidth);
    const targetH = Math.round(targetW * (pxHeight / pxWidth));
    return { width: targetW, height: targetH };
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
