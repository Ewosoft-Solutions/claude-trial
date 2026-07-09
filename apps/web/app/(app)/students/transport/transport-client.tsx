'use client';

/* ============================================================
   TransportClient — route assignments interactive table

   Receives server-fetched assignments as props. DataTableLayout
   (search + route filter, Skeleton/Empty). Assignment status reads as a
   StatusBadge.
   ============================================================ */

import * as React from 'react';
import { Plus, Search } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

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
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

interface Props {
  riders: Rider[];
}

export function TransportClient({ riders }: Props) {
  const RIDERS = riders;
  const loading = false;

  const [query, setQuery] = React.useState('');
  const [routeFilter, setRouteFilter] = React.useState('all');

  const routes = React.useMemo(
    () => Array.from(new Set(RIDERS.map((r) => r.route).filter((r): r is string => Boolean(r)))),
    [RIDERS],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return RIDERS.filter((r) => {
      const matchesQuery =
        !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
      const matchesRoute = routeFilter === 'all' || r.route === routeFilter;
      return matchesQuery && matchesRoute;
    });
  }, [RIDERS, query, routeFilter]);

  const hasFilters = query.trim() !== '' || routeFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setRouteFilter('all');
  }

  const META: PageHeaderMeta[] = [
    { key: 'term', label: 'Spring Term 2025', emphasis: true },
    { key: 'routes', label: `${routes.length} active route${routes.length === 1 ? '' : 's'}` },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Transport"
          meta={META}
          actions={
            <Button size="sm">
              <Plus /> Assign student
            </Button>
          }
        />

        <DataTableLayout
          title="Route assignments"
          description={
            loading
              ? 'Loading riders…'
              : `${filtered.length} of ${RIDERS.length} students`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative w-full sm:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="transport-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="transport-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or ID…"
                  className="pl-8"
                />
              </div>
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="w-[11rem]" aria-label="Filter by route">
                  <SelectValue placeholder="Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All routes</SelectItem>
                  {routes.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No students match your filters' : 'No transport assignments yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or assign a student to a route.'
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
                {RIDERS.length}
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
                <TableHead>Student</TableHead>
                <TableHead className="max-md:hidden">Route</TableHead>
                <TableHead className="max-sm:hidden">Stop</TableHead>
                <TableHead className="text-right max-sm:hidden">Pickup</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const status = STATUS_META[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{r.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{r.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {r.route ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {r.stop ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {r.pickup ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={r.status !== 'unassigned'}>
                        {status.label}
                      </StatusBadge>
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
