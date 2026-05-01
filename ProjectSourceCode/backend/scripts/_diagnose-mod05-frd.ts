/**
 * Find out *exactly* where MOD-05's missing F-05-NN features live. The
 * earlier _inspect-mod05-pipeline.ts run found only F-05-03 in FRD section
 * content but EPIC saw F-05-01 through F-05-10. Either:
 *   (a) the rest of the features live in the FRD's handoffPacket JSON
 *       (which the EPIC skill ingests directly, not via section text), or
 *   (b) they were invented by SKILL-02-S and the FRD genuinely only
 *       declared F-05-03.
 *
 * We need to know which before running mode 04b: if (b), the per-feature
 * regen will fire against feature ids that the FRD never actually
 * authorized, and the upstream FRD needs re-running first.
 *
 * Usage:
 *   npx ts-node scripts/_diagnose-mod05-frd.ts
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

  // SKILL-01-S latest execution — has the FRD humanDocument + handoffPacket
  const skill01 = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-01-S' },
    orderBy: { createdAt: 'desc' },
  });
  if (!skill01) {
    console.log('No SKILL-01-S execution found for MOD-05.');
    return;
  }
  console.log(`SKILL-01-S exec: ${skill01.id}`);
  console.log(`  status:       ${skill01.status}`);
  console.log(`  createdAt:    ${skill01.createdAt.toISOString()}`);
  console.log(`  humanDocLen:  ${(skill01.humanDocument || '').length}`);
  console.log(`  handoffJson:  ${skill01.handoffPacket ? 'present' : 'missing'}\n`);

  // Pull feature ids from BOTH the human document and the handoff packet.
  const humanDoc = skill01.humanDocument || '';
  const humanFeatureIds = new Set<string>();
  for (const m of humanDoc.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) humanFeatureIds.add(m[0]);
  console.log(`Feature ids in SKILL-01-S humanDocument: ${humanFeatureIds.size}`);
  console.log(`  ${[...humanFeatureIds].sort().join(', ') || '(none)'}\n`);

  // The handoffPacket is JSON — we'll search its serialized form for
  // feature-id-like patterns AND deserialize it to inspect the structure.
  if (skill01.handoffPacket) {
    const packetJson = JSON.stringify(skill01.handoffPacket);
    const packetFeatureIds = new Set<string>();
    for (const m of packetJson.matchAll(/\bF-\d{2,}-\d{2,}\b/g)) packetFeatureIds.add(m[0]);
    console.log(`Feature ids in SKILL-01-S handoffPacket JSON: ${packetFeatureIds.size}`);
    console.log(`  ${[...packetFeatureIds].sort().join(', ') || '(none)'}\n`);

    // Common shapes: { features: [...] } or { modules: [{ features: [...] }] }.
    type HandoffShape = {
      features?: Array<Record<string, unknown>>;
      modules?: Array<{ features?: Array<Record<string, unknown>> }>;
    };
    const packet = skill01.handoffPacket as HandoffShape;
    const featuresField = packet.features ?? packet.modules?.[0]?.features ?? null;
    if (Array.isArray(featuresField)) {
      console.log(`Handoff packet 'features' array length: ${featuresField.length}`);
      console.log(`First 3 features (key fields):`);
      for (const f of featuresField.slice(0, 3)) {
        console.log(`  ${JSON.stringify({
          featureId: f.featureId,
          featureName: f.featureName,
          screenIds: f.screenIds ?? f.sourceScreenIds,
          status: f.status,
          priority: f.priority,
        })}`);
      }
    } else {
      console.log(`Handoff packet does NOT have a top-level "features" array.`);
      console.log(`Top-level keys: ${Object.keys(skill01.handoffPacket as Record<string, unknown>).slice(0, 10).join(', ')}`);
    }
    console.log('');
  }

  // BaRtmRow gives the authoritative project-wide feature catalog for this module.
  const rtm = mod.projectId
    ? await prisma.baRtmRow.findMany({
        where: { projectId: mod.projectId, moduleId: mod.moduleId },
        select: { featureId: true, featureName: true, screenRef: true, epicId: true, storyId: true },
      })
    : [];
  const rtmFeatureIds = [...new Set(rtm.map((r) => r.featureId))].sort();
  console.log(`RTM feature ids for ${targetId}: ${rtmFeatureIds.length}`);
  console.log(`  ${rtmFeatureIds.join(', ') || '(none)'}\n`);
  if (rtm.length > 0) {
    console.log('First 5 RTM rows:');
    for (const r of rtm.slice(0, 5)) {
      console.log(`  ${r.featureId.padEnd(10)} ${(r.featureName ?? '').slice(0, 50).padEnd(52)} screens=${r.screenRef}  epic=${r.epicId ?? '?'}  story=${r.storyId ?? '?'}`);
    }
  }

  // ─── Verdict ─────────────────────────────────────────────────────
  console.log('\n──────── VERDICT ────────');
  if (humanFeatureIds.size >= 5) {
    console.log(`✓ FRD humanDocument carries ${humanFeatureIds.size} features. SKILL-04 was given the full set; the under-emission is purely a SKILL-04 problem. Mode 04b is safe to run.`);
  } else if (skill01.handoffPacket) {
    const packetJson = JSON.stringify(skill01.handoffPacket);
    const packetFeatureCount = new Set(packetJson.match(/\bF-\d{2,}-\d{2,}\b/g) ?? []).size;
    if (packetFeatureCount >= 5) {
      console.log(`✓ FRD humanDocument has only ${humanFeatureIds.size} feature(s) in section text BUT handoffPacket carries ${packetFeatureCount} features. EPIC + SKILL-04 ingest the packet, so the upstream catalog is sound. Mode 04b is safe to run against the packet's feature list.`);
    } else {
      console.log(`✗ FRD has only ${humanFeatureIds.size} feature(s) in humanDocument and ${packetFeatureCount} in handoffPacket. EPIC's F-05-01..F-05-10 list was likely synthesized — the FRD needs re-running first.`);
    }
  } else {
    console.log(`✗ FRD has no handoffPacket and only ${humanFeatureIds.size} feature(s) in humanDocument. The upstream FRD must be re-run before any per-feature SKILL-04 regen.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
