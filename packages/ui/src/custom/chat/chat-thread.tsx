'use client';

/* ============================================================
   ChatThread — the scrolling message column

   A `role="log"` scroll container that stays pinned to the newest
   message while replies stream in, but stops auto-scrolling the
   moment the reader scrolls up to review history (resuming once
   they return to the bottom). Renders whatever message nodes the
   consumer supplies — empty/error states included — so no screen
   is ever blank by construction (PRD A6 stays with the consumer).
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

/** How close (px) to the bottom still counts as "pinned". */
const PIN_THRESHOLD = 80;

export interface ChatThreadProps {
  children: React.ReactNode;
  /** Accessible name for the conversation log. */
  'aria-label'?: string;
  className?: string;
}

export function ChatThread({
  children,
  'aria-label': ariaLabel,
  className,
}: ChatThreadProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pinned = React.useRef(true);

  // Runs after every commit: streaming deltas mutate children on each
  // token, and the thread must follow while the reader is at the bottom.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el && pinned.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  const handleScroll = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    pinned.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD;
  }, []);

  return (
    <div
      ref={ref}
      role="log"
      aria-label={ariaLabel}
      aria-live="polite"
      onScroll={handleScroll}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
