/* ============================================================
   /library — section landing

   The Library rail destination opens the catalog (the primary
   view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function LibraryPage() {
  redirect('/library/books');
}
