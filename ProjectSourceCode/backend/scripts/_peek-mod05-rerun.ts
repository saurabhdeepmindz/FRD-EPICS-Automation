import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId: 'MOD-05' } });
  if (!mod) { console.error('MOD-05 not found'); return; }

  // Latest SKILL-01-S execution
  const exec = await prisma.baSkillExecution.findFirst({
    where: { moduleDbId: mod.id, skillName: 'SKILL-01-S' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Latest SKILL-01-S exec: ${exec?.id}  ${exec?.createdAt.toISOString()}`);
  console.log(`  status=${exec?.status}  docLen=${(exec?.humanDocument || '').length}\n`);

  if (exec?.humanDocument) {
    console.log('───── First 2000 chars of new humanDocument ─────');
    console.log(exec.humanDocument.slice(0, 2000));
    console.log('\n───── Last 1500 chars ─────');
    console.log(exec.humanDocument.slice(-1500));
  }

  console.log('\n───── Screens for MOD-05 ─────');
  const screens = await prisma.baScreen.findMany({
    where: { moduleDbId: mod.id },
    orderBy: { displayOrder: 'asc' },
    select: { screenId: true, screenTitle: true, screenType: true, textDescription: true, audioTranscript: true, aiFormattedTranscript: true, transcriptReviewed: true, aiTranscriptReviewed: true },
  });
  console.log(`Total screens: ${screens.length}`);
  let withText = 0, withAudio = 0, withAi = 0;
  for (const s of screens) {
    const tdLen = (s.textDescription ?? '').length;
    const atLen = (s.audioTranscript ?? '').length;
    const aiLen = (s.aiFormattedTranscript ?? '').length;
    if (tdLen > 0) withText++;
    if (atLen > 0) withAudio++;
    if (aiLen > 0) withAi++;
    console.log(`  ${s.screenId.padEnd(8)} ${(s.screenType ?? '?').padEnd(12)} text=${tdLen.toString().padStart(4)}  audio=${atLen.toString().padStart(4)}  aiFmt=${aiLen.toString().padStart(4)}  reviewed=text:${s.transcriptReviewed ? 'Y' : 'N'}/ai:${s.aiTranscriptReviewed ? 'Y' : 'N'}  ${s.screenTitle}`);
  }
  console.log(`\nSummary: text=${withText}/${screens.length}  audio=${withAudio}/${screens.length}  aiFormatted=${withAi}/${screens.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
