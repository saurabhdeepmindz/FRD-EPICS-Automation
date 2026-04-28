/**
 * One-shot fix-up: walk a module's most-recent LLD artifact, sanitize
 * every `mermaid` fenced block in every section's content, and write
 * the cleaned content back. Deterministic, no AI cost.
 *
 * Usage:
 *   npx ts-node scripts/sanitize-lld-mermaid.ts --module MOD-04
 *   npx ts-node scripts/sanitize-lld-mermaid.ts --module MOD-04 --apply
 */
import { PrismaClient } from '@prisma/client';
import { sanitizeMermaidInMarkdown } from '../src/ba-tool/mermaid-sanitizer';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';
  const apply = args.includes('--apply');

  console.log('──────────────────────────────────────────────');
  console.log(`Target module: ${targetModuleId}`);
  console.log(`Mode: ${apply ? 'APPLY (will update)' : 'DRY-RUN (no changes)'}`);
  console.log('──────────────────────────────────────────────\n');

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`Module ${targetModuleId} not found`);
    process.exit(1);
  }
  const artifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'LLD' },
    orderBy: { createdAt: 'desc' },
  });
  if (!artifact) {
    console.error(`No LLD artifact for ${targetModuleId}`);
    process.exit(1);
  }
  console.log(`LLD artifact: ${artifact.artifactId} (${artifact.id})\n`);

  const sections = await prisma.baArtifactSection.findMany({
    where: { artifactId: artifact.id },
  });

  let touched = 0;
  let unchanged = 0;
  let humanModifiedSkipped = 0;
  for (const s of sections) {
    if (!s.content || !/```mermaid/.test(s.content)) continue;
    const cleaned = sanitizeMermaidInMarkdown(s.content);
    if (cleaned === s.content) {
      unchanged++;
      continue;
    }
    if (s.isHumanModified) {
      console.log(`[${s.sectionKey}] HAS CHANGES BUT SKIPPED (human-modified)`);
      humanModifiedSkipped++;
      continue;
    }
    const before = (s.content.match(/```mermaid/g) ?? []).length;
    const after = (cleaned.match(/```mermaid/g) ?? []).length;
    console.log(
      `[${s.sectionKey}] ${before} mermaid block(s); content ${s.content.length} → ${cleaned.length} chars (Δ ${cleaned.length - s.content.length})`,
    );
    // Show first few diff lines (only changed lines)
    const beforeLines = s.content.split(/\r?\n/);
    const afterLines = cleaned.split(/\r?\n/);
    let shown = 0;
    for (let i = 0; i < beforeLines.length && shown < 6; i++) {
      if (beforeLines[i] !== afterLines[i]) {
        console.log(`  -  ${beforeLines[i].slice(0, 100)}`);
        console.log(`  +  ${afterLines[i].slice(0, 100)}`);
        shown++;
      }
    }
    if (apply) {
      await prisma.baArtifactSection.update({
        where: { id: s.id },
        data: { content: cleaned },
      });
    }
    touched++;
    void after;
  }

  console.log();
  console.log(`Sections touched      : ${touched}`);
  console.log(`Sections unchanged    : ${unchanged}`);
  console.log(`Skipped (human-edited): ${humanModifiedSkipped}`);
  if (!apply) console.log(`\nDRY-RUN — re-run with --apply to write changes.`);
  else console.log(`\nDone.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
