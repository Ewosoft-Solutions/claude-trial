/**
 * WB4 · Result grading — pure computation (no I/O), unit-tested.
 *
 * Everything the result cycle needs to turn raw component scores into a subject
 * result, a grade, a remark, and a promotion recommendation lives here as pure
 * functions so it is deterministic, snapshot-stable (the same inputs always
 * produce the same published bytes → the same checksum), and testable without a
 * database. ADR-04 rules encoded here:
 *   • an ABSENT learner is never zeroed (absence is excluded from the total/max,
 *     and a fully-absent subject has no percentage — it shows "ABS");
 *   • an EXEMPT component/subject is excluded from the total/max entirely;
 *   • remark rule sets are STRUCTURED bands (min..max → comment), not prose;
 *   • promotion is a separate explainable policy, so its text never leaks into
 *     the subject remark (fixes C124).
 */

export interface GradeScaleEntry {
  min: number;
  max: number;
  points?: number;
  label?: string;
}
/** The GradingSystem.gradeScale JSON shape: { "A": {min,max,points,label}, … }. */
export type GradeScale = Record<string, GradeScaleEntry>;

export interface ResolvedGrade {
  grade: string | null;
  points: number | null;
  label: string | null;
}

/** Map a percentage to a grade band. Returns nulls when no band matches. */
export function resolveGrade(
  scale: GradeScale | null | undefined,
  percentage: number | null,
): ResolvedGrade {
  if (!scale || percentage === null || Number.isNaN(percentage)) {
    return { grade: null, points: null, label: null };
  }
  for (const [grade, band] of Object.entries(scale)) {
    if (!band) continue;
    if (percentage >= band.min && percentage <= band.max) {
      return {
        grade,
        points: band.points ?? null,
        label: band.label ?? null,
      };
    }
  }
  return { grade: null, points: null, label: null };
}

export interface RemarkRuleLite {
  minPercentage: number;
  maxPercentage: number;
  comment: string;
}

/** Map a percentage to the first matching band's comment. */
export function resolveRemark(
  rules: RemarkRuleLite[] | null | undefined,
  percentage: number | null,
): string | null {
  if (!rules?.length || percentage === null || Number.isNaN(percentage)) {
    return null;
  }
  for (const rule of rules) {
    if (percentage >= rule.minPercentage && percentage <= rule.maxPercentage) {
      return rule.comment;
    }
  }
  return null;
}

export interface ComponentLite {
  id: string;
  key: string;
  label: string;
  maxScore: number;
}
export interface EntryLite {
  score: number | null;
  isAbsent: boolean;
  isExempt: boolean;
}
export interface ComponentResult {
  key: string;
  label: string;
  score: number | null;
  max: number;
  isAbsent: boolean;
  isExempt: boolean;
}
export interface SubjectComputation {
  components: ComponentResult[];
  total: number | null;
  maxTotal: number | null;
  percentage: number | null;
  /** No score entered anywhere and at least one component marked absent. */
  isAbsent: boolean;
  /** Every component exempt. */
  isExempt: boolean;
  /** A present component has no score yet (entry incomplete). */
  hasMissing: boolean;
}

/** Round to two decimals without floating-point drift in the snapshot. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute one subject's result from its components + the student's entries.
 * `entriesByComponentId` maps a component id to the student's entry (absent
 * without a score is NOT zeroed — the component is excluded from total + max).
 */
