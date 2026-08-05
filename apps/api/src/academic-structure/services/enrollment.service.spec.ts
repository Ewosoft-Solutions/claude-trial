/**
 * Unit coverage for the WB2-2 schoolType → enrollment-model fallback: the
 * resolver derives 'class' (K-12) vs 'course' (tertiary) when a tenant has no
 * AcademicProfile.
 */
import { describe, it, expect } from '@jest/globals';
import { enrollmentModelForSchoolType } from './enrollment.service';

describe('enrollmentModelForSchoolType (WB2-2)', () => {
  it('maps tertiary school types to the per-course model', () => {
    expect(enrollmentModelForSchoolType('university')).toBe('course');
    expect(enrollmentModelForSchoolType('college')).toBe('course');
    expect(enrollmentModelForSchoolType('training_institute')).toBe('course');
  });

  it('maps K-12 school types to the class model', () => {
    expect(enrollmentModelForSchoolType('nursery')).toBe('class');
    expect(enrollmentModelForSchoolType('primary')).toBe('class');
    expect(enrollmentModelForSchoolType('secondary')).toBe('class');
  });

  it('defaults unknown / missing school types to the K-12 class model', () => {
    expect(enrollmentModelForSchoolType('organization')).toBe('class');
    expect(enrollmentModelForSchoolType(null)).toBe('class');
    expect(enrollmentModelForSchoolType(undefined)).toBe('class');
  });
});
