'use client';

/* ============================================================
   RoutesClient — transport routes (client-side DirectoryTable)

   One row per route (riders, vehicles, stops, pickup window, coverage
   breakdown). The /transport/routes endpoint returns the full set, so
   search / coverage + vehicle filters / sort / paging run in-memory. Both
   filters collapse into the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';

import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface Route {
  routeName: string;
  studentCount: number;
  vehicles: string[];
  stops: string[];
  firstPickup: string | null;
  lastPickup: string | null;
  assigned: number;
  waitlist: number;
  unassigned: number;
}

function pickupWindow(first: string | null, last: string | null): string {
  if (!first && !last) return '—';
  if (first && last && first !== last) return `${first}–${last}`;
  return first ?? last ?? '—';
}

export function RoutesClient({ routes }: { routes: Route[] }) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const vehicles = React.useMemo(
    () => Array.from(new Set(routes.flatMap((r) => r.vehicles))).sort(),
    [routes],
  );

  const columns: DirectoryColumn<Route>[] = [
    {
      id: 'routeName',
      header: 'Route',
      sortable: true,
      cell: (r) => (
        <span className="font-medium text-foreground">{r.routeName}</span>
      ),
    },
    {
      id: 'studentCount',
      header: 'Riders',
      align: 'end',
      sortable: true,
      cell: (r) => <span className="tabular-nums">{r.studentCount}</span>,
    },
    {
      id: 'vehicles',
      header: 'Vehicles',
      hideable: true,
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.vehicles.length ? r.vehicles.join(', ') : '—'}
        </span>
      ),
    },
    {
      id: 'stops',
      header: 'Stops',
      align: 'end',
      hideable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.stops.length}
        </span>
      ),
    },
    {
      id: 'window',
      header: 'Pickup window',
      hideable: true,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {pickupWindow(r.firstPickup, r.lastPickup)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="flex flex-wrap gap-1.5">
          {r.assigned > 0 ? (
            <StatusBadge tone="success">{r.assigned} assigned</StatusBadge>
          ) : null}
          {r.waitlist > 0 ? (
            <StatusBadge tone="warning">{r.waitlist} waitlist</StatusBadge>
          ) : null}
          {r.unassigned > 0 ? (
            <StatusBadge tone="neutral">{r.unassigned} unassigned</StatusBadge>
          ) : null}
        </div>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const coverage = filters.coverage;
    const vehicle = filters.vehicle;
    let out = routes.filter((r) => {
      const matchesQ = !q || r.routeName.toLowerCase().includes(q);
      const matchesCoverage =
        !coverage ||
        (coverage === 'assigned'
          ? r.waitlist === 0 && r.unassigned === 0
          : coverage === 'waitlist'
            ? r.waitlist > 0
            : coverage === 'unassigned'
              ? r.unassigned > 0
              : true);
      const matchesVehicle = !vehicle || r.vehicles.includes(vehicle);
      return matchesQ && matchesCoverage && matchesVehicle;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'studentCount'
          ? dir * (a.studentCount - b.studentCount)
          : dir * a.routeName.localeCompare(b.routeName),
      );
    }
    return out;
  }, [routes, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<Route>
      title="Routes"
      description={`${filtered.length} ${filtered.length === 1 ? 'route' : 'routes'}`}
      columns={columns}
      rows={pageRows}
      getRowId={(r) => r.routeName}
      getRowLabel={(r) => r.routeName}
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
      caption="Transport routes"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search route…',
        label: 'Search routes',
        id: 'routes-search',
      }}
      filters={[
        {
          key: 'coverage',
          label: 'Coverage',
          options: [
            { value: 'assigned', label: 'Fully assigned' },
            { value: 'waitlist', label: 'Has waitlist' },
            { value: 'unassigned', label: 'Has unassigned' },
          ],
        },
        ...(vehicles.length > 0
          ? [
              {
                key: 'vehicle',
                label: 'Vehicle',
                options: vehicles.map((v) => ({ value: v, label: v })),
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
          title={hasQuery ? 'No routes match your filters' : 'No routes yet'}
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Routes appear here once students are assigned to a named route.'
          }
        />
      }
    />
  );
}
