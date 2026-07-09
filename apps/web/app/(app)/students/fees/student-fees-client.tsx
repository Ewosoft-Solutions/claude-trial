'use client';

import * as React from 'react';
import { Bell, Search } from 'lucide-react';

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

export type FeeStatus = 'paid' | 'partial' | 'owing';

export interface FeeRow {
  id: string;
  name: string;
  className: string;
  billed: number;
  paid: number;
  status: FeeStatus;
}

interface Props {
  rows: FeeRow[];
}

const STATUS_META: Record<FeeStatus, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  owing: { label: 'Owing', tone: 'destructive' },
};

function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function StudentFeesClient({ rows }: Props) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !q || row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q);
      return matchesQuery && (statusFilter === 'all' || row.status === statusFilter);
    });
  }, [query, statusFilter, rows]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  const stats: StatItem[] = React.useMemo(() => {
    const billed = rows.reduce((sum, row) => sum + row.billed, 0);
    const collected = rows.reduce((sum, row) => sum + row.paid, 0);
    const owing = rows.filter((row) => row.status !== 'paid').length;
    return [
      { key: 'billed', label: 'Total billed', value: nairaFromKobo(billed) },
      { key: 'collected', label: 'Collected', value: nairaFromKobo(collected) },
      { key: 'outstanding', label: 'Outstanding', value: nairaFromKobo(billed - collected) },
      { key: 'owing', label: 'Students owing', value: String(owing) },
    ];
  }, [rows]);
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live invoices', emphasis: true },
    { key: 'students', label: `${rows.length} billed students` },
  ];

  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Fees & billing"
          meta={meta}
          actions={
            <Button size="sm">
              <Bell /> Send reminders
            </Button>
          }
        />

        <StatGrid items={stats} />

        <DataTableLayout
          title="Student balances"
          description={`${filtered.length} of ${rows.length} students`}
          empty={filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative w-full sm:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="fees-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="fees-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or ID"
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
                  <SelectItem value="owing">Owing</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No students match your filters' : 'No student balances yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Invoices created for students will appear here.'
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
                {rows.length}
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
                <TableHead>Student</TableHead>
                <TableHead className="max-md:hidden">Class</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right max-sm:hidden">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const status = STATUS_META[row.status];
                const balance = row.billed - row.paid;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {row.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {row.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {row.className}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {nairaFromKobo(row.billed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {nairaFromKobo(row.paid)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {balance > 0 ? nairaFromKobo(balance) : '—'}
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
