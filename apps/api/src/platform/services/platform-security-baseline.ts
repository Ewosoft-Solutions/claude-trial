/**
 * Platform security baseline — the minimum posture the platform expects of a
 * tenant's `SchoolSecurityPolicy`. A tenant may be *stricter*; drift is when it
 * is *weaker* than the baseline on some field.
 *
 * Defined as code for the first cut (2.2). It is deliberately shaped like a row
 * so it can be promoted to a platform-owned, editable baseline table later
 * without changing the drift logic. Each rule carries a direction so "weaker"
 * is unambiguous:
 *   - min   : tenant value must be >= baseline (e.g. password length)
 *   - max   : tenant value must be <= baseline (e.g. idle timeout — longer is weaker)
 *   - true  : tenant flag must be on
 *   - floor : tenant value must rank >= baseline in an ordered set (e.g. audit level)
 */

export type BaselineDirection = 'min' | 'max' | 'true' | 'floor';

export interface BaselineRule {
  /** Key on SchoolSecurityPolicy. */
  field: string;
  label: string;
  direction: BaselineDirection;
  baseline: number | boolean | string;
  /** For `floor` rules: the ordered set, weakest first. */
  order?: readonly string[];
  /** Why this matters, shown in the UI. */
  rationale: string;
}

const AUDIT_LEVELS = ['basic', 'standard', 'comprehensive'] as const;

export const PLATFORM_SECURITY_BASELINE: readonly BaselineRule[] = [
  {
    field: 'requireMFA',
    label: 'Require MFA',
    direction: 'true',
    baseline: true,
    rationale: 'MFA must be on for all users.',
  },
  {
    field: 'requireMFAForSensitiveOperations',
    label: 'MFA for sensitive operations',
    direction: 'true',
    baseline: true,
    rationale: 'Sensitive operations must re-confirm identity.',
  },
  {
    field: 'passwordMinLength',
    label: 'Password minimum length',
    direction: 'min',
    baseline: 8,
    rationale: 'Passwords shorter than 8 characters are too weak.',
  },
  {
    field: 'sessionTimeout',
    label: 'Idle session timeout (min)',
    direction: 'max',
    baseline: 30,
    rationale: 'Idle sessions must expire within 30 minutes.',
  },
  {
    field: 'loginAttemptLimit',
    label: 'Login attempt limit',
    direction: 'max',
    baseline: 10,
    rationale: 'More than 10 attempts before lockout invites brute force.',
  },
  {
    field: 'auditLevel',
    label: 'Audit level',
    direction: 'floor',
    baseline: 'standard',
    order: AUDIT_LEVELS,
    rationale: 'Audit level must be at least standard.',
  },
];

export interface DriftViolation {
  field: string;
  label: string;
  rationale: string;
  baseline: number | boolean | string;
  actual: number | boolean | string | null;
}

/** One rule against one policy value. Returns a violation or null (compliant). */
function evaluate(
  rule: BaselineRule,
  value: unknown,
): DriftViolation | null {
  const violation = (): DriftViolation => ({
    field: rule.field,
    label: rule.label,
    rationale: rule.rationale,
    baseline: rule.baseline,
    actual: (value ?? null) as DriftViolation['actual'],
  });

  switch (rule.direction) {
    case 'true':
      return value === true ? null : violation();
    case 'min':
      return typeof value === 'number' && value >= (rule.baseline as number)
        ? null
        : violation();
    case 'max':
      return typeof value === 'number' && value <= (rule.baseline as number)
        ? null
        : violation();
    case 'floor': {
      const order = rule.order ?? [];
      const actualRank = order.indexOf(String(value));
      const baseRank = order.indexOf(String(rule.baseline));
      return actualRank >= 0 && actualRank >= baseRank ? null : violation();
    }
    default:
      return null;
  }
}

/** Every way `policy` falls short of the baseline. Empty = compliant. */
export function computeDrift(
  policy: Record<string, unknown> | null | undefined,
): DriftViolation[] {
  if (!policy) {
    // No policy at all is maximum drift — every rule is unmet.
    return PLATFORM_SECURITY_BASELINE.map((rule) => ({
      field: rule.field,
      label: rule.label,
      rationale: rule.rationale,
      baseline: rule.baseline,
      actual: null,
    }));
  }
  return PLATFORM_SECURITY_BASELINE.flatMap((rule) => {
    const v = evaluate(rule, policy[rule.field]);
    return v ? [v] : [];
  });
}
