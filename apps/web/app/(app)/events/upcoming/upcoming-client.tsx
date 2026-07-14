'use client';

/* ============================================================
   UpcomingClient — upcoming school events interactive table

   Receives server-fetched events as props. M6 StatGrid (event summary) +
   DataTableLayout (toolbar + table + footer). Event status reads as a
   StatusBadge.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { CalendarPlus, Search } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
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

const STATUS_META: Record<EventStatus, { label: string; tone: StateTone }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  ongoing: { label: 'Ongoing', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'destructive' },
};

const META: PageHeaderMeta[] = [{ key: 'term', label: 'Spring Term 2025', emphasis: true }];

interface Props {
  events: EventRow[];
}

export function UpcomingClient({ events }: Props) {
  const EVENTS = events;
  const loading = false;

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return EVENTS.filter((e) => {
      const matchesQuery = !q || e.title.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [EVENTS, query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const stats: StatItem[] = React.useMemo(() => {
    const count = (fn: (e: EventRow) => boolean) => EVENTS.filter(fn).length;
    return [
      { key: 'total', label: 'Events', value: String(EVENTS.length) },
      { key: 'scheduled', label: 'Scheduled', value: String(count((e) => e.status === 'scheduled')) },
      { key: 'completed', label: 'Completed', value: String(count((e) => e.status === 'completed')) },
      { key: 'registrations', label: 'Total registrations', value: String(EVENTS.reduce((s, e) => s + e.registeredCount, 0)) },
    ];
  }, [EVENTS]);

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

        <StatGrid items={stats} />

        <DataTableLayout
          title="Upcoming & past events"
          description={
            loading ? 'Loading events…' : `${filtered.length} of ${EVENTS.length} events`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[10rem]" aria-label="Filter by status">
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
              title={hasFilters ? 'No events match your filters' : 'No events yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or create an event.'
              }
              primaryAction={
                hasFilters ? { label: 'Clear filters', onClick: resetFilters } : undefined
              }
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {EVENTS.length}
              </span>
              {hasFilters ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="max-md:hidden">Location</TableHead>
                <TableHead className="max-sm:hidden">Date</TableHead>
                <TableHead className="text-right max-sm:hidden">Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Roster</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const status = STATUS_META[e.status];
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">{e.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{e.eventType ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {e.location ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {e.startDate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {e.registeredCount}
                      {e.capacity ? ` / ${e.capacity}` : ''}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot>
                        {status.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/events/${e.id}/roster`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}
