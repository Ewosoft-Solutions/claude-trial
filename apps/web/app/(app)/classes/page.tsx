/* ============================================================
   /classes — section landing

   The Classes rail destination has no standalone landing screen;
   it opens the timetable (the primary teaching view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function ClassesPage() {
  redirect('/classes/timetable');
}
