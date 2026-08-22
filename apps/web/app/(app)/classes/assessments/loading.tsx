'use client';

/* Route loading fallback for /classes/assessments AND everything beneath it.

   A segment's `loading.tsx` covers its children too, so this file was standing
   in for `/classes/assessments/take` as well — drawing the assessments
   list/detail while a TABLE page loaded. Coming from outside the section that
   showed as two different placeholders in one navigation: the destination's
   shape from the click, then this one, then content.

   By the time this renders the URL has committed, so it can name the route
   being opened and draw ITS shape. Same trick as `(app)/loading.tsx`, applied
   one level down. Any segment that has child routes with their own pages wants
   this — see the audit's note. */
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
