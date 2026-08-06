/* ============================================================
   /events/upcoming — events calendar (server component)

   Server-driven list: search / status filter / sort / paging run at the DB
   (via the URL → the paginated `/events` endpoint). Stat tiles come from the
   whole-set `/events/summary`, so they stay accurate on any page.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import {
  UpcomingClient,
  type EventRow,
  type EventStats,
  type EventStatus,
} from './upcoming-client';

const DEFAULT_PAGE_SIZE = 25;

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

interface EventsResponse {
  data: ApiEvent[];
  pagination: { total: number };
}

interface EventsSummary {
  totalEvents: number;
  statusCounts: Record<string, number>;
  totalRegistrations: number;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { status: 'status', type: 'eventType' },
  });

  const [list, summary] = await Promise.all([
    serverApiGet<EventsResponse>(`/events?${params.toString()}`),
    serverApiGet<EventsSummary>('/events/summary'),
  ]);

  const raw = list?.data ?? [];
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

  const counts = summary?.statusCounts ?? {};
  const stats: EventStats = {
    total: summary?.totalEvents ?? 0,
    scheduled: counts.scheduled ?? 0,
    completed: counts.completed ?? 0,
    registrations: summary?.totalRegistrations ?? 0,
  };

  return (
    <UpcomingClient
      events={events}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      stats={stats}
    />
  );
}
