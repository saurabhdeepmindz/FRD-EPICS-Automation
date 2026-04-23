import { Injectable, NotFoundException } from '@nestjs/common';
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
    const { html, fileStem } = await this.renderSubTaskHtml(subtaskId);
    let buffer: Buffer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const htmlDocx = require('html-docx-js');
      buffer = htmlDocx.asBlob(html);
    } catch {
      const wrapped = `<html><head><meta charset="utf-8"><title>${fileStem}</title></head><body>${html}</body></html>`;
      buffer = Buffer.from(wrapped, 'utf-8');
    }
    return { buffer, filename: `${fileStem}.docx` };
  }

  async renderDocx(artifactId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { html, fileStem } = await this.renderHtml(artifactId);
    let buffer: Buffer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const htmlDocx = require('html-docx-js');
      buffer = htmlDocx.asBlob(html);
    } catch {
      const wrapped = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${fileStem}</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
      </head><body>${html}</body></html>`;
      buffer = Buffer.from(wrapped, 'utf-8');
    }
    return { buffer, filename: `${fileStem}.docx` };
  }
}
