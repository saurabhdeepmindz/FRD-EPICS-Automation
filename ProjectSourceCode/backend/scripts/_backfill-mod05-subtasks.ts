/**
 * One-off backfill: MOD-05's SUBTASK artifact has 260 sections / 125
 * distinct subtasks, but the BaSubTask table is empty because the
 * orchestrator's per-story-loop synthesis didn't preserve `## ST-...`
 * headings (splitIntoSections strips them into section labels). This
 * script reconstructs the heading-bearing humanDocument and runs the
 * SubTask parser + RTM extension over it. The orchestrator now does
 * the same thing on every fresh run; this script just patches the
 * already-completed MOD-05 execution.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BaSkillOrchestratorService } from '../src/ba-tool/ba-skill-orchestrator.service';
import { SubTaskParserService } from '../src/ba-tool/subtask-parser.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const parser = app.get(SubTaskParserService);
  const orch = app.get(BaSkillOrchestratorService);

  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' }, include: { project: true } });
  if (!mod) throw new Error('MOD-05 not found');

  const artifact = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'SUBTASK' },
    orderBy: { createdAt: 'desc' },
    include: { sections: true },
  });
  if (!artifact) throw new Error('No SUBTASK artifact');

  console.log(`Module: MOD-05 (${mod.id})`);
  console.log(`Artifact: ${artifact.id} (${artifact.sections.length} sections)`);

  // Delete existing BaSubTask records so the fixed parser can re-create
  // them with featureId / userStoryId populated from the new fallback
  // chain (parseAndStore is idempotent — it skips existing rows).
  const existing = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.baSubTaskSection.deleteMany({
      where: { subtaskDbId: { in: existing.map((e) => e.id) } },
    });
    const del = await prisma.baSubTask.deleteMany({ where: { moduleDbId: mod.id } });
    console.log(`Deleted ${del.count} existing BaSubTask record(s)`);
  }

  const humanDocument = artifact.sections
    .map((s) => `## ${s.sectionLabel}\n${s.content}`)
    .join('\n\n');
  console.log(`Synthesized humanDocument: ${humanDocument.length} chars`);

  // Sanity probe: count `## ST-` headings + `SubTask Decomposition` group headings.
  const stHeadings = (humanDocument.match(/^## (?:SubTask:\s*)?ST-/gm) ?? []).length;
  const groupHeadings = (humanDocument.match(/^## SubTask Decomposition for US-\d+/gm) ?? []).length;
  console.log(`## ST-* headings in synthesized doc: ${stHeadings}`);
  console.log(`## SubTask Decomposition group headings: ${groupHeadings}`);

  const subtaskIds = await parser.parseAndStore(humanDocument, mod.id, artifact.id);
  console.log(`parseAndStore returned ${subtaskIds.length} subtask DB ids`);

  // TBD-Future extraction (uses BaSubTask records just inserted)
  // and RTM extension. Both are private on the orchestrator, so we
  // call them via reflection — same as runSkillAsync's post-processing.
  type OrchPrivate = {
    extractTbdFromSubTasks(moduleDbId: string): Promise<void>;
    extendRtmWithSubTasks(moduleDbId: string, projectId: string): Promise<void>;
  };
  const op = orch as unknown as OrchPrivate;
  await op.extractTbdFromSubTasks(mod.id);
  console.log('TBD extraction done');
  if (mod.projectId) {
    await op.extendRtmWithSubTasks(mod.id, mod.projectId);
    console.log('RTM extension done');
  }

  const finalCount = await prisma.baSubTask.count({ where: { moduleDbId: mod.id } });
  console.log(`\nFinal BaSubTask records for MOD-05: ${finalCount}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
