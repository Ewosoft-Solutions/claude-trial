/* ============================================================
   (app) — the boundary that makes SECTION changes instant

   Every section layout under this group (`finance/`, `students/`,
   `people/`, …) opens with an `await` — a permission check, which calls
   `getSession()`, which is a real round trip to `/auth/me`. A segment's
   own `loading.tsx` cannot cover that: it wraps the segment's CHILDREN,
   and the segment's layout wraps the loading UI in turn. So the only
   boundary that can cover a section layout is one ABOVE it — this file.

   Without it, clicking into a section froze on the network hop with no
   feedback at all, which reads as a click that did not register.

   Deliberately plain: this shows only for the moment a permission check
   takes, and hands over to the section's own, better-shaped skeleton the
   instant the layout resolves. Anything more detailed would just be a
   second shape flashing past.
   ============================================================ */
import { DetailBodySkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <DetailBodySkeleton sections={2} />;
}
