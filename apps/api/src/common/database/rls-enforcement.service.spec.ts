/**
 * evaluateRlsEnforcement — the pure boot-time decision (fail-closed vs warn vs
 * ok) for runtime RLS enforcement. The live probe/DB is not exercised here.
 */
import { evaluateRlsEnforcement } from './rls-enforcement.service';

const goodProbe = {
  role: 'app_runtime',
  superuser: false,
  bypassRls: false,
  gucApplied: true,
};

describe('evaluateRlsEnforcement', () => {
  it('warns when app_runtime is not configured and enforcement is off (dev)', () => {
    const v = evaluateRlsEnforcement({ configured: false, enforced: false });
    expect(v.action).toBe('warn');
    expect(v.message).toContain('NOT enforced');
  });

  it('fails when app_runtime is not configured and enforcement is on (prod)', () => {
    const v = evaluateRlsEnforcement({ configured: false, enforced: true });
    expect(v.action).toBe('fail');
  });

  it('passes when the probe shows a restricted, GUC-applying role', () => {
    expect(evaluateRlsEnforcement({ configured: true, enforced: true, probe: goodProbe }).action).toBe('ok');
    expect(evaluateRlsEnforcement({ configured: true, enforced: false, probe: goodProbe }).action).toBe('ok');
  });

  it('flags a superuser / BYPASSRLS runtime role as unenforced', () => {
    const su = { ...goodProbe, superuser: true };
    expect(evaluateRlsEnforcement({ configured: true, enforced: true, probe: su }).action).toBe('fail');
    // The dangerous silent case still only warns when enforcement is off.
    expect(evaluateRlsEnforcement({ configured: true, enforced: false, probe: su }).action).toBe('warn');

    const bypass = { ...goodProbe, bypassRls: true };
    expect(evaluateRlsEnforcement({ configured: true, enforced: true, probe: bypass }).action).toBe('fail');
  });

  it('flags when the tenant GUC did not take effect', () => {
    const noGuc = { ...goodProbe, gucApplied: false };
    expect(evaluateRlsEnforcement({ configured: true, enforced: true, probe: noGuc }).action).toBe('fail');
  });

  it('gates a probe that threw', () => {
    const v = evaluateRlsEnforcement({
      configured: true,
      enforced: true,
      probe: { error: 'connection refused' },
    });
    expect(v.action).toBe('fail');
    expect(v.message).toContain('connection refused');
  });
});
