/* ============================================================
   CountBadge — numeric count / notification indicator

   The one reusable chip for *counts*: nav notification totals,
   rolled-up section counts, tab counts, active-filter counts. It's
   distinct from `StatusBadge` (semantic status labels) and the base
   `Badge` (brand/label chip) — this one carries a number, caps it at
   `max` (e.g. "99+"), and renders nothing at zero.

   Shape is a rounded square (the shared `rounded-badge` token), never
   a circle: `min-w` matches the height, so a single digit reads as a
   square and a two-digit count grows into a tidy rounded rectangle
   instead of stretching into a warped oval.

   Presentational and server-safe (no hooks). The count is consumer-
   supplied; the component fixes only the colour, size, and shape.
   Positioning (e.g. an absolute overlay on a rail icon) and any
   surface-matched ring stay with the caller via `className`.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export type CountBadgeTone = 'info' | 'primary' | 'accent' | 'neutral';
export type CountBadgeSize = 'sm' | 'md';

/**
 * Tone → fill + foreground. `info` is the notification default (the hot
 * accent used on rail/nav counts); `accent` is a soft primary tint; `neutral`
 * is the muted chip used for passive counts (tabs, filters).
 */
const TONE_SURFACE: Record<CountBadgeTone, string> = {
  // Solid-fill tones keep white text in BOTH themes — the tone tokens' own
  // foregrounds go dark on dark, which reads poorly on a count chip.
  info: 'bg-info text-white',
  primary: 'bg-primary text-white',
  // Tinted tones stay tone-coloured; white would be illegible on their fills.
  accent: 'bg-primary/15 text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

/**
 * Size → box + type. `min-w` equals the height so a single digit reads as a
 * square; multi-digit counts grow wider into a rounded rectangle.
 */
const SIZE: Record<CountBadgeSize, string> = {
  sm: 'h-[17px] min-w-[17px] px-1 text-[calc(9px*var(--font-scale))]',
  md: 'h-[18px] min-w-[18px] px-1.5 text-[calc(10px*var(--font-scale))]',
};

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The count. Numbers are capped at `max`; strings render verbatim. */
  count: number | string;
  /** Cap for numeric counts — renders `${max}+` beyond it. Default 99. */
  max?: number;
  /** Render even when the count is 0 (otherwise nothing is rendered). */
  showZero?: boolean;
  /** Fill/foreground tone. Defaults to `info` (the notification accent). */
  tone?: CountBadgeTone;
  /** Box + type scale. Defaults to `md`. */
  size?: CountBadgeSize;
}

export function CountBadge({
  count,
  max = 99,
  showZero = false,
  tone = 'info',
  size = 'md',
  className,
  ...props
}: CountBadgeProps) {
  const numeric = typeof count === 'number' ? count : undefined;
  if (numeric !== undefined && numeric <= 0 && !showZero) return null;
  const display = numeric !== undefined && numeric > max ? `${max}+` : count;

  return (
    <span
      data-slot="count-badge"
      className={cn(
        'inline-flex items-center justify-center rounded-badge font-bold leading-none tabular-nums',
        SIZE[size],
        TONE_SURFACE[tone],
        className,
      )}
      {...props}
    >
      {display}
    </span>
  );
}
