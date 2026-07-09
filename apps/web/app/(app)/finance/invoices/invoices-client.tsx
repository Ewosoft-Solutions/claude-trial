'use client';

/* ============================================================
   InvoicesClient — interactive invoice table island

   Receives server-fetched invoices as props.
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

export type InvoiceStatus = 'paid' | 'partial' | 'overdue' | 'draft' | 'issued' | 'cancelled';

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
  status: InvoiceStatus;
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
}

export function InvoicesClient({ invoices }: Props) {
  const rows = invoices;

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((inv) => {
      const display = inv.invoiceNumber ?? inv.id;
      const name = inv.student ?? '';
      const matchesQuery =
        !q || name.toLowerCase().includes(q) || display.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const stats: StatItem[] = React.useMemo(() => {
    const billed = rows.reduce((s, i) => s + (i.amountDue ?? 0), 0);
    const collected = rows.reduce((s, i) => s + (i.amountPaid ?? 0), 0);
    const overdue = rows.filter((i) => i.status === 'overdue').length;
    return [
      { key: 'billed', label: 'Total billed', value: nairaFromKobo(billed) },
      {
        key: 'collected',
        label: 'Collected',
        value: nairaFromKobo(collected),
        delta: billed > 0
          ? { label: `${Math.round((collected / billed) * 100)}%`, direction: 'up' as const, intent: 'positive' as const }
          : undefined,
      },
      { key: 'outstanding', label: 'Outstanding', value: nairaFromKobo(billed - collected) },
      {
        key: 'overdue',
        label: 'Overdue invoices',
        value: String(overdue),
        delta: overdue > 0
          ? { label: 'past due', direction: 'up' as const, intent: 'negative' as const }
          : undefined,
      },
    ];
  }, [rows]);

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
          description={`${filtered.length} of ${rows.length} invoices`}
          loading={false}
          empty={filtered.length === 0}
          skeletonColumns={6}
          toolbar={
            <>
              <div className="relative w-full sm:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="invoice-search" className="sr-only">Search invoices</Label>
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
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see every invoice.'
                  : 'Run the dev operational seed or create an invoice.'
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
                const status = STATUS_META[inv.status] ?? STATUS_META['draft'];
                const amountDue = inv.amountDue ?? 0;
                const amountPaid = inv.amountPaid ?? 0;
                const displayName = inv.student ?? inv.studentId ?? '—';
                const displayId = inv.invoiceNumber ?? inv.id;
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">{displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">{displayId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {inv.className ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {inv.due ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {amountDue ? nairaFromKobo(amountDue) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-md:hidden">
                      {amountDue ? nairaFromKobo(amountPaid) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={inv.status !== 'draft' && inv.status !== 'cancelled'}>
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
