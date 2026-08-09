'use client';

/* ============================================================
   ReportCardsClient — term report summaries (client-side DirectoryTable)

   The server computes the per-student summaries and passes them in full, so
   search / grade + class filters / sort / paging run in-memory. Both filters
   collapse into the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface ReportRow {
  key: string;
  id: string;
  name: string;
  className: string;
  average: number;
  grade: string;
  tone: StateTone;
  records: number;
}

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F'];

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function ReportCardsClient({ rows }: { rows: ReportRow[] }) {
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
  const grades = React.useMemo(
    () => GRADE_ORDER.filter((g) => rows.some((r) => r.grade === g)),
    [rows],
  );

  const columns: DirectoryColumn<ReportRow>[] = [
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
              {r.id}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'className',
      header: 'Class',
      hideable: true,
      cell: (r) => <span className="text-muted-foreground">{r.className}</span>,
    },
    {
      id: 'average',
      header: 'Average',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="font-semibold tabular-nums text-foreground">
          {r.average}%
        </span>
      ),
    },
    {
      id: 'grade',
      header: 'Grade',
      align: 'end',
      sortable: true,
      cell: (r) => <StatusBadge tone={r.tone}>{r.grade}</StatusBadge>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusBadge tone="info" dot>
          {r.records} grades
        </StatusBadge>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const grade = filters.grade;
    const className = filters.class;
    let out = rows.filter((r) => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      const matchesGrade = !grade || r.grade === grade;
      const matchesClass = !className || r.className === className;
      return matchesQ && matchesGrade && matchesClass;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'average'
          ? dir * (a.average - b.average)
          : sort.field === 'grade'
            ? dir * a.grade.localeCompare(b.grade)
            : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [rows, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<ReportRow>
      title="Term report summaries"
      description={`${filtered.length} students with recorded grades`}
      columns={columns}
      rows={pageRows}
      getRowId={(r) => r.key}
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
      caption="Term report summaries"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search name or ID',
        label: 'Search students',
        id: 'report-cards-search',
      }}
      filters={[
        ...(grades.length > 1
          ? [
              {
                key: 'grade',
                label: 'Grade',
                options: grades.map((g) => ({ value: g, label: g })),
              },
            ]
          : []),
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
              : 'No report card summaries yet'
          }
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Recorded grades are required before report summaries can be computed.'
          }
        />
      }
    />
  );
}
