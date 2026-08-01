import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { toApiQuery } from './directory-query';
import {
  StudentDirectoryClient,
  type DirectorySavedView,
  type StudentRow,
} from './directory-client';

interface DirectoryResponse {
  data: StudentRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: { canViewContact: boolean };
}

export default async function StudentDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const apiQuery = toApiQuery(search);

  const [session, directory, savedViews] = await Promise.all([
    getSession(),
    serverApiGet<DirectoryResponse>(`/directory/students?${apiQuery}`),
    serverApiGet<DirectorySavedView[]>(
      '/directory/saved-views?resource=students',
    ),
  ]);

  const has = (permission: string) =>
    session?.permissions.includes(permission as never) ?? false;

  const schoolName =
    session?.schools.find((school) => school.id === session.defaultSchoolId)
      ?.name ?? 'your school';

  const rows = directory?.data ?? [];
  const total = directory?.pagination.total ?? 0;

  return (
    <StudentDirectoryClient
      rows={rows}
      total={total}
      schoolName={schoolName}
      savedViews={savedViews ?? []}
      currentProfileId={session?.activeProfileId ?? null}
      canExport={has('students.export')}
      canViewContact={
        directory?.meta.canViewContact ?? has('students.view.personal_info')
      }
    />
  );
}
