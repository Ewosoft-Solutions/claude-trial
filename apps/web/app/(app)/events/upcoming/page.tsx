/* ============================================================
   /events/upcoming — events calendar (server component)

   Fetches events from the NestJS backend (server-side,
   cookie-authenticated) and passes them to UpcomingClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { UpcomingClient, type EventRow, type EventStatus } from './upcoming-client';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface ApiEvent {
  id: string;
  title: string;
  eventType: string | null;
  location: string | null;
  startDate: string;
  status: EventStatus;
  registeredCount: number;
  capacity: number | null;
}

export default async function UpcomingPage() {
  const data = await serverApiGet<ApiEvent[] | { data?: ApiEvent[] }>('/events');

  const raw: ApiEvent[] = Array.isArray(data) ? data : (data as { data?: ApiEvent[] } | null)?.data ?? [];

  const events: EventRow[] = raw.map((e) => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    location: e.location,
    startDate: formatDate(e.startDate),
    status: e.status,
    registeredCount: e.registeredCount,
    capacity: e.capacity,
  }));

  return <UpcomingClient events={events} />;
}
