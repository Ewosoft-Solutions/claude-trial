/* ============================================================
   /finance/invoices — fee invoices (server component)

   Fetches invoices from the NestJS backend (server-side,
   cookie-authenticated) and passes them to InvoicesClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { InvoicesClient, type Invoice } from './invoices-client';

interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  classId?: string | null;
  termName?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
}

interface ApiStudent {
  id: string;
  userTenant?: {
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
  } | null;
  enrollments?: Array<{
    status: string;
    class?: {
      name?: string | null;
      section?: string | null;
      course?: { name?: string | null } | null;
    } | null;
  }>;
}

interface StudentListResponse {
  data?: ApiStudent[];
}

function formatDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

function studentName(student: ApiStudent | undefined): string | undefined {
  const user = student?.userTenant?.user;
  if (!user) return undefined;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || undefined;
}

function studentClass(student: ApiStudent | undefined): string | undefined {
  const enrollment =
    student?.enrollments?.find((item) => item.status === 'active') ??
    student?.enrollments?.[0];
  const cls = enrollment?.class;
  if (!cls) return undefined;
  return cls.name ?? `${cls.course?.name ?? 'Class'} ${cls.section ?? ''}`.trim();
}

export default async function InvoicesPage() {
  const [data, studentData] = await Promise.all([
    serverApiGet<ApiInvoice[] | { data?: ApiInvoice[] }>('/finance/invoices?limit=200'),
    serverApiGet<StudentListResponse | ApiStudent[]>('/students?limit=500'),
  ]);

  const raw: ApiInvoice[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiInvoice[] } | null)?.data ?? [];
  const students = Array.isArray(studentData) ? studentData : studentData?.data ?? [];
  const studentsById = new Map(students.map((student) => [student.id, student]));

  const invoices: Invoice[] = raw.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    studentId: inv.studentId,
    student: studentName(studentsById.get(inv.studentId)),
    className: studentClass(studentsById.get(inv.studentId)),
    issued: formatDate(inv.issuedDate),
    due: formatDate(inv.dueDate),
    amountDue: inv.amountDue,
    amountPaid: inv.amountPaid,
    status: inv.status as Invoice['status'],
  }));

  return <InvoicesClient invoices={invoices} />;
}
