/**
 * WB4-2 · Pure helpers for the spreadsheet score import (parity job 54 —
 * "direct entry + Excel import in ONE flow"). Everything here is
 * side-effect-free so the semantics that matter — absent ≠ zero, a blank cell
 * writes nothing, a header is matched by key OR label — are unit-testable
 * without a database.
 */

/** How a single score cell was read. */
export type CellKind = 'blank' | 'score' | 'absent' | 'exempt' | 'error';

export interface ParsedCell {
  kind: CellKind;
  score: number | null;
  message?: string;
}

const ABSENT_TOKENS = new Set(['abs', 'absent', 'a']);
const EXEMPT_TOKENS = new Set(['exm', 'exempt', 'ex', 'n/a', 'na']);

/**
 * Normalise a header/label for tolerant matching ("First CA " → "firstca").
 * A trailing parenthetical is dropped, because the generated template labels its
 * columns "First CA (max 20)" — the hint is for the human filling the sheet, not
 * part of the component's name.
 */
export function normalizeHeader(value: string): string {
  return value
    .replace(/\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .trim();
}

/**
 * Read one score cell against its component max.
 *
 *   ""            → blank  (writes nothing — an untouched cell is not a zero)
 *   "ABS"/"A"     → absent (stores no score; absent ≠ zero, ADR-04)
 *   "EXM"/"N/A"   → exempt (removed from the subject total entirely)
 *   "17" / "17.5" → score
 *   anything else → error (reported with the row, never silently dropped)
 */
export function parseScoreCell(raw: string, maxScore: number): ParsedCell {
  const text = (raw ?? '').trim();
  if (text === '') return { kind: 'blank', score: null };

  const token = text.toLowerCase();
  if (ABSENT_TOKENS.has(token)) return { kind: 'absent', score: null };
  if (EXEMPT_TOKENS.has(token)) return { kind: 'exempt', score: null };

  // A comma is REFUSED rather than stripped. A component score is at most a
  // couple of digits, so a thousands separator buys nothing, while "1,5" (a
  // decimal comma, which is what a sheet saved under many locales emits) would
  // strip to 15 — a silent ten-fold score on an immutable published result.
  if (text.includes(',')) {
    return {
      kind: 'error',
      score: null,
      message: `"${text}" contains a comma — use a full stop for decimals (e.g. 1.5)`,
    };
  }

  // A trailing "%" is harmless: the number in front of it is still the score.
  const numeric = Number(text.replace(/%/g, ''));
  if (!Number.isFinite(numeric)) {
    return {
      kind: 'error',
      score: null,
      message: `"${text}" is not a score (use a number, ABS for absent, or EXM for exempt)`,
    };
  }
  if (numeric < 0) {
    return {
      kind: 'error',
      score: null,
      message: 'A score cannot be negative',
    };
  }
  if (numeric > maxScore) {
    return {
      kind: 'error',
      score: null,
      message: `Score ${numeric} exceeds the max ${maxScore} for this component`,
    };
  }
  return { kind: 'score', score: numeric };
}

/**
 * Map the spreadsheet's header row onto the cycle's components. A column is
 * matched by component KEY or by its display LABEL (both normalised), so both a
 * downloaded template ("First CA") and a hand-made sheet ("CA1") import.
 */
export function mapComponentColumns(
  headers: string[],
  components: { key: string; label: string; maxScore: number }[],
): Map<number, { key: string; label: string; maxScore: number }> {
  const byNormalized = new Map<
    string,
    { key: string; label: string; maxScore: number }
  >();
  for (const c of components) {
    byNormalized.set(normalizeHeader(c.key), c);
    byNormalized.set(normalizeHeader(c.label), c);
  }
  const columns = new Map<
    number,
    { key: string; label: string; maxScore: number }
  >();
  headers.forEach((header, index) => {
    const match = byNormalized.get(normalizeHeader(header));
    if (match && ![...columns.values()].some((c) => c.key === match.key)) {
      columns.set(index, match);
    }
  });
  return columns;
}

/** Locate an identity/subject column by any of its accepted spellings. */
export function findColumn(headers: string[], accepted: string[]): number {
  const wanted = new Set(accepted.map(normalizeHeader));
  return headers.findIndex((h) => wanted.has(normalizeHeader(h)));
}

export const STUDENT_NUMBER_HEADERS = [
  'student number',
  'studentnumber',
  'student no',
  'admission number',
  'admission no',
  'reg number',
  'reg no',
];
export const STUDENT_NAME_HEADERS = ['student name', 'student', 'name'];
export const SUBJECT_HEADERS = ['subject', 'subject label', 'offering'];

/** Compare a person/subject label tolerantly (case + spacing insensitive). */
export function labelsMatch(a: string, b: string): boolean {
  return normalizeHeader(a) === normalizeHeader(b);
}
