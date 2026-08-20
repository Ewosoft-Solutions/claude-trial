'use client';

/* ============================================================
   MobileNavProvider — which navigation surface phones get

   Two surfaces exist below md: the bottom tab bar + drawer
   (MobileNav, the default) and the pinned collapsed rail
   (MobileRail). The choice is a per-browser preference, so it is
   seeded on the SERVER from a cookie and shared through context —
   the shell reads it to decide what to render, and Account →
   Appearance reads and writes the same value, so flipping it there
   takes effect immediately rather than on the next refresh.
   ============================================================ */

import * as React from 'react';

import { writeMobileNavPreference } from '@/lib/sidebar-preference';

interface MobileNavMode {
  /** The collapsed rail is pinned; the bottom tab bar is not rendered. */
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
}

const MobileNavModeContext = React.createContext<MobileNavMode>({
  pinned: false,
  setPinned: () => {},
});

export function MobileNavProvider({
  defaultPinned = false,
  children,
}: {
  /** Seed from the cookie the server read — no first-paint flash. */
  defaultPinned?: boolean;
  children: React.ReactNode;
}) {
  const [pinned, setPinnedState] = React.useState(defaultPinned);

  const setPinned = React.useCallback((next: boolean) => {
    setPinnedState(next);
    writeMobileNavPreference(next);
  }, []);

  const value = React.useMemo(
    () => ({ pinned, setPinned }),
    [pinned, setPinned],
  );

  return (
    <MobileNavModeContext.Provider value={value}>
      {children}
    </MobileNavModeContext.Provider>
  );
}

export function useMobileNavMode(): MobileNavMode {
  return React.useContext(MobileNavModeContext);
}
