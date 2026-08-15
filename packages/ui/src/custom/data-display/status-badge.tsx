/* ============================================================
   StatusBadge — tone-driven status pill

   A compact, rounded status indicator (e.g. Active · Suspended ·
   Paid · Owing) for use inside tables, list rows and detail panes.
   The base `Badge` primitive only carries the brand/secondary/
   destructive/outline variants; this adds the semantic status tones
   (success / warning / info / neutral / destructive) mapped onto the
   M2 status tokens — the same mapping the M5 state components use, so
   tones read consistently across the product.

   Presentational and server-safe (no hooks). Copy is consumer-
   supplied; the component fixes the colour, shape, and — for a raw
   status STRING — the display casing: DB values are lowercase (e.g.
   `published`, `on_loan`), so a plain-string child is normalised for
   display (separators → spaces, first letter capitalised) → "Published",
   "On loan". Idempotent for already-capitalised labels; only single
   string children are touched (composed children like `{n} assigned`
   pass through). Pass `preserveCase` to opt out.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import type { StatusTone } from '@workspace/ui/types/states.types';

/**
 * Normalise a raw status value for display: collapse `_`/`-` separators to
 * spaces and capitalise the first letter (sentence case, matching the app's
 * `titleCase` convention). `paid` → "Paid", `on_loan` → "On loan". Idempotent
 * for values that are already capitalised.
 */
export function formatStatusLabel(value: string): string {
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Tone → matching border + tinted background + foreground. The border and
 * text share the tone colour over a soft translucent fill, e.g. the
 * "Docs needed" / "Interview" / "Accepted" pills in the Aurora design.
 */
const TONE_SURFACE: Record<StatusTone, string> = {
  // Plain gray: the muted body-text colour on a light --muted fill, so a
  // neutral badge reads as the same gray as the surrounding secondary text.
  neutral: 'border border-border bg-muted text-muted-foreground',
  info: 'border border-info/40 bg-info/12 text-info',
  success: 'border border-success/40 bg-success/12 text-success',
  // Single-hue like every other tone: text + border + dot all derive from the
  // one --warning token (no separate ink/wash), so the three read as ONE colour
  // in light exactly as they already do in dark.
  warning: 'border border-warning/45 bg-warning/15 text-warning',
  destructive:
    'border border-destructive/40 bg-destructive/12 text-destructive',
  blue: 'border border-blue/40 bg-blue/12 text-blue',
  violet: 'border border-violet/40 bg-violet/12 text-violet',
  teal: 'border border-teal/40 bg-teal/12 text-teal',
};

/** Tone → solid dot colour for the optional leading indicator. */
const TONE_DOT: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  blue: 'bg-blue',
  violet: 'bg-violet',
  teal: 'bg-teal',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tone (semantic or accent hue). Defaults to `neutral`. */
  tone?: StatusTone;
  /** Show a leading status dot. */
  dot?: boolean;
  /** Render a plain-string child verbatim instead of normalising its casing. */
  preserveCase?: boolean;
  children: React.ReactNode;
}

export function StatusBadge({
  tone = 'neutral',
  dot = false,
  preserveCase = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  // A raw status VALUE (a single string child) is display-normalised; composed
  // children (arrays / elements, e.g. `{n} assigned`) pass through untouched.
  const content =
    !preserveCase && typeof children === 'string'
      ? formatStatusLabel(children)
      : children;
  return (
    <span
      data-slot="status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge px-2 py-0.5 text-xs font-semibold',
        TONE_SURFACE[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])}
        />
      ) : null}
      {content}
    </span>
  );
}
