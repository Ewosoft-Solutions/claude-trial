import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import {
  firstAllowedType,
  parseType,
  toApiQuery,
  TYPE_PERMISSION,
} from './people-config';
import {
  PeopleWorkbenchClient,
  type DirectorySavedView,
  type PeopleRow,
} from './people-workbench-client';

interface DirectoryResponse {
  data: PeopleRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: { canViewContact: boolean; type: string };
}

export default async function PeopleWorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const session = await getSession();
  const has = (permission: string) =>
    session?.permissions.includes(permission as never) ?? false;
  const permissions = [...(session?.permissions ?? [])] as string[];

  // An explicit `?tab=` wins; otherwise default to the first tab the caller can
  // see, so an authorized user never lands on a denied tab.
  const type = search.tab
    ? parseType(search.tab)
    : (firstAllowedType(permissions) ?? 'student');

  // The workbench gate is enforced in layout.tsx; here we resolve whether the
  // ACTIVE tab is permitted so we can render the denied state (not a blank/500)
  // without a wasted 403 round-trip.
  const authorized = has('people.view') && has(TYPE_PERMISSION[type]);

  const [directory, savedViews] = authorized
    ? await Promise.all([
        serverApiGet<DirectoryResponse>(
          `/directory/people?${toApiQuery(search, type)}`,
        ),
        serverApiGet<DirectorySavedView[]>(
          `/directory/saved-views?resource=people-${type}`,
        ),
      ])
    : [null, null];

  const schoolName =
    session?.schools.find((school) => school.id === session.defaultSchoolId)
      ?.name ?? 'your school';

  return (
    <PeopleWorkbenchClient
      activeType={type}
      rows={directory?.data ?? []}
      total={directory?.pagination.total ?? 0}
      schoolName={schoolName}
      savedViews={savedViews ?? []}
      currentProfileId={session?.activeProfileId ?? null}
      permissions={permissions}
      authorized={authorized}
    />
  );
}
