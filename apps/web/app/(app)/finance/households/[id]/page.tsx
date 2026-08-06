/* ============================================================
   /finance/households/[id] — household detail (server component)

   Manage a family account: its temporal members (students) and payers
   (guardians), plus a merge tool. Loads the household, the student roster for
   the add-member picker, and the other households for the merge picker.
   `canManage` gates the controls; the API enforces finance.manage.
   ============================================================ */

import { notFound } from 'next/navigation';

import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import {
  HouseholdDetailClient,
  type ApiHouseholdDetail,
  type StudentOption,
  type HouseholdOption,
} from './household-detail-client';

interface ApiStudent {
  id: string;
  studentNumber?: string | null;
  userTenant?: {
    user?: { firstName?: string | null; lastName?: string | null } | null;
  } | null;
}
interface StudentListResponse {
  data?: ApiStudent[];
}
interface ApiHouseholdListItem {
  id: string;
  name: string;
}

function studentName(s: ApiStudent): string {
  const u = s.userTenant?.user;
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
  return name || s.studentNumber || s.id;
}

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [household, rosterData, allHouseholds, session] = await Promise.all([
    serverApiGet<ApiHouseholdDetail>(`/finance/households/${id}`),
    serverApiGet<StudentListResponse | ApiStudent[]>('/students/roster'),
    serverApiGet<ApiHouseholdListItem[]>('/finance/households'),
    getSession(),
  ]);

  if (!household) notFound();

  const roster = Array.isArray(rosterData)
    ? rosterData
    : (rosterData?.data ?? []);
  const students: StudentOption[] = roster.map((s) => ({
    id: s.id,
    name: studentName(s),
    studentNumber: s.studentNumber ?? undefined,
  }));

  const otherHouseholds: HouseholdOption[] = (allHouseholds ?? [])
    .filter((h) => h.id !== id)
    .map((h) => ({ id: h.id, name: h.name }));

  const canManage =
    session?.permissions.includes('finance.manage' as never) ?? false;

  return (
    <HouseholdDetailClient
      household={household}
      students={students}
      otherHouseholds={otherHouseholds}
      canManage={canManage}
    />
  );
}
