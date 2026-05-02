import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.baModule
  .findFirst({ where: { moduleId: 'MOD-05' }, select: { id: true, moduleId: true, projectId: true } })
  .then((m) => console.log(JSON.stringify(m)))
  .finally(() => p.$disconnect());
