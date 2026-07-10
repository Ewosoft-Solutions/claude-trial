/* ============================================================
   /events/[id]/roster — event attendee roster (server component)

   The per-attendee roster for one event. Data comes from the NestJS
   GET /events/:id/attendees view (event + attendees).
   ============================================================ */

import { notFound } from 'next/navigation';
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
import { DataCard } from '../../../_shared/data-card';

interface Attendee {
  id: string;
  attendeeName: string;
  attendeeType: string;
  email: string | null;
  status: string;
}

interface RosterResponse {
  event: {
    id: string;
    title: string;
    startDate: string;
    capacity: number | null;
    registeredCount: number;
    status: string;
  };
  attendees: Attendee[];
}

const STATUS_TONE: Record<string, StateTone> = {
  registered: 'info',
  attended: 'success',
  waitlist: 'warning',
  cancelled: 'neutral',
};

export default async function EventRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serverApiGet<RosterResponse>(
    `/events/${encodeURIComponent(id)}/attendees`,
  );
  if (!data) notFound();

  const { event, attendees } = data;
  const capacityLabel = event.capacity
    ? `${event.registeredCount} / ${event.capacity} registered`
    : `${event.registeredCount} registered`;

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={`${event.title} — roster`}
          description={capacityLabel}
        />
        <DataCard title="Attendees" count={attendees.length} unit="attendee">
          {attendees.length === 0 ? (
            <EmptyState
              compact
              title="No attendees yet"
              description="People added to this event's roster appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead className="max-sm:hidden">Type</TableHead>
                  <TableHead className="max-md:hidden">Email</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-medium">{a.attendeeName}</TableCell>
                    <TableCell className="capitalize text-muted-foreground max-sm:hidden">
                      {a.attendeeType}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {a.email ?? '—'}
                    </TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge tone={STATUS_TONE[a.status] ?? 'neutral'} dot>
                        {a.status}
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
