import { WireframeChangeService } from './wireframe-change.service';

/**
 * WC-20 — unit coverage for the register-creation logic: sequential WFC codes,
 * phase→status mapping (LATER → DEFERRED), source/requestor/date capture, and the
 * SUBMITTED + EXTRACTED activity trail per change.
 */
describe('WireframeChangeService.createChanges', () => {
  function make() {
    const created: Array<Record<string, unknown>> = [];
    const activities: Array<Record<string, unknown>> = [];
    let idc = 0;
    const prisma = {
      baWireframeChange: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `c${++idc}`, ...data };
          created.push(row);
          return row;
        }),
      },
      baWireframeChangeActivity: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          activities.push(data);
          return data;
        }),
      },
    };
    const events = { emitActivity: jest.fn(), emitStatus: jest.fn() };
    const svc = new WireframeChangeService(prisma as never, {} as never, events as never, {} as never, {} as never);
    return { svc, prisma, created, activities };
  }

  it('assigns sequential WFC codes, maps phase→status, carries source/requestor/date', async () => {
    const { svc, created, activities } = make();
    const out = await svc.createChanges(
      'p1',
      [
        { description: 'Recolor CTA', targetScreens: ['screen-01-landing'], changeKind: 'SCREEN' },
        { description: 'Add user-stories video', changeKind: 'SCREEN', phase: 'LATER' },
      ],
      { requestedBy: 'Priya', source: 'CUSTOMER', requestedOn: '2026-06-09' },
    );

    expect(out).toHaveLength(2);
    expect(created.map((c) => c.changeCode)).toEqual(['WFC-001', 'WFC-002']);
    expect(created[0].status).toBe('PENDING');
    expect(created[1].status).toBe('DEFERRED'); // phase LATER → deferred
    expect(created[0].source).toBe('CUSTOMER');
    expect(created[0].requestedBy).toBe('Priya');
    expect(created[0].requestedOn).toBeInstanceOf(Date);
    expect(created[0].targetKind).toBe('HIFI'); // default fidelity
    expect(activities.filter((a) => a.type === 'SUBMITTED')).toHaveLength(2);
    expect(activities.filter((a) => a.type === 'EXTRACTED')).toHaveLength(2);
  });

  it('continues numbering from the existing count and defaults source to INTERNAL', async () => {
    const { svc, prisma, created } = make();
    prisma.baWireframeChange.count.mockResolvedValue(5);
    await svc.createChanges('p1', [{ description: 'tidy header' }], {});
    expect(created[0].changeCode).toBe('WFC-006');
    expect(created[0].source).toBe('INTERNAL');
    expect(created[0].requestedOn).toBeNull();
  });
});
