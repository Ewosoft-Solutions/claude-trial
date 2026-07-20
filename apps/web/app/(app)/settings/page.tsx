/* ============================================================
   /settings — section landing

   The Settings rail destination opens the General panel directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/general');
}
