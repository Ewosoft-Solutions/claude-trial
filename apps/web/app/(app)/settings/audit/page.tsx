/* ============================================================
   /settings/audit — school-wide audit log (server component)

   Server-driven list: search / event + status filters / paging all run at the
   DB (URL → the paginated GET /audit-logs endpoint). The page title +
   description come from the settings layout; the interactive table, export, and
   detail drawer live in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { AuditClient, type AuditRow } from './audit-client';

interface ApiAuditRow {
  id: string;
  eventType: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  status: string;
  timestamp: string;
}

interface AuditResponse {
  data: ApiAuditRow[];
  pagination: { total: number };
}

/** Fixed locale + timezone so the value is identical across SSR + hydration. */
function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function AuditSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { eventType: 'eventType', status: 'status', action: 'action' },
  });

  const list = await serverApiGet<AuditResponse>(
    `/audit-logs?${params.toString()}`,
  );

  const rows: AuditRow[] = (list?.data ?? []).map((r) => ({
    id: r.id,
    when: formatWhen(r.timestamp),
    actor: r.actorEmail ?? (r.actorId ? r.actorId.slice(0, 8) : 'System'),
    actorRole: r.actorRole,
    eventType: r.eventType,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    status: r.status,
  }));

  return (
    <AuditClient
      rows={rows}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
    />
  );
}
