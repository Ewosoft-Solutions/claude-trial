/**
 * Unit coverage for the shared objective marker used by classroom assessment
 * taking AND the WB3-4 admission quiz.
 */
import { describe, it, expect } from '@jest/globals';
import { markObjective, type MarkablePaperQuestion } from './objective-marking';

const AUTO = ['mcq', 'true_false', 'short_answer'] as const;

const paper: MarkablePaperQuestion[] = [
  { questionId: 'q1', points: 2, style: 'mcq', correctAnswer: 'B' },
  {
    questionId: 'q2',
    points: 3,
    style: 'short_answer',
    correctAnswer: 'Lagos',
  },
  { questionId: 'q3', points: 5, style: 'essay', correctAnswer: null },
];

describe('markObjective', () => {
  it('awards points for exact objective matches and totals the paper', () => {
    const r = markObjective(
      [
        { questionId: 'q1', points: 2, style: 'mcq', correctAnswer: 'B' },
        {
          questionId: 'q2',
          points: 3,
          style: 'short_answer',
          correctAnswer: 'Lagos',
        },
      ],
      [
        { questionId: 'q1', answer: 'B' },
        { questionId: 'q2', answer: 'Lagos' },
      ],
      AUTO,
    );
    expect(r).toEqual({
      autoPoints: 5,
      maxPoints: 5,
      needsManualGrading: false,
    });
  });

  it('matches case-insensitively and trims', () => {
    const r = markObjective(
      [
        {
          questionId: 'q2',
          points: 3,
          style: 'short_answer',
          correctAnswer: 'Lagos',
        },
      ],
      [{ questionId: 'q2', answer: '  lAGoS ' }],
      AUTO,
    );
    expect(r.autoPoints).toBe(3);
  });

  it('flags manual grading for essays but still counts their max points', () => {
    const r = markObjective(
      paper,
      [
        { questionId: 'q1', answer: 'B' },
        { questionId: 'q2', answer: 'Kano' }, // wrong
        { questionId: 'q3', answer: 'A long essay…' },
      ],
      AUTO,
    );
    expect(r.autoPoints).toBe(2); // only q1
    expect(r.maxPoints).toBe(10); // 2 + 3 + 5
    expect(r.needsManualGrading).toBe(true);
  });

  it('awards nothing for missing answers or a null answer key', () => {
    const r = markObjective(
      [
        { questionId: 'q1', points: 2, style: 'mcq', correctAnswer: 'B' },
        { questionId: 'q4', points: 4, style: 'mcq', correctAnswer: null },
      ],
      [{ questionId: 'q4', answer: 'A' }],
      AUTO,
    );
    expect(r.autoPoints).toBe(0);
    expect(r.maxPoints).toBe(6);
    expect(r.needsManualGrading).toBe(false);
  });
});
