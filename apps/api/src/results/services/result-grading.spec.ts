import { describe, expect, it } from '@jest/globals';

import {
  computeOverall,
  computeSubjectResult,
  recommendPromotion,
  resolveGrade,
  resolveRemark,
  type ComponentLite,
  type EntryLite,
  type GradeScale,
} from './result-grading';

/**
 * The WB4 grading core is pure + snapshot-critical (same inputs → same published
 * bytes → same checksum), so these pin the ADR-04 rules directly: absent ≠ zero,
 * exempt is excluded, structured band remarks, and an explainable promotion
 * recommendation that never leaks into a remark.
 */
const components: ComponentLite[] = [
  { id: 'ca1', key: 'CA1', label: 'CA1', maxScore: 20 },
  { id: 'ca2', key: 'CA2', label: 'CA2', maxScore: 20 },
  { id: 'exam', key: 'EXAM', label: 'Exam', maxScore: 60 },
];

const scale: GradeScale = {
  A: { min: 75, max: 100, points: 4, label: 'Excellent' },
  B: { min: 60, max: 74, points: 3, label: 'Very good' },
  C: { min: 50, max: 59, points: 2, label: 'Credit' },
  F: { min: 0, max: 49, points: 0, label: 'Fail' },
};

function entries(map: Record<string, EntryLite>): Map<string, EntryLite> {
  return new Map(Object.entries(map));
}

describe('computeSubjectResult', () => {
  it('sums present components over their max to a percentage', () => {
    const r = computeSubjectResult(
      components,
      entries({
        ca1: { score: 18, isAbsent: false, isExempt: false },
        ca2: { score: 16, isAbsent: false, isExempt: false },
        exam: { score: 50, isAbsent: false, isExempt: false },
      }),
    );
    expect(r.total).toBe(84);
    expect(r.maxTotal).toBe(100);
    expect(r.percentage).toBe(84);
    expect(r.isAbsent).toBe(false);
    expect(r.hasMissing).toBe(false);
  });

  it('does NOT zero an absent component — it is excluded from total + max', () => {
    const r = computeSubjectResult(
      components,
      entries({
        ca1: { score: 18, isAbsent: false, isExempt: false },
        ca2: { score: 16, isAbsent: false, isExempt: false },
        exam: { score: null, isAbsent: true, isExempt: false },
      }),
    );
    // 34 / 40 present — the absent 60-mark exam is not counted as zero.
    expect(r.total).toBe(34);
    expect(r.maxTotal).toBe(40);
    expect(r.percentage).toBe(85);
  });

  it('marks a fully-absent subject with no percentage (ABS, never 0%)', () => {
    const r = computeSubjectResult(
      components,
      entries({
        ca1: { score: null, isAbsent: true, isExempt: false },
        ca2: { score: null, isAbsent: true, isExempt: false },
        exam: { score: null, isAbsent: true, isExempt: false },
      }),
    );
    expect(r.isAbsent).toBe(true);
    expect(r.percentage).toBeNull();
    expect(r.total).toBeNull();
  });

  it('excludes an exempt subject entirely', () => {
    const r = computeSubjectResult(
      components,
      entries({
        ca1: { score: null, isAbsent: false, isExempt: true },
        ca2: { score: null, isAbsent: false, isExempt: true },
        exam: { score: null, isAbsent: false, isExempt: true },
      }),
    );
    expect(r.isExempt).toBe(true);
    expect(r.percentage).toBeNull();
  });

  it('flags a present-but-unscored component as missing', () => {
    const r = computeSubjectResult(
      components,
      entries({
        ca1: { score: 18, isAbsent: false, isExempt: false },
      }),
    );
    expect(r.hasMissing).toBe(true);
  });
});

describe('resolveGrade / resolveRemark', () => {
  it('maps a percentage into the grade band', () => {
    expect(resolveGrade(scale, 84)).toEqual({
      grade: 'A',
      points: 4,
      label: 'Excellent',
    });
    expect(resolveGrade(scale, 55).grade).toBe('C');
    expect(resolveGrade(scale, null).grade).toBeNull();
  });

  it('maps a percentage to the first matching remark band', () => {
    const rules = [
      { minPercentage: 75, maxPercentage: 100, comment: 'Excellent' },
      { minPercentage: 0, maxPercentage: 74, comment: 'Keep working' },
    ];
    expect(resolveRemark(rules, 90)).toBe('Excellent');
    expect(resolveRemark(rules, 40)).toBe('Keep working');
    expect(resolveRemark(rules, null)).toBeNull();
  });
});

describe('computeOverall', () => {
  it('averages across graded subjects only (absent/exempt excluded)', () => {
    const overall = computeOverall([
      { total: 84, maxTotal: 100 },
      { total: 60, maxTotal: 100 },
      { total: null, maxTotal: null }, // absent — excluded
    ]);
    expect(overall.overallTotal).toBe(144);
    expect(overall.overallMax).toBe(200);
    expect(overall.average).toBe(72);
  });
});

describe('recommendPromotion', () => {
  const subjects = [
    {
      subjectOfferingId: 'eng',
      subjectLabel: 'English',
      percentage: 70,
      isAbsent: false,
      isExempt: false,
    },
    {
      subjectOfferingId: 'mth',
      subjectLabel: 'Maths',
      percentage: 30,
      isAbsent: false,
      isExempt: false,
    },
  ];

  it('promotes when failures are within the limit', () => {
    const r = recommendPromotion(
      { passMark: 40, maxFailedSubjects: 2 },
      subjects,
    );
    expect(r.recommendation).toBe('promote');
  });

  it('repeats when a core subject is failed', () => {
    const r = recommendPromotion(
      { passMark: 40, maxFailedSubjects: 3, coreSubjectOfferingIds: ['mth'] },
      subjects,
    );
    expect(r.recommendation).toBe('repeat');
    expect(r.reason).toContain('Maths');
  });

  it('repeats when too many subjects are failed', () => {
    const r = recommendPromotion(
      { passMark: 40, maxFailedSubjects: 0 },
      subjects,
    );
    expect(r.recommendation).toBe('repeat');
  });

  it('flags review when a subject is incomplete/absent', () => {
    const r = recommendPromotion({ passMark: 40, maxFailedSubjects: 3 }, [
      {
        subjectOfferingId: 'eng',
        subjectLabel: 'English',
        percentage: 70,
        isAbsent: false,
        isExempt: false,
      },
      {
        subjectOfferingId: 'mth',
        subjectLabel: 'Maths',
        percentage: null,
        isAbsent: true,
        isExempt: false,
      },
    ]);
    expect(r.recommendation).toBe('review');
  });
});
