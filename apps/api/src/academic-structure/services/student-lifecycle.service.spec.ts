/**
 * Unit coverage for the WB2-3 student-number allocator: a pure sequence over
 * existing `STU-<year>-NNNN` identifiers (never a parse of an academic label).
 */
import { describe, it, expect } from '@jest/globals';
import { nextStudentNumber } from './student-lifecycle.service';

describe('nextStudentNumber (WB2-3)', () => {
  it('starts at 0001 when no identifiers exist for the year', () => {
    expect(nextStudentNumber([], 2026)).toBe('STU-2026-0001');
  });

  it('returns one past the max suffix in use', () => {
    expect(
      nextStudentNumber(
        ['STU-2026-0001', 'STU-2026-0007', 'STU-2026-0003'],
        2026,
      ),
    ).toBe('STU-2026-0008');
  });

  it('ignores identifiers from other years / other schemes', () => {
    expect(
      nextStudentNumber(['STU-2025-0099', 'ADM-2026-1', 'STU-2026-0002'], 2026),
    ).toBe('STU-2026-0003');
  });

  it('is robust to non-numeric suffixes', () => {
    expect(nextStudentNumber(['STU-2026-A', 'STU-2026-0004'], 2026)).toBe(
      'STU-2026-0005',
    );
  });
});
