/* ============================================================
   /transport/pickups — pickup schedule (server component)

   Every assignment that carries a pickup time or a stop, ordered by
   time. Data comes from the NestJS GET /transport/pickups view.
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
import type { StateTone } from '@workspace/ui/types/states.types';
import { DataCard } from '../../_shared/data-card';

interface Pickup {
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

export default async function TransportPickupsPage() {
  const pickups = (await serverApiGet<Pickup[]>('/transport/pickups')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Pickups & drops"
          description="The pickup schedule — every rider with a stop or pickup time, ordered by time."
        />
        <DataCard title="Pickup schedule" count={pickups.length} unit="pickup">
          {pickups.length === 0 ? (
            <EmptyState
              compact
              title="No pickups scheduled"
              description="Pickups appear here once assignments carry a stop or pickup time."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Time</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickups.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6 tabular-nums font-medium">
                      {p.pickupTime ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words font-medium text-foreground">
                          {p.studentName}
                        </span>
                        <span className="break-words text-xs text-muted-foreground">
                          {p.studentNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.routeName ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.stop ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.vehicleLabel ?? '—'}
                    </TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge tone={STATUS_TONE[p.status] ?? 'neutral'} dot>
                        {p.status}
                      </StatusBadge>
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
