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
import { Download, Plus, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
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
function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

interface Props {
  invoices: Invoice[];
  total: number;
  defaultPageSize: number;
  stats: InvoiceStats;
}

export function InvoicesClient({
  invoices,
  total,
  defaultPageSize,
  stats,
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
  const { state, setPage, setPageSize, toggleSort, setQuery, setFilter } =
    useDirectoryState({
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
  const hasFilters = state.q.trim() !== '' || statusFilter !== 'all';

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
            {inv.student ?? inv.studentId ?? '—'}
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
              <Button size="sm">
                <Plus /> New invoice
              </Button>
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
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="invoice-search" className="sr-only">
                  Search invoices
                </Label>
                <Input
                  id="invoice-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search invoice # or student…"
                  className="pl-8"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setFilter('status', v === 'all' ? null : v)
                }
              >
                <SelectTrigger
                  className="w-[8.5rem]"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Part-paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
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
