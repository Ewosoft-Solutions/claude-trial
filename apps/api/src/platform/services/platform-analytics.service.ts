import { Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';

/**
 * Per-tenant aggregate row. Tenant-level only — a tenant is not a person, so
 * these counts carry no individual records.
 */
export interface TenantMetrics {
  tenantId: string;
  tenantName: string;
  status: string;
  schoolType: string | null;
  students: number;
  activeStudents: number;
  profiles: number;
}

export interface PlatformTotals {
  tenants: number;
  activeTenants: number;
  students: number;
  activeStudents: number;
  profiles: number;
}

export interface PlatformAnalytics {
  totals: PlatformTotals;
  byTenant: TenantMetrics[];
  byType: { schoolType: string; tenants: number; students: number }[];
}

/**
 * Platform Analytics Service — the cross-tenant aggregate surface (3.1).
 *
 * THE AGGREGATE FLOOR IS STRUCTURAL HERE. Every method returns counts, rates,
 * or distributions at the *tenant* level and above — never a per-pupil or
 * per-person row. This is the only surface the platform AI tools (3.2) are
 * allowed to read, which is what makes decision 1's "aggregate floor" a property
 * of the architecture rather than a prompt instruction: a tool bug cannot leak
 * an individual because this layer never returns one.
 *
 * Do not add a method that returns individual records. If per-tenant detail is
 * needed, it belongs behind a tenant-scoped endpoint, not here.
 *
 * Runs inside `@PlatformScoped`, so `tenantDb.client` sees every tenant.
 */
@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async getAnalytics(): Promise<PlatformAnalytics> {
    const client = this.tenantDb.client;

    const [tenants, studentsByTenant, activeByTenant, profilesByTenant] =
      await Promise.all([
        client.tenant.findMany({
          select: { id: true, name: true, status: true, schoolType: true },
          orderBy: { name: 'asc' },
        }),
        client.student.groupBy({ by: ['tenantId'], _count: { _all: true } }),
        client.student.groupBy({
          by: ['tenantId'],
          where: { enrollmentStatus: 'active' },
          _count: { _all: true },
        }),
        client.userTenant.groupBy({ by: ['tenantId'], _count: { _all: true } }),
      ]);

    const countFor = (
      rows: { tenantId: string; _count: { _all: number } }[],
      tenantId: string,
    ): number => rows.find((r) => r.tenantId === tenantId)?._count._all ?? 0;

    const byTenant: TenantMetrics[] = tenants.map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      status: t.status,
      schoolType: t.schoolType,
      students: countFor(studentsByTenant, t.id),
      activeStudents: countFor(activeByTenant, t.id),
      profiles: countFor(profilesByTenant, t.id),
    }));

    const totals: PlatformTotals = {
      tenants: byTenant.length,
      activeTenants: byTenant.filter((t) => t.status === 'active').length,
      students: sum(byTenant.map((t) => t.students)),
      activeStudents: sum(byTenant.map((t) => t.activeStudents)),
      profiles: sum(byTenant.map((t) => t.profiles)),
    };

    // Distribution by institution type — tenants and students per type.
    const typeMap = new Map<string, { tenants: number; students: number }>();
    for (const t of byTenant) {
      const key = t.schoolType ?? 'unspecified';
      const entry = typeMap.get(key) ?? { tenants: 0, students: 0 };
      entry.tenants += 1;
      entry.students += t.students;
      typeMap.set(key, entry);
    }
    const byType = Array.from(typeMap, ([schoolType, v]) => ({
      schoolType,
      ...v,
    })).sort((a, b) => b.students - a.students);

    return { totals, byTenant, byType };
  }
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
