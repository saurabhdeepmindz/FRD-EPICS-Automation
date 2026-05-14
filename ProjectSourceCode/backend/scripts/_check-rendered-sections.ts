/** Verify Step 1 (internal-section filter): show top-level h2 labels
 *  emitted in the rendered HTML for each module/type. Internal-processing
 *  labels should be ABSENT. */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PdfService } from '../src/export/pdf.service';
import { BaArtifactExportService } from '../src/ba-tool/ba-artifact-export.service';

@Module({ providers: [PrismaService, PdfService, BaArtifactExportService] })
class CheckModule {}

const INTERNAL_PATTERNS = [
  /step\s*\d+/i, /introduction/i, /output\s*checklist/i,
  /validate\s*the\s*frd/i, /sign[\s-]?off/i, /definition\s*of\s*done/i,
];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(CheckModule, { logger: ['warn', 'error'] });
  const prisma = app.get(PrismaService);
  const exporter = app.get(BaArtifactExportService);

  const targets: Array<[string, string]> = [['MOD-04', 'FRD'], ['MOD-05', 'FRD'], ['MOD-04', 'FTC'], ['MOD-05', 'FTC']];
  for (const [moduleId, artifactType] of targets) {
    const mod = await prisma.baModule.findFirst({ where: { moduleId } });
    if (!mod) continue;
    const art = await prisma.baArtifact.findFirst({
      where: { moduleDbId: mod.id, artifactType: artifactType as never },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!art) continue;
    const { html } = await exporter.renderHtml(art.id);
    // Extract `<section id="..." class="doc-section">  <h2>N. <label> ...</h2>`
    const re = /<section id="sec-[^"]+" class="doc-section">\s*<h2[^>]*>([^<]+)<\/h2>/g;
    const labels: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      labels.push(m[1].trim());
    }
    console.log(`\n══ ${moduleId} ${artifactType} ══ (${labels.length} top-level sections)`);
    for (const l of labels) {
      const hit = INTERNAL_PATTERNS.find((p) => p.test(l));
      const tag = hit ? '!! LEAK' : '  ok  ';
      console.log(`  ${tag} ${l}`);
    }
  }
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
