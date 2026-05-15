/** Verify SUBTASK restructurer output. */
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
      where: { moduleDbId: m.id, artifactType: 'SUBTASK' as never },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!a) continue;
    const r = await ex.renderHtml(a.id);
    const labels = [...r.html.matchAll(/<section id="sec-[^"]+" class="doc-section">\s*<h2[^>]*>([\s\S]*?)<\/h2>/g)]
      .map((mm) => mm[1].replace(/<[^>]+>/g, '').trim());
    const stCount = labels.filter((l) => /\bST-US\d{3,}-[A-Z]{2,4}-\d{2,}/.test(l)).length;
    const captionCount = labels.filter((l) => /SubTask Decomposition for US/i.test(l)).length;
    console.log(`\n=== ${moduleId} SUBTASK === htmlBytes=${r.html.length} sections=${labels.length} subtasks=${stCount} storyCaptions=${captionCount}`);
    console.log(`First 6:`);
    for (const l of labels.slice(0, 6)) console.log(`  ${l}`);
    console.log(`Last 3:`);
    for (const l of labels.slice(-3)) console.log(`  ${l}`);
  }
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
