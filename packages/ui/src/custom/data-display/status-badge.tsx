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
import type { StateTone } from '@workspace/ui/types/states.types';

/** Tone → tinted background + foreground (mirrors the M5 medallions). */
const TONE_SURFACE: Record<StateTone, string> = {
  neutral: 'bg-accent text-muted-foreground',
  info: 'bg-info/12 text-info',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
};

/** Tone → solid dot colour for the optional leading indicator. */
const TONE_DOT: Record<StateTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone. Defaults to `neutral`. */
  tone?: StateTone;
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
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
