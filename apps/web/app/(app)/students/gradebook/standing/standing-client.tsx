'use client';

/* ============================================================
   StandingClient — live gradebook standing (client-side DirectoryTable)

   The single live view of where each student stands, merged from the former
   Report cards + Gradebook standing pages (they read the same two endpoints and
   averaged the same numbers). Letter grade came from Report cards; GPA and the
   standing band from Gradebook standing.

   NOT the transcript of record — that is assembled from published result
   snapshots at /academics/transcripts. These figures move as teachers mark.

   The server computes the per-student summaries and passes them in full, so
   search / standing + class filters / sort / paging run in-memory. Both filters
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

export type Standing = 'honors' | 'good' | 'watch';

export interface StandingRow {
  key: string;
  id: string;
  name: string;
  className: string;
  average: number;
  gpa: number;
  records: number;
  standing: Standing;
}

/** Letter grade from the average — carried over from the Report cards view. */
function letterGrade(average: number): { letter: string; tone: StateTone } {
  if (average >= 70) return { letter: 'A', tone: 'success' };
  if (average >= 60) return { letter: 'B', tone: 'success' };
  if (average >= 50) return { letter: 'C', tone: 'info' };
  if (average >= 40) return { letter: 'D', tone: 'warning' };
  return { letter: 'F', tone: 'destructive' };
}

const STANDING_META: Record<Standing, { label: string; tone: StateTone }> = {
  honors: { label: 'Honors', tone: 'success' },
  good: { label: 'Good standing', tone: 'info' },
  watch: { label: 'Needs review', tone: 'warning' },
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function StandingClient({ rows }: { rows: StandingRow[] }) {
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

  const columns: DirectoryColumn<StandingRow>[] = [
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
              {r.id} · {r.records} grades
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
      cell: (r) => {
        const g = letterGrade(r.average);
        return <StatusBadge tone={g.tone}>{g.letter}</StatusBadge>;
      },
    },
    {
      id: 'gpa',
      header: 'GPA',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.gpa.toFixed(2)}
        </span>
      ),
    },
    {
      id: 'standing',
      header: 'Standing',
      sortable: true,
      cell: (r) => {
        const standing = STANDING_META[r.standing];
        return (
          <StatusBadge tone={standing.tone} dot>
            {standing.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const standing = filters.standing;
    const className = filters.class;
    let out = rows.filter((r) => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      const matchesStanding = !standing || r.standing === standing;
      const matchesClass = !className || r.className === className;
      return matchesQ && matchesStanding && matchesClass;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'average'
          ? dir * (a.average - b.average)
          : sort.field === 'gpa'
            ? dir * (a.gpa - b.gpa)
            : sort.field === 'standing'
              ? dir * a.standing.localeCompare(b.standing)
              : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [rows, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<StandingRow>
      title="Cumulative grade summaries"
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
      caption="Cumulative grade summaries"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search name or ID',
        label: 'Search students',
        id: 'transcripts-search',
      }}
      filters={[
        {
          key: 'standing',
          label: 'Standing',
          options: (Object.keys(STANDING_META) as Standing[]).map((k) => ({
            value: k,
            label: STANDING_META[k].label,
          })),
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
              : 'No transcript summaries yet'
          }
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Recorded grades are required before transcript summaries can be computed.'
          }
        />
      }
    />
  );
}
