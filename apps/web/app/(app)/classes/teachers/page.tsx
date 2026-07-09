import {
  type ClassSummary,
  type ClassTeacherAssignment,
  type Paginated,
  type StaffProfile,
  profileHasRole,
} from '@/lib/academics';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { ClassTeachersClient } from './teachers-client';

interface ClassListResponse {
  data: ClassSummary[];
}

function teacherProfiles(profiles: StaffProfile[]): StaffProfile[] {
  return profiles.filter((profile) => profileHasRole(profile, 'teacher'));
}

export default async function ClassTeachersPage() {
  const session = await getSession();
  const canAssign = session?.permissions.includes('classes.teachers.assign') ?? false;

  const [classes, staff] = await Promise.all([
    serverApiGet<ClassListResponse>('/classes?limit=100'),
    canAssign && session?.defaultSchoolId
      ? serverApiGet<Paginated<StaffProfile>>(
          `/tenant/${session.defaultSchoolId}/users?limit=200&status=active`,
        )
      : Promise.resolve(null),
  ]);

  const sourceClasses = classes?.data ?? [];
  const sourceStaff = staff?.data ? teacherProfiles(staff.data) : [];
  const assignments: Record<string, ClassTeacherAssignment[]> = {};

  await Promise.all(
    sourceClasses.map(async (cls) => {
      assignments[cls.id] =
        (await serverApiGet<ClassTeacherAssignment[]>(
          `/classes/${cls.id}/teachers`,
        )) ?? [];
    }),
  );

  return (
    <ClassTeachersClient
      live
      initialClasses={sourceClasses}
      initialStaff={sourceStaff}
      initialAssignments={assignments}
    />
  );
}
