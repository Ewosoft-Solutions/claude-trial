/* ============================================================
   Meter — a labelled ratio / progress bar

   A compact horizontal bar for ratios (collection rate, capacity
   used, attendance %). Optional leading label + trailing value, a
   tone-coloured fill, and an accessible `progressbar` role. Pure
   presentational + server-safe; copy and numbers are consumer-
   supplied. Generalises the one-off bars used in the dashboard /
   finance surfaces.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import type { StateTone } from '@workspace/ui/types/states.types';

/** Tone → fill colour. `default` uses the brand primary. */
export type MeterTone = StateTone | 'default';

const TONE_FILL: Record<MeterTone, string> = {
  default: 'bg-primary',
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

export interface MeterProps {
  /** Current value. */
  value: number;
  /** Maximum value the bar represents. Defaults to 100. */
  max?: number;
  /** Leading label (left of the track). */
  label?: React.ReactNode;
  /** Trailing value text (right of the track). Defaults to a percentage. */
  valueLabel?: React.ReactNode;
  /** Fill tone. Defaults to `default` (brand). */
  tone?: MeterTone;
  /** Hide the default percentage when no `valueLabel` is given. */
  hideValue?: boolean;
  className?: string;
}

export function Meter({
  value,
  max = 100,
  label,
  valueLabel,
  tone = 'default',
  hideValue = false,
  className,
}: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const shownValue = valueLabel ?? (hideValue ? null : `${Math.round(pct)}%`);

  return (
    <div data-slot="meter" className={cn('flex flex-col gap-1.5', className)}>
      {label || shownValue !== null ? (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label ? (
            <span className="min-w-0 truncate text-foreground">{label}</span>
          ) : (
            <span />
          )}
          {shownValue !== null ? (
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {shownValue}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', TONE_FILL[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
