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
  const checks: PasswordCheck[] = [
    {
      key: 'length',
      label: `At least ${policy.minLength} characters`,
      ok: value.length >= policy.minLength,
    },
  ];
  if (policy.requireUppercase) {
    checks.push({
      key: 'upper',
      label: '1 uppercase letter',
      ok: /[A-Z]/.test(value),
    });
  }
  if (policy.requireLowercase) {
    checks.push({
      key: 'lower',
      label: '1 lowercase letter',
      ok: /[a-z]/.test(value),
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

const LEVEL_META = [
  { label: '', bar: 'bg-transparent', text: 'text-muted-foreground' },
  { label: 'Weak', bar: 'bg-destructive', text: 'text-destructive' },
  { label: 'Fair', bar: 'bg-warning', text: 'text-warning' },
  { label: 'Good', bar: 'bg-info', text: 'text-info' },
  { label: 'Strong', bar: 'bg-success', text: 'text-success' },
] as const;

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
  const { checks, level } = React.useMemo(
    () => evaluatePassword(policy, value),
    [policy, value],
  );
  const meta = LEVEL_META[level];

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {!hideBar ? (
        <div className="flex items-center gap-2">
          <div
            className="flex flex-1 gap-1"
            role="progressbar"
            aria-label="Password strength"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={level}
            aria-valuetext={meta.label || 'Empty'}
          >
            {[1, 2, 3, 4].map((seg) => (
              <span
                key={seg}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  seg <= level ? meta.bar : 'bg-muted',
                )}
              />
            ))}
          </div>
          {meta.label ? (
            <span className={cn('text-xs font-semibold', meta.text)}>
              {meta.label}
            </span>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-1" aria-label="Password requirements">
        {checks.map((check) => (
          <li
            key={check.key}
            className={cn(
              'flex items-center gap-2 text-[13px] transition-colors',
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
