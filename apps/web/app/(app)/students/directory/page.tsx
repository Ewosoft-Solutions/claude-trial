import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import {
  StudentDirectoryClient,
  type Enrollment,
  type FeeStatus,
  type StudentRow,
} from './directory-client';

interface ApiStudent {
  id: string;
  studentNumber: string;
  gradeLevel: string | null;
  enrollmentStatus: string;
  userTenant: {
    user: {
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
  };
  enrollments?: Array<{
    status: string;
    class?: {
      name: string | null;
      section: string;
      course?: { name: string; code: string } | null;
    } | null;
  }>;
  guardians?: Array<{
    isPrimary: boolean;
    guardian: {
      user: {
        firstName: string | null;
        lastName: string | null;
        email: string;
      };
    };
  }>;
}

interface StudentListResponse {
  data?: ApiStudent[];
}

interface ApiInvoice {
  studentId: string;
  amountDue: number;
  amountPaid: number;
}

function fullName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

function className(student: ApiStudent): string {
  const activeEnrollment =
    student.enrollments?.find((enrollment) => enrollment.status === 'active') ??
    student.enrollments?.[0];
  const cls = activeEnrollment?.class;
  if (!cls) return '-';
  return cls.name ?? `${cls.course?.name ?? 'Class'} ${cls.section}`.trim();
}

function guardianName(student: ApiStudent): string {
  const primary = student.guardians?.find((guardian) => guardian.isPrimary);
  const guardian = primary ?? student.guardians?.[0];
  return guardian ? fullName(guardian.guardian.user) : '-';
}

function normalizeEnrollment(status: string): Enrollment {
  if (
    status === 'active' ||
    status === 'inactive' ||
    status === 'suspended' ||
    status === 'graduated' ||
    status === 'transferred' ||
    status === 'withdrawn'
  ) {
    return status;
  }
  return 'inactive';
}

function feeStatus(invoices: ApiInvoice[]): FeeStatus {
  const amountDue = invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const amountPaid = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  if (amountDue === 0) return 'none';
  if (amountPaid >= amountDue) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'owing';
}

export default async function StudentDirectoryPage() {
  const [session, studentsData, invoiceData] = await Promise.all([
    getSession(),
    serverApiGet<StudentListResponse | ApiStudent[]>('/students?limit=200'),
    serverApiGet<ApiInvoice[]>('/finance/invoices?limit=500'),
  ]);

  const rawStudents = Array.isArray(studentsData)
    ? studentsData
    : studentsData?.data ?? [];
  const invoices = Array.isArray(invoiceData) ? invoiceData : [];
  const invoicesByStudent = new Map<string, ApiInvoice[]>();
  for (const invoice of invoices) {
    const list = invoicesByStudent.get(invoice.studentId) ?? [];
    list.push(invoice);
    invoicesByStudent.set(invoice.studentId, list);
  }

  const students: StudentRow[] = rawStudents.map((student) => ({
    id: student.studentNumber,
    name: fullName(student.userTenant.user),
    className: className(student),
    guardian: guardianName(student),
    enrollment: normalizeEnrollment(student.enrollmentStatus),
    fees: feeStatus(invoicesByStudent.get(student.id) ?? []),
  }));

  const schoolName =
    session?.schools.find((school) => school.id === session.defaultSchoolId)?.name ??
    'your school';
  const activeCount = students.filter((student) => student.enrollment === 'active').length;

  return (
    <StudentDirectoryClient
      students={students}
      schoolName={schoolName}
      meta={[
        { key: 'school', label: schoolName, emphasis: true },
        { key: 'active', label: `${activeCount} active` },
      ]}
    />
  );
}
