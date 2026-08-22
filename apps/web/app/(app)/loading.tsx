'use client';

/* ============================================================
   (app) — the boundary that covers a SECTION LAYOUT's await

   Every section layout under this group opens with a permission check,
   which calls `getSession()`, which is a real round trip to `/auth/me`.
   A segment's own `loading.tsx` cannot cover that: it wraps the
   segment's CHILDREN, and the segment's layout wraps the loading UI in
   turn. So the only boundary that can is one ABOVE it — this file.

   By the time this renders the URL has already committed, so unlike the
   click placeholder in `app-chrome` it can simply read the destination
   from the pathname. It renders the SAME shape, so the sequence
   click → here → the route's own boundary → content never changes
   silhouette; it is one placeholder held across three mechanisms.
   ============================================================ */
import { usePathname } from 'next/navigation';

import { PageChangeSkeleton } from '@workspace/ui/custom/states/page-skeletons';

import {
  hasRouteSkeleton,
  RouteSkeleton,
} from '@/lib/navigation/route-skeletons';

export default function Loading() {
  const pathname = usePathname();
  return hasRouteSkeleton(pathname) ? (
    <RouteSkeleton href={pathname} />
  ) : (
    <PageChangeSkeleton />
  );
}
