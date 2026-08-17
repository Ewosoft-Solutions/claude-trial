'use client';

/* ============================================================
   SubjectsClient — subject catalogue (client-side DirectoryTable)

   Receives the full catalogue, so search / level + category + status filters /
   sort / paging run in-memory. All filters collapse into the Pattern-B Filters
   button.
   ============================================================ */

import * as React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export type SubjectLevel = 'junior' | 'senior' | 'all';
export type SubjectStatus = 'active' | 'draft' | 'archived';

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: string;
  classes: number;
  periods: number;
  level: SubjectLevel;
  status: SubjectStatus;
}

interface Props {
  subjects: Subject[];
}

const STATUS_META: Record<SubjectStatus, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  draft: { label: 'Draft', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

function levelMatches(subject: Subject, level: string): boolean {
  return level === 'all' || subject.level === level || subject.level === 'all';
}

export function SubjectsClient({ subjects }: Props) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const categories = React.useMemo(
    () => Array.from(new Set(subjects.map((s) => s.category))).sort(),
    [subjects],
  );

  const columns: DirectoryColumn<Subject>[] = [
    {
      id: 'name',
      header: 'Subject',
      sortable: true,
      cell: (s) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {s.name}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {s.code}
          </span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideable: true,
      cell: (s) => <span className="text-muted-foreground">{s.category}</span>,
    },
    {
      id: 'classes',
      header: 'Classes',
      align: 'end',
      sortable: true,
      cell: (s) => (
        <span className="tabular-nums text-muted-foreground">{s.classes}</span>
      ),
    },
    {
      id: 'periods',
      header: 'Periods/wk',
      align: 'end',
      sortable: true,
      cell: (s) => (
        <span className="tabular-nums text-muted-foreground">{s.periods}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (s) => {
        const status = STATUS_META[s.status];
        return (
          <StatusBadge tone={status.tone} dot={s.status === 'active'}>
            {status.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const level = filters.level;
    const category = filters.category;
    const status = filters.status;
    let out = subjects.filter((s) => {
      const matchesQ =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q);
      const matchesLevel = !level || levelMatches(s, level);
      const matchesCategory = !category || s.category === category;
      const matchesStatus = !status || s.status === status;
      return matchesQ && matchesLevel && matchesCategory && matchesStatus;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'classes'
          ? dir * (a.classes - b.classes)
          : sort.field === 'periods'
            ? dir * (a.periods - b.periods)
            : sort.field === 'status'
              ? dir * a.status.localeCompare(b.status)
              : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [subjects, term, filters, sort]);

  const activeCount = subjects.filter((s) => s.status === 'active').length;
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live courses', emphasis: true },
    { key: 'count', label: `${activeCount} active subjects` },
  ];

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Course catalogue"
          description="The teaching catalogue the gradebook, assessments and question bank are keyed on. Which subjects a CLASS actually offers is set in Academics → Academic structure, on the section itself."
          meta={meta}
          actions={
            <Button size="sm">
              <Plus /> Add subject
            </Button>
          }
        />

        <DirectoryTable<Subject>
          title="Subject catalog"
          description={`${filtered.length} of ${subjects.length} subjects`}
          columns={columns}
          rows={pageRows}
          getRowId={(s) => s.id}
          getRowLabel={(s) => s.name}
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
          caption="Subject catalogue"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search subject, code, category',
            label: 'Search subjects',
            id: 'subject-search',
          }}
          filters={[
            {
              key: 'level',
              label: 'Level',
              options: [
                { value: 'junior', label: 'Junior' },
                { value: 'senior', label: 'Senior' },
              ],
            },
            ...(categories.length > 0
              ? [
                  {
                    key: 'category',
                    label: 'Category',
                    options: categories.map((c) => ({ value: c, label: c })),
                  },
                ]
              : []),
            {
              key: 'status',
              label: 'Status',
              options: (Object.keys(STATUS_META) as SubjectStatus[]).map(
                (k) => ({ value: k, label: STATUS_META[k].label }),
              ),
            },
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
                hasQuery ? 'No subjects match your filters' : 'No subjects yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters to see the full catalog.'
                  : 'Create courses for this tenant and they will appear in the catalog.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
