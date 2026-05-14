import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BorderStyle,
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
  ShadingType,
  Bookmark,
  InternalHyperlink,
} from 'docx';
import {
  COLORS,
  DOCX_FONT_HALF_PTS,
  DOCX_TABLE_CELL_PADDING_TWIPS,
  buildDocxStyles,
  statusKindFor,
} from './templates/artifact-style';
import { shouldOmitFromExport } from './templates/artifact-internal-filter';

interface MermaidImage {
  buffer: Buffer;
  width: number;
  height: number;
}
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../export/pdf.service';
import {
  generateBaArtifactHtml,
  enrichScreenReferences,
  type BaArtifactDoc,
} from './templates/artifact-html';
import { restructureFrdDoc } from './templates/frd-restructure';
import { restructureFtcDoc } from './templates/ftc-restructure';
import { parseFrdContent, type ParsedFeature } from './templates/frd-parser';
import { extractScreenIds } from './templates/screen-utils';
import { buildFtcStructure, type FtcCategoryGroup } from './templates/ftc-structure';
import type { BaTestCaseLite } from './templates/artifact-html';
import { compressScreensForHtml } from './templates/image-compress';

// docx@9 ImageRun accepts these raster `type` values without a fallback.
// SVG is supported by docx but requires a PNG fallback buffer; screens are
// always uploaded as raster, so we keep the union tight.
type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';

