/* ============================================================
   /events/[id]/roster — event attendee roster (server component)

   The per-attendee roster for one event. Data comes from the NestJS
   GET /events/:id/attendees view; search / filters / sort / paging run
   client-side in RosterClient.
   ============================================================ */

import { notFound } from 'next/navigation';

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { RosterClient, type Attendee } from './roster-client';

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
        <RosterClient attendees={attendees} />
      </div>
    </ShellMain>
  );
}
