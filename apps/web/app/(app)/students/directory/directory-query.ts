import {
  parseDirectoryState,
  DEFAULT_DIRECTORY_STATE,
} from '@workspace/ui/lib/directory-state';

/** Directory filter keys (URL `f_<key>`) → the projection's query params. */
export const FILTER_TO_PARAM: Record<string, string> = {
  status: 'status',
  grade: 'gradeLevel',
  class: 'classId',
};

/**
 * Translate the URL's directory state (the F7 encoding: q / page / size / sort /
 * f_*) into the students projection's REST query (page / limit / q / sort / dir
 * / status / gradeLevel / classId). Keeping the URL encoding (a UI concern)
 * separate from the API contract lets each evolve independently.
 */
export function toApiQuery(
  search: Record<string, string | string[] | undefined>,
): string {
  const incoming = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') incoming.set(key, value);
    else if (Array.isArray(value) && value[0]) incoming.set(key, value[0]);
  }
  const state = parseDirectoryState(incoming, DEFAULT_DIRECTORY_STATE);

  const api = new URLSearchParams();
  api.set('page', String(state.page));
  api.set('limit', String(state.pageSize));
  if (state.q) api.set('q', state.q);
  if (state.sort) {
    api.set('sort', state.sort.field);
    api.set('dir', state.sort.dir);
  }
  for (const [filterKey, value] of Object.entries(state.filters)) {
    const param = FILTER_TO_PARAM[filterKey];
    if (param && value) api.set(param, value);
  }
  return api.toString();
}
