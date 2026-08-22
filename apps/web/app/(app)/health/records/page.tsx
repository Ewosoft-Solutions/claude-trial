/* ============================================================
   /health/records — student health records (server component)

   Server-driven list: search / status filter / sort / paging run at the DB
   (via the URL → the paginated `/health/records` endpoint). Stat tiles come
   from the whole-set `/health/records/summary`, so they stay accurate on any
   page.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import {
  RecordsClient,
  type HealthRecordRow,
  type HealthStats,
  type HealthStatus,
} from './records-client';

interface ApiRecord {
  id: string;
  bloodType: string | null;
  allergies: string | null;
  status: HealthStatus;
  lastCheckup: string | null;
  student: {
    userTenant: { user: { firstName: string; lastName: string } };
  };
}

interface RecordsResponse {
  data: ApiRecord[];
  pagination: { total: number };
}

interface HealthSummary {
  totalRecords: number;
  statusCounts: Record<string, number>;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { status: 'status' },
  });

  const [list, summary] = await Promise.all([
    serverApiGet<RecordsResponse>(`/health/records?${params.toString()}`),
    serverApiGet<HealthSummary>('/health/records/summary'),
  ]);

  const raw = list?.data ?? [];
  const records: HealthRecordRow[] = raw.map((r) => ({
    id: r.id,
    name: `${r.student.userTenant.user.firstName} ${r.student.userTenant.user.lastName}`,
    bloodType: r.bloodType,
    allergies: r.allergies,
    status: r.status,
    lastCheckup: formatDate(r.lastCheckup),
  }));

  const counts = summary?.statusCounts ?? {};
  const stats: HealthStats = {
    total: summary?.totalRecords ?? 0,
    normal: counts.normal ?? 0,
    monitoring: counts.monitoring ?? 0,
    urgent: counts.urgent ?? 0,
  };

  return (
    <RecordsClient
      records={records}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      stats={stats}
    />
  );
}
