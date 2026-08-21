'use client';

/* ============================================================
   Profile navigation — making a tab click land immediately

   THE PROBLEM, precisely. The App Router does not commit a navigation
   until the new route's RSC payload arrives (measured here: ~520ms warm,
   ~3s on a cold dev route). Until then the URL is unchanged and the old
   tab's content is still on screen.

   A `loading.tsx` cannot rescue this, and it is worth writing down why,
   because the boundary IS there and looks like it should work. React
   wraps navigation in a transition, and during a transition, content
   that suspends inside a Suspense boundary which has ALREADY been
   revealed does not re-show that boundary's fallback — React keeps the
   previous UI on screen on purpose, to avoid flashing a skeleton over
   content the reader is already reading. The profile's boundary was
   revealed the moment the profile first loaded, so every tab change
   afterwards is exactly that case.

   So the loading state has to come from us, on click, rather than from
   the router, on commit:

     · the strip moves the selection immediately (ProfileTabs), and
     · the body swaps to a skeleton immediately (ProfileBody).

   The pathname stays the authority throughout. When the route commits,
   the pending tab is cleared and the real content takes over; if the
   navigation fails, or the reader hits Back, or it simply takes longer
   than any human would wait, the pending state is dropped and whatever
   the router actually has is shown.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FolderTabLinks } from '@workspace/ui/custom/detail/folder-tab-shape';

import { ProfileTabSkeleton } from './profile-tab-skeleton';

import {
  personTabHref,
  tabLabel,
  type DetailTab,
} from '../person-detail.types';

/**
 * How long to keep showing a skeleton for a tab that never arrives. A
 * navigation this slow has failed in every way the reader cares about, and
 * a permanent skeleton is a worse lie than stale content.
 */
const PENDING_TIMEOUT_MS = 10_000;

/** Which tab a profile pathname is showing. */
function tabFromPathname(pathname: string, tabs: DetailTab[]): DetailTab {
  const segment = pathname.split('/').filter(Boolean).slice(2)[0];
  return segment && (tabs as string[]).includes(segment)
    ? (segment as DetailTab)
    : 'overview';
}

interface ProfileNavValue {
  tabs: DetailTab[];
  personId: string;
  /** The tab actually on screen, per the URL. */
  actual: DetailTab;
  /** The tab the reader just asked for, before the router caught up. */
  pending: DetailTab | null;
  request: (tab: DetailTab) => void;
}

const Ctx = React.createContext<ProfileNavValue | null>(null);

function useProfileNav() {
  const value = React.useContext(Ctx);
  if (!value) throw new Error('ProfileNav components need ProfileNavProvider');
  return value;
}

export function ProfileNavProvider({
  personId,
  tabs,
  children,
}: {
  personId: string;
  tabs: DetailTab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const actual = tabFromPathname(pathname, tabs);
  const [requested, setRequested] = React.useState<DetailTab | null>(null);

  // The route committed (or went somewhere else entirely) — hand authority
  // back to the URL.
  React.useEffect(() => {
    setRequested(null);
  }, [pathname]);

  // Never strand a skeleton on a navigation that silently failed.
  React.useEffect(() => {
    if (requested === null) return;
    const t = setTimeout(() => setRequested(null), PENDING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [requested]);

  const value = React.useMemo<ProfileNavValue>(
    () => ({
      tabs,
      personId,
      actual,
      pending: requested !== null && requested !== actual ? requested : null,
      request: setRequested,
    }),
    [tabs, personId, actual, requested],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The tab strip. Moves on click, not on commit. */
export function ProfileTabs() {
  const { tabs, personId, actual, pending, request } = useProfileNav();
  return (
    <FolderTabLinks
      tabs={tabs}
      activeTab={pending ?? actual}
      href={(t) => personTabHref(personId, t)}
      label={tabLabel}
      as={Link}
      ariaLabel="Profile sections"
      // The selection moving is a sighted-only cue without this.
      aria-busy={pending !== null || undefined}
      onTabClick={request}
    />
  );
}

/**
 * The tab body. Shows the incoming tab's skeleton the moment a different tab
 * is asked for, so the strip and the content never disagree about which tab
 * the reader is on.
 */
export function ProfileBody({ children }: { children: React.ReactNode }) {
  const { pending } = useProfileNav();
  // The SAME component this segment's `loading.tsx` renders, for the same
  // tab — so when the router commits and the boundary takes over, nothing
  // about the placeholder changes.
  if (pending !== null) return <ProfileTabSkeleton tab={pending} />;
  return <>{children}</>;
}
