'use client';

/* ============================================================
   InvoicesClient — fee invoices (server-driven table)

   Search (invoice # / student name) / status filter / sort / paging live in
   the URL and run at the DB via `useDirectoryState` + `DirectoryTable`; the
   client never filters the fetched page. Stat tiles come from the whole-set
   invoice summary passed by the server.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { Download, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

import { formatNaira as nairaFromKobo } from '@/lib/format';

export type InvoiceStatus =
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'draft'
  | 'issued'
  | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  studentId?: string;
  student?: string;
  className?: string;
  issued?: string;
  due?: string;
  /** Amount due in kobo (minor units). */
  amountDue?: number;
  amountPaid?: number;
  /** Derived: gross (Σ lines), applied discounts, and the outstanding balance. */
  gross?: number;
  discounts?: number;
  balance?: number;
  status: InvoiceStatus;
}

export interface InvoiceStats {
  billed: number;
  discounts: number;
  collected: number;
  outstanding: number;
  overdue: number;
}

const STATUS_META: Record<InvoiceStatus, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'destructive' },
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'cycle', label: 'billing cycle 1' },
];

/** Compact Naira formatting from kobo (minor units). */
interface Props {
  invoices: Invoice[];
  total: number;
  defaultPageSize: number;
  stats: InvoiceStats;
  canManage: boolean;
}

export function InvoicesClient({
  invoices,
  total,
  defaultPageSize,
  stats,
  canManage,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const defaults = React.useMemo(
    () => ({ pageSize: defaultPageSize }),
    [defaultPageSize],
  );
  const {
    state,
    setPage,
    setPageSize,
    toggleSort,
    setQuery,
    setFilter,
    setFilters,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults,
  });

  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const statusFilter = state.filters.status ?? 'all';
  const hasFilters =
    state.q.trim() !== '' ||
    statusFilter !== 'all' ||
    Boolean(state.filters.dueFrom) ||
    Boolean(state.filters.dueTo);

  const collectionRate =
    stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 0;
  const statItems: StatItem[] = [
    {
      key: 'billed',
      label: 'Total billed',
      value: nairaFromKobo(stats.billed),
    },
    {
      key: 'discounts',
      label: 'Discounts',
      value: nairaFromKobo(stats.discounts),
    },
    {
      key: 'collected',
      label: 'Collected',
      value: nairaFromKobo(stats.collected),
      delta:
        stats.billed > 0
          ? { label: `${collectionRate}%`, direction: 'up', intent: 'positive' }
          : undefined,
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: nairaFromKobo(stats.outstanding),
    },
    {
      key: 'overdue',
      label: 'Overdue invoices',
      value: String(stats.overdue),
      delta:
        stats.overdue > 0
          ? { label: 'past due', direction: 'up', intent: 'negative' }
          : undefined,
    },
  ];

  const columns: DirectoryColumn<Invoice>[] = [
    {
      id: 'studentName',
      header: 'Invoice',
      sortable: true,
      cell: (inv) => (
        <Link
          href={`/finance/invoices/${inv.id}`}
          className="flex min-w-0 flex-col hover:underline"
        >
          <span className="break-words font-medium text-foreground">
            {/* Never fall through to the id — a UUID in the name column
                tells a bursar nothing and looks like corruption. */}
            {inv.student ?? '—'}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {inv.invoiceNumber ?? inv.id}
          </span>
        </Link>
      ),
    },
    {
      id: 'className',
      header: 'Class',
      hideable: true,
      cell: (inv) => (
        <span className="text-muted-foreground">{inv.className ?? '—'}</span>
      ),
    },
    {
      // The two ends of the period a bill covers: when it went out, and when
      // it is owed. A draft has no issue date yet, which is itself worth
      // seeing in a list.
      id: 'issuedDate',
      header: 'Issued',
      sortable: true,
      cell: (inv) => (
        <span className="text-muted-foreground">{inv.issued ?? '—'}</span>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due',
      sortable: true,
      cell: (inv) => (
        <span className="text-muted-foreground">{inv.due ?? '—'}</span>
      ),
    },
    {
      id: 'amountDue',
      header: 'Billed',
      align: 'end',
      sortable: true,
      cell: (inv) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-foreground">
            {inv.gross ? nairaFromKobo(inv.gross) : '—'}
          </span>
          {inv.discounts ? (
            <span className="tabular-nums text-xs text-muted-foreground">
              −{nairaFromKobo(inv.discounts)} disc
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'amountPaid',
      header: 'Paid',
      align: 'end',
      sortable: true,
      cell: (inv) => (
        <span className="tabular-nums text-muted-foreground">
          {inv.gross ? nairaFromKobo(inv.amountPaid ?? 0) : '—'}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      cell: (inv) => (
        <span className="tabular-nums font-medium text-foreground">
          {inv.balance != null ? nairaFromKobo(inv.balance) : '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (inv) => {
        const meta = STATUS_META[inv.status] ?? STATUS_META.draft;
        return (
          <StatusBadge
            tone={meta.tone}
            dot={inv.status !== 'draft' && inv.status !== 'cancelled'}
          >
            {meta.label}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Invoices"
          meta={META}
          actions={
            <>
              <Button variant="outline" size="sm">
                <Download /> Export
              </Button>
              {canManage ? (
                <Button size="sm" asChild>
                  <Link href="/finance/invoices/new">
                    <Plus /> New invoice
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<Invoice>
          columns={columns}
          rows={invoices}
          getRowId={(inv) => inv.id}
          getRowLabel={(inv) => inv.invoiceNumber ?? inv.id}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Fee invoices"
          description={`${total} ${total === 1 ? 'invoice' : 'invoices'}`}
          caption="Fee invoices"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search invoice # or student…',
            label: 'Search invoices',
            id: 'invoice-search',
          }}
          filters={[
            {
              key: 'due',
              label: 'Due',
              type: 'dateRange',
              options: [],
            },
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'paid', label: 'Paid' },
                { value: 'partial', label: 'Part-paid' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'issued', label: 'Issued' },
                { value: 'draft', label: 'Draft' },
              ],
            },
          ]}
          filterValues={state.filters}
          onFilterChange={setFilter}
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No invoices match your filters'
                  : 'No invoices yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see every invoice.'
                  : 'Run the dev operational seed or create an invoice.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}

