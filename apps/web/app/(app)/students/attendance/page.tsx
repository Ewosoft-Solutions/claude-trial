'use client';

/* ============================================================
   /students/attendance — per-student attendance history

   Student-centric attendance (distinct from /attendance/daily, the
   class register): each row is a student's term attendance rate +
   absence/lateness tally and a risk flag. DataTableLayout (search +
   status filter); the present rate uses the shared Meter. Mock rows +
   copy live here. Replaces the `[...slug]` placeholder.
   ============================================================ */

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

interface AttendanceRow {
  id: string;
  name: string;
  className: string;
  rate: number; // present %
  absences: number;
  lates: number;
}

const ROWS: AttendanceRow[] = [
  { id: 'SJ-1042', name: 'Adaeze Okafor', className: 'JSS 1A', rate: 98, absences: 1, lates: 0 },
  { id: 'SJ-1043', name: 'Tunde Bakare', className: 'JSS 1A', rate: 79, absences: 9, lates: 4 },
  { id: 'SJ-1071', name: 'Chiamaka Eze', className: 'JSS 2B', rate: 94, absences: 3, lates: 1 },
  { id: 'SJ-1088', name: 'Ibrahim Sani', className: 'JSS 2B', rate: 68, absences: 14, lates: 6 },
  { id: 'SJ-1102', name: 'Fatima Bello', className: 'JSS 3A', rate: 100, absences: 0, lates: 0 },
  { id: 'SJ-1119', name: 'Emeka Nwosu', className: 'JSS 3A', rate: 91, absences: 4, lates: 3 },
  { id: 'SJ-1203', name: 'Zainab Yusuf', className: 'SSS 1A', rate: 96, absences: 2, lates: 1 },
  { id: 'SJ-1221', name: 'David Adeyemi', className: 'SSS 1A', rate: 84, absences: 7, lates: 5 },
];

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'sessions', label: '44 sessions' },
];

/** Below 85% present is flagged at-risk. */
function rateTone(rate: number): MeterTone {
  if (rate >= 95) return 'success';
  if (rate >= 85) return 'info';
  return 'warning';
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function StudentAttendancePage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROWS.filter((r) => {
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
      const atRisk = r.rate < 85;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'risk' ? atRisk : !atRisk);
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Attendance history"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
          }
        />

        <DataTableLayout
          title="By student"
          description={
            loading
              ? 'Loading attendance…'
              : `${filtered.length} of ${ROWS.length} students`
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
                <Label htmlFor="att-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="att-search"
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
              title="No students match your filters"
              description="Try a different search term, or clear the filters."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {ROWS.length}
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
              {filtered.map((r) => {
                const atRisk = r.rate < 85;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{r.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {r.id} · {r.className}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Meter
                        value={r.rate}
                        tone={rateTone(r.rate)}
                        valueLabel={`${r.rate}%`}
                        className="min-w-[8rem]"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {r.absences}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {r.lates}
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
