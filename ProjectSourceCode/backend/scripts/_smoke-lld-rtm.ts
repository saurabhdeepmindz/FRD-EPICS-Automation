/**
 * Smoke test for BaLldRtmService — boots a minimal Nest context, calls
 * each emitter for the latest LLD artifact of a given module, writes
 * outputs to %TEMP%, and prints a sanity summary.
 *
 * Mirrors how scripts/_smoke-export-docx.ts uses NestFactory to exercise
 * BaArtifactExportService without spinning up the HTTP server. The
 * production HTTP endpoints land in BaLldController and use the same
 * BaLldRtmService methods.
 *
 * Run:
 *   npx ts-node scripts/_smoke-lld-rtm.ts MOD-04
 *   npx ts-node scripts/_smoke-lld-rtm.ts MOD-04 F-04-01
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BaLldRtmService } from '../src/ba-tool/ba-lld-rtm.service';

async function main(): Promise<void> {
  const moduleId = process.argv[2];
  const featureFilter = process.argv[3];
  if (!moduleId) {
    console.error('Usage: ts-node _smoke-lld-rtm.ts <MOD-NN> [F-NN-NN]');
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const rtm = app.get(BaLldRtmService);

  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) { console.error(`${moduleId} not found`); await app.close(); process.exit(1); }

  const lld = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'LLD' as never },
    orderBy: { createdAt: 'desc' },
    select: { id: true, artifactId: true },
  });
  if (!lld) { console.error(`No LLD for ${moduleId}`); await app.close(); process.exit(1); }

  console.log(`Smoke test: ${moduleId} LLD (${lld.artifactId}, ${lld.id})${featureFilter ? `, scope=${featureFilter}` : ''}`);

  const t0 = Date.now();
  const { zip, stem, result } = await rtm.buildBundleZip(lld.id, featureFilter ? { featureFilter } : {});
  const elapsedMs = Date.now() - t0;

  const tmpdir = process.env.TEMP ?? process.env.TMP ?? '.';
  const zipPath = path.join(tmpdir, `${stem}-bundle.zip`);
  fs.writeFileSync(zipPath, zip);

  // Also write each member individually for easy inspection
  const csv = rtm.emitCsv(result.rows);
  const tree = rtm.emitTree(result.rows, result.module.moduleId);
  const html = rtm.emitHtml({ moduleId: result.module.moduleId, moduleName: result.module.moduleName }, result.rows, tree, result.stats);
  const implCsv = rtm.emitImplStatusCsv(result.rows);
  fs.writeFileSync(path.join(tmpdir, `${stem}.csv`), csv);
  fs.writeFileSync(path.join(tmpdir, `${stem}-tree.txt`), tree);
  fs.writeFileSync(path.join(tmpdir, `${stem}.html`), html);
  fs.writeFileSync(path.join(tmpdir, `${stem}-impl-status.csv`), implCsv);
  if (result.consolidatedSchema) {
    fs.writeFileSync(path.join(tmpdir, `LLD-${result.module.moduleId}-schema.sql`), result.consolidatedSchema);
  }

  console.log(`\nStats: total=${result.stats.total} done=${result.stats.done} todo=${result.stats.todo}`);
  console.log(`Bundle ZIP: ${zipPath} (${(zip.length / 1024).toFixed(1)} KB, built in ${elapsedMs}ms)`);
  console.log(`Members:`);
  console.log(`  CSV:        ${(csv.length / 1024).toFixed(1)} KB · ${result.rows.length} rows`);
  console.log(`  HTML:       ${(html.length / 1024).toFixed(1)} KB`);
  console.log(`  Tree:       ${(tree.length / 1024).toFixed(1)} KB`);
  console.log(`  Impl-CSV:   ${(implCsv.length / 1024).toFixed(1)} KB · ${implCsv.split('\n').length - 1} dev-trackable rows`);
  if (result.consolidatedSchema) console.log(`  Schema SQL: ${(result.consolidatedSchema.length / 1024).toFixed(1)} KB`);

  await app.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
