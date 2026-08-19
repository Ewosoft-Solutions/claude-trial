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
  type AccountStanding,
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

/** What the family owes right now, and what it has paid ahead (WB5-3/5-4). */
interface OutstandingResponse {
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    studentName?: string | null;
    dueDate?: string | null;
    financials?: { balance?: number };
  }>;
  totalOutstanding?: number;
  availableCredit?: number;
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

  const [household, rosterData, allHouseholds, standing, session] =
    await Promise.all([
      serverApiGet<ApiHouseholdDetail>(`/finance/households/${id}`),
      serverApiGet<StudentListResponse | ApiStudent[]>('/students/roster'),
      serverApiGet<ApiHouseholdListItem[]>('/finance/households'),
      serverApiGet<OutstandingResponse>(
        `/finance/households/${id}/outstanding`,
      ),
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

  // `serverApiGet` yields null on 401/403/404 — rendering that as "₦0.00
  // outstanding, nothing owed" states something false about a family's debt, so
  // the card is told the read failed and says so instead.
  const accountStanding: AccountStanding = {
    unavailable: standing == null,
    outstanding: standing?.totalOutstanding ?? 0,
    credit: standing?.availableCredit ?? 0,
    invoices: (standing?.invoices ?? []).map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentName: invoice.studentName ?? undefined,
      dueDate: invoice.dueDate ?? undefined,
      balance: invoice.financials?.balance ?? 0,
    })),
  };

  return (
    <HouseholdDetailClient
      household={household}
      students={students}
      otherHouseholds={otherHouseholds}
      standing={accountStanding}
      canManage={canManage}
    />
  );
}
