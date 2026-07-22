/**
 * PlatformOverviewService — the tenant-health aggregation.
 *
 * The derivations worth pinning are the ones that aren't a straight DB read:
 * stalled-onboarding detection and month bucketing of growth.
 */
import { PlatformOverviewService } from './platform-overview.service';

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function build(rows: {
  byStatus?: { status: string; _count: { _all: number } }[];
  byType?: { schoolType: string | null; _count: { _all: number } }[];
  userCount?: number;
  tenants?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: Date;
  }[];
  audit?: { action: string; resourceId: string | null; timestamp: Date }[];
}) {
  const client = {
    tenant: {
      groupBy: jest.fn(({ by }: { by: string[] }) =>
        by[0] === 'status' ? (rows.byStatus ?? []) : (rows.byType ?? []),
      ),
      findMany: jest.fn().mockResolvedValue(rows.tenants ?? []),
    },
    user: { count: jest.fn().mockResolvedValue(rows.userCount ?? 0) },
    auditLog: { findMany: jest.fn().mockResolvedValue(rows.audit ?? []) },
  };
  const tenantDb = { client };
  return { service: new PlatformOverviewService(tenantDb as never) };
}

describe('PlatformOverviewService.getOverview', () => {
  it('summarises tenant status counts', async () => {
    const { service } = build({
      byStatus: [
        { status: 'active', _count: { _all: 6 } },
        { status: 'pending', _count: { _all: 1 } },
      ],
      tenants: [
        { id: 't1', name: 'A', slug: 'a', status: 'active', createdAt: daysAgo(3) },
        { id: 't2', name: 'B', slug: 'b', status: 'pending', createdAt: daysAgo(2) },
      ],
      userCount: 312,
    });

    const out = await service.getOverview();

    expect(out.tenants).toEqual({ total: 2, active: 6, pending: 1, suspended: 0 });
    expect(out.users.total).toBe(312);
  });

  it('flags only pending tenants past the stall threshold, longest wait first', async () => {
    const { service } = build({
      tenants: [
        { id: 'old', name: 'Old', slug: 'old', status: 'pending', createdAt: daysAgo(40) },
        { id: 'mid', name: 'Mid', slug: 'mid', status: 'pending', createdAt: daysAgo(20) },
        { id: 'fresh', name: 'Fresh', slug: 'fresh', status: 'pending', createdAt: daysAgo(2) },
        // A long-pending-but-active tenant must NOT be flagged.
        { id: 'act', name: 'Act', slug: 'act', status: 'active', createdAt: daysAgo(90) },
      ],
    });

    const out = await service.getOverview();

    expect(out.onboarding.stalled.map((s) => s.id)).toEqual(['old', 'mid']);
    expect(out.onboarding.stalled[0]?.daysWaiting).toBeGreaterThanOrEqual(40);
  });

  it('buckets growth into the last 12 months and seeds quiet months at 0', async () => {
    const { service } = build({
      tenants: [
        { id: 't1', name: 'A', slug: 'a', status: 'active', createdAt: daysAgo(5) },
        { id: 't2', name: 'B', slug: 'b', status: 'active', createdAt: daysAgo(5) },
      ],
    });

    const out = await service.getOverview();

    expect(out.growth).toHaveLength(12);
    // Two tenants created this month land in the last bucket.
    expect(out.growth[out.growth.length - 1]?.count).toBe(2);
    // Earlier buckets are present and zero, not omitted.
    expect(out.growth[0]?.count).toBe(0);
  });

  it('sorts institution-type breakdown by count desc and labels nulls', async () => {
    const { service } = build({
      byType: [
        { schoolType: 'primary', _count: { _all: 2 } },
        { schoolType: null, _count: { _all: 5 } },
        { schoolType: 'secondary', _count: { _all: 3 } },
      ],
    });

    const out = await service.getOverview();

    expect(out.byType).toEqual([
      { schoolType: 'unspecified', count: 5 },
      { schoolType: 'secondary', count: 3 },
      { schoolType: 'primary', count: 2 },
    ]);
  });

  it('maps recent tenant-lifecycle audit into activity items', async () => {
    const at = new Date();
    const { service } = build({
      audit: [{ action: 'tenant_status_updated', resourceId: 't9', timestamp: at }],
    });

    const out = await service.getOverview();

    expect(out.recentActivity).toEqual([
      { action: 'tenant_status_updated', targetTenantId: 't9', at },
    ]);
  });
});
