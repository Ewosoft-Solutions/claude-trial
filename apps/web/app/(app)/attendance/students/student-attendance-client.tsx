'use client';

/* ============================================================
   StudentAttendanceClient — per-student attendance (client-side DirectoryTable)

   Receives the full roster, so search / status + class filters / sort / paging
   run in-memory. Both filters collapse into the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';
import { Download } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { Meter, type MeterTone } from '@workspace/ui/custom/data-display/meter';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

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
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const classes = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.className))).sort(),
    [rows],
  );

  const columns: DirectoryColumn<AttendanceRow>[] = [
    {
      id: 'name',
      header: 'Student',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-[calc(11px*var(--font-scale))] font-semibold">
              {initials(r.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {r.name}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {r.id} · {r.className}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'rate',
      header: 'Present rate',
      sortable: true,
      cell: (r) => (
        <Meter
          value={r.rate}
          tone={rateTone(r.rate)}
          valueLabel={`${r.rate}%`}
          className="min-w-[8rem]"
        />
      ),
    },
    {
      id: 'absences',
      header: 'Absences',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">{r.absences}</span>
      ),
    },
    {
      id: 'lates',
      header: 'Lates',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">{r.lates}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => {
        const atRisk = r.rate < 85;
        return (
          <StatusBadge tone={atRisk ? 'warning' : 'success'} dot>
            {atRisk ? 'At risk' : 'On track'}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const className = filters.class;
    let out = rows.filter((r) => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      const atRisk = r.rate < 85;
      const matchesStatus = !status || (status === 'risk' ? atRisk : !atRisk);
      const matchesClass = !className || r.className === className;
      return matchesQ && matchesStatus && matchesClass;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'rate'
          ? dir * (a.rate - b.rate)
          : sort.field === 'absences'
            ? dir * (a.absences - b.absences)
            : sort.field === 'lates'
              ? dir * (a.lates - b.lates)
              : sort.field === 'status'
                ? dir * (Number(a.rate < 85) - Number(b.rate < 85))
                : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [rows, term, filters, sort]);

  const sessions = rows.reduce((max, row) => Math.max(max, row.sessions), 0);
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live attendance', emphasis: true },
    { key: 'sessions', label: `${sessions} sessions` },
  ];

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

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

        <DirectoryTable<AttendanceRow>
          title="By student"
          description={`${filtered.length} of ${rows.length} students`}
          columns={columns}
          rows={pageRows}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={sort}
          onSortChange={(field) =>
            setSort((cur) =>
              cur?.field !== field
                ? { field, dir: 'asc' }
                : cur.dir === 'asc'
                  ? { field, dir: 'desc' }
                  : null,
            )
          }
          caption="Per-student attendance"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search name or ID',
            label: 'Search students',
            id: 'att-search',
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'good', label: 'On track' },
                { value: 'risk', label: 'At risk' },
              ],
            },
            ...(classes.length > 0
              ? [
                  {
                    key: 'class',
                    label: 'Class',
                    options: classes.map((c) => ({ value: c, label: c })),
                  },
                ]
              : []),
          ]}
          filterValues={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasQuery
                  ? 'No students match your filters'
                  : 'No attendance records yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters.'
                  : 'Attendance marked in the daily register will appear here.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
