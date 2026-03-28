import { Test, TestingModule } from '@nestjs/testing';
import { PrdController } from './prd.controller';
import { PrdService } from './prd.service';
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
  sections: [],
};

const prdServiceMock = {
  create: jest.fn().mockResolvedValue(mockPrd),
  findAll: jest.fn().mockResolvedValue([mockPrd]),
  findOne: jest.fn().mockResolvedValue(mockPrd),
  updateSection: jest.fn().mockResolvedValue({ status: SectionStatus.COMPLETE }),
  getCompletion: jest.fn().mockResolvedValue({
    prdId: 'test-id',
    productName: 'Test Product',
    totalSections: 22,
    completedSections: 0,
    percentComplete: 0,
    sections: [],
  }),
  remove: jest.fn().mockResolvedValue(mockPrd),
};

describe('PrdController', () => {
  let controller: PrdController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrdController],
      providers: [{ provide: PrdService, useValue: prdServiceMock }],
    }).compile();

    controller = module.get<PrdController>(PrdController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() calls prdService.create', async () => {
    const result = await controller.create({ prdCode: 'PRD-TEST001', productName: 'Test' });
    expect(prdServiceMock.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockPrd);
  });

  it('findAll() calls prdService.findAll', async () => {
    const result = await controller.findAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it('findOne() calls prdService.findOne with id', async () => {
    const result = await controller.findOne('test-id');
    expect(prdServiceMock.findOne).toHaveBeenCalledWith('test-id');
    expect(result).toEqual(mockPrd);
  });

  it('updateSection() calls prdService.updateSection', async () => {
    await controller.updateSection('test-id', 1, { content: { x: 1 } });
    expect(prdServiceMock.updateSection).toHaveBeenCalledWith('test-id', 1, { content: { x: 1 } });
  });

  it('getCompletion() calls prdService.getCompletion', async () => {
    const result = await controller.getCompletion('test-id');
    expect(result).toHaveProperty('percentComplete');
  });

  it('remove() calls prdService.remove', async () => {
    await controller.remove('test-id');
    expect(prdServiceMock.remove).toHaveBeenCalledWith('test-id');
  });
});
