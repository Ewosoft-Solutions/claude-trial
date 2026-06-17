'use client';

/* ============================================================
   Loading state — Spinner + LoadingState

   Spinner: a small token-coloured animated indicator. LoadingState:
   a centered, accessible busy surface for when content is being
   fetched and a skeleton is not a good fit (short waits, actions in
   flight, indeterminate work). Announced via `role="status"`.

   For content-shaped placeholders that mirror the eventual layout,
   prefer the skeleton patterns (skeletons.tsx) instead.
   ============================================================ */

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';

export interface SpinnerProps {
  /** Pixel size of the indicator. Defaults to 20. */
  size?: number;
  className?: string;
}

/** A standalone animated spinner. Decorative — label it at the call site. */
export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <Loader2
      aria-hidden
      className={cn('animate-spin text-muted-foreground', className)}
      style={{ width: size, height: size }}
    />
  );
}

export interface LoadingStateProps {
  /**
   * Visible label beneath the spinner. Also used as the accessible
   * name. Optional — omit for a bare spinner (still announced as busy).
   */
  label?: string;
  /** Tighter spacing for in-card / section use. */
  compact?: boolean;
  /** Spinner size in px. */
  spinnerSize?: number;
  className?: string;
}

export function LoadingState({
  label,
  compact = false,
  spinnerSize,
  className,
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'mx-auto flex w-full flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-8' : 'gap-3 py-14',
        className,
      )}
    >
      <Spinner size={spinnerSize ?? (compact ? 18 : 24)} />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
