import {
  parseDirectoryState,
  DEFAULT_DIRECTORY_STATE,
  type DirectoryState,
} from '@workspace/ui/lib/directory-state';

/**
 * Translate a server component's `searchParams` (the F7 directory URL encoding:
 * `q` / `page` / `size` / `sort` / `f_*`) into the REST query a `PaginationDto`
 * list endpoint expects (`page` / `limit` / `search` / `sortBy` / `sortOrder` +
 * mapped filters).
 *
 * This is the server-driven-list counterpart to the governed directory's
 * `toApiQuery` (which targets the directory services' `sort`/`dir`/`q` params).
 * Keeping the URL encoding (a UI concern) separate from the API contract lets a
 * page reuse `useDirectoryState` on the client and one paginated endpoint on the
 * server without either side knowing the other's param names.
 *
 * Returns both the API `params` (for the fetch) and the parsed `state` (handy
 * when the page needs the effective page/size, e.g. to echo them to the table).
 */
export function toListQuery(
  search: Record<string, string | string[] | undefined>,
  opts: {
    /** Page size when the URL carries no `size` (must match the client's `useDirectoryState` default). */
    defaultPageSize?: number;
    /** Maps a directory filter key (URL `f_<key>`) → the API query param name. */
    filters?: Record<string, string>;
  } = {},
): { params: URLSearchParams; state: DirectoryState } {
  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') incoming.set(key, value);
    else if (Array.isArray(value) && value[0]) incoming.set(key, value[0]);
  }

  const state = parseDirectoryState(incoming, {
    ...DEFAULT_DIRECTORY_STATE,
    pageSize: opts.defaultPageSize ?? DEFAULT_DIRECTORY_STATE.pageSize,
  });

  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('limit', String(state.pageSize));
  if (state.q) params.set('search', state.q);
  if (state.sort) {
    params.set('sortBy', state.sort.field);
    params.set('sortOrder', state.sort.dir);
  }
  const filterMap = opts.filters ?? {};
  for (const [key, value] of Object.entries(state.filters)) {
    const param = filterMap[key];
    if (param && value) params.set(param, value);
  }

  return { params, state };
}
