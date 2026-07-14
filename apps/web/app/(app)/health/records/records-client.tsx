'use client';

/* ============================================================
   RecordsClient — student health records interactive table

   Receives server-fetched records as props. M6 StatGrid (triage summary) +
   DataTableLayout (toolbar + table + footer). Triage status reads as a
   StatusBadge.
   ============================================================ */

import * as React from 'react';
import { Search, UserPlus } from 'lucide-react';

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

export type HealthStatus = 'normal' | 'monitoring' | 'urgent';

export interface HealthRecordRow {
  id: string;
  name: string;
  bloodType: string | null;
  allergies: string | null;
  status: HealthStatus;
  lastCheckup: string | null;
}

const STATUS_META: Record<HealthStatus, { label: string; tone: StateTone }> = {
  normal: { label: 'Normal', tone: 'success' },
  monitoring: { label: 'Monitoring', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'destructive' },
};

const META: PageHeaderMeta[] = [{ key: 'term', label: 'Spring Term 2025', emphasis: true }];

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

interface Props {
  records: HealthRecordRow[];
}

export function RecordsClient({ records }: Props) {
  const RECORDS = records;
  const loading = false;

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECORDS.filter((r) => {
      const matchesQuery = !q || r.name.toLowerCase().includes(q);
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
    const count = (fn: (r: HealthRecordRow) => boolean) => RECORDS.filter(fn).length;
    return [
      { key: 'total', label: 'Records', value: String(RECORDS.length) },
      { key: 'normal', label: 'Normal', value: String(count((r) => r.status === 'normal')) },
      { key: 'monitoring', label: 'Monitoring', value: String(count((r) => r.status === 'monitoring')) },
      { key: 'urgent', label: 'Urgent', value: String(count((r) => r.status === 'urgent')) },
    ];
  }, [RECORDS]);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Health"
          meta={META}
          actions={
            <Button size="sm">
              <UserPlus /> New record
            </Button>
          }
        />

        <StatGrid items={stats} />

        <DataTableLayout
          title="Student records"
          description={
            loading ? 'Loading records…' : `${filtered.length} of ${RECORDS.length} students`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="health-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="health-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[10rem]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No records match your filters' : 'No health records yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or create a student health record.'
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
                <TableHead>Student</TableHead>
                <TableHead className="max-md:hidden">Blood type</TableHead>
                <TableHead className="max-sm:hidden">Allergies</TableHead>
                <TableHead className="text-right max-sm:hidden">Last checkup</TableHead>
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
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium text-foreground">{r.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {r.bloodType ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {r.allergies ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {r.lastCheckup ?? '—'}
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
