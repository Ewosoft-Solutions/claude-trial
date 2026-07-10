/**
 * TransportService unit tests — the derived routes/pickups views (slice 3
 * sub-surfaces) plus the route summary. Prisma is stubbed via a fake client.
 */
import { TransportService } from './transport.service';

function build(rows: unknown[]) {
  const client = {
    transportAssignment: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
  const db = { client };
  const tenantDb = { isScoped: false, client };
  return new TransportService(db as never, tenantDb as never);
}

const student = (first: string, last: string, number: string) => ({
  studentNumber: number,
  userTenant: { user: { firstName: first, lastName: last } },
});

describe('TransportService', () => {
  it('folds assignments into one row per route with a pickup window', async () => {
    const service = build([
      { routeName: 'A', stop: 'S1', pickupTime: '07:00', vehicleLabel: 'Bus 1', status: 'assigned' },
      { routeName: 'A', stop: 'S2', pickupTime: '06:45', vehicleLabel: 'Bus 1', status: 'waitlist' },
      { routeName: null, stop: null, pickupTime: null, vehicleLabel: null, status: 'unassigned' },
    ]);
    const routes = await service.routes('t1');

    expect(routes.map((r) => r.routeName)).toEqual(['A', 'Unassigned']);
    const a = routes[0];
    expect(a).toMatchObject({
      routeName: 'A',
      studentCount: 2,
      vehicles: ['Bus 1'],
      stops: ['S1', 'S2'],
      firstPickup: '06:45',
      lastPickup: '07:00',
      assigned: 1,
      waitlist: 1,
      unassigned: 0,
    });
    expect(routes[1]).toMatchObject({ routeName: 'Unassigned', unassigned: 1 });
  });

  it('orders pickups by time then route', async () => {
    const service = build([
      { id: 'p2', routeName: 'B', stop: 'S3', pickupTime: '07:30', vehicleLabel: null, status: 'assigned', student: student('Ada', 'N', 'S-2') },
      { id: 'p1', routeName: 'A', stop: 'S1', pickupTime: '06:45', vehicleLabel: 'Bus 1', status: 'assigned', student: student('Ben', 'O', 'S-1') },
    ]);
    const pickups = await service.pickups('t1');
    expect(pickups.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(pickups[0]).toMatchObject({
      studentName: 'Ben O',
      studentNumber: 'S-1',
      pickupTime: '06:45',
    });
  });

  it('summarizes per-route and per-status counts', async () => {
    const service = build([
      { routeName: 'A', status: 'assigned' },
      { routeName: 'A', status: 'assigned' },
      { routeName: null, status: 'unassigned' },
    ]);
    const summary = await service.routeSummary('t1');
    expect(summary.totalAssignments).toBe(3);
    expect(summary.routeCounts).toEqual({ A: 2, Unassigned: 1 });
    expect(summary.statusCounts).toEqual({ assigned: 2, unassigned: 1 });
  });
});
