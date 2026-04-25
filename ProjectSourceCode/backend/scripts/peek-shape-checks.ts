import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const sectionKeyArg = args[0];
  if (!sectionKeyArg) {
    console.error('usage: ts-node scripts/peek-shape-checks.ts <sectionKey>');
    process.exit(1);
  }

  const s = await prisma.baArtifactSection.findFirst({
    where: { sectionKey: sectionKeyArg },
  });
  if (!s) {
    console.log('not found');
    return;
  }
  const c = s.content;
  console.log(`Section: ${s.sectionLabel}`);
  console.log(`  Length:                     ${c.length}`);
  console.log(`  Has Section N — headings:   ${(c.match(/^#### Section \d+/gm) ?? []).length}`);
  console.log(`  Has '###' (would fragment): ${(c.match(/^### /gm) ?? []).length}`);
  console.log(`  Has Traceability block:     ${/\/\*[\s\S]*TRACEABILITY[\s\S]*\*\//.test(c)}`);
  console.log(`  Has TBD-Future Dependencies: ${/TBD-Future Dependencies:/i.test(c)}`);
  console.log(`  Has 'Project Structure:':   ${/Project Structure:/i.test(c)}`);
  console.log(`  Has 'Directory Map:':       ${/Directory Map:/i.test(c)}`);
  console.log(`  Has Mermaid sequenceDiagram: ${/```mermaid\s*\n\s*sequenceDiagram/.test(c)}`);
  console.log(`  Mentions NestJS:            ${/NestJS|@Controller|@Injectable/i.test(c)}`);
  console.log(`  Mentions Java legacy:       ${/\bpublic class\b|@Override\b|\.java\b/.test(c)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
