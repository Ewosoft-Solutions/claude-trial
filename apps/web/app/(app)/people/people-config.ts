/**
 * Shared config for the People workbench (WB1-1). The person-type tabs, the
 * per-tab type permission (mirrors the API's server-side gate), and the
 * directory-state ⇄ REST-query translation. Kept framework-light so both the
 * server page and the client component import from one source of truth.
 */
import {
  parseDirectoryState,
  DEFAULT_DIRECTORY_STATE,
} from '@workspace/ui/lib/directory-state';

export const PEOPLE_TYPES = [
  'student',
  'guardian',
  'staff',
  'user',
  'prospect',
] as const;
export type PeopleType = (typeof PEOPLE_TYPES)[number];

/**
 * The permission each tab requires, on top of the workbench-wide `people.view`.
 * Mirrors `TYPE_PERMISSION` in the API controller so the UI hides exactly what
 * the server refuses (the server is still the authority — golden rule 5).
 */
export const TYPE_PERMISSION: Record<PeopleType, string> = {
  student: 'students.view',
  guardian: 'guardians.view',
  staff: 'staff.view',
  user: 'users.view',
  prospect: 'admissions.view',
};

export const TAB_LABEL: Record<PeopleType, string> = {
  student: 'Students',
  guardian: 'Guardians',
  staff: 'Staff',
  user: 'Users',
  prospect: 'Prospects',
};

export function parseType(raw: string | string[] | undefined): PeopleType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (PEOPLE_TYPES as readonly string[]).includes(value ?? '')
    ? (value as PeopleType)
    : 'student';
}

/**
 * The first tab the caller may view, given their permissions — used to pick the
 * default tab so a user with (say) `staff.view` but not `students.view` doesn't
 * land on the denied Students tab when no `?tab=` is present.
 */
export function firstAllowedType(
  permissions: readonly string[],
): PeopleType | null {
  return (
    PEOPLE_TYPES.find((type) => permissions.includes(TYPE_PERMISSION[type])) ??
    null
  );
}

const SORT_FIELDS = new Set(['name', 'createdAt']);

/**
 * Translate the URL's directory state (F7 encoding: q / page / size / sort /
 * f_*) into the People projection's REST query (page / limit / q / sort / dir /
 * status / type). The active `type` (tab) is passed explicitly, not stored in
 * directory state.
 */
export function toApiQuery(
  search: Record<string, string | string[] | undefined>,
  type: PeopleType,
): string {
  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') incoming.set(key, value);
    else if (Array.isArray(value) && value[0]) incoming.set(key, value[0]);
  }
  const state = parseDirectoryState(incoming, DEFAULT_DIRECTORY_STATE);

  const api = new URLSearchParams();
  api.set('type', type);
  api.set('page', String(state.page));
  api.set('limit', String(state.pageSize));
  if (state.q) api.set('q', state.q);
  if (state.sort && SORT_FIELDS.has(state.sort.field)) {
    api.set('sort', state.sort.field);
    api.set('dir', state.sort.dir);
  }
  const status = state.filters.status;
  if (status) api.set('status', status);
  return api.toString();
}
