/** Verify USER_STORY restructurer output. */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PdfService } from '../src/export/pdf.service';
import { BaArtifactExportService } from '../src/ba-tool/ba-artifact-export.service';

@Module({ providers: [PrismaService, PdfService, BaArtifactExportService] })
class M {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(M, { logger: ['error'] });
  const ex = app.get(BaArtifactExportService);
  const pr = app.get(PrismaService);
  for (const moduleId of ['MOD-04', 'MOD-05']) {
    const m = await pr.baModule.findFirst({ where: { moduleId } });
    if (!m) continue;
    const a = await pr.baArtifact.findFirst({
      where: { moduleDbId: m.id, artifactType: 'USER_STORY' as never },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!a) continue;
    const r = await ex.renderHtml(a.id);
    const sections = (r.html.match(/<section id="sec-[^"]+" class="doc-section">/g) ?? []).length;
    const labels = [...r.html.matchAll(/<section id="sec-[^"]+" class="doc-section">\s*<h2[^>]*>([\s\S]*?)<\/h2>/g)]
      .map((mm) => mm[1].replace(/<[^>]+>/g, '').trim());
    const usStories = labels.filter((l) => /US-\d{3,}/.test(l)).length;
    console.log(`\n=== ${moduleId} USER_STORY === htmlBytes=${r.html.length} totalSections=${sections} storySections=${usStories}`);
    console.log(`First 5: ${labels.slice(0, 5).join(' | ')}`);
    console.log(`Last 3: ${labels.slice(-3).join(' | ')}`);
  }
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
