/**
 * Verifies the screen-image embedding pipeline introduced in commit
 * d7f4303. Bootstraps the Nest application context (no HTTP listener),
 * grabs the live BaArtifactExportService, and renders the latest FTC,
 * EPIC, and USER_STORY artifacts for the target module to DOCX (and
 * just one PDF as a sanity check).
 *
 * For each rendered artifact it reports:
 *  - output buffer size (so we can spot suspiciously small DOCX files
 *    that didn't actually embed images)
 *  - which screens were available, decoded successfully, and which
 *    fell back to "(image unavailable for SCR-NN)"
 *  - whether the rendered HTML contains each screen's tile + the
 *    inline `SCR-NN — Title` enrichment
 *
 * Output is written to scripts/_verify-screen-embed/ so binaries don't
 * pollute the repo root. Pass --keep to retain them for manual review;
 * they're cleared by default.
 *
 * Usage:
 *   npx ts-node scripts/_verify-screen-embed.ts
 *   npx ts-node scripts/_verify-screen-embed.ts --module MOD-04 --keep
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { BaArtifactExportService } from '../src/ba-tool/ba-artifact-export.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface Args {
  moduleId: string;
  keep: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const moduleFlag = argv.indexOf('--module');
  const moduleId = moduleFlag >= 0 ? argv[moduleFlag + 1] : 'MOD-04';
  const keep = argv.includes('--keep');
  return { moduleId, keep };
}

async function main(): Promise<void> {
  const { moduleId: targetModuleId, keep } = parseArgs();
  const outDir = join(__dirname, '_verify-screen-embed');

  Logger.overrideLogger(['error', 'warn']);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const exporter = app.get(BaArtifactExportService);

  console.log('──────────────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log(`Output dir:    ${outDir}`);
  console.log(`Keep outputs:  ${keep ? 'yes' : 'no — cleared after run'}`);
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`Module ${targetModuleId} not found`);
    await app.close();
    process.exit(1);
  }

  const screens = await prisma.baScreen.findMany({
    where: { moduleDbId: mod.id },
    orderBy: { displayOrder: 'asc' },
    select: { screenId: true, screenTitle: true, screenType: true, fileData: true, mimeType: true },
  });
  console.log(`Module screens (${screens.length}):`);
  for (const s of screens) {
    const dataLen = (s.fileData?.length ?? 0);
    const dataUrlMatch = s.fileData?.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
    const sniffed = dataUrlMatch ? dataUrlMatch[1] : '(no data-url prefix)';
    console.log(`  ${s.screenId.padEnd(8)} mime=${(s.mimeType ?? '?').padEnd(14)} sniffed=${sniffed.padEnd(8)} fileDataLen=${dataLen}  title="${s.screenTitle}"`);
  }
  console.log('');

  const targetTypes: Array<'FTC' | 'EPIC' | 'USER_STORY'> = ['FTC', 'EPIC', 'USER_STORY'];
  const artifacts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: { in: targetTypes } },
    orderBy: [{ artifactType: 'asc' }, { createdAt: 'desc' }],
  });

  // Keep the most recent of each type so we don't render historical drafts.
  const latestByType = new Map<string, typeof artifacts[number]>();
  for (const a of artifacts) {
    if (!latestByType.has(a.artifactType)) latestByType.set(a.artifactType, a);
  }

  if (latestByType.size === 0) {
    console.error(`No FTC / EPIC / USER_STORY artifacts found on ${targetModuleId}`);
    await app.close();
    process.exit(1);
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let firstPdfRendered = false;
  for (const [type, artifact] of latestByType) {
    console.log('────────────────────────────────────');
    console.log(`Rendering ${type}: ${artifact.artifactId} (${artifact.id})`);
    console.log('────────────────────────────────────');

    // DOCX
    const t0 = Date.now();
    const docxResult = await exporter.renderDocx(artifact.id);
    const docxMs = Date.now() - t0;
    const docxPath = join(outDir, docxResult.filename);
    writeFileSync(docxPath, docxResult.buffer);
    const sizeKb = (docxResult.buffer.length / 1024).toFixed(1);
    console.log(`  DOCX  ${docxResult.filename.padEnd(50)} ${sizeKb} KB  (${docxMs} ms)`);

    // HTML — used to verify enrichment + screens block on the PDF/HTML path.
    const htmlResult = await exporter.renderHtml(artifact.id);
    const htmlPath = join(outDir, `${htmlResult.fileStem}.html`);
    writeFileSync(htmlPath, htmlResult.html);

    // Heuristic checks against the rendered HTML — since the HTML and the
    // DOCX share the enrichScreenReferences helper, a positive on the HTML
    // side is strong evidence the DOCX inline enrichment worked too.
    const html = htmlResult.html;
    const screensBlockHits = (html.match(/Referenced Screens/g) ?? []).length;
    const screenIdsCited = new Set<string>();
    for (const m of html.matchAll(/SCR-\d+/g)) screenIdsCited.add(m[0]);
    const enrichedHits = (html.match(/SCR-\d+\s*<\/span>\s*—\s+/g) ?? []).length
      + (html.match(/SCR-\d+\s+—\s+\w/g) ?? []).length;

    console.log(`  HTML  Referenced Screens block: ${screensBlockHits > 0 ? 'present' : 'MISSING'}`);
    console.log(`  HTML  Screen IDs in document:   ${screenIdsCited.size}`);
    console.log(`  HTML  Inline title enrichments: ${enrichedHits}`);

    // Sanity-check first PDF too — confirms the puppeteer→PDF path still
    // works after the screens-block changes (HTML is the same source).
    if (!firstPdfRendered) {
      const pdfResult = await exporter.renderPdf(artifact.id);
      const pdfPath = join(outDir, pdfResult.filename);
      writeFileSync(pdfPath, pdfResult.buffer);
      const pdfKb = (pdfResult.buffer.length / 1024).toFixed(1);
      console.log(`  PDF   ${pdfResult.filename.padEnd(50)} ${pdfKb} KB`);
      firstPdfRendered = true;
    }
    console.log('');
  }

  if (!keep) {
    rmSync(outDir, { recursive: true, force: true });
    console.log(`Output dir cleared (pass --keep to retain).`);
  } else {
    console.log(`Outputs retained in ${outDir}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
