import { serverApiGet } from '@/lib/server-api';
import { StudentFeesClient, type FeeRow } from './student-fees-client';

type Paginated<T> = { data?: T[] };

interface ApiStudent {
  id: string;
  studentNumber?: string | null;
  userTenant?: {
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
  } | null;
  enrollments?: Array<{
    status?: string | null;
    class?: {
      name?: string | null;
      section?: string | null;
      course?: { name?: string | null } | null;
    } | null;
  }>;
}

interface ApiInvoice {
  studentId: string;
  amountDue?: number | null;
  amountPaid?: number | null;
}

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function studentName(student: ApiStudent | undefined): string {
  const user = student?.userTenant?.user;
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Unknown student';
}

function studentClass(student: ApiStudent | undefined): string {
  const enrollment =
    student?.enrollments?.find((item) => item.status === 'active') ??
    student?.enrollments?.[0];
  const cls = enrollment?.class;
  if (!cls) return 'Unassigned';
  return cls.name ?? `${cls.course?.name ?? 'Class'} ${cls.section ?? ''}`.trim();
}

function statusFor(billed: number, paid: number): FeeRow['status'] {
  if (billed > 0 && paid >= billed) return 'paid';
  if (paid > 0) return 'partial';
  return 'owing';
}

export default async function StudentFeesPage() {
  const [studentData, invoiceData] = await Promise.all([
    serverApiGet<ApiStudent[] | Paginated<ApiStudent>>('/students?limit=1000'),
    serverApiGet<ApiInvoice[]>('/finance/invoices?limit=1000'),
  ]);

  const students = asArray(studentData);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const balances = new Map<string, { billed: number; paid: number }>();

  for (const invoice of invoiceData ?? []) {
    const current = balances.get(invoice.studentId) ?? { billed: 0, paid: 0 };
    current.billed += Number(invoice.amountDue ?? 0);
    current.paid += Number(invoice.amountPaid ?? 0);
    balances.set(invoice.studentId, current);
  }

  const rows: FeeRow[] = Array.from(balances.entries()).map(([studentId, balance]) => {
    const student = studentsById.get(studentId);
    return {
      id: student?.studentNumber ?? studentId,
      name: studentName(student),
      className: studentClass(student),
      billed: balance.billed,
      paid: balance.paid,
      status: statusFor(balance.billed, balance.paid),
    };
  });

  return <StudentFeesClient rows={rows} />;
}
