/* ============================================================
   /hr — section landing

   The HR rail destination opens payroll (the one Step 8 surface
   wired to real data) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function HrPage() {
  redirect('/hr/payroll');
}
