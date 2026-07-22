/**
 * Platform security baseline — drift detection (2.3).
 *
 * A tenant may be stricter than the baseline (no drift); weaker is drift. Pins
 * each direction and the "no policy = maximum drift" case.
 */
import {
  computeDrift,
  PLATFORM_SECURITY_BASELINE,
} from './platform-security-baseline';

const COMPLIANT = {
  requireMFA: true,
  requireMFAForSensitiveOperations: true,
  passwordMinLength: 12,
  sessionTimeout: 15,
  loginAttemptLimit: 5,
  auditLevel: 'comprehensive',
};

describe('computeDrift', () => {
  it('reports no drift for a policy that meets or exceeds the baseline', () => {
    expect(computeDrift(COMPLIANT)).toEqual([]);
  });

  it('flags MFA turned off', () => {
    const drift = computeDrift({ ...COMPLIANT, requireMFA: false });
    expect(drift.map((d) => d.field)).toEqual(['requireMFA']);
    expect(drift[0]?.actual).toBe(false);
  });

  it('flags a password minimum below the floor (min direction)', () => {
    const drift = computeDrift({ ...COMPLIANT, passwordMinLength: 6 });
    expect(drift.map((d) => d.field)).toEqual(['passwordMinLength']);
  });

  it('flags an idle timeout above the ceiling (max direction — longer is weaker)', () => {
    const drift = computeDrift({ ...COMPLIANT, sessionTimeout: 60 });
    expect(drift.map((d) => d.field)).toEqual(['sessionTimeout']);
  });

  it('does NOT flag a stricter-than-baseline value', () => {
    // 5-minute idle timeout is stricter than the 30 ceiling — compliant.
    expect(computeDrift({ ...COMPLIANT, sessionTimeout: 5 })).toEqual([]);
  });

  it('flags an audit level below the floor (ordered set)', () => {
    const drift = computeDrift({ ...COMPLIANT, auditLevel: 'basic' });
    expect(drift.map((d) => d.field)).toEqual(['auditLevel']);
  });

  it('treats a missing policy as maximum drift (every rule unmet)', () => {
    const drift = computeDrift(null);
    expect(drift).toHaveLength(PLATFORM_SECURITY_BASELINE.length);
    expect(drift.every((d) => d.actual === null)).toBe(true);
  });

  it('accumulates multiple violations', () => {
    const drift = computeDrift({
      ...COMPLIANT,
      requireMFA: false,
      auditLevel: 'basic',
    });
    expect(drift.map((d) => d.field).sort()).toEqual([
      'auditLevel',
      'requireMFA',
    ]);
  });
});
