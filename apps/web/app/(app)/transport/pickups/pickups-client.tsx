'use client';

/* ============================================================
   PickupsClient — transport pickup schedule (client-side DirectoryTable)

   The /transport/pickups endpoint returns the full schedule, so search /
   status + route filters / sort / paging run in-memory here. Both filters
   collapse into the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';

import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface Pickup {
  id: string;
  studentName: string;
  studentNumber: string;
  routeName: string | null;
  stop: string | null;
  pickupTime: string | null;
  vehicleLabel: string | null;
  status: string;
}

const STATUS_TONE: Record<string, StateTone> = {
  assigned: 'success',
  waitlist: 'warning',
  unassigned: 'neutral',
};

export function PickupsClient({ pickups }: { pickups: Pickup[] }) {
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
        new Set(pickups.map((p) => p.routeName).filter(Boolean) as string[]),
      ).sort(),
    [pickups],
  );

  const columns: DirectoryColumn<Pickup>[] = [
    {
      id: 'pickupTime',
      header: 'Time',
      sortable: true,
      cell: (p) => (
        <span className="font-medium tabular-nums text-foreground">
          {p.pickupTime ?? '—'}
        </span>
      ),
    },
    {
      id: 'studentName',
      header: 'Student',
      sortable: true,
      cell: (p) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {p.studentName}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {p.studentNumber}
          </span>
        </div>
      ),
    },
    {
      id: 'routeName',
      header: 'Route',
      hideable: true,
      cell: (p) => (
        <span className="text-muted-foreground">{p.routeName ?? '—'}</span>
      ),
    },
    {
      id: 'stop',
      header: 'Stop',
      hideable: true,
      cell: (p) => (
        <span className="text-muted-foreground">{p.stop ?? '—'}</span>
      ),
    },
    {
      id: 'vehicleLabel',
      header: 'Vehicle',
      hideable: true,
      cell: (p) => (
        <span className="text-muted-foreground">{p.vehicleLabel ?? '—'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (p) => (
        <StatusBadge
          tone={STATUS_TONE[p.status] ?? 'neutral'}
          dot
          className="capitalize"
        >
          {p.status}
        </StatusBadge>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const route = filters.route;
    let out = pickups.filter((p) => {
      const matchesQ =
        !q ||
        p.studentName.toLowerCase().includes(q) ||
        p.studentNumber.toLowerCase().includes(q) ||
        (p.routeName?.toLowerCase().includes(q) ?? false) ||
        (p.stop?.toLowerCase().includes(q) ?? false);
      const matchesStatus = !status || p.status === status;
      const matchesRoute = !route || p.routeName === route;
      return matchesQ && matchesStatus && matchesRoute;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      const value = (p: Pickup): string => {
        if (sort.field === 'studentName') return p.studentName;
        if (sort.field === 'status') return p.status;
        return p.pickupTime ?? '';
      };
      out = [...out].sort((a, b) => dir * value(a).localeCompare(value(b)));
    }
    return out;
  }, [pickups, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<Pickup>
      title="Pickup schedule"
      description={`${filtered.length} ${filtered.length === 1 ? 'pickup' : 'pickups'}`}
      columns={columns}
      rows={pageRows}
      getRowId={(p) => p.id}
      getRowLabel={(p) => p.studentName}
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
      caption="Transport pickup schedule"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search student, route, stop…',
        label: 'Search pickups',
        id: 'pickups-search',
      }}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'assigned', label: 'Assigned' },
            { value: 'waitlist', label: 'Waitlist' },
            { value: 'unassigned', label: 'Unassigned' },
          ],
        },
        ...(routes.length > 0
          ? [
              {
                key: 'route',
                label: 'Route',
                options: routes.map((r) => ({ value: r, label: r })),
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
            hasQuery ? 'No pickups match your filters' : 'No pickups scheduled'
          }
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Pickups appear here once assignments carry a stop or pickup time.'
          }
        />
      }
    />
  );
}
