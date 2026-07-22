/**
 * PlatformAuditQueryService — the cross-tenant audit query.
 *
 * Pins the query shaping: filters narrow, the limit is clamped, and paging math
 * is right. Cross-tenant visibility itself is an RLS/interceptor concern proven
 * elsewhere; here we assert the query the service builds.
 */
import { PlatformAuditQueryService } from './platform-audit-query.service';

function build(rows: unknown[] = [], total = 0) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(total);
  const client = { auditLog: { findMany, count } };
  const tenantDb = { client };
  return {
    service: new PlatformAuditQueryService(tenantDb as never),
    findMany,
    count,
  };
}

describe('PlatformAuditQueryService.query', () => {
  it('applies only the filters provided, ordered newest first', async () => {
    const { service, findMany } = build();

    await service.query({ tenantId: 't1', action: 'login', page: 2, limit: 10 });

    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: 't1', action: 'login' });
    expect(arg.orderBy).toEqual({ timestamp: 'desc' });
    expect(arg.skip).toBe(10); // (page 2 - 1) * limit 10
    expect(arg.take).toBe(10);
  });

  it('builds a timestamp range from start/end dates', async () => {
    const { service, findMany } = build();

    await service.query({ startDate: '2026-07-01', endDate: '2026-07-31' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.timestamp.gte).toEqual(new Date('2026-07-01'));
    expect(where.timestamp.lte).toEqual(new Date('2026-07-31'));
  });

  it('clamps the limit to the maximum', async () => {
    const { service, findMany } = build();

    await service.query({ limit: 100_000 });

    expect(findMany.mock.calls[0][0].take).toBe(200);
  });

  it('returns pagination metadata', async () => {
    const { service } = build([{ id: 'a' }], 125);

    const res = await service.query({ limit: 50, page: 2 });

    expect(res.pagination).toEqual({
      page: 2,
      limit: 50,
      total: 125,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });
});
