/**
 * Drill into MOD-05's FRD → EPIC → USER_STORY pipeline output to find
 * where the chain narrowed to a single user story despite 20 screens.
 *
 * Reports:
 *   - features extracted in the FRD (F-NN-NN ids and names)
 *   - epics declared in the EPIC artifact (EPIC-NN ids + feature refs)
 *   - user stories declared in the USER_STORY artifact
 *   - SKILL-04 humanDocument size, top of content, full screen-id mentions
 *
 * Usage:
 *   npx ts-node scripts/_inspect-mod05-pipeline.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const targetId = process.argv[2] ?? 'MOD-05';
  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetId } });
  if (!mod) {
    console.error(`Module ${targetId} not found`);
    process.exit(1);
  }
  console.log(`Module: ${mod.moduleId} — ${mod.moduleName}\n`);

  // FRD artifact
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log('───── FRD ─────');
  if (!frd) {
    console.log('  (no FRD artifact)');
  } else {
    console.log(`  artifactId: ${frd.artifactId}`);
    console.log(`  status:     ${frd.status}`);
    console.log(`  sections:   ${frd.sections.length}`);
    const allFrdContent = frd.sections.map((s) => s.content || '').join('\n\n');
    const featureIds = new Set<string>();
    for (const m of allFrdContent.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) featureIds.add(m[0]);
    console.log(`  Feature ids found in FRD content: ${featureIds.size}  [${[...featureIds].sort().join(', ')}]`);
    const screenIds = new Set<string>();
    for (const m of allFrdContent.matchAll(/\bSCR-\d+\b/g)) screenIds.add(m[0]);
    console.log(`  Screen ids found in FRD content:  ${screenIds.size}  [${[...screenIds].sort().join(', ')}]`);
  }
  console.log('');

  // EPIC artifact
  const epic = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'EPIC' },
    orderBy: { createdAt: 'desc' },
    include: { sections: { orderBy: { createdAt: 'asc' } } },
  });
  console.log('───── EPIC ─────');
  if (!epic) {
    console.log('  (no EPIC artifact)');
  } else {
    console.log(`  artifactId: ${epic.artifactId}`);
    console.log(`  status:     ${epic.status}`);
    console.log(`  sections:   ${epic.sections.length}`);
    const epicContent = epic.sections.map((s) => s.content || '').join('\n\n');
    const epicIds = new Set<string>();
    for (const m of epicContent.matchAll(/\bEPIC-\d{2,}\b/g)) epicIds.add(m[0]);
    console.log(`  EPIC ids found in EPIC content:   ${epicIds.size}  [${[...epicIds].sort().join(', ')}]`);
    const featureIds = new Set<string>();
    for (const m of epicContent.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) featureIds.add(m[0]);
    console.log(`  Feature ids in EPIC content:      ${featureIds.size}  [${[...featureIds].sort().join(', ')}]`);
    const usIds = new Set<string>();
    for (const m of epicContent.matchAll(/\bUS-\d{3,}\b/g)) usIds.add(m[0]);
    console.log(`  US ids in EPIC content:           ${usIds.size}  [${[...usIds].sort().join(', ')}]`);
  }
  console.log('');

  // SKILL-04 execution
  const skill04Execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-04' },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`───── SKILL-04 executions: ${skill04Execs.length} ─────`);
  for (const e of skill04Execs) {
    const doc = e.humanDocument || '';
    const usIds = new Set<string>();
    for (const m of doc.matchAll(/\bUS-\d{3,}\b/g)) usIds.add(m[0]);
    const featureIds = new Set<string>();
    for (const m of doc.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) featureIds.add(m[0]);
    console.log(`  ${e.id}  status=${e.status}  docLen=${doc.length}`);
    console.log(`     US ids in doc: ${usIds.size}  [${[...usIds].sort().slice(0, 30).join(', ')}]`);
    console.log(`     Feature ids in doc: ${featureIds.size}  [${[...featureIds].sort().slice(0, 30).join(', ')}]`);
    console.log(`     First 600 chars: ${doc.slice(0, 600).replace(/\n/g, ' ⏎ ')}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
