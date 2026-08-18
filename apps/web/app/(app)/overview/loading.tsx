/* Route loading fallback — the skeleton shown on a hard load/refresh while
   the server streams. Shaped to the SIGNED-IN PERSONA's dashboard rather than
   a generic four-tile guess, because /overview renders a different dashboard
   per persona: an owner has six tiles and two aside cards where a parent has
   three and one, so one generic shape mis-describes every persona but one and
   the layout jumps when the real content lands.

   `getSession` is React-`cache()`-wrapped and the (app) layout already awaits
   it in this same render pass, so reading it here is a cache hit, not a second
   round-trip. If it is somehow unavailable, fall back to the generic shape —
   a fallback must never be the thing that fails.

   NOTE this only covers the hard-load path. On a CLIENT navigation the route
   fallback never runs (the page is already mounted, only SWR is fetching), so
   each dashboard renders the same shape from its own `loading` branch. Both
   read DASHBOARD_SHAPES so they cannot drift. See dashboard-shape.ts. */
import { DashboardPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

import { getSession } from '@/lib/session';
import { DASHBOARD_SHAPES, dashboardKindFor } from './dashboard-shape';

export default async function Loading() {
  const session = await getSession().catch(() => null);
  const shape = session
    ? DASHBOARD_SHAPES[dashboardKindFor(session.scope, session.clearanceLevel)]
    : undefined;

  return <DashboardPageSkeleton {...shape} />;
}
