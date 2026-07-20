/* ============================================================
   /reports — section landing

   The Reports rail destination has no standalone landing screen; it
   opens the academic report (its primary view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function ReportsPage() {
  redirect('/reports/academic');
}
