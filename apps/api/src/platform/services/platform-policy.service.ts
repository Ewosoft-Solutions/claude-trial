import { Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  PLATFORM_SECURITY_BASELINE,
  computeDrift,
  type BaselineRule,
  type DriftViolation,
} from './platform-security-baseline';

export interface TenantPolicyRow {
  tenantId: string;
  tenantName: string;
  status: string;
  policyTier: string | null;
  requireMFA: boolean | null;
  sessionTimeout: number | null;
  auditLevel: string | null;
  /** Empty = compliant with the platform baseline. */
  drift: DriftViolation[];
  hasPolicy: boolean;
}

export interface PlatformPolicyOverview {
  baseline: BaselineRule[];
  tenants: TenantPolicyRow[];
  summary: { total: number; compliant: number; drifting: number };
}

/**
 * Platform Policy Service
 *
 * Cross-tenant security-policy posture (2.2) and drift detection against the
 * platform baseline (2.3). Runs inside `@PlatformScoped`, so `tenantDb.client`
 * reads every tenant's `SchoolSecurityPolicy`.
 *
 * The baseline is code today (`platform-security-baseline.ts`) — a per-tenant
 * override or an editable platform-owned baseline row is a later step; the drift
 * computation would not change.
 */
@Injectable()
export class PlatformPolicyService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async getPolicyOverview(): Promise<PlatformPolicyOverview> {
    const client = this.tenantDb.client;

    // Every tenant, each joined to its (optional) security policy. A tenant with
    // no policy row is maximum drift.
    const tenants = await client.tenant.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        securityPolicy: {
          select: {
            policyTier: true,
            requireMFA: true,
            requireMFAForSensitiveOperations: true,
            passwordMinLength: true,
            sessionTimeout: true,
            loginAttemptLimit: true,
            auditLevel: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows: TenantPolicyRow[] = tenants.map((t) => {
      const policy = t.securityPolicy;
      const drift = computeDrift(policy as Record<string, unknown> | null);
      return {
        tenantId: t.id,
        tenantName: t.name,
        status: t.status,
        policyTier: policy?.policyTier ?? null,
        requireMFA: policy?.requireMFA ?? null,
        sessionTimeout: policy?.sessionTimeout ?? null,
        auditLevel: policy?.auditLevel ?? null,
        drift,
        hasPolicy: policy != null,
      };
    });

    const drifting = rows.filter((r) => r.drift.length > 0).length;

    return {
      baseline: [...PLATFORM_SECURITY_BASELINE],
      tenants: rows,
      summary: {
        total: rows.length,
        compliant: rows.length - drifting,
        drifting,
      },
    };
  }
}
