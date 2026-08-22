/* ============================================================
   /finance/approvals — discounts awaiting a second authority

   The maker-checker rule was enforced from the start, but the only listing was
   per-invoice: a requested discount could be found only by already knowing
   which invoice carried it, so approvers had to be told verbally. Approving is
   a task, and a task needs a queue.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { toListQuery } from '@/lib/list-query';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { ApprovalsClient, type ApprovalRow } from './approvals-client';

interface ApiAdjustment {
  id: string;
  invoiceId: string;
  type: string;
  status: string;
  amount: number;
  reason?: string | null;
  requestedBy?: string | null;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    studentName?: string | null;
    status: string;
    amountDue: number;
    amountPaid: number;
    termName?: string | null;
  } | null;
}

interface AdjustmentsResponse {
  data: ApiAdjustment[];
  pagination: { total: number };
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params, state } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { status: 'status' },
  });
  // A queue defaults to what is still waiting; the filter can widen it.
  if (!params.get('status')) params.set('status', 'pending');

  const [list, session] = await Promise.all([
    serverApiGet<AdjustmentsResponse>(`/finance/adjustments?${params}`),
    getSession(),
  ]);

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  const rows: ApprovalRow[] = (list?.data ?? []).map((adj) => ({
    id: adj.id,
    invoiceId: adj.invoiceId,
    invoiceNumber: adj.invoice?.invoiceNumber ?? '—',
    student: adj.invoice?.studentName ?? null,
    termName: adj.invoice?.termName ?? null,
    type: adj.type,
    status: adj.status,
    amount: adj.amount,
    reason: adj.reason ?? null,
    // What the discount is being taken off, so the size of the ask is legible
    // without opening the invoice.
    outstanding: Math.max(
      0,
      (adj.invoice?.amountDue ?? 0) - (adj.invoice?.amountPaid ?? 0),
    ),
    requestedAt: adj.createdAt,
  }));

  return (
    <ApprovalsClient
      rows={rows}
      total={list?.pagination.total ?? rows.length}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      canManage={canManage}
      currentStatus={state.filters.status ?? 'pending'}
    />
  );
}
