import { ForbiddenException } from '@nestjs/common';
import {
  AccessScopeService,
  isGrantExpired,
  parseScope,
} from './access-scope.service';

describe('AccessScopeService', () => {
  const svc = new AccessScopeService();

  describe('isWithinScope', () => {
    it('an unscoped (null) grant is not restricted', () => {
      expect(svc.isWithinScope(null, { campusId: 'campus-a' })).toBe(true);
      expect(svc.isWithinScope(undefined, { campusId: null })).toBe(true);
    });

    it('a global grant is not restricted', () => {
      expect(
        svc.isWithinScope({ type: 'global' }, { campusId: 'campus-a' }),
      ).toBe(true);
    });

    it('a campus grant allows its own campus', () => {
      const scope = { type: 'campus', value: 'campus-a', label: 'Campus A' };
      expect(svc.isWithinScope(scope, { campusId: 'campus-a' })).toBe(true);
    });

    it('a campus grant denies another campus', () => {
      const scope = { type: 'campus', value: 'campus-a', label: 'Campus A' };
      expect(svc.isWithinScope(scope, { campusId: 'campus-b' })).toBe(false);
    });

    it('a campus grant denies an unspecified (global) target — the safe default', () => {
      const scope = { type: 'campus', value: 'campus-a' };
      expect(svc.isWithinScope(scope, {})).toBe(false);
      expect(svc.isWithinScope(scope, { campusId: null })).toBe(false);
    });
  });

  describe('assertWithinScope', () => {
    it('throws a 403 out of scope', () => {
      const scope = { type: 'campus', value: 'campus-a', label: 'Campus A' };
      expect(() =>
        svc.assertWithinScope(scope, { campusId: 'campus-b' }),
      ).toThrow(ForbiddenException);
    });

    it('is silent within scope', () => {
      const scope = { type: 'campus', value: 'campus-a' };
      expect(() =>
        svc.assertWithinScope(scope, { campusId: 'campus-a' }),
      ).not.toThrow();
    });
  });
});

describe('isGrantExpired', () => {
  it('is false with no expiry (permanent grant)', () => {
    expect(isGrantExpired(null)).toBe(false);
    expect(isGrantExpired(undefined)).toBe(false);
  });

  it('is false while the grant is still in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isGrantExpired(future)).toBe(false);
  });

  it('is true once the grant is in the past (a substitute cover ended)', () => {
    const past = new Date(Date.now() - 1_000);
    expect(isGrantExpired(past)).toBe(true);
  });
});

describe('parseScope', () => {
  it('parses a well-formed campus scope', () => {
    expect(
      parseScope({ type: 'campus', value: 'c1', label: 'Main' }),
    ).toEqual({ type: 'campus', value: 'c1', label: 'Main' });
  });

  it('returns null for junk / non-objects / missing type', () => {
    expect(parseScope(null)).toBeNull();
    expect(parseScope('campus')).toBeNull();
    expect(parseScope({ value: 'c1' })).toBeNull();
  });
});
