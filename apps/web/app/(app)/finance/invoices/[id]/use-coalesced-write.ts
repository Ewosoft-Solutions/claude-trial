'use client';

/* ============================================================
   Coalesced writes — one request for a burst of changes

   Tapping a quantity stepper four times is one decision, not four. Firing a
   request per tap costs four round trips to reach a number the bursar already
   sees, and they arrive out of order often enough to matter.

   This holds the write until the tapping stops, then sends the latest value
   once. The screen has already moved; only the server is behind, and only
   briefly.
   ============================================================ */

import * as React from 'react';

/** Long enough to swallow a burst of clicks, short enough to feel immediate. */
const QUIET_MS = 350;

export function useCoalescedWrite(delay: number = QUIET_MS) {
  // Keyed by whatever is being written (a line id), so two lines edited at
  // once do not cancel each other.
  const pending = React.useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>(),
  );

  const schedule = React.useCallback(
    (key: string, run: () => void) => {
      const existing = pending.current.get(key);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        pending.current.delete(key);
        run();
      }, delay);
      pending.current.set(key, { timer, run });
    },
    [delay],
  );

  React.useEffect(() => {
    const map = pending.current;
    return () => {
      // Leaving the page must not swallow a change that was already made on
      // screen. Anything still waiting is sent now rather than dropped —
      // the alternative is a quantity that silently reverts on return.
      map.forEach(({ timer, run }) => {
        clearTimeout(timer);
        run();
      });
      map.clear();
    };
  }, []);

  return schedule;
}
