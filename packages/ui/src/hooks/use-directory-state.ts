/* ============================================================
   useDirectoryState — URL-persisted directory state (F7)

   A thin React binding over the pure (de)serializers in
   lib/directory-state.ts. Like `useResolvedNavigation`, it carries NO
   framework-routing dependency: the host passes the current query string
   (e.g. from `useSearchParams().toString()`) and an `onChange` callback
   that writes the next query string (e.g. `router.replace`). This keeps
   `@workspace/ui` free of `next/navigation` while giving apps a stable,
   shareable, URL-synced directory state.

   Mutating page-affecting inputs (search, filters, sort, page size)
   resets the page to 1 — the record you were on rarely survives a new
   filter, so keeping the old page number just shows an empty tail.
   ============================================================ */

import * as React from 'react';

import {
  cycleSort,
  DEFAULT_DIRECTORY_STATE,
  parseDirectoryState,
  serializeDirectoryState,
  type DirectorySort,
  type DirectoryState,
} from '@workspace/ui/lib/directory-state';

export interface UseDirectoryStateOptions {
  /** Current URL query string (e.g. `useSearchParams().toString()`). */
  searchParams: string | URLSearchParams;
  /** Persist the next query string (e.g. `router.replace(pathname + '?' + qs)`). */
  onChange: (queryString: string) => void;
  /** Per-page defaults (page size, default sort/filters). */
  defaults?: Partial<DirectoryState>;
}

export interface UseDirectoryStateResult {
  /** The current derived state. */
  state: DirectoryState;
  /** The effective defaults (merged base + caller overrides). */
  defaults: DirectoryState;
  setQuery: (q: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  /** Set an explicit sort (or clear it). */
  setSort: (sort: DirectorySort | null) => void;
  /** Toggle a column's sort: unsorted -> asc -> desc -> unsorted. */
  toggleSort: (field: string) => void;
  /** Set (value) or clear (null) a single filter. */
  setFilter: (key: string, value: string | null) => void;
  /** Replace the whole filter map. */
  setFilters: (filters: Record<string, string>) => void;
  /** Apply a saved view: replace state wholesale, tagging `viewId`. */
  applyView: (
    viewId: string | null,
    viewState: Partial<DirectoryState>,
  ) => void;
  /** Reset to defaults (clears the URL). */
  reset: () => void;
}

export function useDirectoryState(
  options: UseDirectoryStateOptions,
): UseDirectoryStateResult {
  const { searchParams, onChange } = options;

  const defaults = React.useMemo<DirectoryState>(
    () => ({ ...DEFAULT_DIRECTORY_STATE, ...options.defaults }),
    [options.defaults],
  );

  // Normalize to a stable string so the memo key doesn't churn on a fresh
  // URLSearchParams instance carrying identical params each render.
  const queryString =
    typeof searchParams === 'string' ? searchParams : searchParams.toString();

  const state = React.useMemo<DirectoryState>(
    () => parseDirectoryState(queryString, defaults),
    [queryString, defaults],
  );

  // Keep the latest state/defaults in a ref so the returned setters are stable
  // (do not change identity every render) yet always act on current values.
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const defaultsRef = React.useRef(defaults);
  defaultsRef.current = defaults;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const commit = React.useCallback((next: DirectoryState) => {
    onChangeRef.current(serializeDirectoryState(next, defaultsRef.current));
  }, []);

  const update = React.useCallback(
    (patch: Partial<DirectoryState>, resetPage: boolean) => {
      const current = stateRef.current;
      commit({
        ...current,
        ...patch,
        page: resetPage ? 1 : (patch.page ?? current.page),
      });
    },
    [commit],
  );

  const setQuery = React.useCallback(
    (q: string) => update({ q, viewId: null }, true),
    [update],
  );
  const setPage = React.useCallback(
    (page: number) => update({ page: Math.max(1, page) }, false),
    [update],
  );
  const setPageSize = React.useCallback(
    (pageSize: number) => update({ pageSize: Math.max(1, pageSize) }, true),
    [update],
  );
  const setSort = React.useCallback(
    (sort: DirectorySort | null) => update({ sort }, true),
    [update],
  );
  const toggleSort = React.useCallback(
    (field: string) =>
      update({ sort: cycleSort(stateRef.current.sort, field) }, true),
    [update],
  );
  const setFilter = React.useCallback(
    (key: string, value: string | null) => {
      const filters = { ...stateRef.current.filters };
      if (value === null || value === '') delete filters[key];
      else filters[key] = value;
      update({ filters, viewId: null }, true);
    },
    [update],
  );
  const setFilters = React.useCallback(
    (filters: Record<string, string>) =>
      update({ filters, viewId: null }, true),
    [update],
  );
  const applyView = React.useCallback(
    (viewId: string | null, viewState: Partial<DirectoryState>) => {
      commit({
        ...defaultsRef.current,
        ...viewState,
        viewId,
        page: 1,
      });
    },
    [commit],
  );
  const reset = React.useCallback(() => {
    onChangeRef.current('');
  }, []);

  return {
    state,
    defaults,
    setQuery,
    setPage,
    setPageSize,
    setSort,
    toggleSort,
    setFilter,
    setFilters,
    applyView,
    reset,
  };
}
