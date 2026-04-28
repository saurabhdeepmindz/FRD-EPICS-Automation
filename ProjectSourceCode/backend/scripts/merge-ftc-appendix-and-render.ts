/**
 * One-time cleanup for FTC artifacts whose per-feature mode-2 runs created
 * multiple `test_case_appendix` section rows (one per feature) instead of a
 * single consolidated section. Merges them into one, then triggers the
 * structural-sections render (§5 Test Cases Index, §6 Functional, §7
 * Integration, §8 White-Box) via the orchestrator's mode-3 endpoint.
 *
 * Usage:
 *   npx ts-node scripts/merge-ftc-appendix-and-render.ts --module MOD-04
 *   npx ts-node scripts/merge-ftc-appendix-and-render.ts --module MOD-04 --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';
  const apply = args.includes('--apply');

  console.log('────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`Module ${targetModuleId} not found`);
    process.exit(1);
  }

  const artifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FTC' },
    orderBy: { createdAt: 'desc' },
  });
  if (!artifact) {
    console.error(`No FTC artifact for ${targetModuleId}`);
    process.exit(1);
  }
  console.log(`FTC artifact: ${artifact.id}  (${artifact.artifactId})\n`);

  const appendixRows = await prisma.baArtifactSection.findMany({
    where: { artifactId: artifact.id, sectionKey: 'test_case_appendix' },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`test_case_appendix rows: ${appendixRows.length}`);
  for (const r of appendixRows) {
    console.log(`  ${r.id}  contentLen=${r.content?.length ?? 0}  isHumanModified=${r.isHumanModified}`);
  }

  if (appendixRows.length <= 1) {
    console.log('\nNo merge needed.');
  } else if (!apply) {
    console.log(`\nDRY-RUN — would merge ${appendixRows.length} rows into 1 (the oldest, kept and updated).`);
  } else {
    const [first, ...rest] = appendixRows;
    if (first.isHumanModified) {
      console.log('\nFirst row is human-modified — skipping merge to preserve edits.');
    } else {
      const mergedContent = appendixRows
        .map((r) => r.content ?? '')
        .filter((c) => c.trim().length > 0)
        .join('\n\n')
        .trim();
      await prisma.$transaction(async (tx) => {
        await tx.baArtifactSection.update({
          where: { id: first.id },
          data: { content: mergedContent },
        });
        await tx.baArtifactSection.deleteMany({
          where: { id: { in: rest.map((r) => r.id) } },
        });
      });
      console.log(`\n✓ merged ${appendixRows.length} appendix rows into 1 (id=${first.id}, contentLen=${mergedContent.length})`);
      console.log(`✓ deleted ${rest.length} duplicate row(s)`);
    }
  }

  console.log('\n────────────────────────────────────');
  console.log('Next step: trigger structural-sections render via mode-3 endpoint');
  console.log(`  curl -X POST http://localhost:4000/api/ba/modules/${mod.id}/execute/SKILL-07-FTC/narrative`);
  console.log(`  (mode 3 now always runs renderStructuralSections at the start, even when narrative is skipped)`);
  console.log('────────────────────────────────────');
}

main().catch(console.error).finally(() => prisma.$disconnect());
