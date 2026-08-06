'use client';

/* ============================================================
   UpcomingClient — school events (server-driven table)

   Search / status filter / sort / paging live in the URL and run at the DB
   via `useDirectoryState` + `DirectoryTable`; no in-memory filtering of the
   fetched page. Stat tiles come from the whole-set summary from the server.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { CalendarPlus, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export type EventStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface EventRow {
  id: string;
  title: string;
  eventType: string | null;
  location: string | null;
  startDate: string;
  status: EventStatus;
  registeredCount: number;
  capacity: number | null;
}

export interface EventStats {
  total: number;
  scheduled: number;
  completed: number;
  registrations: number;
}

const STATUS_META: Record<EventStatus, { label: string; tone: StateTone }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  ongoing: { label: 'Ongoing', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'destructive' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
];

interface Props {
  events: EventRow[];
  total: number;
  defaultPageSize: number;
  stats: EventStats;
}

export function UpcomingClient({
  events,
  total,
  defaultPageSize,
  stats,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const defaults = React.useMemo(
    () => ({ pageSize: defaultPageSize }),
    [defaultPageSize],
  );
  const { state, setPage, setPageSize, toggleSort, setQuery, setFilter } =
    useDirectoryState({
      searchParams: searchParams.toString(),
      onChange,
      defaults,
    });

  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const statusFilter = state.filters.status ?? 'all';
  const hasFilters = state.q.trim() !== '' || statusFilter !== 'all';

  const statItems: StatItem[] = [
    { key: 'total', label: 'Events', value: String(stats.total) },
    { key: 'scheduled', label: 'Scheduled', value: String(stats.scheduled) },
    { key: 'completed', label: 'Completed', value: String(stats.completed) },
    {
      key: 'registrations',
      label: 'Total registrations',
      value: String(stats.registrations),
    },
  ];

  const columns: DirectoryColumn<EventRow>[] = [
    {
      id: 'title',
      header: 'Event',
      sortable: true,
      cell: (e) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {e.title}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {e.eventType ?? '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      hideable: true,
      cell: (e) => (
        <span className="text-muted-foreground">{e.location ?? '—'}</span>
      ),
    },
    {
      id: 'startDate',
      header: 'Date',
      sortable: true,
      cell: (e) => <span className="text-muted-foreground">{e.startDate}</span>,
    },
    {
      id: 'registeredCount',
      header: 'Registered',
      align: 'end',
      sortable: true,
      cell: (e) => (
        <span className="tabular-nums text-muted-foreground">
          {e.registeredCount}
          {e.capacity ? ` / ${e.capacity}` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (e) => {
        const meta = STATUS_META[e.status];
        return (
          <StatusBadge tone={meta.tone} dot>
            {meta.label}
          </StatusBadge>
        );
      },
    },
    {
      id: 'roster',
      header: 'Roster',
      align: 'end',
      hideable: true,
      cell: (e) => (
        <Link
          href={`/events/${e.id}/roster`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Events"
          meta={META}
          actions={
            <Button size="sm">
              <CalendarPlus /> New event
            </Button>
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<EventRow>
          columns={columns}
          rows={events}
          getRowId={(e) => e.id}
          getRowLabel={(e) => e.title}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Upcoming & past events"
          description={`${total} ${total === 1 ? 'event' : 'events'}`}
          caption="School events"
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="event-search" className="sr-only">
                  Search events
                </Label>
                <Input
                  id="event-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search title…"
                  className="pl-8"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setFilter('status', v === 'all' ? null : v)
                }
              >
                <SelectTrigger
                  className="w-[10rem]"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters ? 'No events match your filters' : 'No events yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or create an event.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
