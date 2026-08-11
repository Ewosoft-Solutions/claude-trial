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
   supplied; the component fixes only the colour and shape.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import type { StatusTone } from '@workspace/ui/types/states.types';

/**
 * Tone → matching border + tinted background + foreground. The border and
 * text share the tone colour over a soft translucent fill, e.g. the
 * "Docs needed" / "Interview" / "Accepted" pills in the Aurora design.
 */
const TONE_SURFACE: Record<StatusTone, string> = {
  neutral: 'border border-border bg-muted-foreground/12 text-muted-foreground',
  info: 'border border-info/40 bg-info/12 text-info',
  success: 'border border-success/40 bg-success/12 text-success',
  // Warm-gold "toast" recipe: brighter --warning-wash fill + dark --warning-ink
  // text (in dark both collapse to the bright --warning). Reads warmer and more
  // legible than a flat --warning tint on the near-white canvas.
  warning: 'border border-warning-wash/50 bg-warning-wash/20 text-warning-ink',
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
  children: React.ReactNode;
}

export function StatusBadge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
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
      {children}
    </span>
  );
}
