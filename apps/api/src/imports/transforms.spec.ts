import { describe, it, expect } from '@jest/globals';
import { applyTransform } from './transforms';

describe('applyTransform (F2)', () => {
  it('trims / cases', () => {
    expect(applyTransform('trim', null, '  hi  ').value).toBe('hi');
    expect(applyTransform('uppercase', null, 'ng').value).toBe('NG');
    expect(applyTransform('lowercase', null, 'NG').value).toBe('ng');
  });

  it('parses DD/MM/YYYY and YYYY-MM-DD to ISO, flags bad dates', () => {
    expect(applyTransform('date_parse', { format: 'DD/MM/YYYY' }, '05/03/2012').value).toBe(
      '2012-03-05',
    );
    expect(applyTransform('date_parse', {}, '2011-10-10').value).toBe('2011-10-10');
    const bad = applyTransform('date_parse', {}, 'not-a-date');
    expect(bad.value).toBeNull();
    expect(bad.error).toBeDefined();
  });

  it('normalizes numbers and rejects non-numbers', () => {
    expect(applyTransform('number', null, '1,500,000').value).toBe('1500000');
    expect(applyTransform('number', null, 'abc').error).toBeDefined();
  });

  it('constant / split / lookup', () => {
    expect(applyTransform('constant', { value: 'NG' }, 'ignored').value).toBe('NG');
    expect(applyTransform('split', { separator: ' ', index: 1 }, 'Ada Okafor').value).toBe(
      'Okafor',
    );
    expect(
      applyTransform('lookup', { table: { M: 'male', F: 'female' } }, 'F').value,
    ).toBe('female');
    expect(
      applyTransform('lookup', { table: {}, default: 'undisclosed' }, 'x').value,
    ).toBe('undisclosed');
  });
});
