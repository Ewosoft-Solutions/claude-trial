import { describe, it, expect } from '@jest/globals';
import { maskContactValue, normalizeContact } from './person.masking';

describe('person contact masking (F1)', () => {
  it('masks an email but keeps it recognizable', () => {
    const masked = maskContactValue('email', 'bola.ade@example.com');
    expect(masked).not.toContain('bola.ade');
    expect(masked).toContain('@');
    expect(masked.endsWith('.com')).toBe(true);
    expect(masked.startsWith('b')).toBe(true);
  });

  it('masks a phone keeping only the last two digits', () => {
    const masked = maskContactValue('phone', '+234 801 234 5678');
    expect(masked.endsWith('78')).toBe(true);
    expect(masked).not.toContain('5678'.slice(0, 2)); // '56' not exposed
    expect(/^\*+78$/.test(masked)).toBe(true);
  });

  it('never returns the raw value for short inputs', () => {
    expect(maskContactValue('email', 'a')).toBe('**');
    expect(maskContactValue('phone', '1')).toBe('**');
  });

  it('normalizes email to lowercase and phone to digits/plus only', () => {
    expect(normalizeContact('email', '  Bola.Ade@Example.COM ')).toBe(
      'bola.ade@example.com',
    );
    expect(normalizeContact('phone', '+234 (801) 234-5678')).toBe(
      '+2348012345678',
    );
  });
});
