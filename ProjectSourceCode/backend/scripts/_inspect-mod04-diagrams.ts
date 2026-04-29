import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-04' } });
  if (!mod) { console.error('MOD-04 not found'); return; }

  const lld = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'LLD' },
    orderBy: { createdAt: 'desc' },
  });
  if (!lld) { console.error('No LLD artifact for MOD-04'); return; }

  console.log(`LLD artifact: ${lld.artifactId} (${lld.id})`);
  console.log(`  createdAt: ${lld.createdAt.toISOString()}`);
  console.log(`  updatedAt: ${lld.updatedAt.toISOString()}\n`);

  const sections = await prisma.baArtifactSection.findMany({
    where: { artifactId: lld.id },
    select: { sectionKey: true, sectionLabel: true, content: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total sections: ${sections.length}\n`);

  type Diag = { kind: string; section: string; sectionKey: string; updatedAt: Date };
  const diagrams: Diag[] = [];
  for (const s of sections) {
    const c = s.content ?? '';
    if (/```mermaid[^\n]*\nerDiagram/i.test(c)) diagrams.push({ kind: 'erDiagram (schema)', section: s.sectionLabel, sectionKey: s.sectionKey, updatedAt: s.updatedAt });
    if (/```mermaid[^\n]*\nclassDiagram/i.test(c)) diagrams.push({ kind: 'classDiagram', section: s.sectionLabel, sectionKey: s.sectionKey, updatedAt: s.updatedAt });
    if (/```mermaid[^\n]*\nsequenceDiagram/i.test(c)) diagrams.push({ kind: 'sequenceDiagram', section: s.sectionLabel, sectionKey: s.sectionKey, updatedAt: s.updatedAt });
    if (/```mermaid[^\n]*\nflowchart/i.test(c)) diagrams.push({ kind: 'flowchart', section: s.sectionLabel, sectionKey: s.sectionKey, updatedAt: s.updatedAt });
    if (/```mermaid[^\n]*\ngraph\s+(TD|LR|BT|RL)/i.test(c)) diagrams.push({ kind: 'graph', section: s.sectionLabel, sectionKey: s.sectionKey, updatedAt: s.updatedAt });
  }

  console.log(`Mermaid diagrams found: ${diagrams.length}\n`);
  for (const d of diagrams) {
    console.log(`  [${d.kind.padEnd(22)}] ${d.sectionKey}`);
    console.log(`     ${d.section.slice(0, 90)}`);
    console.log(`     updatedAt: ${d.updatedAt.toISOString()}`);
  }

  const pseudoFiles = await prisma.baPseudoFile.count({ where: { artifactDbId: lld.id } });
  console.log(`\nPseudo-files on this artifact: ${pseudoFiles}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
