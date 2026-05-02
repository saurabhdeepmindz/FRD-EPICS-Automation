/**
 * Poll a BaSkillExecution by id every N seconds and exit when terminal.
 * Usage: npx ts-node scripts/_poll-exec.ts <execId> [intervalSec=60] [maxIters=60]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const execId = process.argv[2];
  const interval = parseInt(process.argv[3] ?? '60', 10) * 1000;
  const maxIters = parseInt(process.argv[4] ?? '60', 10);
  if (!execId) {
    console.error('Usage: ts-node _poll-exec.ts <execId> [intervalSec=60] [maxIters=60]');
    process.exit(2);
  }
  for (let i = 0; i < maxIters; i++) {
    const e = await prisma.baSkillExecution.findUnique({ where: { id: execId } });
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] iter ${i} status=${e?.status} docLen=${e?.humanDocument?.length ?? 0}`);
    if (!e || (e.status !== 'RUNNING' && e.status !== 'PENDING')) {
      console.log(`FINAL: ${e?.status} err=${e?.errorMessage?.slice(0, 200) ?? '-'}`);
      break;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
