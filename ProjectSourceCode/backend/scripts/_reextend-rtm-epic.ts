/**
 * Re-run RTM EPIC extension for a module without re-firing SKILL-02-S.
 *
 * Use case: SKILL-02-S already ran and stored the EPIC artifact, but
 * the original RTM extension run produced 0 rows linked because the
 * legacy extendRtmWithEpic required both an EPIC-NN id in the content
 * AND a feature list — the LLM-generated content sometimes omits one
 * or both. The fixed orchestrator falls back to deriving EPIC-{NN}
 * from moduleId and featureIds from the module's RTM rows. This
 * script just re-runs that extension against the existing EPIC
 * artifact / latest SKILL-02-S humanDocument.
 *
 * Idempotent: safe to re-run; updateMany rewrites the same epicId
 * onto the same rows.
 *
 * Usage: npx ts-node scripts/_reextend-rtm-epic.ts <MOD-NN>
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
    where: { moduleDbId: mod.id, skillName: 'SKILL-02-S' },
    orderBy: { createdAt: 'desc' },
  });
  if (!exec || !exec.humanDocument) {
    console.error(`No SKILL-02-S humanDocument found for ${targetModuleId}`);
    process.exit(1);
  }

  console.log(`Module: ${mod.moduleId} (${mod.id})`);
  console.log(`SKILL-02-S exec: ${exec.id}  status=${exec.status}`);
  console.log(`humanDocument length: ${exec.humanDocument.length}\n`);

  type OrchPrivate = {
    extendRtmWithEpic(moduleDbId: string, projectId: string, epicMarkdown: string): Promise<void>;
  };
  const op = orch as unknown as OrchPrivate;
  await op.extendRtmWithEpic(mod.id, mod.projectId, exec.humanDocument);

  // Show resulting linkage
  const rtm = await prisma.baRtmRow.findMany({ where: { projectId: mod.projectId, moduleId: mod.moduleId } });
  const linked = rtm.filter((r) => r.epicId);
  console.log(`\nFinal RTM state for ${targetModuleId}: ${linked.length}/${rtm.length} rows epic-linked`);
  if (linked.length > 0) {
    const distinctEpics = new Set(linked.map((r) => r.epicId));
    console.log(`Distinct epicIds in RTM: ${[...distinctEpics].join(', ')}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
