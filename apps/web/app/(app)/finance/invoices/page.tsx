'use client';

/* ============================================================
   /finance/invoices — fee invoices

   The directory recipe applied to billing: an M6 StatGrid billing
   summary (billed / collected / outstanding / overdue, derived
   live) + DataTableLayout (search + status filter, SkeletonTable on
   load, EmptyState + reset). Invoice status reads as a StatusBadge.
   Mock rows + copy live here. Replaces the `[...slug]` placeholder.
   ============================================================ */

import * as React from 'react';
import { Download, Plus, Search } from 'lucide-react';

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

type Status = 'paid' | 'partial' | 'overdue' | 'draft';

interface Invoice {
  id: string;
  student: string;
  className: string;
  issued: string;
  due: string;
  amount: number; // billed, in ₦
  paid: number; // collected so far, in ₦
  status: Status;
}

const INVOICES: Invoice[] = [
  { id: 'INV-3001', student: 'Adaeze Okafor', className: 'JSS 1A', issued: '01 Mar', due: '15 Mar', amount: 185000, paid: 185000, status: 'paid' },
  { id: 'INV-3002', student: 'Tunde Bakare', className: 'JSS 1A', issued: '01 Mar', due: '15 Mar', amount: 185000, paid: 0, status: 'overdue' },
  { id: 'INV-3003', student: 'Chiamaka Eze', className: 'JSS 2B', issued: '01 Mar', due: '15 Mar', amount: 195000, paid: 100000, status: 'partial' },
  { id: 'INV-3004', student: 'Ibrahim Sani', className: 'JSS 2B', issued: '01 Mar', due: '15 Mar', amount: 195000, paid: 0, status: 'overdue' },
  { id: 'INV-3005', student: 'Fatima Bello', className: 'JSS 3A', issued: '01 Mar', due: '15 Mar', amount: 210000, paid: 210000, status: 'paid' },
  { id: 'INV-3006', student: 'Emeka Nwosu', className: 'JSS 3A', issued: '01 Mar', due: '15 Mar', amount: 210000, paid: 120000, status: 'partial' },
  { id: 'INV-3007', student: 'Zainab Yusuf', className: 'SSS 1A', issued: '01 Mar', due: '15 Mar', amount: 245000, paid: 245000, status: 'paid' },
  { id: 'INV-3008', student: 'David Adeyemi', className: 'SSS 1A', issued: '01 Mar', due: '15 Mar', amount: 245000, paid: 0, status: 'overdue' },
  { id: 'INV-3009', student: 'Grace Obi', className: 'SSS 2B', issued: '08 Mar', due: '22 Mar', amount: 260000, paid: 260000, status: 'paid' },
  { id: 'INV-3010', student: 'Samuel Etim', className: 'SSS 3A', issued: '08 Mar', due: '22 Mar', amount: 0, paid: 0, status: 'draft' },
];

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'destructive' },
  draft: { label: 'Draft', tone: 'neutral' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'cycle', label: 'billing cycle 1' },
];

/** Compact Naira formatting, e.g. ₦1.9M / ₦185k. */
function naira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${n}`;
}

export default function InvoicesPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return INVOICES.filter((inv) => {
      const matchesQuery =
        !q ||
        inv.student.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const stats: StatItem[] = React.useMemo(() => {
    const billed = INVOICES.reduce((s, i) => s + i.amount, 0);
    const collected = INVOICES.reduce((s, i) => s + i.paid, 0);
    const overdue = INVOICES.filter((i) => i.status === 'overdue').length;
    return [
      { key: 'billed', label: 'Total billed', value: naira(billed) },
      {
        key: 'collected',
        label: 'Collected',
        value: naira(collected),
        delta: {
          label: `${Math.round((collected / billed) * 100)}%`,
          direction: 'up',
          intent: 'positive',
        },
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        value: naira(billed - collected),
      },
      {
        key: 'overdue',
        label: 'Overdue invoices',
        value: String(overdue),
        delta: { label: 'past due', direction: 'up', intent: 'negative' },
      },
    ];
  }, []);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Invoices"
          meta={META}
          actions={
            <>
              <Button variant="outline" size="sm" className="max-md:hidden">
                <Download /> Export
              </Button>
              <Button size="sm">
                <Plus /> New invoice
              </Button>
            </>
          }
        />

        <StatGrid items={stats} />

        <DataTableLayout
          title="Fee invoices"
          description={
            loading
              ? 'Loading invoices…'
              : `${filtered.length} of ${INVOICES.length} invoices`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={6}
          toolbar={
            <>
              <div className="relative w-full sm:w-56">
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search invoice # or student…"
                  className="pl-8"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[8.5rem]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Part-paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No invoices match your filters"
              description="Try a different search term, or clear the filters to see every invoice."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {INVOICES.length}
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
                <TableHead>Invoice</TableHead>
                <TableHead className="max-md:hidden">Class</TableHead>
                <TableHead className="max-sm:hidden">Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right max-md:hidden">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const status = STATUS_META[inv.status];
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {inv.student}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {inv.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {inv.className}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {inv.due}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {inv.amount ? naira(inv.amount) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-md:hidden">
                      {inv.amount ? naira(inv.paid) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={inv.status !== 'draft'}>
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
