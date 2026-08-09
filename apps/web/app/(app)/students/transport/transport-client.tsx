'use client';

/* ============================================================
   TransportClient — route assignments (client-side DirectoryTable)

   Receives the full assignments list, so search / route + status filters /
   sort / paging run in-memory. Both filters collapse into the Pattern-B
   Filters button.
   ============================================================ */

import * as React from 'react';
import { Plus } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export type Status = 'assigned' | 'waitlist' | 'unassigned';

export interface Rider {
  id: string;
  name: string;
  route: string | null;
  stop: string | null;
  pickup: string | null;
  status: Status;
}

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  assigned: { label: 'Assigned', tone: 'success' },
  waitlist: { label: 'Waitlist', tone: 'warning' },
  unassigned: { label: 'Unassigned', tone: 'neutral' },
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

interface Props {
  riders: Rider[];
}

export function TransportClient({ riders }: Props) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const routes = React.useMemo(
    () =>
      Array.from(
        new Set(riders.map((r) => r.route).filter((r): r is string => !!r)),
      ).sort(),
    [riders],
  );

  const columns: DirectoryColumn<Rider>[] = [
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
      id: 'route',
      header: 'Route',
      hideable: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.route ?? '—'}</span>
      ),
    },
    {
      id: 'stop',
      header: 'Stop',
      hideable: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.stop ?? '—'}</span>
      ),
    },
    {
      id: 'pickup',
      header: 'Pickup',
      align: 'end',
      sortable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.pickup ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => {
        const status = STATUS_META[r.status];
        return (
          <StatusBadge tone={status.tone} dot={r.status !== 'unassigned'}>
            {status.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const route = filters.route;
    const status = filters.status;
    let out = riders.filter((r) => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      const matchesRoute = !route || r.route === route;
      const matchesStatus = !status || r.status === status;
      return matchesQ && matchesRoute && matchesStatus;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'pickup'
          ? dir * (a.pickup ?? '').localeCompare(b.pickup ?? '')
          : sort.field === 'status'
            ? dir * a.status.localeCompare(b.status)
            : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [riders, term, filters, sort]);

  const meta: PageHeaderMeta[] = [
    { key: 'term', label: 'Spring Term 2025', emphasis: true },
    {
      key: 'routes',
      label: `${routes.length} active route${routes.length === 1 ? '' : 's'}`,
    },
  ];

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Transport"
          meta={meta}
          actions={
            <Button size="sm">
              <Plus /> Assign student
            </Button>
          }
        />

        <DirectoryTable<Rider>
          title="Route assignments"
          description={`${filtered.length} of ${riders.length} students`}
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
          caption="Route assignments"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search name or ID…',
            label: 'Search students',
            id: 'transport-search',
          }}
          filters={[
            ...(routes.length > 0
              ? [
                  {
                    key: 'route',
                    label: 'Route',
                    options: routes.map((r) => ({ value: r, label: r })),
                  },
                ]
              : []),
            {
              key: 'status',
              label: 'Status',
              options: (Object.keys(STATUS_META) as Status[]).map((k) => ({
                value: k,
                label: STATUS_META[k].label,
              })),
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
                hasQuery
                  ? 'No students match your filters'
                  : 'No transport assignments yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or assign a student to a route.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
