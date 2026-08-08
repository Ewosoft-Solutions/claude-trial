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
  /** Column ids hidden from view. Presentation-only (never sent to the server),
   *  but part of the state so a shared link and a SavedView restore the same
   *  columns — letting a view omit columns that aren't relevant to it. */
  hiddenColumns: string[];
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
  // Compact default so long lists don't dominate the viewport (esp. mobile); a
  // user's chosen size is remembered per-browser (apps/web/lib/page-size.ts).
  pageSize: 10,
  sort: null,
  filters: {},
  hiddenColumns: [],
  viewId: null,
};

/** Filter params are namespaced so they never collide with q/page/size/sort/view. */
export const FILTER_PARAM_PREFIX = 'f_';

const PARAM = {
  q: 'q',
  page: 'page',
  size: 'size',
  sort: 'sort',
  cols: 'cols',
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

/**
 * Parse a sort param into a DirectorySort.
 *
 * Canonical form is a `-` prefix for descending (`sort=-name`), plain field for
 * ascending (`sort=name`) — chosen because `-` is not percent-encoded, so the
 * URL stays clean (no `%3A`). The legacy `field:dir` form is still accepted so
 * older shared links and saved views keep working.
 */
export function parseSort(raw: string | null): DirectorySort | null {
  if (!raw) return null;
  // Legacy `field:dir`.
  const colon = raw.lastIndexOf(':');
  if (colon >= 0) {
    const field = raw.slice(0, colon);
    if (!field) return null;
    return { field, dir: raw.slice(colon + 1) === 'desc' ? 'desc' : 'asc' };
  }
  // Canonical: leading `-` = descending.
  if (raw.startsWith('-')) {
    const field = raw.slice(1);
    return field ? { field, dir: 'desc' } : null;
  }
  return { field: raw, dir: 'asc' };
}

export function serializeSort(sort: DirectorySort | null): string | null {
  if (!sort) return null;
  return sort.dir === 'desc' ? `-${sort.field}` : sort.field;
}

function sortsEqual(a: DirectorySort | null, b: DirectorySort | null): boolean {
  if (a === null || b === null) return a === b;
  return a.field === b.field && a.dir === b.dir;
}

/**
 * Parse the hidden-columns param (`cols=guardian,contact`) into a de-duplicated
 * id list. An empty value means "nothing hidden" — distinct from the param being
 * absent, which falls back to the caller's defaults (see {@link parseDirectoryState}).
 */
export function parseCols(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Order-insensitive equality for the hidden-columns list. */
function colsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
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
    hiddenColumns: params.has(PARAM.cols)
      ? parseCols(params.get(PARAM.cols))
      : [...defaults.hiddenColumns],
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
  if (!colsEqual(state.hiddenColumns, defaults.hiddenColumns)) {
    // Sorted for a deterministic query string. An empty list emits `cols=`,
    // which explicitly says "nothing hidden" even when the defaults hide some.
    params.set(PARAM.cols, [...state.hiddenColumns].sort().join(','));
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
