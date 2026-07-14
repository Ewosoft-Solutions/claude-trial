'use client';

/* ============================================================
   PaymentsClient — interactive payments table island

   Receives server-fetched payments as props.
   ============================================================ */

import * as React from 'react';
import { Download, Search } from 'lucide-react';

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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

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

function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

interface Props {
  payments: Payment[];
}

export function PaymentsClient({ payments }: Props) {
  const rows = payments;

  const [query, setQuery] = React.useState('');
  const [methodFilter, setMethodFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      const display = p.receiptNumber ?? p.id;
      const name = p.student ?? '';
      const matchesQuery =
        !q || name.toLowerCase().includes(q) || display.toLowerCase().includes(q);
      const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
      return matchesQuery && matchesMethod;
    });
  }, [rows, query, methodFilter]);

  const hasFilters = query.trim() !== '' || methodFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setMethodFilter('all');
  }

  const collected = React.useMemo(
    () =>
      rows
        .filter((p) => p.status === 'completed')
        .reduce((s, p) => s + p.amount, 0),
    [rows],
  );

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

        <DataTableLayout
          title="Payment receipts"
          description={`${filtered.length} of ${rows.length} · ${nairaFromKobo(collected)} collected`}
          loading={false}
          empty={filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="payment-search" className="sr-only">Search payments</Label>
                <Input
                  id="payment-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search receipt # or student…"
                  className="pl-8"
                />
              </div>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[9rem]" aria-label="Filter by method">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="transfer">Bank transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No payments match your filters' : 'No payments yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see every receipt.'
                  : 'Run the dev operational seed or record a payment.'
              }
              primaryAction={
                hasFilters ? { label: 'Clear filters', onClick: resetFilters } : undefined
              }
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of {rows.length}
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
                <TableHead>Receipt</TableHead>
                <TableHead className="max-md:hidden">Method</TableHead>
                <TableHead className="max-sm:hidden">Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const status = STATUS_META[p.status];
                const displayName = p.student ?? p.studentId ?? '—';
                const displayId = p.receiptNumber ?? p.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">{displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">{displayId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {METHOD_LABEL[p.method] ?? p.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {p.date ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {nairaFromKobo(p.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={p.status !== 'refunded'}>
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
