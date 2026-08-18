/* ============================================================
   /students/gradebook — section landing

   Opens the single live standing view. (The former Report cards page was
   merged into it; official report cards are published artifacts under
   /academics/results.)
   ============================================================ */

import { redirect } from 'next/navigation';

export default function StudentGradebookPage() {
  redirect('/students/gradebook/standing');
}
