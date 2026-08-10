'use client';

/* ============================================================
   PaymentsClient — payment receipts (client-side DirectoryTable)

   Receives the full server-fetched payments list, so search / method +
   status filters / sort / paging run in-memory. Both filters collapse into
   the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';
import { Download } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { formatNaira as nairaFromKobo } from '@/lib/format';

export type PaymentMethod = 'transfer' | 'card' | 'cash' | 'cheque';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  receiptNumber?: string;
  invoiceId?: string;
  studentId?: string;
  student?: string;
  method: PaymentMethod;
  date?: string;
  /** Amount in kobo (from API) */
  amount: number;
  status: PaymentStatus;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
};

const STATUS_META: Record<PaymentStatus, { label: string; tone: StateTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'destructive' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'cycle', label: 'billing cycle 1' },
];

interface Props {
  payments: Payment[];
}

export function PaymentsClient({ payments }: Props) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const columns: DirectoryColumn<Payment>[] = [
    {
      id: 'receipt',
      header: 'Receipt',
      sortable: true,
      cell: (p) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {p.student ?? p.studentId ?? '—'}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {p.receiptNumber ?? p.id}
          </span>
        </div>
      ),
    },
    {
      id: 'method',
      header: 'Method',
      hideable: true,
      cell: (p) => (
        <span className="text-muted-foreground">
          {METHOD_LABEL[p.method] ?? p.method}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      hideable: true,
      cell: (p) => (
        <span className="text-muted-foreground">{p.date ?? '—'}</span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      sortable: true,
      cell: (p) => (
        <span className="tabular-nums text-foreground">
          {nairaFromKobo(p.amount)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (p) => {
        const status = STATUS_META[p.status];
        return (
          <StatusBadge tone={status.tone} dot={p.status !== 'refunded'}>
            {status.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const method = filters.method;
    const status = filters.status;
    let out = payments.filter((p) => {
      const name = (p.student ?? '').toLowerCase();
      const display = (p.receiptNumber ?? p.id).toLowerCase();
      const matchesQ = !q || name.includes(q) || display.includes(q);
      const matchesMethod = !method || p.method === method;
      const matchesStatus = !status || p.status === status;
      return matchesQ && matchesMethod && matchesStatus;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'amount'
          ? dir * (a.amount - b.amount)
          : sort.field === 'status'
            ? dir * a.status.localeCompare(b.status)
            : dir * (a.student ?? '').localeCompare(b.student ?? ''),
      );
    }
    return out;
  }, [payments, term, filters, sort]);

  const collected = React.useMemo(
    () =>
      payments
        .filter((p) => p.status === 'completed')
        .reduce((s, p) => s + p.amount, 0),
    [payments],
  );

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Payments"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
          }
        />

        <DirectoryTable<Payment>
          title="Payment receipts"
          description={`${payments.length} ${payments.length === 1 ? 'receipt' : 'receipts'} · ${nairaFromKobo(collected)} collected`}
          columns={columns}
          rows={pageRows}
          getRowId={(p) => p.id}
          getRowLabel={(p) => p.student ?? p.receiptNumber ?? p.id}
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={sort}
          onSortChange={(field) =>
            setSort((cur) =>
              cur?.field !== field
                ? { field, dir: 'asc' }
                : cur.dir === 'asc'
                  ? { field, dir: 'desc' }
                  : null,
            )
          }
          caption="Payment receipts"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search receipt # or student…',
            label: 'Search payments',
            id: 'payment-search',
          }}
          filters={[
            {
              key: 'method',
              label: 'Method',
              options: (Object.keys(METHOD_LABEL) as PaymentMethod[]).map(
                (m) => ({ value: m, label: METHOD_LABEL[m] }),
              ),
            },
            {
              key: 'status',
              label: 'Status',
              options: (Object.keys(STATUS_META) as PaymentStatus[]).map(
                (s) => ({ value: s, label: STATUS_META[s].label }),
              ),
            },
          ]}
          filterValues={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasQuery ? 'No payments match your filters' : 'No payments yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters to see every receipt.'
                  : 'Run the dev operational seed or record a payment.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
