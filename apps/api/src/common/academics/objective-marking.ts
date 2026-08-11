/**
 * Objective auto-marking — the one place the platform grades a question paper
 * without a teacher.
 *
 * Shared by assessment taking (class-scoped submissions) and the WB3-4 admission
 * quiz (application-scoped exam interview). Objective styles (mcq / true_false /
 * short_answer) are marked by an exact, case-insensitive, trimmed label match;
 * any non-objective style (essay) parks the whole paper as needs-manual-grading.
 * Pure + dependency-free so both callers get identical behaviour.
 */

export interface MarkablePaperQuestion {
  questionId: string;
  points: number;
  /** Question style; matched against `autoGradableStyles`. */
  style: string;
  /** The answer key for objective styles; null ⇒ never awards points. */
  correctAnswer: string | null;
}

export interface ObjectiveMarkResult {
  autoPoints: number;
  maxPoints: number;
  needsManualGrading: boolean;
}

/**
 * Mark a paper against a set of answers. `autoGradableStyles` is the caller's
 * list of styles the server may mark (e.g. AUTO_GRADABLE_STYLES); any question
 * outside it flips `needsManualGrading` and awards no auto points.
 */
export function markObjective(
  paper: MarkablePaperQuestion[],
  answers: Array<{ questionId: string; answer: string }>,
  autoGradableStyles: readonly string[],
): ObjectiveMarkResult {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.answer]));
  let autoPoints = 0;
  let maxPoints = 0;
  let needsManualGrading = false;

  for (const question of paper) {
    maxPoints += question.points;
    if (!autoGradableStyles.includes(question.style)) {
      needsManualGrading = true;
      continue;
    }
    const given = byQuestion.get(question.questionId);
    if (!given || !question.correctAnswer) continue;
    if (
      given.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
    ) {
      autoPoints += question.points;
    }
  }

  return { autoPoints, maxPoints, needsManualGrading };
}
