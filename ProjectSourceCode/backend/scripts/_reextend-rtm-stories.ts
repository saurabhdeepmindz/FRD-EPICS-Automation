/**
 * Re-run RTM USER_STORY extension for a module without re-firing SKILL-04.
 *
 * Use case: SKILL-04 already produced a valid 27-section USER_STORY
 * artifact (validator passed, AWAITING_REVIEW), but the in-flight RTM
 * extension that ran during runSkillAsync used the OLD extractField
 * (single-line `Label: value` only) and missed the bold-numbered
 * `**5. FRD Feature Reference**` heading-then-value shape, so 0/N
 * RTM rows got storyId-linked.
 *
 * The fixed extractField now has Pass 2 for the numbered-heading
 * format. This script just re-runs extendRtmWithStories against the
 * existing latest SKILL-04 humanDocument so the linkage backfills
 * without needing to re-fire the (slow, costly) per-feature loop.
 *
 * Idempotent: safe to re-run; updateMany rewrites the same storyId
 * onto the same featureId rows.
 *
 * Usage: npx ts-node scripts/_reextend-rtm-stories.ts <MOD-NN>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const targetModuleId = process.argv[2] ?? 'MOD-06';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const orch = app.get(BaSkillOrchestratorService);

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) {
    console.error(`${targetModuleId} not found`);
    process.exit(1);
  }
  if (!mod.projectId) {
    console.error(`${targetModuleId} has no projectId`);
    process.exit(1);
  }

  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-04' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec || !exec.humanDocument) {
    console.error(`No SKILL-04 humanDocument found for ${targetModuleId}`);
    process.exit(1);
  }

  console.log(`Module: ${mod.moduleId} (${mod.id})`);
  console.log(`SKILL-04 exec: ${exec.id}  status=${exec.status}`);
  console.log(`humanDocument length: ${exec.humanDocument.length}\n`);

  // Snapshot before
  const before = await prisma.baRtmRow.findMany({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
  const beforeLinked = before.filter((r) => r.storyId).length;
  console.log(`RTM before: ${beforeLinked}/${before.length} rows story-linked`);

  type OrchPrivate = {
    extendRtmWithStories(moduleDbId: string, projectId: string, storiesMarkdown: string): Promise<void>;
  };
  const op = orch as unknown as OrchPrivate;
  await op.extendRtmWithStories(mod.id, mod.projectId, exec.humanDocument);

  // Show resulting linkage
  const rtm = await prisma.baRtmRow.findMany({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
  const linked = rtm.filter((r) => r.storyId);
  console.log(`\nRTM after: ${linked.length}/${rtm.length} rows story-linked`);
  if (linked.length > 0) {
    const distinctStories = new Set(linked.map((r) => r.storyId));
    console.log(`Distinct storyIds in RTM: ${[...distinctStories].slice(0, 20).join(', ')}${distinctStories.size > 20 ? `, +${distinctStories.size - 20} more` : ''}`);
    const sampleRows = linked.slice(0, 5).map((r) => `  ${r.featureId} → ${r.storyId} (${r.storyType ?? '-'})`);
    console.log(`Sample linkage:\n${sampleRows.join('\n')}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
