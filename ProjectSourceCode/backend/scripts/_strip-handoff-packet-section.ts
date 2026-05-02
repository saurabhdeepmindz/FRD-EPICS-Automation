/**
 * Delete the `handoff_packet_json` section (and any siblings whose key
 * indicates a JSON handoff packet) from a module's FRD artifact. The
 * JSON is preserved in BaSkillExecution.handoffPacket — only the
 * duplicate artifact section is removed so the FRD preview / Word / PDF
 * exports stop rendering the raw JSON to the user.
 *
 * One-off cleanup for any module that ran SKILL-01-S before the
 * parseAiOutput strip-fix landed.
 *
 * Usage: npx ts-node scripts/_strip-handoff-packet-section.ts <MOD-NN>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const moduleId = process.argv[2] ?? 'MOD-06';
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) {
    console.log(`${moduleId} not found`);
    return;
  }
  const frd = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'FRD' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!frd) {
    console.log(`No FRD artifact for ${moduleId}`);
    return;
  }

  // Match section keys that look like the handoff packet (covers
  // 'handoff_packet_json', 'handoff_packet', 'frd_handoff_packet', etc.)
  const targets = frd.sections.filter((s) => /handoff[_\s-]*packet/i.test(s.sectionKey));
  console.log(`${moduleId} FRD artifact: ${frd.id}`);
  console.log(`Total sections: ${frd.sections.length}`);
  console.log(`Handoff-packet sections to delete: ${targets.length}`);
  for (const t of targets) {
    console.log(`  - [${t.sectionKey}] "${t.sectionLabel}"  len=${t.content.length}`);
  }

  if (targets.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const del = await prisma.baArtifactSection.deleteMany({
    where: { id: { in: targets.map((t) => t.id) } },
  });
  console.log(`\nDeleted ${del.count} section(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
