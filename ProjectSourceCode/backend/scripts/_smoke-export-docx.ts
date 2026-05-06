/**
 * Throwaway smoke test for the DOCX export refactor. Triggers the same code
 * path the controller uses — boots a minimal Nest application context, calls
 * BaArtifactExportService.renderDocx, and writes the buffer to a temp file.
 *
 * Run:
 *   npx ts-node scripts/_smoke-export-docx.ts            # default MOD-06 FRD
 *   npx ts-node scripts/_smoke-export-docx.ts MOD-04 FRD
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../src/prisma/prisma.service';
import { PdfService } from '../src/export/pdf.service';
import { BaArtifactExportService } from '../src/ba-tool/ba-artifact-export.service';

@Module({
  providers: [PrismaService, PdfService, BaArtifactExportService],
})
class SmokeModule {}

async function main(): Promise<void> {
  const moduleArg = process.argv[2] ?? 'MOD-06';
  const typeArg = process.argv[3] ?? 'FRD';

  const app = await NestFactory.createApplicationContext(SmokeModule, { logger: ['warn', 'error'] });
  const prisma = app.get(PrismaService);
  const exporter = app.get(BaArtifactExportService);

  const mod = await prisma.baModule.findFirst({ where: { moduleId: moduleArg } });
  if (!mod) { console.log(`module ${moduleArg} not found`); await app.close(); process.exit(1); }
  const a = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: typeArg as never },
    select: { id: true, artifactId: true },
  });
  if (!a) { console.log(`no ${typeArg} for ${moduleArg}`); await app.close(); process.exit(1); }

  console.log(`rendering DOCX for ${a.artifactId} (${typeArg})...`);
  const t0 = Date.now();
  let result;
  try {
    result = await exporter.renderDocx(a.id);
  } catch (err) {
    const e = err as Error;
    console.error('renderDocx threw:', e.message);
    console.error(e.stack);
    await app.close();
    process.exit(1);
  }
  const ms = Date.now() - t0;

  const tmpdir = process.env.TEMP ?? process.env.TMP ?? '.';
  const out = path.join(tmpdir, result.filename);
  fs.writeFileSync(out, result.buffer);
  console.log(`wrote ${out}`);
  console.log(`  size: ${(result.buffer.length / 1024).toFixed(1)} KB in ${ms}ms`);
  // Verify magic bytes for a valid OOXML (zip).
  const head = result.buffer.subarray(0, 4);
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  console.log(`  magic bytes: ${isZip ? 'PK (zip) ✓' : `BAD (${head.toString('hex')})`}`);
  await app.close();
  process.exit(isZip ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
