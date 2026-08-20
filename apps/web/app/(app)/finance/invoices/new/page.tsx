/* ============================================================
   /finance/invoices/new — compose an invoice (server component)

   Composing is deep work on one object assembled from an unbounded list of
   children with a running total, which is a route rather than a drawer
   (frontend-conventions §3). Nothing is written here: the invoice lives in the
   browser until the bursar saves or issues it, and that one request carries
   the header, the lines and the issue together.
   ============================================================ */

import { notFound } from 'next/navigation';

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { fetchRoster } from '../student-options';
import type { CatalogueItem } from '../[id]/invoice-detail-client';
import { ComposeClient } from './compose-client';

interface ApiFeeItem {
  id: string;
  code: string;
  name: string;
  pricingMode?: string | null;
  defaultAmount?: number | null;
  active: boolean;
}

export default async function NewInvoicePage() {
  const [{ options }, feeItems, session] = await Promise.all([
    fetchRoster(),
    serverApiGet<ApiFeeItem[]>('/finance/fee-items'),
    getSession(),
  ]);

  // Authorisation is enforced server-side, not by hiding the button that
  // reaches this route (AGENTS.md golden rule 5).
  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;
  if (!canManage) notFound();

  const catalogue: CatalogueItem[] = (feeItems ?? [])
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      pricingMode: item.pricingMode === 'open' ? 'open' : 'fixed',
      defaultAmount: item.defaultAmount ?? null,
    }));

  return <ComposeClient students={options} catalogue={catalogue} />;
}
