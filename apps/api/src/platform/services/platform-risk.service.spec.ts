/**
 * PlatformRiskService (3.3) — signal combination and severity.
 *
 * The detection is rules-based and must stay explainable; these pin the flag
 * rules and the "worst flag wins" severity, plus the summary counts.
 */
import { PlatformRiskService } from './platform-risk.service';

const COMPLIANT_POLICY = {
  requireMFA: true,
  requireMFAForSensitiveOperations: true,
  passwordMinLength: 12,
  sessionTimeout: 15,
  loginAttemptLimit: 5,
  auditLevel: 'comprehensive',
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function build(
  tenants: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    securityPolicy: Record<string, unknown> | null;
  }[],
  activity: { tenantId: string; _max: { timestamp: Date | null } }[] = [],
) {
  const client = {
    tenant: { findMany: jest.fn().mockResolvedValue(tenants) },
    auditLog: { groupBy: jest.fn().mockResolvedValue(activity) },
  };
  return { service: new PlatformRiskService({ client } as never) };
}

describe('PlatformRiskService.assess', () => {
  it('does not flag a healthy, compliant, active, recently-active tenant', async () => {
    const { service } = build(
      [
        {
          id: 't1',
          name: 'Healthy',
          status: 'active',
          createdAt: daysAgo(120),
          securityPolicy: COMPLIANT_POLICY,
        },
      ],
      [{ tenantId: 't1', _max: { timestamp: daysAgo(1) } }],
    );

    const r = await service.assess();
    expect(r.atRisk).toEqual([]);
    expect(r.summary.ok).toBe(1);
  });

  it('flags a suspended tenant as high severity', async () => {
    const { service } = build([
      {
        id: 't1',
        name: 'Suspended',
        status: 'suspended',
        createdAt: daysAgo(200),
        securityPolicy: COMPLIANT_POLICY,
      },
    ]);

    const r = await service.assess();
    expect(r.atRisk[0]?.severity).toBe('high');
    expect(r.atRisk[0]?.flags.map((f) => f.code)).toContain('suspended');
  });

  it('flags a tenant with no policy as high (missing policy is worse than drift)', async () => {
    const { service } = build([
      {
        id: 't1',
        name: 'Unconfigured',
        status: 'active',
        createdAt: daysAgo(5),
        securityPolicy: null,
      },
    ]);

    const r = await service.assess();
    const flag = r.atRisk[0]?.flags.find((f) => f.code === 'policy_drift');
    expect(flag?.severity).toBe('high');
  });

  it('flags stalled onboarding for a long-pending tenant', async () => {
    const { service } = build([
      {
        id: 't1',
        name: 'Stalled',
        status: 'pending',
        createdAt: daysAgo(40),
        securityPolicy: COMPLIANT_POLICY,
      },
    ]);

    const r = await service.assess();
    expect(r.atRisk[0]?.flags.map((f) => f.code)).toContain('stalled_onboarding');
  });

  it('flags a dormant active tenant with no recent activity', async () => {
    const { service } = build(
      [
        {
          id: 't1',
          name: 'Dormant',
          status: 'active',
          createdAt: daysAgo(200),
          securityPolicy: COMPLIANT_POLICY,
        },
      ],
      [{ tenantId: 't1', _max: { timestamp: daysAgo(90) } }],
    );

    const r = await service.assess();
    expect(r.atRisk[0]?.flags.map((f) => f.code)).toContain('dormant');
  });

  it('takes the worst flag as the tenant severity and sorts high first', async () => {
    const { service } = build(
      [
        {
          id: 'low',
          name: 'Dormant only',
          status: 'active',
          createdAt: daysAgo(200),
          securityPolicy: COMPLIANT_POLICY,
        },
        {
          id: 'high',
          name: 'Suspended + drift',
          status: 'suspended',
          createdAt: daysAgo(200),
          securityPolicy: null,
        },
      ],
      [{ tenantId: 'low', _max: { timestamp: daysAgo(90) } }],
    );

    const r = await service.assess();
    // High-severity tenant sorts first.
    expect(r.atRisk[0]?.tenantId).toBe('high');
    expect(r.atRisk[0]?.severity).toBe('high');
    expect(r.summary.high).toBe(1);
    expect(r.summary.low).toBe(1);
  });
});
