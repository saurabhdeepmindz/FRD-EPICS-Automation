/**
 * Throwaway smoke test for the export HTML refactor. Renders the requested
 * artifact (default: MOD-06 FRD) to a temp file and prints structural
 * counts so we can verify the nested TOC + per-feature screens landed.
 *
 * Run:
 *   npx ts-node scripts/_smoke-export-html.ts            # default MOD-06 FRD
 *   npx ts-node scripts/_smoke-export-html.ts MOD-04 FRD
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { generateBaArtifactHtml, type BaArtifactDoc } from '../src/ba-tool/templates/artifact-html';

async function main(): Promise<void> {
  const moduleArg = process.argv[2] ?? 'MOD-06';
  const typeArg = process.argv[3] ?? 'FRD';
  const prisma = new PrismaClient();
  const mod = await prisma.baModule.findFirst({ where: { moduleId: moduleArg } });
  if (!mod) {
    console.log(`module ${moduleArg} not found`);
    await prisma.$disconnect();
    process.exit(1);
  }
  const a = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: typeArg as never },
    include: {
      sections: { orderBy: { createdAt: 'asc' } },
      module: {
        include: {
          project: true,
          screens: { orderBy: { displayOrder: 'asc' } },
        },
      },
    },
  });
  if (!a) {
    console.log(`no ${typeArg} artifact for ${moduleArg}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const p = a.module.project as unknown as {
    name: string;
    projectCode: string;
    productName: string | null;
    clientName: string | null;
    submittedBy: string | null;
    clientLogo: string | null;
  };

  const doc: BaArtifactDoc = {
    artifactId: a.artifactId,
    artifactType: a.artifactType,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    sections: a.sections.map((s, idx) => ({
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
      moduleId: a.module.moduleId,
      moduleName: a.module.moduleName,
      packageName: a.module.packageName,
      screens: ((a.module as { screens?: Array<{ screenId: string; screenTitle: string; screenType: string | null; fileData: string }> }).screens ?? []),
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

  const html = generateBaArtifactHtml(doc);
  const tmpdir = process.env.TEMP ?? process.env.TMP ?? '.';
  const out = path.join(tmpdir, `${moduleArg.toLowerCase()}-${typeArg.toLowerCase()}-preview.html`);
  fs.writeFileSync(out, html);
  console.log(`wrote ${out} (${html.length} bytes)`);

  // Structural counts to confirm refactor landed.
  // Strip the inline <style> block before counting class usages, otherwise
  // a CSS rule like `.feature-screen-inline { ... }` would be miscounted as
  // an actual injection. We only care about injected markup occurrences.
  const stripped = html.replace(/<style[\s\S]*?<\/style>/g, '');
  const tocChildren = (stripped.match(/class="toc-child(?:")/g) ?? []).length;
  const tocGrandchildren = (stripped.match(/class="toc-grandchild/g) ?? []).length;
  const featureScreens = (stripped.match(/class="feature-screen-inline"/g) ?? []).length;
  const headingsWithIds = (stripped.match(/<h[1-6][^>]*\sid="[^"]+"/g) ?? []).length;
  console.log(`  TOC children: ${tocChildren}`);
  console.log(`  TOC grandchildren: ${tocGrandchildren}`);
  console.log(`  Feature inline screens injected: ${featureScreens}`);
  console.log(`  Headings carrying anchor IDs: ${headingsWithIds}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
