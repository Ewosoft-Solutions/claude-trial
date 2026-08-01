import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDirectoryState } from './use-directory-state';

/**
 * Drive the hook like a router would: `onChange` writes the next query string,
 * and the test re-renders with it as the new `searchParams`, closing the URL
 * round-trip the way `useSearchParams()` + `router.replace` do in the app.
 */
function setup(
  initial = '',
  defaults?: Parameters<typeof useDirectoryState>[0]['defaults'],
) {
  let searchParams = initial;
  const onChange = vi.fn((next: string) => {
    searchParams = next;
  });
  const view = renderHook(
    (props: { searchParams: string }) =>
      useDirectoryState({
        searchParams: props.searchParams,
        onChange,
        defaults,
      }),
    { initialProps: { searchParams } },
  );
  const sync = () => view.rerender({ searchParams });
  return { view, onChange, sync, current: () => view.result.current };
}

describe('useDirectoryState', () => {
  it('derives defaults from an empty URL', () => {
    const { current } = setup('', { pageSize: 25 });
    expect(current().state).toMatchObject({ q: '', page: 1, pageSize: 25 });
  });

  it('setQuery writes q, resets page to 1, and clears the applied view', () => {
    const { current, onChange, sync } = setup('page=3&view=v1');
    act(() => current().setPage(3));
    act(() => current().setQuery('ada'));
    expect(onChange).toHaveBeenLastCalledWith('q=ada');
    sync();
    expect(current().state).toMatchObject({ q: 'ada', page: 1, viewId: null });
  });

  it('setPage keeps the rest of the state and does not reset', () => {
    const { current, onChange } = setup('q=lee&sort=name:asc');
    act(() => current().setPage(4));
    expect(onChange).toHaveBeenLastCalledWith('q=lee&sort=name%3Aasc&page=4');
  });

  it('toggleSort cycles asc -> desc -> cleared', () => {
    const { current, sync } = setup();
    act(() => current().toggleSort('name'));
    sync();
    expect(current().state.sort).toEqual({ field: 'name', dir: 'asc' });
    act(() => current().toggleSort('name'));
    sync();
    expect(current().state.sort).toEqual({ field: 'name', dir: 'desc' });
    act(() => current().toggleSort('name'));
    sync();
    expect(current().state.sort).toBeNull();
  });

  it('setFilter adds and removes a filter and resets page', () => {
    const { current, onChange, sync } = setup('page=5');
    act(() => current().setFilter('status', 'active'));
    expect(onChange).toHaveBeenLastCalledWith('f_status=active');
    sync();
    act(() => current().setFilter('status', null));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('applyView replaces state and tags the view id at page 1', () => {
    const { current, onChange } = setup('q=stale&page=9');
    act(() =>
      current().applyView('owing-view', {
        filters: { status: 'owing' },
        sort: { field: 'fees', dir: 'desc' },
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      'view=owing-view&f_status=owing&sort=fees%3Adesc',
    );
  });

  it('reset clears the URL', () => {
    const { current, onChange } = setup('q=x&page=2');
    act(() => current().reset());
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('keeps setter identities stable across re-renders', () => {
    const { current, sync } = setup();
    const before = current().setQuery;
    sync();
    expect(current().setQuery).toBe(before);
  });
});
