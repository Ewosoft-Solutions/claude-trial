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
  type PeopleFacets,
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

  // Summary counts + filter facets are gated on `people.view` alone, so fetch
  // them even when the active tab is denied (the cards then show the tabs the
  // caller CAN open).
  const summaryPromise = serverApiGet<Record<string, number>>(
    '/directory/people/summary',
  );
  const facetsPromise = serverApiGet<PeopleFacets>('/directory/people/facets');

  const directory = authorized
    ? await serverApiGet<DirectoryResponse>(
        `/directory/people?${toApiQuery(search, type)}`,
      )
    : null;

  const summary = (await summaryPromise) ?? {};
  const facets = (await facetsPromise) ?? { grades: [], departments: [] };

  const schoolName =
    session?.schools.find((school) => school.id === session.defaultSchoolId)
      ?.name ?? 'your school';

  return (
    <PeopleWorkbenchClient
      activeType={type}
      rows={directory?.data ?? []}
      total={directory?.pagination.total ?? 0}
      schoolName={schoolName}
      authorized={authorized}
      summary={summary}
      facets={facets}
    />
  );
}
