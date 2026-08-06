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

interface ApiFeeItem {
  id: string;
  code: string;
  name: string;
  defaultAmount?: number | null;
  active: boolean;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, feeItems, session] = await Promise.all([
    serverApiGet<ApiInvoiceDetail>(`/finance/invoices/${id}`),
    serverApiGet<ApiFeeItem[]>('/finance/fee-items'),
    getSession(),
  ]);

  if (!invoice) notFound();

  const catalogue: CatalogueItem[] = (feeItems ?? [])
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      defaultAmount: item.defaultAmount ?? null,
    }));

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  return (
    <InvoiceDetailClient
      invoice={invoice}
      catalogue={catalogue}
      canManage={canManage}
    />
  );
}
