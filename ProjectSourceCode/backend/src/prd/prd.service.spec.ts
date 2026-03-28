import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrdService } from './prd.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrdStatus, SectionStatus } from '@prisma/client';

const mockPrd = {
  id: 'test-id',
  prdCode: 'PRD-TEST001',
  productName: 'Test Product',
  version: '1.0',
  author: 'Tester',
  status: PrdStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: Array.from({ length: 22 }, (_, i) => ({
    id: `section-${i + 1}`,
    prdId: 'test-id',
    sectionNumber: i + 1,
    sectionName: `Section ${i + 1}`,
    status: SectionStatus.NOT_STARTED,
    content: {},
    aiSuggested: false,
    completedAt: null,
  })),
};

const prismaMock = {
  prd: {
    create: jest.fn().mockResolvedValue(mockPrd),
    findMany: jest.fn().mockResolvedValue([mockPrd]),
    findUnique: jest.fn().mockResolvedValue(mockPrd),
    delete: jest.fn().mockResolvedValue(mockPrd),
  },
  prdSection: {
    findUnique: jest.fn().mockResolvedValue(mockPrd.sections[0]),
    update: jest.fn().mockResolvedValue({ ...mockPrd.sections[0], status: SectionStatus.COMPLETE }),
  },
};

describe('PrdService', () => {
  let service: PrdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrdService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PrdService>(PrdService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('creates a PRD with 22 sections', async () => {
      const result = await service.create({
        prdCode: 'PRD-TEST001',
        productName: 'Test Product',
      });
      expect(prismaMock.prd.create).toHaveBeenCalledTimes(1);
      expect(result.sections).toHaveLength(22);
    });
  });

  describe('findAll()', () => {
    it('returns array of PRDs', async () => {
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
      expect(prismaMock.prd.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne()', () => {
    it('returns a PRD by id', async () => {
      const result = await service.findOne('test-id');
      expect(result.id).toBe('test-id');
    });

    it('throws NotFoundException for unknown id', async () => {
      prismaMock.prd.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSection()', () => {
    it('updates section content and marks COMPLETE', async () => {
      const result = await service.updateSection('test-id', 1, {
        content: { objective: 'Build something great' },
      });
      expect(result.status).toBe(SectionStatus.COMPLETE);
    });

    it('throws NotFoundException when section not found', async () => {
      prismaMock.prdSection.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateSection('test-id', 99, { content: { x: 1 } }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCompletion()', () => {
    it('returns completion statistics', async () => {
      const result = await service.getCompletion('test-id');
      expect(result).toHaveProperty('percentComplete');
      expect(result).toHaveProperty('totalSections', 22);
    });

    it('throws NotFoundException for unknown id', async () => {
      prismaMock.prd.findUnique.mockResolvedValueOnce(null);
      await expect(service.getCompletion('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('deletes a PRD', async () => {
      await service.remove('test-id');
      expect(prismaMock.prd.delete).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });
  });
});
