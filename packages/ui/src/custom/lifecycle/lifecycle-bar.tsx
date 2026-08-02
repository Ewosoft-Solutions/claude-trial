'use client';

/* ============================================================
   LifecycleBar — a record's status view (F8)

   An ordered, accessible lifecycle strip: draft → approved →
   active → retired, admission applied → offered → accepted →
   enrolled, result draft → published → locked → amended, etc.
   The current state is highlighted with a tone AND a non-colour
   cue (a filled ring + `aria-current="step"`); completed steps
   carry a check, upcoming steps a hollow ring — so status never
   reads by colour alone (WCAG). Tones map to the shared status
   tokens via the same scale as StatusBadge.
   ============================================================ */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import type { StateTone } from '@workspace/ui/types/states.types';
import type {
  LifecycleState,
  LifecycleStep,
} from '@workspace/ui/types/patterns.types';

const TONE_RING: Record<StateTone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-info/50 bg-info/15 text-info',
  success: 'border-success/50 bg-success/15 text-success',
  warning: 'border-warning/55 bg-warning/20 text-warning',
  destructive: 'border-destructive/50 bg-destructive/15 text-destructive',
};

const TONE_LABEL: Record<StateTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-foreground',
  success: 'text-foreground',
  warning: 'text-foreground',
  destructive: 'text-foreground',
};

/** Default tone for a step from its lifecycle position. */
function toneForState(state: LifecycleState | undefined): StateTone {
  switch (state) {
    case 'done':
      return 'success';
    case 'current':
      return 'info';
    case 'skipped':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export interface LifecycleBarProps {
  steps: LifecycleStep[];
  /** Accessible name for the list, e.g. "Result lifecycle". */
  label?: string;
  className?: string;
}

export function LifecycleBar({ steps, label, className }: LifecycleBarProps) {
  return (
    <ol
      data-slot="lifecycle"
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-wrap items-start gap-x-1 gap-y-3 @container/lifecycle',
        className,
      )}
    >
      {steps.map((step, index) => {
        const state = step.state ?? 'upcoming';
        const tone = step.tone ?? toneForState(state);
        const isCurrent = state === 'current';
        const isDone = state === 'done';
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex min-w-0 flex-1 items-start gap-2 basis-[9rem]"
          >
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
              <div className="flex w-full items-center">
                <span className="h-px flex-1 bg-transparent" aria-hidden />
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-colors',
                    TONE_RING[tone],
                    isCurrent &&
                      'ring-2 ring-ring/45 ring-offset-1 ring-offset-background',
                    state === 'skipped' && 'opacity-60',
                  )}
                >
                  {isDone ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <span aria-hidden>{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'h-px flex-1',
                    isLast
                      ? 'bg-transparent'
                      : isDone
                        ? 'bg-success/40'
                        : 'bg-border',
                  )}
                  aria-hidden
                />
              </div>
              <span
                className={cn(
                  'text-[12px] leading-tight font-semibold break-words',
                  TONE_LABEL[tone],
                  isCurrent && 'text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="text-[11px] leading-tight text-muted-foreground break-words">
                  {step.description}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
