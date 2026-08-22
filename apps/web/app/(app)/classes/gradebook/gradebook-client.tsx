'use client';

/* ============================================================
   GradebookClient — recorded grades (client-side DirectoryTable)

   The page assembles every grade it can see server-side (one call per
   assessment), so search / class + grade filters / sort / paging all run
   in-memory here, the same way the event roster does.

   It replaces a hand-rolled `<Table>` that rendered every row at once: no
   pager, no page size, and nothing to stop a busy term from printing a
   thousand rows into the page.
   ============================================================ */

import * as React from 'react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface GradeRow {
  id: string;
  student: string;
  studentNumber: string;
  assessment: string;
  className: string;
  points: number | null;
  maxPoints: number | null;
  percentage: number | null;
  letter: string;
  tone: StateTone;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function GradebookClient({
  rows,
  assessmentCount,
}: {
  rows: GradeRow[];
  assessmentCount: number;
}) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  // Any narrowing puts the reader on a different set of results, so page 4 of
  // the old set is meaningless.
  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const classes = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.className))).sort(),
    [rows],
  );
  const letters = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.letter))).sort(),
    [rows],
  );

  const columns: DirectoryColumn<GradeRow>[] = [
    {
      id: 'student',
      header: 'Student',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-[calc(11px*var(--font-scale))] font-semibold">
              {initials(r.student)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {r.student}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {r.studentNumber}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'assessment',
      header: 'Assessment',
      sortable: true,
      truncate: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.assessment}</span>
      ),
    },
    {
      id: 'className',
      header: 'Class',
      truncate: true,
      cell: (r) => <span className="text-muted-foreground">{r.className}</span>,
    },
    {
      id: 'score',
      header: 'Score',
      align: 'end',
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.points !== null && r.maxPoints !== null
            ? `${r.points}/${r.maxPoints}`
            : 'Pending'}
        </span>
      ),
    },
    {
      id: 'percentage',
      header: 'Percent',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.percentage !== null ? `${Math.round(r.percentage)}%` : 'Pending'}
        </span>
      ),
    },
    {
      id: 'letter',
      header: 'Grade',
      align: 'end',
      cell: (r) => <StatusBadge tone={r.tone}>{r.letter}</StatusBadge>,
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const className = filters.className;
    const letter = filters.letter;
    let out = rows.filter((r) => {
      const matchesQ =
        !q ||
        r.student.toLowerCase().includes(q) ||
        r.studentNumber.toLowerCase().includes(q) ||
        r.assessment.toLowerCase().includes(q);
      return (
        matchesQ &&
        (!className || r.className === className) &&
        (!letter || r.letter === letter)
      );
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) => {
        if (sort.field === 'percentage') {
          // Ungraded rows sort last either way — a missing score is not a zero.
          if (a.percentage === null) return 1;
          if (b.percentage === null) return -1;
          return dir * (a.percentage - b.percentage);
        }
        if (sort.field === 'assessment')
          return dir * a.assessment.localeCompare(b.assessment);
        return dir * a.student.localeCompare(b.student);
      });
    }
    return out;
  }, [rows, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<GradeRow>
      title="Recorded grades"
      description={`${filtered.length} ${filtered.length === 1 ? 'grade' : 'grades'} across ${assessmentCount} assessments`}
      columns={columns}
      rows={pageRows}
      getRowId={(r) => r.id}
      getRowLabel={(r) => `${r.student} — ${r.assessment}`}
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
      caption="Recorded grades"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search student or assessment…',
        label: 'Search grades',
        id: 'gradebook-search',
      }}
      filters={[
        ...(classes.length > 0
          ? [
              {
                key: 'className',
                label: 'Class',
                options: classes.map((c) => ({ value: c, label: c })),
              },
            ]
          : []),
        ...(letters.length > 0
          ? [
              {
                key: 'letter',
                label: 'Grade',
                options: letters.map((l) => ({ value: l, label: l })),
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
          title={hasQuery ? 'No grades match' : 'No grades recorded yet'}
          description={
            hasQuery
              ? 'Try a different search, or clear the filters.'
              : 'Grades entered for assessments will appear here.'
          }
        />
      }
    />
  );
}
