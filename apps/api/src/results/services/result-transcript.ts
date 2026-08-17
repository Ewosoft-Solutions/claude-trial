/**
 * WB4-4 · Pure transcript arithmetic. A transcript is a DERIVED read over
 * published snapshots — it must never introduce a number the snapshots do not
 * already contain, and it must never turn a missing term into a zero. Keeping
 * the maths here (side-effect-free) makes those two properties testable.
 */

/**
 * The machine tag stamped on every transcript artifact this module issues, so
 * "has a transcript been issued?" is answered by provenance rather than by
 * guessing from a human-written document title. Lives here (the dependency-free
 * module) so both the artifact writer and the transcript reader can share it
 * without importing each other.
 */
export const TRANSCRIPT_SOURCE_SYSTEM = 'results.transcript';

export interface TranscriptSubject {
  subjectLabel: string;
  percentage: number | null;
  letterGrade: string | null;
  total: number | null;
  maxTotal: number | null;
}

export interface TranscriptTerm {
  cycleId: string;
  cycleName: string;
  academicYearId: string;
  academicYearName: string;
  /**
   * Chronological sort keys, carried alongside the display names because a
   * school names its years freely ("2025/2026", "Academic Year 2027") and a name
   * does not sort. `yearStart` is the academic year's start date (ISO) and
   * `termOrder` the term's declared sequence.
   */
  yearStart: string | null;
  termOrder: number | null;
  termId: string | null;
  termName: string | null;
  publicationId: string;
  version: number;
  checksum: string;
  publishedAt: string;
  average: number | null;
  overallGrade: string | null;
  position: number | null;
  promotionRecommendation: string | null;
  sectionLabel: string | null;
  reportCardDocumentId: string | null;
  subjects: TranscriptSubject[];
}

export interface SubjectSummary {
  subjectLabel: string;
  /** How many published terms carried a graded result for this subject. */
  terms: number;
  average: number | null;
  best: number | null;
  worst: number | null;
}

export interface YearSummary {
  academicYearId: string;
  academicYearName: string;
  terms: number;
  average: number | null;
}

export interface TranscriptSummary {
  /**
   * The mean of every graded subject percentage across every published term —
   * subject-weighted, so a term with more subjects counts for more, and an
   * absent/exempt subject (percentage null) is EXCLUDED rather than zeroed.
   */
  cumulativeAverage: number | null;
  gradedSubjectCount: number;
  termCount: number;
  subjects: SubjectSummary[];
  years: YearSummary[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Roll published terms up into a cumulative record. */
export function summariseTranscript(
  terms: TranscriptTerm[],
): TranscriptSummary {
  const allPercentages: number[] = [];
  const bySubject = new Map<string, number[]>();
  const byYear = new Map<
    string,
    { name: string; terms: number; percentages: number[] }
  >();

  for (const term of terms) {
    const year = byYear.get(term.academicYearId) ?? {
      name: term.academicYearName,
      terms: 0,
      percentages: [],
    };
    year.terms += 1;

    for (const subject of term.subjects) {
      if (subject.percentage === null) continue; // absent/exempt ≠ zero
      allPercentages.push(subject.percentage);
      year.percentages.push(subject.percentage);
      const list = bySubject.get(subject.subjectLabel) ?? [];
      list.push(subject.percentage);
      bySubject.set(subject.subjectLabel, list);
    }
    byYear.set(term.academicYearId, year);
  }

  const subjects: SubjectSummary[] = [...bySubject.entries()]
    .map(([subjectLabel, values]) => ({
      subjectLabel,
      terms: values.length,
      average: mean(values),
      best: values.length ? Math.max(...values) : null,
      worst: values.length ? Math.min(...values) : null,
    }))
    .sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel));

  const years: YearSummary[] = [...byYear.entries()].map(([id, year]) => ({
    academicYearId: id,
    academicYearName: year.name,
    terms: year.terms,
    average: mean(year.percentages),
  }));

  return {
    cumulativeAverage: mean(allPercentages),
    gradedSubjectCount: allPercentages.length,
    termCount: terms.length,
    subjects,
    years,
  };
}

/**
 * Chronological order for the transcript: academic year by its START DATE, then
 * term by its declared order, then the publish time as the tie-break (a
 * year-long cycle, which has no term order, sorts before that year's terms).
 *
 * Deliberately not by NAME: a school names years and terms freely, so
 * "Academic Year 2027" would sort before "2025/2026" and "Term 10" before
 * "Term 2". The names are for display only. Where a sort key is missing the
 * name is the last-resort fallback, so ordering degrades rather than throws.
 */
export function sortTranscriptTerms(terms: TranscriptTerm[]): TranscriptTerm[] {
  return terms.slice().sort((a, b) => {
    if (a.academicYearId !== b.academicYearId) {
      if (a.yearStart && b.yearStart && a.yearStart !== b.yearStart) {
        return a.yearStart.localeCompare(b.yearStart);
      }
      if (a.academicYearName !== b.academicYearName) {
        return a.academicYearName.localeCompare(b.academicYearName);
      }
    }
    // A year-long cycle (no term) precedes the same year's termed cycles.
    const aOrder = a.termOrder ?? -1;
    const bOrder = b.termOrder ?? -1;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.publishedAt.localeCompare(b.publishedAt);
  });
}
