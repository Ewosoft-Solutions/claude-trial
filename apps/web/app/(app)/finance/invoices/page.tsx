/* ============================================================
   /finance/invoices — fee invoices (server component)

   Server-driven list: search (invoice # / student name) / status filter / sort
   / paging all run at the DB (via the URL → the paginated `/finance/invoices`
   endpoint). The student name comes off the invoice's denormalized snapshot;
   the roster is only used to label the class. Stat tiles come from the
   whole-set `/finance/invoices/summary`.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import {
  InvoicesClient,
  type Invoice,
  type InvoiceStats,
} from './invoices-client';

const DEFAULT_PAGE_SIZE = 25;

interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName?: string | null;
  classId?: string | null;
  termName?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
}

interface InvoicesResponse {
  data: ApiInvoice[];
  pagination: { total: number };
}

interface InvoiceSummary {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  statusCounts: Record<string, number>;
}

interface ApiStudent {
  id: string;
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
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

function studentClass(student: ApiStudent | undefined): string | undefined {
  const enrollment =
    student?.enrollments?.find((item) => item.status === 'active') ??
    student?.enrollments?.[0];
  const cls = enrollment?.class;
  if (!cls) return undefined;
  return (
    cls.name ?? `${cls.course?.name ?? 'Class'} ${cls.section ?? ''}`.trim()
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { status: 'status' },
  });

  const [list, summary, studentData] = await Promise.all([
    serverApiGet<InvoicesResponse>(`/finance/invoices?${params.toString()}`),
    serverApiGet<InvoiceSummary>('/finance/invoices/summary'),
    serverApiGet<StudentListResponse | ApiStudent[]>('/students/roster'),
  ]);

  const raw = list?.data ?? [];
  const students = Array.isArray(studentData)
    ? studentData
    : (studentData?.data ?? []);
  const studentsById = new Map(
    students.map((student) => [student.id, student]),
  );

  const invoices: Invoice[] = raw.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    studentId: inv.studentId,
    student: inv.studentName ?? undefined,
    className: studentClass(studentsById.get(inv.studentId)),
    issued: formatDate(inv.issuedDate),
    due: formatDate(inv.dueDate),
    amountDue: inv.amountDue,
    amountPaid: inv.amountPaid,
    status: inv.status as Invoice['status'],
  }));

  const counts = summary?.statusCounts ?? {};
  const stats: InvoiceStats = {
    billed: summary?.totalBilled ?? 0,
    collected: summary?.totalCollected ?? 0,
    outstanding: summary?.totalOutstanding ?? 0,
    overdue: counts.overdue ?? 0,
  };

  return (
    <InvoicesClient
      invoices={invoices}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      stats={stats}
    />
  );
}
