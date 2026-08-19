/* ============================================================
   /finance/payments — receipts (server component)

   A receipt is money received; what it settled lives in its allocations, so
   this list shows the payer, the children covered, and anything held back as
   credit. Search / method + status filters / paging run at the DB through the
   server-driven `/finance/receipts` endpoint.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { toListQuery } from '@/lib/list-query';
import { PaymentsClient, type Receipt, type HouseholdOption } from './payments-client';

const DEFAULT_PAGE_SIZE = 25;

interface ApiAllocation {
  id: string;
  amount: number;
  invoice?: {
    id: string;
    invoiceNumber?: string | null;
    studentName?: string | null;
  } | null;
}

interface ApiReceipt {
  id: string;
  receiptNumber: string;
  payerName?: string | null;
  householdId?: string | null;
  household?: { id: string; name: string } | null;
  method: string;
  paidAt: string;
  amount: number;
  status: string;
  reference?: string | null;
  reprintCount?: number;
  allocatedAmount?: number;
  unallocatedAmount?: number;
  coveredStudents?: string[];
  allocations?: ApiAllocation[];
}

interface ReceiptsResponse {
  data?: ApiReceipt[];
  total?: number;
}

interface ApiHousehold {
  id: string;
  name: string;
  primaryPayerName?: string | null;
}

interface CollectionsReport {
  totals?: {
    receipts?: number;
    total?: number;
    allocated?: number;
    heldAsCredit?: number;
  };
}

function formatDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

/** The window the collection tiles describe: the current calendar month. */
function monthToDate(): { from: string; to: string; label: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {
    from: iso(first),
    to: iso(now),
    label: new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(now),
  };
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params, state } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { method: 'method', status: 'status' },
  });
  // The receipts endpoint pages by offset; the directory URL pages by number.
  params.set('offset', String((state.page - 1) * state.pageSize));
  params.delete('page');

  const window = monthToDate();
  const [list, householdData, collections, session] = await Promise.all([
    serverApiGet<ReceiptsResponse>(`/finance/receipts?${params.toString()}`),
    serverApiGet<ApiHousehold[] | { data?: ApiHousehold[] }>(
      '/finance/households',
    ),
    serverApiGet<CollectionsReport>(
      `/finance/reports/collections?from=${window.from}&to=${window.to}`,
    ),
    getSession(),
  ]);

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  const rows = list?.data ?? [];
  const households = Array.isArray(householdData)
    ? householdData
    : (householdData?.data ?? []);

  const receipts: Receipt[] = rows.map((receipt) => ({
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    payerName: receipt.payerName ?? receipt.household?.name ?? undefined,
    householdName: receipt.household?.name ?? undefined,
    method: receipt.method as Receipt['method'],
    date: formatDate(receipt.paidAt),
    amount: receipt.amount,
    allocated: receipt.allocatedAmount ?? 0,
    unallocated: receipt.unallocatedAmount ?? 0,
    covers: receipt.coveredStudents ?? [],
    reference: receipt.reference ?? undefined,
    status: receipt.status as Receipt['status'],
  }));

  const householdOptions: HouseholdOption[] = households.map((household) => ({
    id: household.id,
    name: household.name,
    payerName: household.primaryPayerName ?? undefined,
  }));

  return (
    <PaymentsClient
      receipts={receipts}
      total={list?.total ?? receipts.length}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      households={householdOptions}
      canManage={canManage}
      collections={{
        label: window.label,
        received: collections?.totals?.total ?? 0,
        count: collections?.totals?.receipts ?? 0,
        heldAsCredit: collections?.totals?.heldAsCredit ?? 0,
      }}
    />
  );
}
