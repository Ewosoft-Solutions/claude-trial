import { describe, expect, it } from '@jest/globals';

import {
  sortTranscriptTerms,
  summariseTranscript,
  type TranscriptTerm,
} from './result-transcript';
import { toTranscriptSubjects } from './result-transcript.service';

/**
 * WB4-4 · a transcript must not invent numbers and must not turn a missing term
 * into a zero. These pin both, plus the chronological ordering a reader expects.
 */
function term(over: Partial<TranscriptTerm> = {}): TranscriptTerm {
  return {
    cycleId: 'c1',
    cycleName: 'First Term Results',
    academicYearId: 'y1',
    academicYearName: '2025/2026',
    termId: 't1',
    termName: 'First Term',
    publicationId: 'p1',
    version: 1,
    checksum: 'abc123',
    publishedAt: '2026-01-10',
    average: 70,
    overallGrade: 'B',
    position: null,
    promotionRecommendation: 'promote',
    sectionLabel: 'JSS1 A',
    reportCardDocumentId: null,
    subjects: [],
    ...over,
  };
}

describe('summariseTranscript', () => {
  it('averages every graded subject percentage across terms (subject-weighted)', () => {
    const summary = summariseTranscript([
      term({
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 80,
            letterGrade: 'A',
            total: 80,
            maxTotal: 100,
          },
          {
            subjectLabel: 'English',
            percentage: 60,
            letterGrade: 'B',
            total: 60,
            maxTotal: 100,
          },
        ],
      }),
      term({
        termId: 't2',
        termName: 'Second Term',
        publicationId: 'p2',
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 90,
            letterGrade: 'A',
            total: 90,
            maxTotal: 100,
          },
          {
            subjectLabel: 'English',
            percentage: 70,
            letterGrade: 'B',
            total: 70,
            maxTotal: 100,
          },
        ],
      }),
    ]);
    expect(summary.cumulativeAverage).toBe(75);
    expect(summary.gradedSubjectCount).toBe(4);
    expect(summary.termCount).toBe(2);
  });

  it('EXCLUDES an absent/exempt subject rather than counting it as zero', () => {
    const summary = summariseTranscript([
      term({
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 80,
            letterGrade: 'A',
            total: 80,
            maxTotal: 100,
          },
          // absent: no percentage at all
          {
            subjectLabel: 'French',
            percentage: null,
            letterGrade: null,
            total: null,
            maxTotal: null,
          },
        ],
      }),
    ]);
    // 80 alone — a zero for French would have dragged this to 40.
    expect(summary.cumulativeAverage).toBe(80);
    expect(summary.gradedSubjectCount).toBe(1);
    expect(summary.subjects.map((s) => s.subjectLabel)).toEqual(['Maths']);
  });

  it('summarises each subject across the terms it appears in', () => {
    const summary = summariseTranscript([
      term({
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 55,
            letterGrade: 'C',
            total: 55,
            maxTotal: 100,
          },
        ],
      }),
      term({
        termId: 't2',
        termName: 'Second Term',
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 95,
            letterGrade: 'A',
            total: 95,
            maxTotal: 100,
          },
        ],
      }),
    ]);
    const maths = summary.subjects[0]!;
    expect(maths).toEqual({
      subjectLabel: 'Maths',
      terms: 2,
      average: 75,
      best: 95,
      worst: 55,
    });
  });

  it('reports a per-year average across multiple years', () => {
    const summary = summariseTranscript([
      term({
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 50,
            letterGrade: 'C',
            total: 50,
            maxTotal: 100,
          },
        ],
      }),
      term({
        academicYearId: 'y2',
        academicYearName: '2026/2027',
        subjects: [
          {
            subjectLabel: 'Maths',
            percentage: 90,
            letterGrade: 'A',
            total: 90,
            maxTotal: 100,
          },
        ],
      }),
    ]);
    expect(summary.years).toEqual([
      {
        academicYearId: 'y1',
        academicYearName: '2025/2026',
        terms: 1,
        average: 50,
      },
      {
        academicYearId: 'y2',
        academicYearName: '2026/2027',
        terms: 1,
        average: 90,
      },
    ]);
  });

  it('is empty-safe (a student with no published results)', () => {
    expect(summariseTranscript([])).toEqual({
      cumulativeAverage: null,
      gradedSubjectCount: 0,
      termCount: 0,
      subjects: [],
      years: [],
    });
  });
});

describe('sortTranscriptTerms', () => {
  it('orders by year, then term, then publish date', () => {
    const ordered = sortTranscriptTerms([
      term({ academicYearName: '2026/2027', termName: 'First Term' }),
      term({ academicYearName: '2025/2026', termName: 'Second Term' }),
      term({ academicYearName: '2025/2026', termName: 'First Term' }),
    ]);
    expect(ordered.map((t) => `${t.academicYearName}/${t.termName}`)).toEqual([
      '2025/2026/First Term',
      '2025/2026/Second Term',
      '2026/2027/First Term',
    ]);
  });
});

describe('toTranscriptSubjects', () => {
  it('reads the stored snapshot JSON defensively', () => {
    expect(
      toTranscriptSubjects([
        {
          subjectLabel: 'Maths',
          percentage: '72.5',
          letterGrade: 'B',
          total: '58',
          maxTotal: '80',
        },
      ]),
    ).toEqual([
      {
        subjectLabel: 'Maths',
        percentage: 72.5,
        letterGrade: 'B',
        total: 58,
        maxTotal: 80,
      },
    ]);
  });

  it('survives a missing or malformed snapshot without throwing', () => {
    expect(toTranscriptSubjects(null)).toEqual([]);
    expect(toTranscriptSubjects('not an array')).toEqual([]);
    expect(toTranscriptSubjects([{}])).toEqual([
      {
        subjectLabel: '—',
        percentage: null,
        letterGrade: null,
        total: null,
        maxTotal: null,
      },
    ]);
  });
});
