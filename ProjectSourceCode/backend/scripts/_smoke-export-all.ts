/**
 * Throwaway: smoke-render every artifact type for a given module as both
 * PDF and DOCX. Writes outputs to %TEMP% and prints a size/duration table
 * so we can compare modules side-by-side without bringing up the backend.
 *
 * SUBTASK exports go through the per-artifact endpoint (rollup view); a
 * single sample BaSubTask is also rendered separately so we exercise the
 * subtask-specific code path too.
 *
 * Run:
 *   npx ts-node scripts/_smoke-export-all.ts MOD-04
 *   npx ts-node scripts/_smoke-export-all.ts MOD-04 --skip=LLD
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
class SmokeAllModule {}

interface Row {
  type: string;
  format: 'pdf' | 'docx';
  size: string;
  ms: number;
  filename: string;
  ok: boolean;
  note?: string;
}

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-04';
  const skipArg = process.argv.find((a) => a.startsWith('--skip='))?.split('=')[1] ?? 'LLD';
  const skip = new Set(skipArg.split(',').map((s) => s.trim().toUpperCase()));

  const app = await NestFactory.createApplicationContext(SmokeAllModule, { logger: ['warn', 'error'] });
  const prisma = app.get(PrismaService);
  const exporter = app.get(BaArtifactExportService);

  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.log(`module ${moduleId} not found`); await app.close(); process.exit(1); }

  const allTypes = ['FRD', 'EPIC', 'USER_STORY', 'SUBTASK', 'LLD', 'FTC'] as const;
  const tmpdir = process.env.TEMP ?? process.env.TMP ?? '.';
  const rows: Row[] = [];

  for (const t of allTypes) {
    if (skip.has(t)) {
      rows.push({ type: t, format: 'pdf', size: '—', ms: 0, filename: '(skipped)', ok: true, note: 'skipped' });
      rows.push({ type: t, format: 'docx', size: '—', ms: 0, filename: '(skipped)', ok: true, note: 'skipped' });
      continue;
    }
    const art = await prisma.baArtifact.findFirst({
      where: { moduleDbId: mod.id, artifactType: t as never },
      orderBy: { createdAt: 'desc' },
      select: { id: true, artifactId: true },
    });
    if (!art) {
      rows.push({ type: t, format: 'pdf', size: '—', ms: 0, filename: '(no artifact)', ok: false, note: 'missing' });
      rows.push({ type: t, format: 'docx', size: '—', ms: 0, filename: '(no artifact)', ok: false, note: 'missing' });
      continue;
    }

    // PDF
    let t0 = Date.now();
    try {
      const r = await exporter.renderPdf(art.id);
      const out = path.join(tmpdir, `${moduleId.toLowerCase()}-${t.toLowerCase()}.pdf`);
      fs.writeFileSync(out, r.buffer);
      rows.push({
        type: t, format: 'pdf',
        size: `${(r.buffer.length / 1024).toFixed(1)} KB`,
        ms: Date.now() - t0,
        filename: out,
        ok: r.buffer.subarray(0, 4).toString('ascii') === '%PDF',
      });
    } catch (err) {
      rows.push({ type: t, format: 'pdf', size: '—', ms: Date.now() - t0, filename: '(threw)', ok: false, note: (err as Error).message.slice(0, 80) });
    }

    // DOCX
    t0 = Date.now();
    try {
      const r = await exporter.renderDocx(art.id);
      const out = path.join(tmpdir, `${moduleId.toLowerCase()}-${t.toLowerCase()}.docx`);
      fs.writeFileSync(out, r.buffer);
      const head = r.buffer.subarray(0, 4);
      const isZip = head[0] === 0x50 && head[1] === 0x4b;
      rows.push({
        type: t, format: 'docx',
        size: `${(r.buffer.length / 1024).toFixed(1)} KB`,
        ms: Date.now() - t0,
        filename: out,
        ok: isZip,
      });
    } catch (err) {
      rows.push({ type: t, format: 'docx', size: '—', ms: Date.now() - t0, filename: '(threw)', ok: false, note: (err as Error).message.slice(0, 80) });
    }
  }

  // Also exercise a sample BaSubTask (single-row export path).
  if (!skip.has('SUBTASK')) {
    const st = await prisma.baSubTask.findFirst({
      where: { moduleDbId: mod.id },
      orderBy: { subtaskId: 'asc' },
      select: { id: true, subtaskId: true },
    });
    if (st) {
      let t0 = Date.now();
      try {
        const r = await exporter.renderSubTaskPdf(st.id);
        const out = path.join(tmpdir, `${moduleId.toLowerCase()}-subtask-sample-${st.subtaskId}.pdf`);
        fs.writeFileSync(out, r.buffer);
        rows.push({
          type: `SUBTASK[${st.subtaskId}]`, format: 'pdf',
          size: `${(r.buffer.length / 1024).toFixed(1)} KB`,
          ms: Date.now() - t0, filename: out,
          ok: r.buffer.subarray(0, 4).toString('ascii') === '%PDF',
        });
      } catch (err) {
        rows.push({ type: `SUBTASK[${st.subtaskId}]`, format: 'pdf', size: '—', ms: 0, filename: '(threw)', ok: false, note: (err as Error).message.slice(0, 80) });
      }
      t0 = Date.now();
      try {
        const r = await exporter.renderSubTaskDocx(st.id);
        const out = path.join(tmpdir, `${moduleId.toLowerCase()}-subtask-sample-${st.subtaskId}.docx`);
        fs.writeFileSync(out, r.buffer);
        const head = r.buffer.subarray(0, 4);
        rows.push({
          type: `SUBTASK[${st.subtaskId}]`, format: 'docx',
          size: `${(r.buffer.length / 1024).toFixed(1)} KB`,
          ms: Date.now() - t0, filename: out,
          ok: head[0] === 0x50 && head[1] === 0x4b,
        });
      } catch (err) {
        rows.push({ type: `SUBTASK[${st.subtaskId}]`, format: 'docx', size: '—', ms: 0, filename: '(threw)', ok: false, note: (err as Error).message.slice(0, 80) });
      }
    }
  }

  // Print a clean comparison table.
  console.log(`\n══ Smoke export — ${moduleId} ══ (skipped: ${[...skip].join(', ') || 'none'})`);
  console.log(`${'type'.padEnd(28)} ${'format'.padEnd(6)} ${'size'.padEnd(12)} ${'ms'.padEnd(6)} ${'ok'.padEnd(3)} file`);
  for (const r of rows) {
    const okTag = r.note === 'skipped' ? 'skp' : (r.ok ? ' ok' : 'FAIL');
    const file = r.note && r.note !== 'skipped' ? `(${r.note})` : r.filename;
    console.log(`${r.type.padEnd(28)} ${r.format.padEnd(6)} ${r.size.padEnd(12)} ${String(r.ms).padEnd(6)} ${okTag} ${file}`);
  }
  await app.close();
  process.exit(rows.every((r) => r.ok || r.note === 'skipped') ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
