import { PipelineWireframeService } from './pipeline-wireframe.service';

/**
 * Regression: a second hi-fi UPLOAD must APPEND to the existing hi-fi set, not
 * spawn a brand-new BaHifiSet. The gallery reads only the newest set, so the
 * old behaviour silently hid previously-uploaded hi-fi screens (e.g. uploading
 * screens 01–05 hid the already-uploaded 06–10).
 */
describe('PipelineWireframeService.upload — hi-fi append', () => {
  interface FakeHifiSet { id: string; projectId: string; wireframeSetId: string; createdAt: number }
  interface FakeHifiScreen { setId: string; sequenceNum: number; slug: string }

  function makeService() {
    const hifiSets: FakeHifiSet[] = [];
    const hifiScreens: FakeHifiScreen[] = [];
    let seq = 0;
    const createCalls = { hifiSet: 0 };

    const prisma = {
      baProject: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Demo' }),
      },
      baWireframeSet: {
        // ensurePipelineLoFiSet — always return a stable parent lo-fi set.
        findFirst: jest.fn().mockResolvedValue({ id: 'lofi-1' }),
        create: jest.fn(),
      },
      baHifiSet: {
        findFirst: jest.fn(async ({ where }: { where: { wireframeSetId: string } }) => {
          const matching = hifiSets
            .filter((s) => s.wireframeSetId === where.wireframeSetId)
            .sort((a, b) => b.createdAt - a.createdAt);
          return matching[0] ?? null;
        }),
        create: jest.fn(async ({ data }: { data: { projectId: string; wireframeSetId: string } }) => {
          createCalls.hifiSet += 1;
          const set: FakeHifiSet = {
            id: `hifi-${hifiSets.length + 1}`,
            projectId: data.projectId,
            wireframeSetId: data.wireframeSetId,
            createdAt: (seq += 1),
          };
          hifiSets.push(set);
          return set;
        }),
      },
      baHifiScreen: {
        count: jest.fn(async ({ where }: { where: { setId: string } }) =>
          hifiScreens.filter((s) => s.setId === where.setId).length,
        ),
        createMany: jest.fn(async ({ data }: { data: FakeHifiScreen[] }) => {
          hifiScreens.push(...data);
          return { count: data.length };
        }),
      },
    };

    const projectFolders = {
      writeArtifactFile: jest.fn().mockResolvedValue(undefined),
      appendChangelog: jest.fn().mockResolvedValue(undefined),
    };

    // Only prisma + projectFolders are exercised by upload(); the rest are unused here.
    const service = new PipelineWireframeService(
      prisma as never,
      projectFolders as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, hifiSets, hifiScreens, createCalls };
  }

  const file = (name: string) => ({ originalname: name, buffer: Buffer.from(`<html>${name}</html>`), mimetype: 'text/html' });

  it('creates one set on first upload, then appends on the second', async () => {
    const { service, hifiSets, hifiScreens, createCalls } = makeService();
    const projectId = 'p1';

    // First upload: screens 06–10.
    await service.upload(
      projectId,
      [file('screen-06.html'), file('screen-07.html'), file('screen-08.html'), file('screen-09.html'), file('screen-10.html')],
      'hifi',
      'Guest Flow',
    );

    // Second upload: screens 01–05 — must NOT hide the first batch.
    await service.upload(
      projectId,
      [file('screen-01.html'), file('screen-02.html'), file('screen-03.html'), file('screen-04.html'), file('screen-05.html')],
      'hifi',
      'Module A',
    );

    // Exactly one hi-fi set exists (the second upload reused it).
    expect(createCalls.hifiSet).toBe(1);
    expect(hifiSets).toHaveLength(1);

    // All 10 screens live in that one set, with continuous sequence numbers 1..10.
    const setId = hifiSets[0].id;
    const screensInSet = hifiScreens.filter((s) => s.setId === setId);
    expect(screensInSet).toHaveLength(10);
    expect(screensInSet.map((s) => s.sequenceNum).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
