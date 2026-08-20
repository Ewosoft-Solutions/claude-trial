/* ============================================================
   /finance/invoices/[id] — invoice detail (server component)

   Loads the invoice with its lines (+ fee item), adjustments, payments and
   DERIVED financials (gross − applied discounts − paid), plus the fee-item
   catalogue for the add-line picker. Line edits + discretionary adjustments run
   from the client and re-fetch via router.refresh. `canManage` (finance.manage)
   gates whether the write controls render; the API enforces it authoritatively.
   ============================================================ */

import { notFound } from 'next/navigation';

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import {
  InvoiceDetailClient,
  type ApiInvoiceDetail,
  type CatalogueItem,
} from './invoice-detail-client';
import type { BilledTo } from '../billed-to';
import { fetchRoster, studentClass, studentName } from '../student-options';

interface ApiFeeItem {
  id: string;
  code: string;
  name: string;
  /** 'fixed' — priced by the catalogue; 'open' — priced on the line. */
  pricingMode?: string | null;
  defaultAmount?: number | null;
  active: boolean;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, feeItems, roster, session] = await Promise.all([
    serverApiGet<ApiInvoiceDetail>(`/finance/invoices/${id}`),
    serverApiGet<ApiFeeItem[]>('/finance/fee-items'),
    fetchRoster(),
    getSession(),
  ]);

  if (!invoice) notFound();

  // Finance keeps the payer's name as a snapshot and does not join the student
  // schema (deliberately — see FeeInvoice). The roster fills in what a bill
  // still has to show: which child, their number, and their class.
  const student = roster.students.find((s) => s.id === invoice.studentId);
  const billedTo: BilledTo = {
    name: invoice.studentName ?? (student ? studentName(student) : null),
    studentNumber: student?.studentNumber ?? null,
    className: studentClass(student) ?? null,
    householdName: invoice.household?.name ?? null,
    payerName: invoice.household?.primaryPayerName ?? null,
  };

  const catalogue: CatalogueItem[] = (feeItems ?? [])
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      // Anything without an explicit mode is fixed — that is what every item
      // was before open pricing existed.
      pricingMode: item.pricingMode === 'open' ? 'open' : 'fixed',
      defaultAmount: item.defaultAmount ?? null,
    }));

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  return (
    <InvoiceDetailClient
      invoice={invoice}
      catalogue={catalogue}
      billedTo={billedTo}
      canManage={canManage}
    />
  );
}