// Cover-page eyebrow text per artifact type. Mirrors the
// ARTIFACT_TYPE_LABELS map in templates/artifact-html.ts so the cover
// reads the same on PDF and DOCX.
const ARTIFACT_TYPE_LABELS_DOCX: Record<string, string> = {
  FRD: 'Functional Requirements Document',
  EPIC: 'EPIC',
  USER_STORY: 'User Story',
  SUBTASK: 'SubTask',
  SCREEN_ANALYSIS: 'Screen Analysis',
  LLD: 'Low-Level Design',
  FTC: 'Functional Test Cases',
};

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

    // FTC pilot: load the structured test-case data and the same-module
    // FRD feature names so the renderers can emit the editor tree's
    // category → feature → TC hierarchy with human-readable feature
    // labels. Both are no-ops when this isn't an FTC artifact.
    const { testCases, frdFeatureNames, frdFeatureScreenRefs } = await this.loadFtcExtras(artifact.id, artifact.artifactType, artifact.module.id);

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
      ...(testCases ? { testCases } : {}),
      ...(frdFeatureNames ? { frdFeatureNames } : {}),
      ...(frdFeatureScreenRefs ? { frdFeatureScreenRefs } : {}),
    };
  }

  /**
   * Returns FTC-only sidecar data: the structured `BaTestCase` rows for the
   * artifact, plus a `featureId → featureName` map sourced from the same
   * module's FRD artifact (when present). Both are `undefined` for non-FTC
   * artifact types so the loader's spread doesn't pollute non-FTC docs.
   *
   * Mirrors the runtime lookup `FtcArtifactView` does on the client — the
   * editor tree shows `F-05-01 — Reset Password` because it parses the
   * sibling FRD's features. Doing the same on the server keeps the
   * exported PDF/DOCX TOC + body labels consistent with the editor.
   */
  private async loadFtcExtras(
    artifactDbId: string,
    artifactType: string,
    moduleDbId: string,
  ): Promise<{
    testCases?: BaArtifactDoc['testCases'];
    frdFeatureNames?: BaArtifactDoc['frdFeatureNames'];
    frdFeatureScreenRefs?: BaArtifactDoc['frdFeatureScreenRefs'];
  }> {
    if (artifactType !== 'FTC') return {};

    const tcs = await this.prisma.baTestCase.findMany({
      where: { artifactDbId },
      orderBy: [{ category: 'asc' }, { testCaseId: 'asc' }],
    });
    const testCases: BaArtifactDoc['testCases'] = tcs.map((t) => ({
      id: t.id,
      testCaseId: t.testCaseId,
      title: t.title,
      category: t.category ?? null,
      scope: t.scope,
      testKind: t.testKind,
      priority: t.priority ?? null,
      isIntegrationTest: t.isIntegrationTest,
      owaspCategory: t.owaspCategory ?? null,
      scenarioGroup: t.scenarioGroup ?? null,
      testData: t.testData ?? null,
      e2eFlow: t.e2eFlow ?? null,
      preconditions: t.preconditions ?? null,
      steps: t.steps,
      expected: t.expected,
      postValidation: t.postValidation ?? null,
      sqlSetup: t.sqlSetup ?? null,
      sqlVerify: t.sqlVerify ?? null,
      playwrightHint: t.playwrightHint ?? null,
      developerHints: t.developerHints ?? null,
      parentTestCaseId: t.parentTestCaseId ?? null,
      linkedFeatureIds: t.linkedFeatureIds,
      linkedEpicIds: t.linkedEpicIds,
      linkedStoryIds: t.linkedStoryIds,
      linkedSubtaskIds: t.linkedSubtaskIds,
      isHumanModified: t.isHumanModified,
    }));

    // Look up the same-module FRD's parsed features. The module can hold
    // several FRD artifacts (legacy + current) and BaModule has no
    // canonical `frdArtifactId` pointer, so enumerate them in
    // status/recency order and use the first one whose parser actually
    // returns features. Schema FK is `moduleDbId`, not `moduleId` (which
    // is the human-readable string column).
    const frdCandidates = await this.prisma.baArtifact.findMany({
      where: { moduleDbId, artifactType: 'FRD' },
      include: { sections: { orderBy: { createdAt: 'asc' } } },
      orderBy: [
        { status: 'desc' },
        { approvedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
    let frdFeatureNames: BaArtifactDoc['frdFeatureNames'];
    let frdFeatureScreenRefs: BaArtifactDoc['frdFeatureScreenRefs'];
    for (const frd of frdCandidates) {
      try {
        const parsed = parseFrdContent(frd.sections.map((s: { sectionKey: string; sectionLabel: string; content: string; isHumanModified: boolean; editedContent: string | null }) => ({
          sectionKey: s.sectionKey,
          sectionLabel: s.sectionLabel,
          content: s.isHumanModified && s.editedContent ? s.editedContent : s.content,
        })));
        if (parsed.features.length === 0) continue;
        frdFeatureNames = {};
        frdFeatureScreenRefs = {};
        for (const f of parsed.features) {
          if (!f.featureId) continue;
          frdFeatureNames[f.featureId] = f.featureName ?? f.featureId;
          // The FRD parser stores the raw "Screen Reference:" value as
          // free text (e.g. "SCR-28 — Reset Password" or "SCR-30, SCR-31").
          // Pluck out the SCR-NN tokens so the renderers can resolve them
          // to the module's `BaScreen` rows by ID.
          const ids = extractScreenIds(f.screenRef);
          if (ids.length > 0) frdFeatureScreenRefs[f.featureId] = ids;
        }
        break;
      } catch {
        // Try the next candidate.
      }
    }

    return { testCases, frdFeatureNames, frdFeatureScreenRefs };
  }

  async renderHtml(artifactId: string): Promise<{ html: string; fileStem: string; typeLabel: string }> {
    const doc = await this.loadArtifactDoc(artifactId);
    // Compress screen images before they hit the HTML renderer. A fresh
    // upload from `BaScreen.fileData` is ~1.5 MB; FTC artifacts can
    // reference 60+ screens (one per feature bucket plus the catalog),
    // and Chrome's PDF pipeline OOMs on 100+ MB HTML payloads. This
    // resizes to ~600 px JPEG q72 — visually identical for catalog
    // thumbnails, ~30× smaller. No-op when `sharp` is unavailable.
    const compressedScreens = doc.module.screens
      ? await compressScreensForHtml(doc.module.screens)
      : doc.module.screens;
    const docForHtml = {
      ...doc,
      module: { ...doc.module, screens: compressedScreens },
    };
    let html = generateBaArtifactHtml(docForHtml);
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
  private async buildDocxFromDoc(input: BaArtifactDoc): Promise<Buffer> {
    // FRD pilot: parse features from the *original* input before
    // restructuring so the dedicated per-feature renderer can emit
    // bookmarked headings + inline screen images directly. Empty for
    // non-FRD artifacts — those go through the generic markdown→DOCX
    // path unchanged.
    const frdFeatures = input.artifactType === 'FRD' ? this.parseFrdFeaturesFromDoc(input) : null;

    // FTC pilot: build the same category → feature → TC structure the
    // HTML restructurer emits and keep it in scope so the body renderer
    // can emit bookmarked TC headings (which the post-restructure
    // markdown round-trip would lose). `null` for non-FTC types.
    const ftcStructure: FtcCategoryGroup[] | null = input.artifactType === 'FTC' && input.testCases
      ? buildFtcStructure(input.testCases, input.frdFeatureNames ?? {})
      : null;

    // Same canonical restructure as the HTML/PDF path so the DOCX TOC,
    // section headings, and standalone-section ordering stay aligned with
    // PDF and the editor tree. No-op for unrelated artifact types.
    const doc = restructureFtcDoc(restructureFrdDoc(input));

    // Render any Mermaid diagrams to PNG up front so the DOCX shows real
    // swim-lane visuals instead of the source code. One Chromium instance is
    // reused across diagrams. If puppeteer is unavailable or rendering
    // fails, callers fall back to the preformatted source text per-block.
    const mermaidImages = await this.prepareMermaidImages(doc);

    const children: Array<Paragraph | Table> = [];

    // ─── Cover page (matches HTML cover via shared style tokens) ───────
    this.appendCoverPage(children, doc);

    // Sort sections by displayOrder then createdAt for stable output, then
    // filter out internal-processing + preamble-only sections via the
    // shared predicate. Mirrors the HTML/PDF pipeline so PDF and DOCX are
    // never out of step on what reaches the customer. (Gap B fix.)
    const sorted = [...doc.sections]
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return at - bt;
      })
      .filter((s) => !shouldOmitFromExport(s));

    // ─── Document History (own page, mirrors the HTML history block) ───
    // Use the *original* sections — `restructureFrdDoc` collapses every
    // FRD feature into a synthetic parent section, which would reduce the
    // history to a single row. The original sections still carry the per-
    // section edit timestamps + AI/Human flags the audit trail needs.
    this.appendDocumentHistory(children, input.sections);

    // ─── Table of Contents (own page, hyperlinks to bookmarked headings)
    this.appendTableOfContents(children, sorted, frdFeatures, ftcStructure);

    // Embed the per-module screen catalog right after the TOC so the
    // customer can correlate every SCR-NN reference in the body with the
    // actual wireframe image. Only emitted for the artifact types where
    // screens are meaningful (EPIC / User Story / FTC / FRD / SubTask).
    this.appendScreensSection(children, doc);

    // Same screen list used for inline reference enrichment in the body —
    // every bare `SCR-NN` is rewritten to `SCR-NN — Title` so the Word doc
    // reads fluently without forcing a flip back to the screen catalog.
    const screensForEnrichment = doc.module.screens ?? [];

    let isFirstSection = true;
    for (const section of sorted) {
      const rawBody = section.isHumanModified && section.editedContent ? section.editedContent : section.content;
      if (!rawBody || !rawBody.trim()) continue;

      // Bookmarked section heading — TOC entries above hyperlink into
      // these IDs. First body section forces a page break so it doesn't
      // start mid-page right after the screens catalog.
      const sectionLabel = section.sectionLabel || section.sectionKey.replace(/_/g, ' ');
      const sectionBookmarkId = this.bookmarkIdFor(`sec_${section.sectionKey || section.id}`);
      children.push(this.buildBookmarkedHeading(
        sectionLabel,
        sectionBookmarkId,
        HeadingLevel.HEADING_1,
        { pageBreakBefore: isFirstSection },
      ));
      isFirstSection = false;

      // FRD canonical parent section: bypass the markdown→DOCX path and
      // render features directly so bookmarks + per-feature screen
      // thumbnails are guaranteed (the post-pass `injectFeatureScreensDocx`
      // can't reliably read heading text out of docx@9 Paragraph instances,
      // so we never depend on it for the FRD pilot).
      if (frdFeatures && section.sectionKey === 'frd_features') {
        const featBlocks = this.buildFrdFeatureBlocks(
          frdFeatures,
          doc.module.screens ?? [],
          mermaidImages,
        );
        for (const node of featBlocks) children.push(node);
        children.push(new Paragraph({ text: '' }));
        continue;
      }

      // FTC canonical category section: bypass markdown→DOCX so we can
      // emit bookmarks per feature bucket AND per individual TC. The
      // restructurer named these sections `ftc_<categoryKey>` (e.g.
      // `ftc_functional`); match by prefix to find the matching group in
      // `ftcStructure`.
      if (ftcStructure && section.sectionKey.startsWith('ftc_')) {
        const group = this.findFtcGroupForSection(section.sectionKey, ftcStructure);
        if (group) {
          const blocks = this.buildFtcCategoryBlocks(
            group,
            doc.frdFeatureScreenRefs ?? {},
            doc.module.screens ?? [],
          );
          for (const node of blocks) children.push(node);
          children.push(new Paragraph({ text: '' }));
          continue;
        }
      }

      // Generic path — unchanged for non-FRD types and for FRD
      // standalone sections (Business Rules, Validations, TBD-Future
      // Registry, "other" deliverable sections).
      const body = enrichScreenReferences(rawBody, screensForEnrichment);
      const blocks = this.markdownBlocksToDocx(body, mermaidImages);
      const blocksWithScreens = this.injectFeatureScreensDocx(blocks, body, doc.module.screens ?? []);
      for (const node of blocksWithScreens) {
        children.push(node);
      }
      children.push(new Paragraph({ text: '' }));
    }

    const document = new Document({
      creator: 'BA Tool',
      title: doc.artifactId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styles: buildDocxStyles() as any,
      description: `${doc.artifactType} for module ${doc.module.moduleId}`,
      sections: [{ children }],
    });

    return Packer.toBuffer(document);
  }

  /**
   * Match an FTC synthetic section's `sectionKey` (e.g. `ftc_functional`,
   * `ftc_white_box`) back to the matching `FtcCategoryGroup`. The
   * restructurer derives sectionKeys by lowercasing + sanitising the
   * group's `key`; we apply the same transform here so the lookup is a
   * straightforward equality check rather than a fuzzy match.
   */
  private findFtcGroupForSection(
    sectionKey: string,
    structure: FtcCategoryGroup[],
  ): FtcCategoryGroup | undefined {
    const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const target = sectionKey.replace(/^ftc_/, '');
    return structure.find((g) => normalize(g.key) === target);
  }

  /**
   * Render one FTC category group as bookmarked DOCX blocks. Emits, per
   * feature bucket: a bookmarked H2 feature heading, then per test case a
   * bookmarked H3 TC heading + a one-line metadata run + the body fields
   * (preconditions, test data, steps, expected, post-validation, etc.).
   *
   * Bookmark IDs match `appendTableOfContents`'s anchors so clicking a
   * feature or TC entry in the TOC jumps to the matching block in the
   * body. Empty fields are skipped to keep the page count tractable on
   * 150+ test-case artifacts.
   */
  private buildFtcCategoryBlocks(
    group: FtcCategoryGroup,
    featureScreenRefs: Record<string, string[]>,
    screens: BaArtifactDoc['module']['screens'],
  ): Array<Paragraph | Table> {
    const out: Array<Paragraph | Table> = [];
    const screenList = screens ?? [];
    const screenById = new Map(screenList.map((s) => [s.screenId, s] as const));

    for (const fb of group.featureBuckets) {
      const featBookmarkId = this.bookmarkIdFor(`ftc_feat_${group.key}_${fb.featureId}`);
      out.push(this.buildBookmarkedHeading(
        fb.featureLabel,
        featBookmarkId,
        HeadingLevel.HEADING_2,
      ));

      // Resolve this feature's screenRefs once per bucket — every TC in
      // the bucket maps to the same feature, so emit the screen card
      // ONCE under the feature heading and let every TC below inherit
      // the visual context. Avoids 150+ duplicated images that bloat
      // the DOCX file and overwhelm Chrome on the PDF render path.
      // Skipped silently when the FTC has no sibling FRD or the feature
      // has no `Screen Reference:` line.
      const featScreenIds = featureScreenRefs[fb.featureId] ?? [];
      const featScreens = featScreenIds
        .map((sid) => screenById.get(sid))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

      for (const screen of featScreens) {
        out.push(new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: `${screen.screenId} — ${screen.screenTitle}`,
              size: DOCX_FONT_HALF_PTS.caption,
              font: 'Consolas',
              color: COLORS.idRefFg,
              shading: { type: ShadingType.SOLID, color: COLORS.idRefBg, fill: COLORS.idRefBg },
            }),
          ],
        }));
        const decoded = this.decodeScreenImage(screen.fileData);
        if (!decoded) continue;
        try {
          out.push(new Paragraph({
            spacing: { before: 0, after: 160 },
            children: [
              new ImageRun({
                data: decoded.buffer,
                transformation: this.scaleImageForDocx(decoded.width, decoded.height, 460),
                type: decoded.type,
              }),
            ],
          }));
        } catch (err) {
          this.logger.warn(`Failed inline feature screen embed ${screen.screenId} in ${group.key}/${fb.featureId}: ${(err as Error).message}`);
        }
      }

      for (const tc of fb.testCases) {
        const tcBookmarkId = this.bookmarkIdFor(`ftc_tc_${tc.id}`);
        out.push(this.buildBookmarkedHeading(
          `${tc.testCaseId}: ${tc.title}`,
          tcBookmarkId,
          HeadingLevel.HEADING_3,
        ));

        // Compact metadata run — Type · Priority · Integration · OWASP · Scenario.
        const metaParts: string[] = [];
        metaParts.push(`Type: ${tc.testKind.charAt(0).toUpperCase()}${tc.testKind.slice(1)}`);
        if (tc.priority) metaParts.push(`Priority: ${tc.priority}`);
        if (tc.isIntegrationTest) metaParts.push('Integration');
        if (tc.owaspCategory) metaParts.push(`OWASP: ${tc.owaspCategory}`);
        if (tc.scenarioGroup) metaParts.push(`Scenario: ${tc.scenarioGroup}`);
        out.push(new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [new TextRun({
            text: metaParts.join('  ·  '),
            italics: true,
            color: COLORS.muted,
            size: DOCX_FONT_HALF_PTS.caption,
          })],
        }));

        // Traceability — only when something is actually linked.
        const traceParts: string[] = [];
        if (tc.linkedFeatureIds.length > 0) traceParts.push(`Feature: ${tc.linkedFeatureIds.join(', ')}`);
        if (tc.linkedEpicIds.length > 0) traceParts.push(`EPIC: ${tc.linkedEpicIds.join(', ')}`);
        if (tc.linkedStoryIds.length > 0) traceParts.push(`Story: ${tc.linkedStoryIds.join(', ')}`);
        if (tc.linkedSubtaskIds.length > 0) traceParts.push(`SubTask: ${tc.linkedSubtaskIds.join(', ')}`);
        if (traceParts.length > 0) {
          out.push(new Paragraph({
            spacing: { before: 0, after: 80 },
            children: [new TextRun({
              text: traceParts.join('  ·  '),
              color: COLORS.idRefFg,
              size: DOCX_FONT_HALF_PTS.caption,
            })],
          }));
        }

        // Note: the screen card was emitted once per feature bucket above
        // (not once per TC). The screen applies to every TC in the bucket,
        // so the per-feature emission is sufficient and keeps the file
        // size + render time tractable on 150+ TC modules.

        // Body fields — flow through `markdownBlocksToDocx` so bullets /
        // bolds / SQL fences render as proper Word constructs. Skipping
        // empty fields keeps the per-TC footprint compact.
        const fieldMd = this.formatTestCaseFieldsAsMarkdown(tc);
        if (fieldMd) {
          const blocks = this.markdownBlocksToDocx(fieldMd);
          for (const b of blocks) out.push(b);
        }
      }
    }
    return out;
  }

  /**
   * Format a TC's body fields (preconditions / test data / e2e flow /
   * steps / expected / post-validation / SQL / Playwright / dev hints) as
   * markdown. Empty fields are dropped so a sparse TC produces a sparse
   * page rather than a wall of empty labels.
   *
   * Companion to `formatTestCaseBlock` in `ftc-structure.ts` — that one
   * builds the entire markdown block (heading + meta + body) for the
   * HTML/PDF path; this one only emits the body fields because the
   * DOCX feature renderer already laid down the heading + meta line as
   * bookmarked paragraphs.
   */
  private formatTestCaseFieldsAsMarkdown(tc: BaTestCaseLite): string {
    const lines: string[] = [];
    if (tc.preconditions?.trim()) {
      lines.push('**Pre-conditions:**', '', tc.preconditions.trim(), '');
    }
    if (tc.testData?.trim()) {
      lines.push('**Test Data:**', '', tc.testData.trim(), '');
    }
    if (tc.e2eFlow?.trim()) {
      lines.push(`**E2E Flow:** ${tc.e2eFlow.trim()}`, '');
    }
    if (tc.steps?.trim()) {
      lines.push('**Steps:**', '', tc.steps.trim(), '');
    }
    if (tc.expected?.trim()) {
      lines.push('**Expected:**', '', tc.expected.trim(), '');
    }
    if (tc.postValidation?.trim()) {
      lines.push('**Post-validation:**', '', tc.postValidation.trim(), '');
    }
    if (tc.sqlSetup?.trim()) {
      lines.push('**SQL Setup:**', '', '```sql', tc.sqlSetup.trim(), '```', '');
    }
    if (tc.sqlVerify?.trim()) {
      lines.push('**SQL Verify:**', '', '```sql', tc.sqlVerify.trim(), '```', '');
    }
    if (tc.playwrightHint?.trim()) {
      lines.push(`**Playwright Hint:** ${tc.playwrightHint.trim()}`, '');
    }
    if (tc.developerHints?.trim()) {
      lines.push(`**Developer Hints:** ${tc.developerHints.trim()}`, '');
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  /**
   * Server-side mirror of `parseFrdContent` for the DOCX path. Returns the
   * parsed features (sorted by ID) or null when the artifact isn't an FRD or
   * has no features. The caller uses the result to drive
   * `buildFrdFeatureBlocks` and the FRD-aware TOC nesting.
   */
  private parseFrdFeaturesFromDoc(input: BaArtifactDoc): ParsedFeature[] | null {
    if (input.artifactType !== 'FRD') return null;
    const sections = [...input.sections].sort((a, b) => a.displayOrder - b.displayOrder);
    const parsed = parseFrdContent(sections.map((s) => ({
      sectionKey: s.sectionKey,
      sectionLabel: s.sectionLabel,
      content: s.isHumanModified && s.editedContent ? s.editedContent : s.content,
    })));
    return parsed.features.length > 0 ? parsed.features : null;
  }

  /**
   * Build a stable Word bookmark ID from an arbitrary stem. Word constraints:
   * starts with a letter, only letters/digits/underscores, max 40 chars.
   * The same `stem` always produces the same ID so the TOC's
   * `InternalHyperlink({ anchor })` and the body's `Bookmark({ id })` line
   * up.
   */
  private bookmarkIdFor(stem: string): string {
    const sanitised = stem.replace(/[^a-zA-Z0-9_]/g, '_');
    const withLeadingLetter = /^[a-zA-Z]/.test(sanitised) ? sanitised : `b_${sanitised}`;
    return withLeadingLetter.slice(0, 40);
  }

  /**
   * Heading paragraph whose text is wrapped in a `Bookmark`. Every body
   * heading callable from the TOC goes through this helper so the TOC
   * hyperlinks always have a matching anchor.
   */
  private buildBookmarkedHeading(
    text: string,
    bookmarkId: string,
    level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
    options: { pageBreakBefore?: boolean } = {},
  ): Paragraph {
    return new Paragraph({
      heading: level,
      pageBreakBefore: options.pageBreakBefore === true,
      children: [
        new Bookmark({
          id: bookmarkId,
          children: [new TextRun({ text })],
        }),
      ],
    });
  }

  /**
   * Document History block — own page, table with Date / Section / Action /
   * By columns. Mirrors the HTML history block so PDF and DOCX show the
   * same audit trail. Falls back to a single italic line when no sections
   * carry AI-generated or human-edited markers.
   */
  private appendDocumentHistory(
    children: Array<Paragraph | Table>,
    sortedSections: BaArtifactDoc['sections'],
  ): void {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      text: 'Document History',
    }));

    const rows = [...sortedSections]
      .filter((s) => s.isHumanModified || s.aiGenerated)
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
      .slice(0, 50);

    if (rows.length === 0) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: 'No edits or AI generations recorded.',
          italics: true,
          size: DOCX_FONT_HALF_PTS.body,
          color: COLORS.muted,
        })],
      }));
      return;
    }

    const headerCell = (label: string): TableCell => new TableCell({
      shading: { type: ShadingType.SOLID, color: COLORS.surfaceMuted, fill: COLORS.surfaceMuted },
      children: [new Paragraph({
        children: [new TextRun({
          text: label,
          bold: true,
          size: DOCX_FONT_HALF_PTS.body,
          color: COLORS.text,
        })],
      })],
    });
    const dataCell = (text: string): TableCell => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, size: DOCX_FONT_HALF_PTS.body, color: COLORS.text })],
      })],
    });

    const headerRow = new TableRow({
      tableHeader: true,
      children: ['Date', 'Section', 'Action', 'By'].map(headerCell),
    });

    const dataRows = rows.map((s) => {
      const who = s.isHumanModified ? 'Human' : s.aiGenerated ? 'AI' : '—';
      const action = s.isHumanModified ? 'Edited' : 'Generated';
      return new TableRow({
        children: [
          dataCell(this.formatHumanDate(s.updatedAt)),
          dataCell(s.sectionLabel),
          dataCell(action),
          dataCell(who),
        ],
      });
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }));
  }

  /**
   * Format a feature's labelled fields (Description / Priority / Status /
   * Trigger / Pre- / Post- / Business Rules / Validations / Integration
   * Signals / Acceptance Criteria) as deterministic markdown. Multi-line
   * fields keep their bullet structure so `markdownBlocksToDocx` renders
   * them as proper Word lists. Description appears first; the screen card
   * is spliced in BEFORE the Description by the caller so PDF and DOCX
   * read top-to-bottom in the same order.
   */
  private formatFeatureFieldsAsMarkdown(f: ParsedFeature): string {
    const lines: string[] = [];
    if (f.description) { lines.push(`**Description:** ${f.description}`); lines.push(''); }
    if (f.priority) { lines.push(`**Priority:** ${f.priority}`); lines.push(''); }
    if (f.status) { lines.push(`**Status:** ${f.status}`); lines.push(''); }
    if (f.trigger) { lines.push(`**Trigger:** ${f.trigger}`); lines.push(''); }
    if (f.preConditions) { lines.push(`**Pre-conditions:**`); lines.push(''); lines.push(f.preConditions); lines.push(''); }
    if (f.postConditions) { lines.push(`**Post-conditions:**`); lines.push(''); lines.push(f.postConditions); lines.push(''); }
    if (f.businessRules) { lines.push(`**Business Rules:**`); lines.push(''); lines.push(f.businessRules); lines.push(''); }
    if (f.validations) { lines.push(`**Validations:**`); lines.push(''); lines.push(f.validations); lines.push(''); }
    if (f.integrationSignals) { lines.push(`**Integration Signals:**`); lines.push(''); lines.push(f.integrationSignals); lines.push(''); }
    if (f.acceptanceCriteria) { lines.push(`**Acceptance Criteria:**`); lines.push(''); lines.push(f.acceptanceCriteria); lines.push(''); }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * FRD-only per-feature renderer. Emits — for every parsed feature — a
   * bookmarked H2 heading, then the feature's referenced wireframe
   * (caption + image), then the labelled body fields as Word paragraphs.
   * The bookmark IDs match what `appendTableOfContents` hyperlinks to so
   * clicking a feature in the TOC jumps to the corresponding heading.
   *
   * Replaces the `injectFeatureScreensDocx` post-pass for FRD content —
   * that pass relied on `Paragraph.options.text` which docx@9 doesn't
   * expose, silently dropping every per-feature thumbnail.
   */
  private buildFrdFeatureBlocks(
    features: ParsedFeature[],
    screens: BaArtifactDoc['module']['screens'],
    mermaidImages: Map<string, MermaidImage>,
  ): Array<Paragraph | Table> {
    const out: Array<Paragraph | Table> = [];
    const screenList = screens ?? [];
    const screenById = new Map(screenList.map((s) => [s.screenId, s]));

    for (const f of features) {
      const featBookmarkId = this.bookmarkIdFor(`feat_${f.featureId}`);
      out.push(this.buildBookmarkedHeading(
        `${f.featureId}: ${f.featureName}`,
        featBookmarkId,
        HeadingLevel.HEADING_2,
      ));

      // Inline screen card — rendered immediately under the heading so
      // the layout matches the PDF (image at the top, prose below).
      const screenIds = extractScreenIds(f.screenRef);
      for (const sid of screenIds) {
        const screen = screenById.get(sid);
        if (!screen) continue;
        out.push(new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: `${screen.screenId} — ${screen.screenTitle}`,
              size: DOCX_FONT_HALF_PTS.caption,
              font: 'Consolas',
              color: COLORS.idRefFg,
              shading: { type: ShadingType.SOLID, color: COLORS.idRefBg, fill: COLORS.idRefBg },
            }),
          ],
        }));
        const decoded = this.decodeScreenImage(screen.fileData);
        if (!decoded) continue;
        try {
          out.push(new Paragraph({
            spacing: { before: 0, after: 160 },
            children: [
              new ImageRun({
                data: decoded.buffer,
                transformation: this.scaleImageForDocx(decoded.width, decoded.height, 460),
                type: decoded.type,
              }),
            ],
          }));
        } catch (err) {
          this.logger.warn(`Failed inline screen embed ${screen.screenId}: ${(err as Error).message}`);
        }
      }

      // Body fields. We delegate to the existing markdown converter so
      // bullet lists / inline `**bold**` etc. render the same way as
      // every other section.
      const fieldMd = this.formatFeatureFieldsAsMarkdown(f);
      if (fieldMd) {
        const blocks = this.markdownBlocksToDocx(fieldMd, mermaidImages);
        for (const b of blocks) out.push(b);
      }
    }
    return out;
  }

  // ─── Document-structure helpers ────────────────────────────────────────

  /**
   * Build the cover page using a 1-cell layout table so the centered block
   * mirrors the HTML cover's visual weight (eyebrow / title / accent rule /
   * KV grid / status). docx headings + paragraph borders give us the brand
   * accent line without the html-docx-js fragility we used to depend on.
   */
  private appendCoverPage(children: Array<Paragraph | Table>, doc: BaArtifactDoc): void {
    const productName = doc.project.productName?.trim() || doc.project.name;
    const typeLabel = ARTIFACT_TYPE_LABELS_DOCX[doc.artifactType] ?? doc.artifactType.replace(/_/g, ' ');

    // Eyebrow (artifact type label, all-caps, muted).
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 80 },
      children: [
        new TextRun({
          text: typeLabel.toUpperCase(),
          size: DOCX_FONT_HALF_PTS.coverEyebrow,
          color: COLORS.muted,
          characterSpacing: 60, // ≈ 0.18em letter spacing in docx (units = 1/20 pt)
        }),
      ],
    }));

    // Big title (artifact ID).
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: doc.artifactId,
          size: DOCX_FONT_HALF_PTS.coverTitle,
          bold: true,
          color: COLORS.text,
        }),
      ],
    }));

    // Accent divider — short bottom-bordered empty paragraph mirroring
    // the HTML cover's 72×3 px orange rule.
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 280 },
      border: {
        bottom: { color: COLORS.accent, space: 1, style: BorderStyle.SINGLE, size: 18 },
      },
      // Extra padding so the bottom border floats clear of any text below.
      children: [new TextRun({ text: '          ' })],
    }));

    // KV table: 2 columns, no outer border (cell borders only on bottom for
    // a soft separator). Mirrors the <dl> grid in HTML.
    const kvRows: Array<[string, string]> = [
      ['Product Name', productName],
      ['Project Code', doc.project.projectCode],
      ['Module', `${doc.module.moduleId} — ${doc.module.moduleName}`],
      ['Client Name', doc.project.clientName ?? '—'],
      ['Submitted By', doc.project.submittedBy ?? '—'],
      ['Date', this.formatHumanDate(doc.updatedAt)],
      ['Status', doc.status.replace(/_/g, ' ')],
    ];
    children.push(this.buildCoverKvTable(kvRows, doc.status));
    // No trailing break paragraph — Document History / TOC / Screens / first
    // body section each set `pageBreakBefore: true` on their leading
    // paragraph, which keeps the cover on its own page without an extra
    // blank line at the bottom of every export.
  }

  private buildCoverKvTable(rows: Array<[string, string]>, status: string): Table {
    const C = COLORS;
    const cellPadding = { top: DOCX_TABLE_CELL_PADDING_TWIPS, bottom: DOCX_TABLE_CELL_PADDING_TWIPS, left: DOCX_TABLE_CELL_PADDING_TWIPS, right: DOCX_TABLE_CELL_PADDING_TWIPS };
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };
    const softBottom = { style: BorderStyle.SINGLE, size: 4, color: C.borderSoft };
    const cellBorders = { top: noBorder, left: noBorder, right: noBorder, bottom: softBottom };

    const tableRows = rows.map(([k, v], idx) => {
      const isStatus = k === 'Status';
      const valueRuns: TextRun[] = isStatus
        ? [new TextRun({
            text: ` ${v} `,
            size: DOCX_FONT_HALF_PTS.coverDl,
            bold: true,
            color: this.statusFg(status),
            shading: { type: ShadingType.SOLID, color: this.statusBg(status), fill: this.statusBg(status) },
          })]
        : [new TextRun({
            text: v,
            size: DOCX_FONT_HALF_PTS.coverDl,
            color: C.text,
          })];
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: cellPadding,
            borders: cellBorders,
            children: [new Paragraph({
              children: [new TextRun({
                text: `${k}:`,
                size: DOCX_FONT_HALF_PTS.coverDl,
                color: C.muted,
                bold: false,
              })],
            })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: cellPadding,
            borders: cellBorders,
            children: [new Paragraph({ children: valueRuns })],
          }),
        ],
      });
    });

    return new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: tableRows,
    });
  }

  private statusBg(status: string): string {
    const k = statusKindFor(status);
    if (k === 'approved') return COLORS.statusApprovedBg;
    if (k === 'partial') return COLORS.statusPartialBg;
    if (k === 'confirmed') return COLORS.statusConfirmedBg;
    return COLORS.statusDraftBg;
  }
  private statusFg(status: string): string {
    const k = statusKindFor(status);
    if (k === 'approved') return COLORS.statusApprovedFg;
    if (k === 'partial') return COLORS.statusPartialFg;
    if (k === 'confirmed') return COLORS.statusConfirmedFg;
    return COLORS.statusDraftFg;
  }

  private formatHumanDate(d: string | Date | null | undefined): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * Static Table of Contents — mirrors the HTML nested TOC. Each section
   * gets a bold entry; inner headings (markdown ## / ### / #### inside
   * the section body) are emitted as indented italic entries. We don't
   * use docx's TableOfContents() field because that requires Word to
   * recalculate fields on open, which not every renderer does reliably
   * (e.g. LibreOffice / Pages).
   */
  private appendTableOfContents(
    children: Array<Paragraph | Table>,
    sortedSections: BaArtifactDoc['sections'],
    frdFeatures: ParsedFeature[] | null,
    ftcStructure: FtcCategoryGroup[] | null,
  ): void {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      text: 'Table of Contents',
      spacing: { before: 0, after: 160 },
    }));

    sortedSections.forEach((section, idx) => {
      const sectionLabel = section.sectionLabel || section.sectionKey.replace(/_/g, ' ');
      const sectionBookmarkId = this.bookmarkIdFor(`sec_${section.sectionKey || section.id}`);

      // Top-level entry — clickable hyperlink into the matching body
      // bookmark. Word renders `InternalHyperlink` with the default
      // hyperlink character style (blue + underlined) when the document
      // styles include one; we bold it here for visual hierarchy.
      children.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new InternalHyperlink({
            anchor: sectionBookmarkId,
            children: [new TextRun({
              text: `${idx + 1}. ${sectionLabel}`,
              bold: true,
              size: DOCX_FONT_HALF_PTS.body,
              color: COLORS.text,
              style: 'Hyperlink',
            })],
          }),
        ],
      }));

      // FRD canonical parent: emit each parsed feature as a nested
      // hyperlink so the TOC mirrors the editor tree
      // (FRD-MOD-XX → F-XX-YY). Bookmarks are created in
      // `buildFrdFeatureBlocks` with the same `feat_<featureId>` stem.
      if (frdFeatures && section.sectionKey === 'frd_features') {
        frdFeatures.forEach((f) => {
          const featBookmarkId = this.bookmarkIdFor(`feat_${f.featureId}`);
          children.push(new Paragraph({
            indent: { left: 360 },
            spacing: { before: 20, after: 20 },
            children: [
              new InternalHyperlink({
                anchor: featBookmarkId,
                children: [new TextRun({
                  text: `${f.featureId} — ${f.featureName}`,
                  size: DOCX_FONT_HALF_PTS.caption,
                  color: COLORS.muted,
                  style: 'Hyperlink',
                })],
              }),
            ],
          }));
        });
        return;
      }

      // FTC canonical category section: emit nested feature buckets and
      // per-test-case entries. Bookmarks match the IDs created in
      // `buildFtcCategoryBlocks` (`ftc_feat_<cat>_<fid>` and
      // `ftc_tc_<tcDbId>`). Two indent levels (360 / 720 twips) line up
      // with the editor tree's three-level nesting.
      if (ftcStructure && section.sectionKey.startsWith('ftc_')) {
        const group = this.findFtcGroupForSection(section.sectionKey, ftcStructure);
        if (group) {
          for (const fb of group.featureBuckets) {
            const featBookmarkId = this.bookmarkIdFor(`ftc_feat_${group.key}_${fb.featureId}`);
            children.push(new Paragraph({
              indent: { left: 360 },
              spacing: { before: 30, after: 20 },
              children: [
                new InternalHyperlink({
                  anchor: featBookmarkId,
                  children: [new TextRun({
                    text: fb.featureLabel,
                    bold: true,
                    size: DOCX_FONT_HALF_PTS.caption,
                    color: COLORS.text,
                    style: 'Hyperlink',
                  })],
                }),
              ],
            }));
            for (const tc of fb.testCases) {
              const tcBookmarkId = this.bookmarkIdFor(`ftc_tc_${tc.id}`);
              children.push(new Paragraph({
                indent: { left: 720 },
                spacing: { before: 10, after: 10 },
                children: [
                  new InternalHyperlink({
                    anchor: tcBookmarkId,
                    children: [new TextRun({
                      text: `${tc.testCaseId} — ${tc.title}`,
                      size: DOCX_FONT_HALF_PTS.caption,
                      color: COLORS.muted,
                      italics: tc.testKind === 'negative',
                      style: 'Hyperlink',
                    })],
                  }),
                ],
              }));
            }
          }
          return;
        }
      }

      // Non-FRD inner headings stay as informational indented text. We
      // don't bookmark inner markdown headings (no stable anchor target),
      // so making them hyperlinks would lead nowhere. Section-level
      // hyperlinks above are sufficient for navigation.
      const body = (section.isHumanModified && section.editedContent) ? section.editedContent : section.content;
      if (!body) return;
      const inner = this.extractInnerHeadingsForToc(body);
      for (const ih of inner) {
        children.push(new Paragraph({
          indent: { left: ih.depth === 2 ? 360 : 720 },
          spacing: { before: 20, after: 20 },
          children: [new TextRun({
            text: ih.text,
            size: DOCX_FONT_HALF_PTS.caption,
            color: COLORS.muted,
            italics: ih.depth === 3,
          })],
        }));
      }
    });
  }

  /**
   * Mirrors the extractInnerHeadings helper in artifact-html.ts but without
   * generating slugs (DOCX TOC entries don't hyperlink — they're informational).
   * Skips headings inside fenced code blocks; normalises depth so the
   * shallowest heading depth in a section becomes "depth 2".
   */
  private extractInnerHeadingsForToc(md: string): Array<{ text: string; depth: 2 | 3 }> {
    const lines = md.split(/\r?\n/);
    let inFence = false;
    const collected: Array<{ text: string; rawLevel: number }> = [];
    for (const raw of lines) {
      const t = raw.trim();
      if (/^```/.test(t)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^(#{1,6})\s+(.*)$/.exec(t);
      if (!m) continue;
      collected.push({ text: m[2].trim(), rawLevel: m[1].length });
    }
    if (collected.length === 0) return [];
    const minRaw = Math.min(...collected.map((c) => c.rawLevel));
    return collected
      .map((c) => ({ text: c.text, depth: (c.rawLevel === minRaw ? 2 : 3) as 2 | 3 }))
      // Bumped from 50 for the FTC pilot — see the matching comment in
      // `templates/artifact-html.ts::extractInnerHeadings`.
      .slice(0, 500);
  }

  /**
   * After markdownBlocksToDocx renders a section into Paragraph/Table blocks,
   * walk the markdown source for `^####? F-XX-YY:` feature headings + their
   * `Screen Reference: SCR-NN` line, and splice the screen image right after
   * the matching heading paragraph in the blocks array.
   *
   * Matching strategy: find the index of the paragraph whose plain text
   * starts with `F-XX-YY:` (heading paragraphs from markdown headings carry
   * the heading text as their first run). For each match insert an
   * ImageRun-bearing paragraph immediately after.
   */
  private injectFeatureScreensDocx(
    blocks: Array<Paragraph | Table>,
    rawMarkdown: string,
    screens: Array<{ screenId: string; screenTitle: string; screenType: string | null; fileData: string }>,
  ): Array<Paragraph | Table> {
    if (screens.length === 0 || !rawMarkdown) return blocks;
    const screenById = new Map(screens.map((s) => [s.screenId, s]));

    // Walk the markdown source to learn which feature ID maps to which screen.
    const lines = rawMarkdown.split(/\r?\n/);
    const featureToScreen = new Map<string, string>();
    for (let i = 0; i < lines.length; i++) {
      const m = /^#{2,4}\s+(F-\d+-\d+):/i.exec(lines[i].trim());
      if (!m) continue;
      const featureId = m[1].toUpperCase();
      const startDepth = (lines[i].match(/^#+/) ?? [''])[0].length;
      for (let j = i + 1; j < Math.min(lines.length, i + 60); j++) {
        const nextHash = /^(#{1,6})\s/.exec(lines[j].trim());
        if (nextHash && nextHash[1].length <= startDepth) break;
        const sm = /Screen\s+Reference[\s*_:]*\s*(SCR-\d+)/i.exec(lines[j]);
        if (sm) {
          featureToScreen.set(featureId, sm[1].toUpperCase());
          break;
        }
      }
    }

    if (featureToScreen.size === 0) return blocks;

    const out: Array<Paragraph | Table> = [];
    for (const block of blocks) {
      out.push(block);
      const headingFid = this.extractFeatureIdFromHeadingBlock(block);
      if (!headingFid) continue;
      const screenId = featureToScreen.get(headingFid);
      if (!screenId) continue;
      const screen = screenById.get(screenId);
      if (!screen) continue;
      // Caption (e.g. SCR-01 — Order Document List), then the image itself.
      out.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: `${screen.screenId} — ${screen.screenTitle}`,
            size: DOCX_FONT_HALF_PTS.caption,
            font: 'Consolas',
            color: COLORS.idRefFg,
            shading: { type: ShadingType.SOLID, color: COLORS.idRefBg, fill: COLORS.idRefBg },
          }),
        ],
      }));
      const decoded = this.decodeScreenImage(screen.fileData);
      if (decoded) {
        try {
          out.push(new Paragraph({
            spacing: { before: 0, after: 160 },
            children: [
              new ImageRun({
                data: decoded.buffer,
                transformation: this.scaleImageForDocx(decoded.width, decoded.height, 460),
                type: decoded.type,
              }),
            ],
          }));
        } catch (err) {
          this.logger.warn(`Failed inline screen embed ${screen.screenId}: ${(err as Error).message}`);
        }
      }
    }
    return out;
  }

  /**
   * Inspect a Paragraph block produced by markdownBlocksToDocx and decide
   * whether it's a heading whose first text starts with an `F-XX-YY:`
   * feature ID. Returns the upper-cased feature ID or null.
   *
   * Tables can never be feature headings, so they're skipped.
   */
  private extractFeatureIdFromHeadingBlock(block: Paragraph | Table): string | null {
    if (block instanceof Table) return null;
    // The Paragraph instance doesn't expose its run text via public API in
    // docx 9.x. Read the JSON-serialised representation; OOXML attribute
    // names are stable across versions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (block as any)?.options ?? (block as any)?.root ?? null;
    // Fast-path: most heading blocks pass the `text` shorthand at construction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directText: string | undefined = (block as any)?.options?.text ?? (block as any)?.text;
    if (typeof directText === 'string') {
      const m = /^(F-\d+-\d+):/i.exec(directText.trim());
      if (m) return m[1].toUpperCase();
    }
    if (json && Array.isArray(json)) {
      for (const child of json) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t: string | undefined = (child as any)?.options?.text ?? (child as any)?.text;
        if (typeof t === 'string') {
          const m = /^(F-\d+-\d+):/i.exec(t.trim());
          if (m) return m[1].toUpperCase();
        }
      }
    }
    return null;
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
   * Artifact types where the per-module screen catalog is a meaningful
   * deliverable. Mirrors the `wanted` set inside the HTML template's
   * `renderScreensBlock`. LLD and SCREEN_ANALYSIS are intentionally
   * excluded — those are technical/internal docs.
   */
  private readonly SCREENS_BLOCK_ARTIFACT_TYPES = new Set([
    'EPIC',
    'USER_STORY',
    'SUBTASK',
    'FRD',
    'FTC',
  ]);

  /**
   * Append a "Referenced Screens" section to the DOCX body, right after the
   * title page. Each screen renders as a small block: ID + title heading,
   * type chip, and the wireframe image scaled to page width. The HTML/PDF
   * path produces the same visual via `renderScreensBlock` in the template.
   *
   * Failures (corrupt base64, unsupported MIME, oversized data) are logged
   * and the screen is skipped — the export never fails because of one bad
   * image.
   */
  private appendScreensSection(children: Array<Paragraph | Table>, doc: BaArtifactDoc): void {
    if (!this.SCREENS_BLOCK_ARTIFACT_TYPES.has(doc.artifactType)) return;
    const screens = doc.module.screens ?? [];
    if (screens.length === 0) return;

    children.push(new Paragraph({
      text: `Referenced Screens (${screens.length})`,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
    }));
    children.push(new Paragraph({
      children: [new TextRun({
        text: 'The wireframes below are referenced throughout this document by their Screen ID (e.g. SCR-01). Each ID is annotated with the screen title in the body sections so the reader can match a reference to its source without leaving the document.',
        italics: true,
        size: 18,
      })],
    }));
    children.push(new Paragraph({ text: '' }));

    for (const s of screens) {
      // Heading: ID — Title  (matches the inline body enrichment style)
      children.push(new Paragraph({
        children: [
          new TextRun({ text: s.screenId, bold: true, font: 'Consolas', size: 22 }),
          new TextRun({ text: '  —  ', bold: true, size: 22 }),
          new TextRun({ text: s.screenTitle, bold: true, size: 22 }),
        ],
      }));
      if (s.screenType) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Type: ${s.screenType}`, italics: true, size: 18, color: '64748B' })],
        }));
      }

      const decoded = this.decodeScreenImage(s.fileData);
      if (decoded) {
        try {
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: decoded.buffer,
                transformation: this.scaleImageForDocx(decoded.width, decoded.height, 540),
                type: decoded.type,
              }),
            ],
          }));
        } catch (err) {
          this.logger.warn(`Failed to embed image for ${s.screenId}: ${(err as Error).message}`);
          children.push(new Paragraph({
            children: [new TextRun({ text: `(image unavailable for ${s.screenId})`, italics: true, size: 18, color: '94A3B8' })],
          }));
        }
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: `(image unavailable for ${s.screenId})`, italics: true, size: 18, color: '94A3B8' })],
        }));
      }
      children.push(new Paragraph({ text: '' }));
    }
  }

  /**
   * Decode a screen's `fileData` (a `data:image/<type>;base64,...` URL) into
   * a Buffer + dimensions + DOCX-compatible `type` discriminator.
   *
   * `BaScreen.fileData` is stored as a complete data-URL by the upload
   * pipeline; we sniff the MIME from the URL prefix and fall back to
   * `image/png` when the prefix is missing. Returns null when the input is
   * empty, malformed, or carries a MIME type the `docx` library doesn't
   * support natively (e.g. webp — which Word renderers handle inconsistently).
   *
   * Width/height default to `0` when we can't read the PNG/JPEG header
   * cheaply; `scaleImageForDocx` clamps to `maxWidthPx` in that case so
   * Word still gets a usable image.
   */
  private decodeScreenImage(fileData: string): { buffer: Buffer; type: DocxImageType; width: number; height: number } | null {
    if (!fileData || typeof fileData !== 'string') return null;

    const dataUrlMatch = fileData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
    let mime = 'png';
    let b64 = fileData;
    if (dataUrlMatch) {
      mime = dataUrlMatch[1].toLowerCase();
      b64 = dataUrlMatch[2];
    }
    // Map sniffed MIME to docx-supported `type`. The library accepts
    // png/jpg/gif/bmp/svg; everything else is rejected with a runtime
    // error inside `Packer.toBuffer`. Treat `jpeg` as `jpg`.
    let type: DocxImageType;
    switch (mime) {
      case 'png': type = 'png'; break;
      case 'jpg':
      case 'jpeg': type = 'jpg'; break;
      case 'gif': type = 'gif'; break;
      case 'bmp': type = 'bmp'; break;
      default:
        // SVG / WebP / unknown — skip so the export doesn't fail. The
        // caller writes a "(image unavailable for SCR-NN)" placeholder.
        this.logger.warn(`Unsupported screen image MIME "image/${mime}" — skipping in DOCX`);
        return null;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(b64, 'base64');
    } catch (err) {
      this.logger.warn(`Screen image base64 decode failed: ${(err as Error).message}`);
      return null;
    }
    if (buffer.length === 0) return null;

    const dims = this.sniffImageDimensions(buffer, type);
    return { buffer, type, width: dims.width, height: dims.height };
  }

  /**
   * Read PNG/JPEG dimensions from the image header without decoding the
   * pixel data. Returns `{0,0}` when the header isn't recognised — the
   * caller's `scaleImageForDocx` clamps to `maxWidthPx` in that case.
   */
  private sniffImageDimensions(buffer: Buffer, type: DocxImageType): { width: number; height: number } {
    if (type === 'png' && buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (type === 'jpg') {
      // Walk JPEG markers to find the SOF (Start Of Frame) chunk that
      // carries height + width. Keep the walk bounded so a corrupt header
      // can't loop forever.
      let i = 2;
      const end = Math.min(buffer.length - 8, 65535);
      while (i < end) {
        if (buffer[i] !== 0xff) break;
        const marker = buffer[i + 1];
        const segLen = buffer.readUInt16BE(i + 2);
        const isSof = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSof) {
          return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
        }
        i += 2 + segLen;
      }
    }
    return { width: 0, height: 0 };
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
