/* ============================================================
   /health/records — student health records (server component)

   Fetches records from the NestJS backend (server-side,
   cookie-authenticated) and passes them to RecordsClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { RecordsClient, type HealthRecordRow, type HealthStatus } from './records-client';

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return null;
  }
}

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

export default async function RecordsPage() {
  const data = await serverApiGet<ApiRecord[] | { data?: ApiRecord[] }>('/health/records');

  const raw: ApiRecord[] = Array.isArray(data) ? data : (data as { data?: ApiRecord[] } | null)?.data ?? [];

  const records: HealthRecordRow[] = raw.map((r) => ({
    id: r.id,
    name: `${r.student.userTenant.user.firstName} ${r.student.userTenant.user.lastName}`,
    bloodType: r.bloodType,
    allergies: r.allergies,
    status: r.status,
    lastCheckup: formatDate(r.lastCheckup),
  }));

  return <RecordsClient records={records} />;
}
