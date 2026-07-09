/* ============================================================
   /finance/payments — payment receipts (server component)

   Fetches payments from the NestJS backend (server-side,
   cookie-authenticated) and passes them to PaymentsClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { PaymentsClient, type Payment } from './payments-client';

interface ApiPayment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  method: string;
  paidAt: string;
  amount: number;
  status: string;
  invoice?: { invoiceNumber?: string; studentId?: string };
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

export default async function PaymentsPage() {
  const [data, studentData] = await Promise.all([
    serverApiGet<ApiPayment[] | { data?: ApiPayment[] }>('/finance/payments?limit=200'),
    serverApiGet<StudentListResponse | ApiStudent[]>('/students?limit=500'),
  ]);

  const raw: ApiPayment[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiPayment[] } | null)?.data ?? [];
  const students = Array.isArray(studentData) ? studentData : studentData?.data ?? [];
  const studentsById = new Map(students.map((student) => [student.id, student]));

  const payments: Payment[] = raw.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    invoiceId: p.invoiceId,
    studentId: p.studentId,
    student: studentName(studentsById.get(p.studentId)),
    method: p.method as Payment['method'],
    date: formatDate(p.paidAt),
    amount: p.amount,
    status: p.status as Payment['status'],
  }));

  return <PaymentsClient payments={payments} />;
}
