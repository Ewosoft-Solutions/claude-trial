'use client';

/* ============================================================
   ChatTypingIndicator — "assistant is thinking" feedback

   Three softly pulsing dots shown while a reply is pending (before
   the first streamed token arrives). Motion is feedback-only (PRD
   A5) and disabled under prefers-reduced-motion; the `label` prop
   supplies the screen-reader announcement (copy stays with the
   consumer).
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface ChatTypingIndicatorProps {
  /** Screen-reader announcement, e.g. "Assistant is thinking". */
  label?: string;
  className?: string;
}

export function ChatTypingIndicator({
  label,
  className,
}: ChatTypingIndicatorProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
