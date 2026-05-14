/** Verify EPIC body is rendering (not just cover + empty TOC). */
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
      where: { moduleDbId: m.id, artifactType: 'EPIC' as never },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!a) continue;
    const r = await ex.renderHtml(a.id);
    const sections = (r.html.match(/<section id="sec-[^"]+" class="doc-section">/g) ?? []).length;
    const tocItems = (r.html.match(/<li[^>]*>(?:[\s\S]{0,160}?)<\/li>/g) ?? []).length;
    const innerHeadings = [...r.html.matchAll(/<h([2-6])[^>]*>([^<]{0,80})<\/h[2-6]>/g)]
      .filter((mm) => !/^Document History$|^Table of Contents$|^Referenced Screens/i.test(mm[2].trim()))
      .slice(0, 12)
      .map((mm) => `  h${mm[1]}: ${mm[2].trim()}`);
    console.log(`\n=== ${moduleId} EPIC === htmlBytes=${r.html.length} sections=${sections} tocItems=${tocItems}`);
    console.log(innerHeadings.join('\n'));
  }
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
