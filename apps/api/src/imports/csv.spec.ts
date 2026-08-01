import { describe, it, expect } from '@jest/globals';
import { parseCsv, rowToObject } from './csv';

describe('parseCsv (F2)', () => {
  it('parses headers + rows', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('handles quoted fields with commas, quotes and newlines', () => {
    const csv = 'name,note\n"Okafor, Ada","she said ""hi""\nline2"\n';
    const { rows } = parseCsv(csv);
    expect(rows[0][0]).toBe('Okafor, Ada');
    expect(rows[0][1]).toBe('she said "hi"\nline2');
  });

  it('handles CRLF line endings and a missing trailing newline', () => {
    const { headers, rows } = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('zips a row into an object by header', () => {
    expect(rowToObject(['a', 'b'], ['1', '2'])).toEqual({ a: '1', b: '2' });
    // missing cell → empty string, not undefined
    expect(rowToObject(['a', 'b'], ['1'])).toEqual({ a: '1', b: '' });
  });
});
