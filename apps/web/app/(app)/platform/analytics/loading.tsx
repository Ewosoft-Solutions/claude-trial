'use client';

/* Route loading fallback for /platform/analytics AND everything beneath it.

   A segment's `loading.tsx` covers its child routes too — here, its `/assistant` child is a detail page, not a report —
   so left as a fixed shape it stands in for pages it looks nothing like, and
   a reader coming from outside the section sees two different placeholders in
   one navigation.

   By the time this renders the URL has committed, so it can name the route
   being opened and draw ITS shape from the registry. Same as
   `(app)/loading.tsx`, one level down. */
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
