import { EffectiveAccessService } from './effective-access.service';

/**
 * Unit coverage for the pure evaluator logic — clearance floor, source-pool
 * attribution, sensitive detection, separation-of-duties, and the scope-aware
 * explanation. The DB-backed evaluateRole / whoIsAffected are proven on real pg
 * in test/role-editor.e2e-spec.ts.
 */
function perm(
  name: string,
  requiredClearanceLevel = 3,
  extra: Partial<{ label: string; context: string | null }> = {},
) {
  const [resource, action, context] = name.split('.');
  return {
    id: name,
    name,
    label: extra.label ?? name,
    resource: resource ?? name,
    action: action ?? '',
    context: extra.context ?? context ?? null,
    requiredClearanceLevel,
  };
}

function pool(
  name: string,
  clearanceLevel: number,
  perms: ReturnType<typeof perm>[],
) {
  return {
    name,
    clearanceLevel,
    poolPermissions: perms.map((permission) => ({ permission })),
  };
}

// Reach the private assemble/explainFrom without a DB (they are pure).
type Access = Awaited<ReturnType<EffectiveAccessService['evaluateDraft']>>;
interface Internals {
  assemble(
    clearance: number,
    pools: ReturnType<typeof pool>[],
    meta: {
      roleName: string | null;
      scope: unknown;
      templateKey: string | null;
    },
  ): Access;
  explainFrom(
    access: Access,
    probe: { permission: string; targetScope?: unknown },
  ): { allowed: boolean; reason: string };
}

describe('EffectiveAccessService', () => {
  const service = new EffectiveAccessService();
  const internals = service as unknown as Internals;

  const assemble = (
    clearance: number,
    pools: ReturnType<typeof pool>[],
    meta: {
      roleName: string | null;
      scope: unknown;
      templateKey: string | null;
    },
  ) => internals.assemble(clearance, pools, meta);

  it('floors permissions at the role clearance and attributes a source pool', () => {
    const access = assemble(
      5,
      [
        pool('Level5_Finance', 5, [
          perm('fees.view', 4),
          perm('fees.create', 5),
          perm('platform.override', 9), // above clearance → excluded
        ]),
      ],
      { roleName: 'Bursar', scope: null, templateKey: 'bursar' },
    );
    const names = access.entries.map((e) => e.permission);
    expect(names).toContain('fees.view');
    expect(names).toContain('fees.create');
    expect(names).not.toContain('platform.override'); // floored out
    expect(access.entries[0]!.sourcePool).toBe('Level5_Finance');
    expect(
      access.entries.find((e) => e.permission === 'fees.view')!.reason,
    ).toContain('bursar template → Level5_Finance');
  });

  it('flags sensitive capabilities (money / export / high clearance)', () => {
    const access = assemble(
      6,
      [
        pool('P', 6, [
          perm('fees.view', 3),
          perm('payments.refund', 5), // action refund → sensitive
          perm('fees.export', 4), // action export → sensitive
        ]),
      ],
      { roleName: null, scope: null, templateKey: null },
    );
    expect(new Set(access.sensitive)).toEqual(
      new Set(['payments.refund', 'fees.export']),
    );
  });

  it('surfaces a separation-of-duties conflict', () => {
    const access = assemble(
      6,
      [pool('P', 6, [perm('fees.create', 4), perm('payments.refund', 5)])],
      { roleName: null, scope: null, templateKey: null },
    );
    expect(access.conflicts).toHaveLength(1);
    expect(access.conflicts[0]).toMatchObject({
      a: 'fees.create',
      b: 'payments.refund',
    });
    expect(access.summary).toMatch(/separation-of-duties/i);
  });

  it('explains a scoped role: allowed in scope, denied out of scope, denied when ungranted', () => {
    const access = assemble(
      5,
      [pool('Level5_Finance', 5, [perm('fees.view', 4)])],
      {
        roleName: 'Bursar (Campus A)',
        scope: { type: 'campus', value: 'campus-a', label: 'Campus A' },
        templateKey: 'bursar',
      },
    );

    const inScope = internals.explainFrom(access, {
      permission: 'fees.view',
      targetScope: { type: 'campus', value: 'campus-a', label: 'Campus A' },
    });
    expect(inScope.allowed).toBe(true);

    const outOfScope = internals.explainFrom(access, {
      permission: 'fees.view',
      targetScope: { type: 'campus', value: 'campus-b', label: 'Campus B' },
    });
    expect(outOfScope.allowed).toBe(false);
    expect(outOfScope.reason).toMatch(/Campus A.*not.*Campus B/);

    const ungranted = internals.explainFrom(access, {
      permission: 'payments.refund',
    });
    expect(ungranted.allowed).toBe(false);
    expect(ungranted.reason).toMatch(/not granted/i);
  });
});
