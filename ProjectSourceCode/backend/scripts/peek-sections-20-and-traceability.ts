import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const s = await prisma.baArtifactSection.findFirst({
    where: {
      sectionKey:
        'st_us074_be_01_implement_api_endpoint_for_verification_quota_check_and_decrement',
    },
  });
  if (!s) {
    console.log('not found');
    return;
  }

  // Find Traceability block
  const traceabilityIdx = s.content.indexOf('TRACEABILITY');
  if (traceabilityIdx >= 0) {
    const trace = s.content.slice(Math.max(0, traceabilityIdx - 100), traceabilityIdx + 1500);
    console.log('── TRACEABILITY block ──');
    console.log(trace);
    console.log();
  }

  // Find Section 20 block
  const sec20Idx = s.content.search(/Section 20\b.*Project Structure/i);
  if (sec20Idx >= 0) {
    const sec20 = s.content.slice(sec20Idx, sec20Idx + 2500);
    console.log('── Section 20 block ──');
    console.log(sec20);
    console.log();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
