'use client';

import * as React from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import {
  ASSESSMENT_STATUS_META,
  classLabel,
  formatDate,
  type AssessmentSummary,
} from '@/lib/academics';
import { Button } from '@workspace/ui/components/button';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export function AssessmentTakeListClient({
  initialAssessments,
  initialQuery = '',
}: {
  live?: boolean;
  initialAssessments: AssessmentSummary[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState(initialQuery);
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [filters, pageSize, initialAssessments]);

  // Server-side search: `initialAssessments` is already filtered at the DB, so
  // the box only needs to push its term into the URL and let the page refetch.
  // (Filtering in the client would only ever see the first page of results.)
  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  React.useEffect(() => {
    if (query === initialQuery) return;
    const timer = setTimeout(() => {
      const trimmed = query.trim();
      router.replace(
        trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname,
        { scroll: false },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query, initialQuery, pathname, router]);

  const assessments = initialAssessments;

  function openAssessment(id: string) {
    if (!id.trim()) return;
    router.push(`/classes/assessments/take/${encodeURIComponent(id.trim())}`);
  }

  const statuses = React.useMemo(
    () => Array.from(new Set(assessments.map((a) => a.status))),
    [assessments],
  );

  const filtered = React.useMemo(() => {
    const status = filters.status;
    let out = assessments.filter((a) => !status || a.status === status);
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'due'
          ? dir * String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? ''))
          : sort.field === 'status'
            ? dir * a.status.localeCompare(b.status)
            : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [assessments, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: DirectoryColumn<AssessmentSummary>[] = [
    {
      id: 'name',
      header: 'Assessment',
      sortable: true,
      cell: (a) => <span className="font-medium">{a.name}</span>,
    },
    {
      id: 'class',
      header: 'Class',
      hideable: true,
      cell: (a) => (
        <span className="text-muted-foreground">{classLabel(a.class)}</span>
      ),
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      hideable: true,
      cell: (a) => (
        <span className="text-muted-foreground">{formatDate(a.dueDate)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (a) => {
        const status =
          ASSESSMENT_STATUS_META[a.status] ??
          ({ label: 'Published', tone: 'success' } as const);
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
      },
    },
    {
      id: 'open',
      header: 'Open',
      align: 'end',
      cell: (a) => (
        <Button variant="ghost" size="sm" onClick={() => openAssessment(a.id)}>
          Open <ArrowRight />
        </Button>
      ),
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Take assessment"
          meta={[
            {
              key: 'available',
              label: `${initialAssessments.length} listed`,
              emphasis: true,
            },
          ]}
        />

        <DirectoryTable<AssessmentSummary>
          title="Published assessments"
          description={`${filtered.length} visible assessments`}
          columns={columns}
          rows={pageRows}
          getRowId={(a) => a.id}
          getRowLabel={(a) => a.name}
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
          caption="Published assessments"
          search={{
            value: query,
            onChange: setQuery,
            placeholder: 'Search assessments',
            label: 'Search assessments',
            id: 'assessment-take-search',
          }}
          filters={
            statuses.length > 1
              ? [
                  {
                    key: 'status',
                    label: 'Status',
                    options: statuses.map((s) => ({
                      value: s,
                      label: ASSESSMENT_STATUS_META[s]?.label ?? s,
                    })),
                  },
                ]
              : []
          }
          filterValues={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              icon={<ClipboardList aria-hidden />}
              title="No assessments listed"
              description="Use an assessment link or ID from your teacher."
            />
          }
        />
      </div>
    </ShellMain>
  );
}