export function computeSubjectResult(
  components: ComponentLite[],
  entriesByComponentId: Map<string, EntryLite>,
): SubjectComputation {
  let total = 0;
  let maxTotal = 0;
  let hasScore = false;
  let hasAbsent = false;
  let hasMissing = false;
  let exemptCount = 0;

  const componentResults: ComponentResult[] = components.map((c) => {
    const e = entriesByComponentId.get(c.id);
    const isExempt = e?.isExempt ?? false;
    const isAbsent = !isExempt && (e?.isAbsent ?? false);
    const score = isExempt || isAbsent ? null : (e?.score ?? null);

    if (isExempt) {
      exemptCount += 1;
    } else if (isAbsent) {
      hasAbsent = true;
    } else {
      // present component contributes its max; a null score is "missing"
      maxTotal += c.maxScore;
      if (score === null) {
        hasMissing = true;
      } else {
        total += score;
        hasScore = true;
      }
    }
    return {
      key: c.key,
      label: c.label,
      score,
      max: c.maxScore,
      isAbsent,
      isExempt,
    };
  });

  const isExempt = components.length > 0 && exemptCount === components.length;
  const isAbsent = !isExempt && !hasScore && hasAbsent;
  const percentage =
    isExempt || isAbsent || maxTotal <= 0
      ? null
      : round2((total / maxTotal) * 100);

  return {
    components: componentResults,
    total: isExempt || isAbsent ? null : round2(total),
    maxTotal: isExempt || isAbsent ? null : round2(maxTotal),
    percentage,
    isAbsent,
    isExempt,
    hasMissing,
  };
}

export interface PromotionPolicy {
  /** A subject is a pass at or above this percentage. */
  passMark: number;
  /** More than this many failed subjects → not promoted. */
  maxFailedSubjects: number;
  /** Failing any of these subject offerings → not promoted. */
  coreSubjectOfferingIds?: string[];
}

export interface PromotionSubject {
  subjectOfferingId: string;
  subjectLabel: string;
  percentage: number | null;
  isAbsent: boolean;
  isExempt: boolean;
}

export type PromotionRecommendation = 'promote' | 'repeat' | 'review';

export interface PromotionResult {
  recommendation: PromotionRecommendation;
  reason: string;
}

/**
 * An explainable promotion recommendation from a policy — the WB4 input the
 * registrar consults in the WB2-4 promotion workbench. Never mutates a grade or
 * leaks into a remark; the reason is human-readable.
 */
export function recommendPromotion(
  policy: PromotionPolicy | null | undefined,
  subjects: PromotionSubject[],
): PromotionResult {
  if (!policy) {
    return {
      recommendation: 'review',
      reason: 'No promotion policy configured',
    };
  }
  const graded = subjects.filter((s) => !s.isExempt);
  const incomplete = graded.filter((s) => s.isAbsent || s.percentage === null);
  const failed = graded.filter(
    (s) => s.percentage !== null && s.percentage < policy.passMark,
  );
  const core = new Set(policy.coreSubjectOfferingIds ?? []);
  const failedCore = failed.filter((s) => core.has(s.subjectOfferingId));

  if (failedCore.length > 0) {
    return {
      recommendation: 'repeat',
      reason: `Failed core subject(s): ${failedCore
        .map((s) => s.subjectLabel)
        .join(', ')}`,
    };
  }
  if (failed.length > policy.maxFailedSubjects) {
    return {
      recommendation: 'repeat',
      reason: `Failed ${failed.length} subjects (limit ${policy.maxFailedSubjects})`,
    };
  }
  if (incomplete.length > 0) {
    return {
      recommendation: 'review',
      reason: `Incomplete/absent result in ${incomplete.length} subject(s)`,
    };
  }
  return {
    recommendation: 'promote',
    reason:
      failed.length === 0
        ? 'Passed all subjects'
        : `Failed ${failed.length} subject(s), within the ${policy.maxFailedSubjects} limit`,
  };
}

/** The overall average across graded (non-absent, non-exempt) subjects. */
export function computeOverall(
  subjects: { total: number | null; maxTotal: number | null }[],
): { overallTotal: number; overallMax: number; average: number | null } {
  let overallTotal = 0;
  let overallMax = 0;
  for (const s of subjects) {
    if (s.total !== null && s.maxTotal !== null && s.maxTotal > 0) {
      overallTotal += s.total;
      overallMax += s.maxTotal;
    }
  }
  const average =
    overallMax > 0 ? round2((overallTotal / overallMax) * 100) : null;
  return {
    overallTotal: round2(overallTotal),
    overallMax: round2(overallMax),
    average,
  };
}
