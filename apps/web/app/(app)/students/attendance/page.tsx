import { serverApiGet } from '@/lib/server-api';
import { StudentAttendanceClient, type AttendanceRow } from './student-attendance-client';

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

interface ApiAttendanceRecord {
  studentId: string;
  status?: string | null;
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

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

export default async function StudentAttendancePage() {
  const from = new Date();
  from.setDate(from.getDate() - 90);

  const [studentData, attendanceData] = await Promise.all([
    serverApiGet<ApiStudent[] | Paginated<ApiStudent>>('/students?limit=1000'),
    serverApiGet<ApiAttendanceRecord[]>(`/attendance?from=${from.toISOString().slice(0, 10)}`),
  ]);

  const students = asArray(studentData);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const grouped = new Map<string, { total: number; present: number; absent: number; late: number }>();

  for (const record of attendanceData ?? []) {
    const current = grouped.get(record.studentId) ?? { total: 0, present: 0, absent: 0, late: 0 };
    current.total += 1;
    if (record.status === 'present') current.present += 1;
    if (record.status === 'late') {
      current.present += 1;
      current.late += 1;
    }
    if (record.status === 'absent') current.absent += 1;
    grouped.set(record.studentId, current);
  }

  const rows: AttendanceRow[] = Array.from(grouped.entries()).map(([studentId, totals]) => {
    const student = studentsById.get(studentId);
    return {
      id: student?.studentNumber ?? studentId,
      name: studentName(student),
      className: studentClass(student),
      rate: percent(totals.present, totals.total),
      absences: totals.absent,
      lates: totals.late,
      sessions: totals.total,
    };
  });

  return <StudentAttendanceClient rows={rows} />;
}
