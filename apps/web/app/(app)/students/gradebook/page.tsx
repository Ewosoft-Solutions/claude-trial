/* ============================================================
   /students/gradebook — section landing

   The student Gradebook destination opens report cards (its primary
   view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function StudentGradebookPage() {
  redirect('/students/gradebook/report-cards');
}
