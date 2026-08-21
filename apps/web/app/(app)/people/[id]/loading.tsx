'use client';

/* Loading fallback for the TAB BODY only.
   The chrome above it is the [id] layout, which this boundary sits inside —
   so the header and tab strip stay painted while the next tab streams.

   Client-side, and deriving the tab from the pathname, so it draws the SAME
   shape `ProfileBody` was already drawing for this tab before the router
   committed. Otherwise the handover between the two is visible as a second,
   differently shaped loader appearing mid-wait. */
import { usePathname } from 'next/navigation';

import {
  ProfileTabSkeleton,
  profileTabFromPathname,
} from './profile-tab-skeleton';

export default function Loading() {
  return <ProfileTabSkeleton tab={profileTabFromPathname(usePathname())} />;
}
