import { describe, expect, it } from 'vitest';

import {
  evaluatePassword,
  type PasswordRequirements,
} from './password-strength';

const FULL: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

describe('evaluatePassword', () => {
  it('reports an empty password as level 0 with nothing met', () => {
    const r = evaluatePassword(FULL, '');
    expect(r.level).toBe(0);
    expect(r.allMet).toBe(false);
    expect(r.met).toBe(0);
    expect(r.total).toBe(5);
  });

  it('only lists the requirements the policy actually asks for', () => {
    const r = evaluatePassword(
      { ...FULL, requireSpecialChars: false, requireNumbers: false },
      '',
    );
    expect(r.total).toBe(3); // lower + upper + length (length last)
    expect(r.checks.map((c) => c.key)).toEqual(['lower', 'upper', 'length']);
  });

  it('flags a password that misses the special-char rule', () => {
    const r = evaluatePassword(FULL, 'Abcdef12'); // 8 chars, no special
    expect(r.allMet).toBe(false);
    expect(r.checks.find((c) => c.key === 'special')?.ok).toBe(false);
    expect(r.checks.find((c) => c.key === 'length')?.ok).toBe(true);
  });

  it('marks a fully-compliant, comfortably-long password as strong', () => {
    const r = evaluatePassword(FULL, 'Abcdef12!@#x'); // 12 chars, all classes
    expect(r.allMet).toBe(true);
    expect(r.level).toBe(4);
  });

  it('respects a higher minLength', () => {
    const strict = { ...FULL, minLength: 16 };
    expect(evaluatePassword(strict, 'Abcdef12!@#x').allMet).toBe(false);
    expect(evaluatePassword(strict, 'Abcdef12!@#xyzWQ').allMet).toBe(true);
  });
});
