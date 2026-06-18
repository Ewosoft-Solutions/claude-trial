'use client';

/* ============================================================
   /students/fees — per-student fee balances

   Student-centric billing (distinct from /finance/invoices, which is
   the ledger): each row is a student's term balance. StatGrid summary
   + DataTableLayout (search + status filter, Skeleton/Empty). Mock
   rows + copy live here. Replaces the `[...slug]` placeholder.
   ============================================================ */

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

type Status = 'paid' | 'partial' | 'owing';

interface FeeRow {
  id: string;
  name: string;
  className: string;
  billed: number;
  paid: number;
  status: Status;
}

const FEES: FeeRow[] = [
  { id: 'SJ-1042', name: 'Adaeze Okafor', className: 'JSS 1A', billed: 185000, paid: 185000, status: 'paid' },
  { id: 'SJ-1043', name: 'Tunde Bakare', className: 'JSS 1A', billed: 185000, paid: 0, status: 'owing' },
  { id: 'SJ-1071', name: 'Chiamaka Eze', className: 'JSS 2B', billed: 195000, paid: 100000, status: 'partial' },
  { id: 'SJ-1088', name: 'Ibrahim Sani', className: 'JSS 2B', billed: 195000, paid: 0, status: 'owing' },
  { id: 'SJ-1102', name: 'Fatima Bello', className: 'JSS 3A', billed: 210000, paid: 210000, status: 'paid' },
  { id: 'SJ-1119', name: 'Emeka Nwosu', className: 'JSS 3A', billed: 210000, paid: 120000, status: 'partial' },
  { id: 'SJ-1203', name: 'Zainab Yusuf', className: 'SSS 1A', billed: 245000, paid: 245000, status: 'paid' },
  { id: 'SJ-1221', name: 'David Adeyemi', className: 'SSS 1A', billed: 245000, paid: 0, status: 'owing' },
  { id: 'SJ-1244', name: 'Grace Obi', className: 'SSS 2B', billed: 260000, paid: 260000, status: 'paid' },
  { id: 'SJ-1290', name: 'Samuel Etim', className: 'SSS 3A', billed: 260000, paid: 180000, status: 'partial' },
];

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  owing: { label: 'Owing', tone: 'destructive' },
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

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function StudentFeesPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return FEES.filter((f) => {
      const matchesQuery =
        !q || f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const stats: StatItem[] = React.useMemo(() => {
    const billed = FEES.reduce((s, f) => s + f.billed, 0);
    const collected = FEES.reduce((s, f) => s + f.paid, 0);
    const owing = FEES.filter((f) => f.status !== 'paid').length;
    return [
      { key: 'billed', label: 'Total billed', value: naira(billed) },
      { key: 'collected', label: 'Collected', value: naira(collected) },
      { key: 'outstanding', label: 'Outstanding', value: naira(billed - collected) },
      { key: 'owing', label: 'Students owing', value: String(owing) },
    ];
  }, []);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Fees & billing"
          meta={META}
          actions={
            <Button size="sm">
              <Bell /> Send reminders
            </Button>
          }
        />

        <StatGrid items={stats} />

        <DataTableLayout
          title="Student balances"
          description={
            loading
              ? 'Loading balances…'
              : `${filtered.length} of ${FEES.length} students`
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
                <Label htmlFor="fees-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="fees-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or ID…"
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
              title="No students match your filters"
              description="Try a different search term, or clear the filters."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {FEES.length}
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
              {filtered.map((f) => {
                const status = STATUS_META[f.status];
                const balance = f.billed - f.paid;
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(f.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{f.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{f.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">{f.className}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{naira(f.billed)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">{naira(f.paid)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {balance > 0 ? naira(balance) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot>{status.label}</StatusBadge>
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
