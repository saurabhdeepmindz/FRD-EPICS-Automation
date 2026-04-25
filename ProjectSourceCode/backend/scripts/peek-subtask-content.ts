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
  console.log(s.content.slice(0, 2500));
  console.log('\n--- END preview ---');
  console.log('total length:', s.content.length);
  console.log('contains NestJS:', /Nest|@Controller|@Injectable|nest\.js/i.test(s.content));
  console.log('contains Next.js:', /Next\.js|next\//i.test(s.content));
  console.log('contains Prisma:', /@prisma|prisma\.|prisma\/client/i.test(s.content));
  console.log('contains Java legacy:', /\bpublic class\b|\bvoid\s+\w+\s*\(|@Override\b/.test(s.content));
  console.log('contains Mermaid:', /sequenceDiagram/.test(s.content));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
