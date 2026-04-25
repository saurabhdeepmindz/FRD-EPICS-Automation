import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const moduleFlag = args.indexOf('--module');
  const targetModuleId = moduleFlag >= 0 ? args[moduleFlag + 1] : 'MOD-04';

  const mod = await prisma.baModule.findFirst({ where: { moduleId: targetModuleId } });
  if (!mod) { console.error(`module ${targetModuleId} not found`); process.exit(1); }

  console.log(`── ${targetModuleId} (${mod.id}) ──`);

  // FTC executions
  const execs = await prisma.baSkillExecution.findMany({
    where: { moduleDbId: mod.id, skillName: 'SKILL-07-FTC' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\nSKILL-07-FTC executions (${execs.length}):`);
  for (const e of execs) {
    const docLen = e.humanDocument?.length ?? 0;
    console.log(
      `  ${e.id}  status=${e.status}  createdAt=${e.createdAt.toISOString()}  docLen=${docLen}  err=${e.errorMessage?.slice(0, 80) ?? '—'}`,
    );
  }

  // FTC artifacts
  const artifacts = await prisma.baArtifact.findMany({
    where: { moduleDbId: mod.id, artifactType: 'FTC' },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { sections: true, testCases: true } } },
  });
  console.log(`\nFTC artifacts (${artifacts.length}):`);
  for (const a of artifacts) {
    console.log(
      `  ${a.id}  ${a.artifactId}  status=${a.status}  createdAt=${a.createdAt.toISOString()}  sections=${a._count.sections}  testCases=${a._count.testCases}`,
    );
  }

  // FTC config
  const config = await prisma.baFtcConfig.findUnique({ where: { moduleDbId: mod.id } });
  if (config) {
    console.log(`\nBaFtcConfig:`);
    console.log(`  testingFrameworks: ${JSON.stringify(config.testingFrameworks)}`);
    console.log(`  hasNarrative: ${!!config.narrative?.trim()}  narrativeLen=${config.narrative?.length ?? 0}`);
  } else {
    console.log(`\nBaFtcConfig: (none)`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
