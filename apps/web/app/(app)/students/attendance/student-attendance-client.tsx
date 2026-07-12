'use client';

import * as React from 'react';
import { Download, Search } from 'lucide-react';

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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { Meter, type MeterTone } from '@workspace/ui/custom/data-display/meter';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export interface AttendanceRow {
  id: string;
  name: string;
  className: string;
  rate: number;
  absences: number;
  lates: number;
  sessions: number;
}

interface Props {
  rows: AttendanceRow[];
}

function rateTone(rate: number): MeterTone {
  if (rate >= 95) return 'success';
  if (rate >= 85) return 'info';
  return 'warning';
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function StudentAttendanceClient({ rows }: Props) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !q || row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q);
      const atRisk = row.rate < 85;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'risk' ? atRisk : !atRisk);
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, rows]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  const sessions = rows.reduce((max, row) => Math.max(max, row.sessions), 0);
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live attendance', emphasis: true },
    { key: 'sessions', label: `${sessions} sessions` },
  ];

  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Attendance history"
          meta={meta}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
          }
        />

        <DataTableLayout
          title="By student"
          description={`${filtered.length} of ${rows.length} students`}
          empty={filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative w-full @md/main:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="att-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="att-search"
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
                  <SelectItem value="all">All students</SelectItem>
                  <SelectItem value="good">On track</SelectItem>
                  <SelectItem value="risk">At risk</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No students match your filters' : 'No attendance records yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Attendance marked in the daily register will appear here.'
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
                <TableHead className="w-[12rem]">Present rate</TableHead>
                <TableHead className="text-right max-sm:hidden">Absences</TableHead>
                <TableHead className="text-right max-sm:hidden">Lates</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const atRisk = row.rate < 85;
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
                            {row.id} · {row.className}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Meter
                        value={row.rate}
                        tone={rateTone(row.rate)}
                        valueLabel={`${row.rate}%`}
                        className="min-w-[8rem]"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {row.absences}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {row.lates}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={atRisk ? 'warning' : 'success'} dot>
                        {atRisk ? 'At risk' : 'On track'}
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
