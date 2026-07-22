import { Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { computeDrift } from './platform-security-baseline';

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface RiskFlag {
  code: string;
  severity: RiskSeverity;
  detail: string;
}

export interface TenantRisk {
  tenantId: string;
  tenantName: string;
  status: string;
  severity: RiskSeverity;
  flags: RiskFlag[];
}

export interface PlatformRiskReport {
  atRisk: TenantRisk[];
  summary: { total: number; high: number; medium: number; low: number; ok: number };
}

const STALLED_ONBOARDING_DAYS = 14;
const DORMANT_ACTIVITY_DAYS = 30;

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 3, medium: 2, low: 1 };

/**
 * Platform Risk Service (3.3)
 *
 * Combines existing platform signals into an at-risk / misconfigured view. This
 * is deliberately **rules-based**, not AI: the signals are deterministic and an
 * operator needs to trust the flag. The AI layer (3.2) can *narrate* this, but
 * the detection itself should be explainable and reproducible.
 *
 * Signals:
 *  - policy drift (2.3)         → misconfigured
 *  - stalled onboarding (>14d)  → onboarding at risk
 *  - dormant (no audit >30d)    → possibly abandoned
 *  - suspended                  → access cut
 *
 * Runs inside `@PlatformScoped`.
 */
@Injectable()
export class PlatformRiskService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async assess(): Promise<PlatformRiskReport> {
    const client = this.tenantDb.client;
    const now = Date.now();

    const [tenants, lastActivity] = await Promise.all([
      client.tenant.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          securityPolicy: {
            select: {
              requireMFA: true,
              requireMFAForSensitiveOperations: true,
              passwordMinLength: true,
              sessionTimeout: true,
              loginAttemptLimit: true,
              auditLevel: true,
            },
          },
        },
      }),
      // Most recent audit event per tenant — an activity heartbeat.
      client.auditLog.groupBy({
        by: ['tenantId'],
        _max: { timestamp: true },
      }),
    ]);

    const lastSeen = new Map<string, Date | null>();
    for (const row of lastActivity) {
      if (row.tenantId) lastSeen.set(row.tenantId, row._max.timestamp);
    }

    const assessed: TenantRisk[] = tenants.map((t) => {
      const flags: RiskFlag[] = [];

      if (t.status === 'suspended') {
        flags.push({
          code: 'suspended',
          severity: 'high',
          detail: 'Tenant is suspended — access is cut.',
        });
      }

      const drift = computeDrift(
        t.securityPolicy as Record<string, unknown> | null,
      );
      if (drift.length > 0) {
        flags.push({
          code: 'policy_drift',
          severity: t.securityPolicy ? 'medium' : 'high',
          detail: t.securityPolicy
            ? `Security policy is weaker than baseline on ${drift.length} setting(s): ${drift
                .map((d) => d.label)
                .join(', ')}.`
            : 'No security policy configured.',
        });
      }

      const ageDays = (now - t.createdAt.getTime()) / 86_400_000;
      if (t.status === 'pending' && ageDays > STALLED_ONBOARDING_DAYS) {
        flags.push({
          code: 'stalled_onboarding',
          severity: 'medium',
          detail: `Pending for ${Math.floor(ageDays)} days without activation.`,
        });
      }

      const seen = lastSeen.get(t.id) ?? null;
      const dormantDays = seen
        ? (now - seen.getTime()) / 86_400_000
        : ageDays;
      if (t.status === 'active' && dormantDays > DORMANT_ACTIVITY_DAYS) {
        flags.push({
          code: 'dormant',
          severity: 'low',
          detail: `No recorded activity for ${Math.floor(dormantDays)} days.`,
        });
      }

      return {
        tenantId: t.id,
        tenantName: t.name,
        status: t.status,
        severity: highestSeverity(flags),
        flags,
      };
    });

    const atRisk = assessed
      .filter((t) => t.flags.length > 0)
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

    const bySeverity = (s: RiskSeverity) =>
      atRisk.filter((t) => t.severity === s).length;

    return {
      atRisk,
      summary: {
        total: assessed.length,
        high: bySeverity('high'),
        medium: bySeverity('medium'),
        low: bySeverity('low'),
        ok: assessed.length - atRisk.length,
      },
    };
  }
}

function highestSeverity(flags: RiskFlag[]): RiskSeverity {
  return flags.reduce<RiskSeverity>((worst, f) => {
    return SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst;
  }, 'low');
}
