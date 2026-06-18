'use client';

/* ============================================================
   /finance/payments — payment receipts

   The directory recipe applied to collected payments:
   DataTableLayout (search + method filter, SkeletonTable on load,
   EmptyState + reset). Payment status reads as a StatusBadge. Mock
   rows + copy live here. Replaces the `[...slug]` placeholder.
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

type Method = 'transfer' | 'card' | 'cash';
type Status = 'completed' | 'pending' | 'failed' | 'refunded';

interface Payment {
  id: string;
  student: string;
  method: Method;
  date: string;
  amount: number; // in ₦
  status: Status;
}

const PAYMENTS: Payment[] = [
  { id: 'PMT-9001', student: 'Adaeze Okafor', method: 'transfer', date: '12 Mar', amount: 185000, status: 'completed' },
  { id: 'PMT-9002', student: 'Fatima Bello', method: 'card', date: '12 Mar', amount: 210000, status: 'completed' },
  { id: 'PMT-9003', student: 'Chiamaka Eze', method: 'transfer', date: '13 Mar', amount: 100000, status: 'completed' },
  { id: 'PMT-9004', student: 'Zainab Yusuf', method: 'transfer', date: '13 Mar', amount: 245000, status: 'completed' },
  { id: 'PMT-9005', student: 'Emeka Nwosu', method: 'cash', date: '14 Mar', amount: 120000, status: 'completed' },
  { id: 'PMT-9006', student: 'David Adeyemi', method: 'card', date: '14 Mar', amount: 245000, status: 'failed' },
  { id: 'PMT-9007', student: 'Grace Obi', method: 'transfer', date: '15 Mar', amount: 260000, status: 'completed' },
  { id: 'PMT-9008', student: 'Tunde Bakare', method: 'card', date: '16 Mar', amount: 185000, status: 'pending' },
  { id: 'PMT-9009', student: 'Ibrahim Sani', method: 'transfer', date: '16 Mar', amount: 95000, status: 'refunded' },
];

const METHOD_LABEL: Record<Method, string> = {
  transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
};

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'destructive' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'cycle', label: 'billing cycle 1' },
];

function naira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${n}`;
}

export default function PaymentsPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [methodFilter, setMethodFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return PAYMENTS.filter((p) => {
      const matchesQuery =
        !q ||
        p.student.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
      return matchesQuery && matchesMethod;
    });
  }, [query, methodFilter]);

  const hasFilters = query.trim() !== '' || methodFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setMethodFilter('all');
  }

  const collected = React.useMemo(
    () =>
      PAYMENTS.filter((p) => p.status === 'completed').reduce(
        (s, p) => s + p.amount,
        0,
      ),
    [],
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
          description={
            loading
              ? 'Loading payments…'
              : `${filtered.length} of ${PAYMENTS.length} · ${naira(collected)} collected`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative w-full sm:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="payment-search" className="sr-only">
                  Search payments
                </Label>
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
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No payments match your filters"
              description="Try a different search term, or clear the filters to see every receipt."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {PAYMENTS.length}
              </span>
              {hasFilters ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={resetFilters}
                >
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
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {p.student}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {p.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {METHOD_LABEL[p.method]}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {p.date}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {naira(p.amount)}
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
