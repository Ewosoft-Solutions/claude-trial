import { describe, expect, it } from '@jest/globals';

import {
  renderReportCardHtml,
  renderTranscriptHtml,
  type ArtifactCycleMeta,
  type ArtifactStudent,
  type TranscriptArtifact,
} from './result-artifact.service';
import { summariseTranscript, type TranscriptTerm } from './result-transcript';

/**
 * The artifacts are what a family actually receives, so the rules have to be
 * visible IN THE DOCUMENT: an absent subject reads ABS (never 0), an exempt one
 * reads EXM, the behavioural block appears per domain (WB4-3), and interpolated
 * values are HTML-escaped.
 */
const meta: ArtifactCycleMeta = {
  schoolName: 'Sunrise Academy',
  cycleName: 'First Term Results',
  academicYearName: '2026/2027',
  termName: 'First Term',
  version: 1,
  publishedAt: '2026-12-20',
};

const student: ArtifactStudent = {
  studentNumber: 'STU-2026-0001',
  studentName: 'Ada Okafor',
  sectionLabel: 'JSS1 A',
  subjects: [
    {
      subjectLabel: 'Mathematics',
      components: [
        {
          key: 'CA1',
          label: 'First CA',
          score: 18,
          max: 20,
          isAbsent: false,
          isExempt: false,
        },
        {
          key: 'EXAM',
          label: 'Exam',
          score: 70,
          max: 80,
          isAbsent: false,
          isExempt: false,
        },
      ],
      total: 88,
      maxTotal: 100,
      percentage: 88,
      letterGrade: 'A',
      remark: 'Excellent',
    },
    {
      subjectLabel: 'English',
      components: [
        {
          key: 'CA1',
          label: 'First CA',
          score: null,
          max: 20,
          isAbsent: true,
          isExempt: false,
        },
        {
          key: 'EXAM',
          label: 'Exam',
          score: null,
          max: 80,
          isAbsent: true,
          isExempt: false,
        },
      ],
      total: null,
      maxTotal: null,
      percentage: null,
      letterGrade: null,
      remark: null,
    },
  ],
  average: 88,
  overallGrade: 'A',
  position: null,
  promotionRecommendation: 'promote',
  promotionReason: 'Passed every core subject',
  principalRemark: 'A pleasure to teach',
};

describe('renderReportCardHtml', () => {
  it('shows an absent subject as ABS, never as a zero', () => {
    const html = renderReportCardHtml(meta, student);
    expect(html).toContain('ABS');
    // The absent row must not render a 0 total.
    expect(html).not.toContain('>0 / 0<');
  });

  it('renders the affective + psychomotor block when traits are snapshotted', () => {
    const html = renderReportCardHtml(meta, {
      ...student,
      traits: [
        {
          domain: 'affective',
          key: 'punctuality',
          label: 'Punctuality',
          rating: 5,
          maxRating: 5,
        },
        {
          domain: 'psychomotor',
          key: 'handwriting',
          label: 'Handwriting',
          rating: 4,
          maxRating: 4,
        },
      ],
    });
    expect(html).toContain('Affective traits');
    expect(html).toContain('Psychomotor skills');
    expect(html).toContain('Punctuality');
    expect(html).toContain('5 / 5');
    expect(html).toContain('4 / 4');
  });

  it('omits the behavioural block entirely on a cycle with no rubric', () => {
    const html = renderReportCardHtml(meta, student);
    expect(html).not.toContain('Affective traits');
    expect(html).not.toContain('Psychomotor skills');
  });

  it('escapes interpolated values', () => {
    const html = renderReportCardHtml(meta, {
      ...student,
      studentName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderTranscriptHtml', () => {
  const term: TranscriptTerm = {
    cycleId: 'c1',
    cycleName: 'First Term Results',
    academicYearId: 'y1',
    academicYearName: '2026/2027',
    yearStart: '2026-09-01T00:00:00.000Z',
    termOrder: 1,
    termId: 't1',
    termName: 'First Term',
    publicationId: 'p1',
    version: 2,
    checksum: 'deadbeefcafe1234',
    publishedAt: '2026-12-20',
    average: 88,
    overallGrade: 'A',
    position: 1,
    promotionRecommendation: 'promote',
    sectionLabel: 'JSS1 A',
    reportCardDocumentId: null,
    subjects: [
      {
        subjectLabel: 'Mathematics',
        percentage: 88,
        letterGrade: 'A',
        total: 88,
        maxTotal: 100,
      },
      {
        subjectLabel: 'English',
        percentage: null,
        letterGrade: null,
        total: null,
        maxTotal: null,
      },
    ],
  };

  function artifact(): TranscriptArtifact {
    return {
      student: { studentNumber: 'STU-2026-0001', studentName: 'Ada Okafor' },
      schoolName: 'Sunrise Academy',
      terms: [term],
      summary: summariseTranscript([term]),
      generatedAt: '2027-01-05',
    };
  }

  it('cites the publication version + snapshot checksum for every term', () => {
    const html = renderTranscriptHtml(artifact());
    expect(html).toContain('v2');
    expect(html).toContain('deadbeefcafe');
  });

  it('shows an absent subject as ABS and keeps it out of the average', () => {
    const html = renderTranscriptHtml(artifact());
    expect(html).toContain('ABS');
    // Maths alone → 88, not 44.
    expect(html).toContain('88%');
    expect(html).not.toContain('44%');
  });

  it('carries the subject summary and the reproducibility note', () => {
    const html = renderTranscriptHtml(artifact());
    expect(html).toContain('Subject summary');
    expect(html).toContain('published result snapshots only');
  });
});
