/* ============================================================
   /transport/routes — routes view (server component)

   Folds transport assignments into one row per route (riders,
   vehicles, stops, pickup window, per-status breakdown). Data comes
   from the NestJS GET /transport/routes aggregation.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { DataCard } from '../../_shared/data-card';

interface Route {
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

function window(first: string | null, last: string | null): string {
  if (!first && !last) return '—';
  if (first && last && first !== last) return `${first}–${last}`;
  return first ?? last ?? '—';
}

export default async function TransportRoutesPage() {
  const routes = (await serverApiGet<Route[]>('/transport/routes')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Routes"
          description="Each bus route with its riders, vehicles, stops, and pickup window."
        />
        <DataCard title="Routes" count={routes.length} unit="route">
          {routes.length === 0 ? (
            <EmptyState
              compact
              title="No routes yet"
              description="Routes appear here once students are assigned to a named route."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Route</TableHead>
                  <TableHead className="text-right">Riders</TableHead>
                  <TableHead>Vehicles</TableHead>
                  <TableHead>Stops</TableHead>
                  <TableHead>Pickup window</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => (
                  <TableRow key={r.routeName}>
                    <TableCell className="pl-6 font-medium">{r.routeName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.studentCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.vehicles.length ? r.vehicles.join(', ') : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.stops.length}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {window(r.firstPickup, r.lastPickup)}
                    </TableCell>
                    <TableCell className="pr-6">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataCard>
      </div>
    </ShellMain>
  );
}
