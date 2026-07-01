/* ============================================================
   /students/transport — route assignments (server component)

   Fetches assignments from the NestJS backend (server-side,
   cookie-authenticated) and passes them to TransportClient. Falls
   back to built-in mock data when NEXT_PUBLIC_API_URL is not set
   (dev mode).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { TransportClient, type Rider, type Status } from './transport-client';

interface ApiAssignment {
  id: string;
  routeName: string | null;
  stop: string | null;
  pickupTime: string | null;
  status: Status;
  student: {
    studentNumber: string;
    userTenant: { user: { firstName: string; lastName: string } };
  };
}

export default async function TransportPage() {
  const data = await serverApiGet<ApiAssignment[] | { data?: ApiAssignment[] }>(
    '/transport/assignments',
  );

  const raw: ApiAssignment[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiAssignment[] } | null)?.data ?? [];

  const riders: Rider[] = raw.map((a) => ({
    id: a.student.studentNumber,
    name: `${a.student.userTenant.user.firstName} ${a.student.userTenant.user.lastName}`,
    route: a.routeName,
    stop: a.stop,
    pickup: a.pickupTime,
    status: a.status,
  }));

  return <TransportClient riders={riders} />;
}
