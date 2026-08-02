import { describe, it, expect } from '@jest/globals';
import { normalizeName } from './curriculum.util';

describe('normalizeName', () => {
  it('unifies "&" and "and" so dirty-catalog duplicates collapse (C080)', () => {
    expect(normalizeName('Cultural & Creative Arts')).toBe(
      'cultural and creative arts',
    );
    expect(normalizeName('Cultural And Creative Arts')).toBe(
      'cultural and creative arts',
    );
    expect(normalizeName('cultural  &  creative   arts')).toBe(
      'cultural and creative arts',
    );
  });

  it('strips punctuation and casing', () => {
    expect(normalizeName('  Math/Science! ')).toBe('math science');
  });

  it('handles empty input', () => {
    expect(normalizeName('')).toBe('');
  });
});
