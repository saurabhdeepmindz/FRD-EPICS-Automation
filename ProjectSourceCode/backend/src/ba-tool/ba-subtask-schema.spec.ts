/**
 * Test: BaSubTask and BaSubTaskSection Prisma models exist and have correct shape.
 * This test validates the schema was applied correctly by checking the Prisma client types.
 */

// This test runs after prisma generate — it validates the generated types exist
describe('BaSubTask Prisma Schema', () => {
  it('should have BaSubTask model available on PrismaClient', () => {
    // If prisma generate succeeded with the new models, this import won't throw
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    expect(prisma.baSubTask).toBeDefined();
    expect(typeof prisma.baSubTask.findMany).toBe('function');
    expect(typeof prisma.baSubTask.create).toBe('function');
    expect(typeof prisma.baSubTask.update).toBe('function');
    expect(typeof prisma.baSubTask.delete).toBe('function');
  });

  it('should have BaSubTaskSection model available on PrismaClient', () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    expect(prisma.baSubTaskSection).toBeDefined();
    expect(typeof prisma.baSubTaskSection.findMany).toBe('function');
    expect(typeof prisma.baSubTaskSection.create).toBe('function');
  });

  it('should have SubTaskStatus enum values', () => {
    const { SubTaskStatus } = require('@prisma/client');
    expect(SubTaskStatus.DRAFT).toBe('DRAFT');
    expect(SubTaskStatus.APPROVED).toBe('APPROVED');
    expect(SubTaskStatus.IMPLEMENTED).toBe('IMPLEMENTED');
  });
});
