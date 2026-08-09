'use client';

/* ============================================================
   PasswordStrengthMeter — policy-driven strength bar + checklist

   Renders a live strength bar and a requirements checklist for a
   password being created/reset. Driven by the ACTIVE policy the API
   returns (strictest across the user's schools, or the invited
   school's), so what the user sees is exactly what the server
   enforces. `evaluatePassword` is exported so the surrounding form can
   gate submission on the same rules.

   The special-character class mirrors PasswordService.validatePasswordPolicy
   on the API — keep the two in step.
   ============================================================ */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

/** Client-facing subset of the effective password policy. */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface PasswordCheck {
  key: string;
  label: string;
  ok: boolean;
}

// Mirrors the API's special-character class exactly.
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export interface PasswordEvaluation {
  checks: PasswordCheck[];
  met: number;
  total: number;
  /** Every active requirement satisfied (and a non-empty value). */
  allMet: boolean;
  /** 0 (empty) … 4 (strong), for the strength bar. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Evaluate a candidate password against the active policy. */
export function evaluatePassword(
  policy: PasswordRequirements,
  value: string,
): PasswordEvaluation {
  // Ordered the way a password is actually built: the deliberate
  // character-class choices first (lowercase → uppercase → number → symbol, by
  // increasing effort), then the cumulative length check LAST. Length is
  // satisfied simply by continuing to type, so it belongs at the finish line —
  // not leading the list as a filler to clear before the real choices.
  const checks: PasswordCheck[] = [];
  if (policy.requireLowercase) {
    checks.push({
      key: 'lower',
      label: '1 lowercase letter',
      ok: /[a-z]/.test(value),
    });
  }
  if (policy.requireUppercase) {
    checks.push({
      key: 'upper',
      label: '1 uppercase letter',
      ok: /[A-Z]/.test(value),
    });
  }
  if (policy.requireNumbers) {
    checks.push({ key: 'number', label: '1 number', ok: /\d/.test(value) });
  }
  if (policy.requireSpecialChars) {
    checks.push({
      key: 'special',
      label: '1 special character',
      ok: SPECIAL_CHARS.test(value),
    });
  }
  checks.push({
    key: 'length',
    label: `At least ${policy.minLength} characters`,
    ok: value.length >= policy.minLength,
  });

  const total = checks.length;
  const met = checks.filter((c) => c.ok).length;
  const allMet = met === total && value.length > 0;

  let level: PasswordEvaluation['level'] = 0;
  if (value.length > 0) {
    const ratio = total > 0 ? met / total : 0;
    level = Math.max(1, Math.round(ratio * 4)) as 1 | 2 | 3 | 4;
    // Reserve "strong" for all rules met AND comfortable length.
    if (allMet && value.length >= policy.minLength + 4) level = 4;
    else if (level === 4) level = 3;
  }

  return { checks, met, total, allMet, level };
}

/**
 * Strength reads as ONE smooth ramp from red (weakest) to green (strongest),
 * aligned to how many requirements are met. Intermediate steps are mixed from
 * the design tokens (--destructive → --warning → --success), so the scale stays
 * on-palette in both themes with no off-ramp blue in the middle. `pos` is the
 * strength position in [0,1] (0 = weakest filled step, 1 = every rule met).
 */
function strengthColor(pos: number): string {
  const p = Math.min(1, Math.max(0, pos));
  if (p <= 0.5) {
    const t = Math.round((p / 0.5) * 100);
    return `color-mix(in oklab, var(--warning) ${t}%, var(--destructive))`;
  }
  const t = Math.round(((p - 0.5) / 0.5) * 100);
  return `color-mix(in oklab, var(--success) ${t}%, var(--warning))`;
}

/** Terminology sized to the number of requirements, spanning weak → strong, so
 *  the words track the count (4 rules → Weak · Fair · Good · Strong). */
const STRENGTH_LABELS: Record<number, string[]> = {
  1: ['Set'],
  2: ['Weak', 'Strong'],
  3: ['Weak', 'Fair', 'Strong'],
  4: ['Weak', 'Fair', 'Good', 'Strong'],
  5: ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'],
  6: ['Very weak', 'Weak', 'Low', 'Fair', 'Good', 'Strong'],
};

function strengthLabel(filled: number, total: number): string {
  const set = STRENGTH_LABELS[total] ?? STRENGTH_LABELS[5]!;
  return set[Math.min(set.length - 1, Math.max(0, filled - 1))] ?? '';
}

export interface PasswordStrengthMeterProps {
  policy: PasswordRequirements;
  value: string;
  className?: string;
  /** Hide the strength bar and show only the checklist. */
  hideBar?: boolean;
}

export function PasswordStrengthMeter({
  policy,
  value,
  className,
  hideBar = false,
}: PasswordStrengthMeterProps) {
  const { checks, met, total } = React.useMemo(
    () => evaluatePassword(policy, value),
    [policy, value],
  );

  const active = value.length > 0;
  // One segment per requirement (aligned to the count); a non-empty value shows
  // at least the weakest step so the ramp reads immediately.
  const filled = active ? Math.min(total, Math.max(met, 1)) : 0;
  const pos = total > 1 ? (filled - 1) / (total - 1) : filled > 0 ? 1 : 0;
  const color = strengthColor(pos);
  const label = active ? strengthLabel(filled, total) : '';

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {!hideBar ? (
        <div className="flex items-center gap-2">
          <div
            className="flex flex-1 gap-1"
            role="progressbar"
            aria-label="Password strength"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={filled}
            aria-valuetext={label || 'Empty'}
          >
            {Array.from({ length: total }, (_, i) => i + 1).map((seg) => (
              <span
                key={seg}
                className="h-1.5 flex-1 rounded-full bg-muted transition-colors"
                style={seg <= filled ? { backgroundColor: color } : undefined}
              />
            ))}
          </div>
          {label ? (
            <span className="text-xs font-semibold" style={{ color }}>
              {label}
            </span>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-1" aria-label="Password requirements">
        {checks.map((check) => (
          <li
            key={check.key}
            className={cn(
              'flex items-center gap-2 text-[calc(13px*var(--font-scale))] transition-colors',
              check.ok ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
                check.ok
                  ? 'border-success bg-success text-success-foreground'
                  : 'border-muted-foreground/40 text-transparent',
              )}
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span>{check.label}</span>
            <span className="sr-only">{check.ok ? '— met' : '— not met'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
