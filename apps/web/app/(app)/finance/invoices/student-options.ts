/* ============================================================
   Roster → student picker options

   Shared by the invoices list and the new-invoice route so the two never drift
   on how a student is labelled. The roster shape is defensive on purpose: it
   crosses a trust boundary, and a student with no linked user still has to
   render as *something* pickable (AGENTS.md golden rule 9).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';

export interface ApiStudent {
  id: string;
  studentNumber?: string | null;
  userTenant?: {
    user?: { firstName?: string | null; lastName?: string | null } | null;
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

export interface StudentOption {
  id: string;
  name: string;
  studentNumber?: string;
}

interface StudentListResponse {
  data?: ApiStudent[];
}

/** Name, falling back to the number and then the id — never an empty label. */
export function studentName(student: ApiStudent): string {
  const user = student.userTenant?.user;
  const name = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || student.studentNumber || student.id;
}

/** The active enrollment's class, for labelling a row. */
export function studentClass(student: ApiStudent | undefined): string | undefined {
  const enrollment =
    student?.enrollments?.find((item) => item.status === 'active') ??
    student?.enrollments?.[0];
  const cls = enrollment?.class;
  if (!cls) return undefined;
  return (
    cls.name ?? `${cls.course?.name ?? 'Class'} ${cls.section ?? ''}`.trim()
  );
}

/** The roster, as both the raw rows (for class lookup) and picker options. */
export async function fetchRoster(): Promise<{
  students: ApiStudent[];
  options: StudentOption[];
}> {
  const data = await serverApiGet<StudentListResponse | ApiStudent[]>(
    '/students/roster',
  );
  const students = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    students,
    options: students.map((student) => ({
      id: student.id,
      name: studentName(student),
      studentNumber: student.studentNumber ?? undefined,
    })),
  };
}
