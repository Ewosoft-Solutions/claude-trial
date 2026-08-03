/* ============================================================
   Directory state — pure URL <-> state (de)serialization (F7)

   The single source of truth for how a governed "directory" surface
   (server-side page / filter / sort + saved views) is encoded into
   the URL query string. Pure and framework-free: no React, no
   `next/navigation`. `useDirectoryState` (hooks/use-directory-state.ts)
   binds these to a router; the server projection reads the same shape.

   Encoding it in the URL is what makes a directory view SHAREABLE — a
   colleague opening the link sees the same page, filters and sort — and
   what a SavedView persists (the serialized state, replayed on apply).
   ============================================================ */

export type SortDir = 'asc' | 'desc';

export interface DirectorySort {
  /** Column id being sorted (the projection maps it to a DB order). */
  field: string;
  dir: SortDir;
}

/**
 * The full state of a directory surface. `filters` is an open map so the
 * pattern is reusable across entities (students today, staff/finance later)
 * without changing this contract; each list declares its own filter keys.
 */
export interface DirectoryState {
  /** Free-text search term. */
  q: string;
  /** 1-based page number. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Active sort, or null for the projection's default order. */
  sort: DirectorySort | null;
  /** Arbitrary column filters (key -> value). */
  filters: Record<string, string>;
  /** Id of the applied SavedView, if any (for the "shared/dirty" affordance). */
  viewId: string | null;
}

/** A persisted directory view — the serialized state under a name. */
export interface SavedView {
  id: string;
  /** Entity list this view belongs to, e.g. `students`. */
  resource: string;
  name: string;
  /** The directory state this view replays when applied. */
  state: Partial<DirectoryState>;
  /** Visible to the whole tenant (true) or just its owner (false). */
  isShared: boolean;
  /** The owner's default view for this resource. */
  isDefault: boolean;
}

export const DEFAULT_DIRECTORY_STATE: DirectoryState = {
  q: '',
  page: 1,
  pageSize: 25,
  sort: null,
  filters: {},
  viewId: null,
};

/** Filter params are namespaced so they never collide with q/page/size/sort/view. */
export const FILTER_PARAM_PREFIX = 'f_';

const PARAM = {
  q: 'q',
  page: 'page',
  size: 'size',
  sort: 'sort',
  view: 'view',
} as const;

function toParams(
  input: string | URLSearchParams | undefined,
): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  return new URLSearchParams(input ?? '');
}

/** Parse a positive integer, or return `fallback` when absent/invalid. */
function parseIntParam(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/** Parse `field:dir` into a DirectorySort; unknown dir falls back to `asc`. */
export function parseSort(raw: string | null): DirectorySort | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(':');
  const field = idx >= 0 ? raw.slice(0, idx) : raw;
  const dir = idx >= 0 ? raw.slice(idx + 1) : 'asc';
  if (!field) return null;
  return { field, dir: dir === 'desc' ? 'desc' : 'asc' };
}

export function serializeSort(sort: DirectorySort | null): string | null {
  return sort ? `${sort.field}:${sort.dir}` : null;
}

function sortsEqual(a: DirectorySort | null, b: DirectorySort | null): boolean {
  if (a === null || b === null) return a === b;
  return a.field === b.field && a.dir === b.dir;
}

/**
 * Read a {@link DirectoryState} out of a URL query string.
 *
 * Absent params fall back to `defaults`. Filter params (prefixed `f_`) define
 * the whole filter set when any are present; when none are present the caller's
 * default filters are used (so a bare URL still respects a page's defaults).
 */
export function parseDirectoryState(
  input: string | URLSearchParams,
  defaults: DirectoryState = DEFAULT_DIRECTORY_STATE,
): DirectoryState {
  const params = toParams(input);

  const filters: Record<string, string> = {};
  let sawFilter = false;
  for (const [key, value] of params.entries()) {
    if (key.startsWith(FILTER_PARAM_PREFIX) && value !== '') {
      sawFilter = true;
      filters[key.slice(FILTER_PARAM_PREFIX.length)] = value;
    }
  }

  return {
    q: params.get(PARAM.q) ?? defaults.q,
    page: parseIntParam(params.get(PARAM.page), defaults.page),
    pageSize: parseIntParam(params.get(PARAM.size), defaults.pageSize),
    sort: params.has(PARAM.sort)
      ? parseSort(params.get(PARAM.sort))
      : defaults.sort,
    filters: sawFilter ? filters : { ...defaults.filters },
    viewId: params.get(PARAM.view) ?? defaults.viewId,
  };
}

/**
 * Serialize a {@link DirectoryState} to a query string, emitting only the
 * params that differ from `defaults` so shared URLs stay short and stable.
 * Keys are written in a fixed order, giving deterministic output for tests.
 */
export function serializeDirectoryState(
  state: DirectoryState,
  defaults: DirectoryState = DEFAULT_DIRECTORY_STATE,
): string {
  const params = new URLSearchParams();

  if (state.viewId && state.viewId !== defaults.viewId) {
    params.set(PARAM.view, state.viewId);
  }
  if (state.q && state.q !== defaults.q) {
    params.set(PARAM.q, state.q);
  }
  // Filters in key order for a deterministic, diffable query string.
  for (const key of Object.keys(state.filters).sort()) {
    const value = state.filters[key];
    if (value !== undefined && value !== '') {
      params.set(`${FILTER_PARAM_PREFIX}${key}`, value);
    }
  }
  if (state.sort && !sortsEqual(state.sort, defaults.sort)) {
    params.set(PARAM.sort, serializeSort(state.sort)!);
  }
  if (state.page !== defaults.page) {
    params.set(PARAM.page, String(state.page));
  }
  if (state.pageSize !== defaults.pageSize) {
    params.set(PARAM.size, String(state.pageSize));
  }

  return params.toString();
}

/**
 * Toggle sort for a column: unsorted -> asc -> desc -> unsorted. Returns the
 * next sort (or null). Kept pure so both the hook and tests share one rule.
 */
export function cycleSort(
  current: DirectorySort | null,
  field: string,
): DirectorySort | null {
  if (current?.field !== field) return { field, dir: 'asc' };
  if (current.dir === 'asc') return { field, dir: 'desc' };
  return null;
}
