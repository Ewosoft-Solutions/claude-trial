/* ============================================================
   /finance — section landing

   The Finance rail destination opens the invoices ledger (the
   primary billing view) directly.
   ============================================================ */

import { redirect } from 'next/navigation';

export default function FinancePage() {
  redirect('/finance/invoices');
}
