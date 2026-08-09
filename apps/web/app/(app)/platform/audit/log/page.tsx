/* ============================================================
   /platform/audit/log — cross-tenant audit log (server component)

   Server-driven list: search / event-type filter / sort / paging all run at
   the DB (via the URL → the paginated, `@PlatformScoped` GET /platform/audit
   endpoint). Reading the audit trail is itself audited by the interceptor.
   This is the sanctioned cross-tenant audit path; the old clearance-9 branch
   on /audit-logs was removed.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import { AuditLogClient, type AuditRow } from './audit-log-client';

const DEFAULT_PAGE_SIZE = 50;

interface ApiAuditRow {
  id: string;
  tenantId: string | null;
  eventType: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  actorId: string | null;
  actorRole: string | null;
  description: string | null;
  timestamp: string;
  tenant: { id: string; name: string; slug: string } | null;
}

interface AuditResponse {
  data: ApiAuditRow[];
  pagination: { total: number };
}

/**
 * Format on the server with a fixed locale/timezone so the value is stable
 * across the SSR render and client hydration (a bare `toLocaleString()` in a
 * client cell would diverge between the two).
 */
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

export default async function PlatformAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { eventType: 'eventType' },
  });

  const list = await serverApiGet<AuditResponse>(
    `/platform/audit?${params.toString()}`,
  );

  const rows: AuditRow[] = (list?.data ?? []).map((r) => ({
    id: r.id,
    tenantName: r.tenant?.name ?? null,
    eventType: r.eventType,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    actorId: r.actorId,
    actorRole: r.actorRole,
    when: formatWhen(r.timestamp),
  }));

  return (
    <AuditLogClient
      rows={rows}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
    />
  );
}
