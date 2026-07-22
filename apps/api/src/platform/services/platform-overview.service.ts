import { Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { AUDIT_ACTION } from '../../common/audit/audit.constants';

/** A tenant flagged as stalled in onboarding. */
export interface StalledOnboarding {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  daysWaiting: number;
}

/** The honest tenant-health overview (docs/platform-scope-plan.md §3). */
export interface PlatformOverview {
  tenants: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
  byType: { schoolType: string; count: number }[];
  users: { total: number };
  onboarding: { stalled: StalledOnboarding[] };
  growth: { month: string; count: number }[];
  recentActivity: {
    action: string;
    targetTenantId: string | null;
    at: Date;
  }[];
}

/** A tenant pending this long with no activation is treated as stalled. */
const STALLED_ONBOARDING_DAYS = 14;
const GROWTH_MONTHS = 12;
const RECENT_ACTIVITY_LIMIT = 12;

/**
 * Platform Overview Service
 *
 * Aggregates tenant-health across all tenants for the platform `/overview`.
 * Runs inside the audited `@PlatformScoped` cross-tenant scope, so
 * `tenantDb.client` sees every tenant.
 *
 * Deliberately the *honest* cut: only what the current schema actually supports
 * — tenant counts/status/type, user totals, onboarding progress, growth from
 * `createdAt`, and recent tenant-lifecycle audit events. MRR / renewals /
 * tickets are omitted rather than shown as zeroes; they arrive when the billing
 * and support domains do.
 *
 * The per-row scans here are fine at demo scale. At 1,000+ tenants the growth
 * and count queries should move to materialised rollups (Phase 3.1 / Option C).
 */
@Injectable()
export class PlatformOverviewService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async getOverview(): Promise<PlatformOverview> {
    const client = this.tenantDb.client;

    const [byStatus, byTypeRaw, userCount, tenantsForDerived, recent] =
      await Promise.all([
        client.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
        client.tenant.groupBy({ by: ['schoolType'], _count: { _all: true } }),
        client.user.count(),
        client.tenant.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            createdAt: true,
          },
        }),
        client.auditLog.findMany({
          where: { action: { in: TENANT_LIFECYCLE_ACTIONS } },
          orderBy: { timestamp: 'desc' },
          take: RECENT_ACTIVITY_LIMIT,
          select: { action: true, resourceId: true, timestamp: true },
        }),
      ]);

    const statusCount = (status: string): number =>
      byStatus.find((s) => s.status === status)?._count._all ?? 0;

    return {
      tenants: {
        total: tenantsForDerived.length,
        active: statusCount('active'),
        pending: statusCount('pending'),
        suspended: statusCount('suspended'),
      },
      byType: byTypeRaw
        .map((t) => ({
          schoolType: t.schoolType ?? 'unspecified',
          count: t._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      users: { total: userCount },
      onboarding: { stalled: this.stalledOnboarding(tenantsForDerived) },
      growth: this.growth(tenantsForDerived.map((t) => t.createdAt)),
      recentActivity: recent.map((r) => ({
        action: r.action,
        targetTenantId: r.resourceId,
        at: r.timestamp,
      })),
    };
  }

  private stalledOnboarding(
    tenants: { id: string; name: string; slug: string; status: string; createdAt: Date }[],
  ): StalledOnboarding[] {
    const now = Date.now();
    const cutoffMs = STALLED_ONBOARDING_DAYS * 24 * 60 * 60 * 1000;
    return tenants
      .filter(
        (t) => t.status === 'pending' && now - t.createdAt.getTime() > cutoffMs,
      )
      .map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.createdAt,
        daysWaiting: Math.floor((now - t.createdAt.getTime()) / 86_400_000),
      }))
      .sort((a, b) => b.daysWaiting - a.daysWaiting);
  }

  /** Tenant count per month for the last GROWTH_MONTHS, oldest first. */
  private growth(createdAts: Date[]): { month: string; count: number }[] {
    const buckets = new Map<string, number>();
    const now = new Date();
    // Seed the last N months at 0 so quiet months render as gaps, not omissions.
    for (let i = GROWTH_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(monthKey(d), 0);
    }
    for (const created of createdAts) {
      const key = monthKey(created);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets, ([month, count]) => ({ month, count }));
  }
}

const TENANT_LIFECYCLE_ACTIONS: string[] = [
  AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_REGISTERED,
  AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_STATUS_UPDATED,
  AUDIT_ACTION.PLATFORM.TENANT_STATUS_ACTION,
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
