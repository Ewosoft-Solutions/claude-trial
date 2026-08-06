'use client';

/* ============================================================
   PayrollClient — staff payroll (server-driven table)

   Search / status filter / sort / paging live in the URL and run at the DB
   via `useDirectoryState` + `DirectoryTable`; no in-memory filtering of the
   fetched page. Stat tiles come from the whole-set summary from the server.
   ============================================================ */

import * as React from 'react';
import { Plus, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
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

export type PayrollStatus = 'draft' | 'approved' | 'paid';

export interface PayrollRow {
  id: string;
  staffName: string;
  role: string | null;
  payPeriod: string;
  grossPay: number;
  netPay: number;
  status: PayrollStatus;
}

export interface PayrollStats {
  total: number;
  draft: number;
  approved: number;
  netPay: number;
}

const STATUS_META: Record<PayrollStatus, { label: string; tone: StateTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  approved: { label: 'Approved', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
};

const META: PageHeaderMeta[] = [
  { key: 'period', label: 'June 2026', emphasis: true },
];

function currency(n: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n);
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

interface Props {
  records: PayrollRow[];
  total: number;
  defaultPageSize: number;
  stats: PayrollStats;
}

export function PayrollClient({
  records,
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

  const statItems: StatItem[] = [
    { key: 'total', label: 'Records', value: String(stats.total) },
    { key: 'draft', label: 'Draft', value: String(stats.draft) },
    { key: 'approved', label: 'Approved', value: String(stats.approved) },
    { key: 'net', label: 'Total net pay', value: currency(stats.netPay) },
  ];

  const columns: DirectoryColumn<PayrollRow>[] = [
    {
      id: 'staffName',
      header: 'Staff',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-[11px] font-semibold">
              {initials(r.staffName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {r.staffName}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {r.role ?? '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'payPeriod',
      header: 'Pay period',
      sortable: true,
      cell: (r) => <span className="text-muted-foreground">{r.payPeriod}</span>,
    },
    {
      id: 'grossPay',
      header: 'Gross',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {currency(r.grossPay)}
        </span>
      ),
    },
    {
      id: 'netPay',
      header: 'Net',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {currency(r.netPay)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => {
        const meta = STATUS_META[r.status];
        return (
          <StatusBadge tone={meta.tone} dot>
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
          title="Payroll"
          meta={META}
          actions={
            <Button size="sm">
              <Plus /> New run
            </Button>
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<PayrollRow>
          columns={columns}
          rows={records}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.staffName}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Payroll runs"
          description={`${total} ${total === 1 ? 'record' : 'records'}`}
          caption="Staff payroll runs"
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="payroll-search" className="sr-only">
                  Search staff
                </Label>
                <Input
                  id="payroll-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search staff name…"
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
                  className="w-[10rem]"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No payroll records match your filters'
                  : 'No payroll records yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or create a payroll run.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
