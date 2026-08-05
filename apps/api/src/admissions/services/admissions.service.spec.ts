/**
 * Unit coverage for the WB3 applicant-name splitter used to build the F1 Person
 * on conversion (last word = surname, with safe fallbacks).
 */
import { describe, it, expect } from '@jest/globals';
import { splitApplicantName } from './admissions.service';

describe('splitApplicantName (WB3)', () => {
  it('takes the last word as the surname', () => {
    expect(splitApplicantName('Ada Ngozi Okoro')).toEqual({
      firstName: 'Ada Ngozi',
      lastName: 'Okoro',
    });
    expect(splitApplicantName('Chidi Obi')).toEqual({
      firstName: 'Chidi',
      lastName: 'Obi',
    });
  });

  it('reuses a single name for both parts (Person requires a surname)', () => {
    expect(splitApplicantName('Ada')).toEqual({
      firstName: 'Ada',
      lastName: 'Ada',
    });
  });

  it('is robust to extra whitespace and empty input', () => {
    expect(splitApplicantName('  Ada   Okoro  ')).toEqual({
      firstName: 'Ada',
      lastName: 'Okoro',
    });
    expect(splitApplicantName('   ')).toEqual({
      firstName: 'Unknown',
      lastName: 'Applicant',
    });
  });
});
