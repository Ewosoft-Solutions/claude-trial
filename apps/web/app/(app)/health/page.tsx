/* ============================================================
   /health — section landing

   The Health rail destination opens the records view (the
   primary view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function HealthPage() {
  redirect('/health/records');
}
