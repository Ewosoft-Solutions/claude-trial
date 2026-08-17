import { describe, expect, it } from '@jest/globals';

import {
  findColumn,
  labelsMatch,
  mapComponentColumns,
  normalizeHeader,
  parseScoreCell,
  STUDENT_NUMBER_HEADERS,
  SUBJECT_HEADERS,
} from './result-import';
import { resolveFormat } from './result-import.service';

/**
 * WB4-2 · the import translation layer is pure and safety-critical: a
 * misread cell is a wrong published result. These pin the rules that matter —
 * absent ≠ zero, a blank writes nothing, an unreadable cell ERRORS rather than
 * degrading to 0, and a header matches by component key or label.
 */
const components = [
  { key: 'CA1', label: 'First CA', maxScore: 20 },
  { key: 'CA2', label: 'Second CA', maxScore: 20 },
  { key: 'EXAM', label: 'Exam', maxScore: 60 },
];

describe('parseScoreCell', () => {
  it('reads a plain number within the component max', () => {
    expect(parseScoreCell('17', 20)).toEqual({ kind: 'score', score: 17 });
    expect(parseScoreCell(' 17.5 ', 20)).toEqual({
      kind: 'score',
      score: 17.5,
    });
  });

  it('treats a blank cell as "nothing to write", not a zero', () => {
    expect(parseScoreCell('', 20)).toEqual({ kind: 'blank', score: null });
    expect(parseScoreCell('   ', 20)).toEqual({ kind: 'blank', score: null });
  });

  it('imports absence as absent, never as zero (ADR-04)', () => {
    for (const token of ['ABS', 'abs', 'Absent', 'a']) {
      expect(parseScoreCell(token, 20)).toEqual({
        kind: 'absent',
        score: null,
      });
    }
  });

  it('imports an exemption as exempt', () => {
    for (const token of ['EXM', 'exempt', 'EX', 'N/A']) {
      expect(parseScoreCell(token, 20)).toEqual({
        kind: 'exempt',
        score: null,
      });
    }
  });

  it('errors on unreadable text instead of guessing a score', () => {
    const cell = parseScoreCell('seventeen', 20);
    expect(cell.kind).toBe('error');
    expect(cell.score).toBeNull();
    expect(cell.message).toContain('not a score');
  });

  it('errors when the score exceeds the component max', () => {
    const cell = parseScoreCell('25', 20);
    expect(cell.kind).toBe('error');
    expect(cell.message).toContain('exceeds the max 20');
  });

  it('errors on a negative score', () => {
    expect(parseScoreCell('-3', 20).kind).toBe('error');
  });

  it('tolerates spreadsheet noise around a real number', () => {
    expect(parseScoreCell('85%', 100)).toEqual({ kind: 'score', score: 85 });
    expect(parseScoreCell('1,000', 1000)).toEqual({
      kind: 'score',
      score: 1000,
    });
  });
});

describe('mapComponentColumns', () => {
  it('matches a downloaded template by label (with the max hint stripped off)', () => {
    // These are the exact headers buildTemplate emits — the "(max N)" hint is
    // for the human filling the sheet and must not defeat the match.
    const headers = [
      'Student number',
      'Student name',
      'First CA (max 20)',
      'Exam (max 60)',
    ];
    const columns = mapComponentColumns(headers, components);
    expect(columns.get(2)?.key).toBe('CA1');
    expect(columns.get(3)?.key).toBe('EXAM');
    expect(columns.size).toBe(2);
  });

  it('matches a plain label with no hint too', () => {
    const columns = mapComponentColumns(
      ['Student number', 'First CA', 'Exam'],
      components,
    );
    expect([...columns.values()].map((c) => c.key)).toEqual(['CA1', 'EXAM']);
  });

  it('matches a hand-made sheet by component key, case/space-insensitively', () => {
    const headers = ['Student No', 'ca 1', 'CA_2', 'exam'];
    const columns = mapComponentColumns(headers, components);
    expect([...columns.values()].map((c) => c.key)).toEqual([
      'CA1',
      'CA2',
      'EXAM',
    ]);
  });

  it('ignores unrelated columns and keeps the first of a duplicated component', () => {
    const headers = ['Student number', 'Remark', 'CA1', 'First CA'];
    const columns = mapComponentColumns(headers, components);
    expect(columns.size).toBe(1);
    expect(columns.get(2)?.key).toBe('CA1');
  });
});

describe('findColumn', () => {
  it('finds the identity column under any accepted spelling', () => {
    expect(
      findColumn(['Name', 'Admission No', 'CA1'], STUDENT_NUMBER_HEADERS),
    ).toBe(1);
    expect(findColumn(['Student', 'Subject'], SUBJECT_HEADERS)).toBe(1);
  });

  it('returns -1 when the column is absent', () => {
    expect(findColumn(['CA1', 'CA2'], STUDENT_NUMBER_HEADERS)).toBe(-1);
  });
});

describe('normalizeHeader / labelsMatch', () => {
  it('ignores case, spacing and separators', () => {
    expect(normalizeHeader(' First-CA ')).toBe('firstca');
    expect(labelsMatch('STU-2026-0001', 'stu 2026 0001')).toBe(true);
    expect(labelsMatch('Ada Okafor', 'ada  okafor')).toBe(true);
  });

  it('does not match different values', () => {
    expect(labelsMatch('STU-2026-0001', 'STU-2026-0002')).toBe(false);
  });
});

describe('resolveFormat', () => {
  it('prefers the explicit format', () => {
    expect(resolveFormat('csv', 'scores.xlsx')).toBe('csv');
  });

  it('infers xlsx from the filename', () => {
    expect(resolveFormat(undefined, 'JSS1A scores.XLSX')).toBe('xlsx');
  });

  it('defaults to csv', () => {
    expect(resolveFormat(undefined, undefined)).toBe('csv');
    expect(resolveFormat(undefined, 'scores.csv')).toBe('csv');
  });
});
