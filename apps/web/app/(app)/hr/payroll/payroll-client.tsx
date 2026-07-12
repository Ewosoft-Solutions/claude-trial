'use client';

/* ============================================================
   PayrollClient — staff payroll interactive table

   Receives server-fetched payroll records as props. M6 StatGrid (payroll
   totals) + DataTableLayout (toolbar + table + footer). Run status reads as
   a StatusBadge.
   ============================================================ */

import * as React from 'react';
import { Plus, Search } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
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

const STATUS_META: Record<PayrollStatus, { label: string; tone: StateTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  approved: { label: 'Approved', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
};

const META: PageHeaderMeta[] = [{ key: 'period', label: 'June 2026', emphasis: true }];

function currency(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

interface Props {
  records: PayrollRow[];
}

export function PayrollClient({ records }: Props) {
  const RECORDS = records;
  const loading = false;

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECORDS.filter((r) => {
      const matchesQuery = !q || r.staffName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [RECORDS, query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const stats: StatItem[] = React.useMemo(() => {
    const count = (fn: (r: PayrollRow) => boolean) => RECORDS.filter(fn).length;
    const totalNet = RECORDS.reduce((sum, r) => sum + r.netPay, 0);
    return [
      { key: 'total', label: 'Records', value: String(RECORDS.length) },
      { key: 'draft', label: 'Draft', value: String(count((r) => r.status === 'draft')) },
      { key: 'approved', label: 'Approved', value: String(count((r) => r.status === 'approved')) },
      { key: 'net', label: 'Total net pay', value: currency(totalNet) },
    ];
  }, [RECORDS]);

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

        <StatGrid items={stats} />

        <DataTableLayout
          title="Payroll runs"
          description={
            loading ? 'Loading payroll…' : `${filtered.length} of ${RECORDS.length} records`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative w-full @md/main:w-56">
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search staff name…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[10rem]" aria-label="Filter by status">
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
              title={hasFilters ? 'No payroll records match your filters' : 'No payroll records yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or create a payroll run.'
              }
              primaryAction={
                hasFilters ? { label: 'Clear filters', onClick: resetFilters } : undefined
              }
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {RECORDS.length}
              </span>
              {hasFilters ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="max-md:hidden">Pay period</TableHead>
                <TableHead className="text-right max-sm:hidden">Gross</TableHead>
                <TableHead className="text-right max-sm:hidden">Net</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const status = STATUS_META[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(r.staffName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{r.staffName}</span>
                          <span className="truncate text-xs text-muted-foreground">{r.role ?? '—'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {r.payPeriod}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {currency(r.grossPay)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {currency(r.netPay)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot>
                        {status.label}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}
