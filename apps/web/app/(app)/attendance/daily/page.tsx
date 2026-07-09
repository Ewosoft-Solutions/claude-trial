/* ============================================================
   /attendance/daily — daily attendance register (server component)

   Fetches the initial class list and today's attendance from the
   NestJS backend (server-side, cookie-authenticated). Passes the
   hydrated data to DailyRegisterClient for interactive state.

   Empty API responses render as an empty register in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import {
  DailyRegisterClient,
  type ClassOption,
  type Pupil,
  type AttendanceRecord,
} from './register-client';

interface ApiClass {
  id: string;
  name?: string;
  section?: string;
  course?: { name?: string };
}

interface ApiStudent {
  id: string;
  studentNumber: string;
  userTenant?: { user?: { firstName?: string; lastName?: string } };
}

interface ApiAttendanceRecord {
  studentId: string;
  status: string;
}

function studentName(s: ApiStudent): string {
  const u = s.userTenant?.user;
  const first = u?.firstName ?? '';
  const last = u?.lastName ?? '';
  return [first, last].filter(Boolean).join(' ') || s.studentNumber;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DailyRegisterPage() {
  // Fetch class list from the backend
  const classData = await serverApiGet<ApiClass[] | { data?: ApiClass[] }>('/classes?status=active&limit=50');
  const rawClasses: ApiClass[] = Array.isArray(classData)
    ? classData
    : (classData as { data?: ApiClass[] } | null)?.data ?? [];

  const classes: ClassOption[] = rawClasses.map((c) => ({
    id: c.id,
    label: c.name ?? `${c.course?.name ?? 'Class'} ${c.section ?? ''}`.trim(),
  }));

  // Use the first class for the initial load
  const initialClassId = classes[0]?.id ?? '';
  const dateStr = today();

  // Fetch students enrolled in the first class
  let initialStudents: Pupil[] = [];
  if (initialClassId) {
    const studentData = await serverApiGet<
      ApiStudent[] | { students?: ApiStudent[]; data?: ApiStudent[] }
    >(`/students?classId=${initialClassId}&limit=100`);

    const rawStudents: ApiStudent[] = Array.isArray(studentData)
      ? studentData
      : (studentData as { students?: ApiStudent[]; data?: ApiStudent[] } | null)?.students ??
        (studentData as { data?: ApiStudent[] } | null)?.data ?? [];

    initialStudents = rawStudents.map((s) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      name: studentName(s),
    }));
  }

  // Fetch any existing attendance marks for today
  let initialRecords: AttendanceRecord[] = [];
  if (initialClassId) {
    const attendanceData = await serverApiGet<
      ApiAttendanceRecord[] | { records?: ApiAttendanceRecord[] }
    >(`/attendance?classId=${initialClassId}&date=${dateStr}`);

    const raw: ApiAttendanceRecord[] = Array.isArray(attendanceData)
      ? attendanceData
      : (attendanceData as { records?: ApiAttendanceRecord[] } | null)?.records ?? [];

    initialRecords = raw.map((r) => ({
      studentId: r.studentId,
      status: r.status as AttendanceRecord['status'],
    }));
  }

  return (
    <DailyRegisterClient
      classes={classes}
      initialClassId={initialClassId}
      initialStudents={initialStudents}
      initialRecords={initialRecords}
    />
  );
}
