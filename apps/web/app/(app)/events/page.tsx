/* ============================================================
   /events — section landing

   The Events rail destination opens the upcoming-events view (the
   primary view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function EventsPage() {
  redirect('/events/upcoming');
}
