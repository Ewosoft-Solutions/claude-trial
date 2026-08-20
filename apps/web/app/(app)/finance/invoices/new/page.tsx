/* ============================================================
   /finance/invoices/new — open a draft invoice (server component)

   Composing an invoice is deep work on one object, so it is a route rather
   than a drawer (frontend-conventions §3). This page only picks the student;
   the draft it opens is composed on `/finance/invoices/[id]`.
   ============================================================ */

import { notFound } from 'next/navigation';

import { getSession } from '@/lib/session';
import { fetchRoster } from '../student-options';
import { NewInvoiceClient } from './new-invoice-client';

export default async function NewInvoicePage() {
  const [{ options }, session] = await Promise.all([
    fetchRoster(),
    getSession(),
  ]);

  // Authorisation is enforced server-side, not by hiding the button that
  // reaches this route (AGENTS.md golden rule 5).
  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;
  if (!canManage) notFound();

  return <NewInvoiceClient students={options} />;
}
