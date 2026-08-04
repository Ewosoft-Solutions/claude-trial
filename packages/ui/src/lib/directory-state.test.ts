import { describe, expect, it } from 'vitest';

import {
  cycleSort,
  DEFAULT_DIRECTORY_STATE,
  parseDirectoryState,
  parseSort,
  serializeDirectoryState,
  serializeSort,
  type DirectoryState,
} from './directory-state';

describe('parseDirectoryState', () => {
  it('returns defaults for an empty query string', () => {
    expect(parseDirectoryState('')).toEqual(DEFAULT_DIRECTORY_STATE);
  });

  it('reads q, page, size, sort, filters and view', () => {
    const state = parseDirectoryState(
      'q=ada&page=3&size=50&sort=name:desc&f_status=active&f_grade=SS1&view=v1',
    );
    expect(state).toEqual({
      q: 'ada',
      page: 3,
      pageSize: 50,
      sort: { field: 'name', dir: 'desc' },
      filters: { status: 'active', grade: 'SS1' },
      viewId: 'v1',
    });
  });

  it('falls back to defaults for invalid or non-positive numbers', () => {
    const state = parseDirectoryState('page=0&size=-4');
    expect(state.page).toBe(DEFAULT_DIRECTORY_STATE.page);
    expect(state.pageSize).toBe(DEFAULT_DIRECTORY_STATE.pageSize);
  });

  it('uses default filters only when no filter param is present', () => {
    const defaults: DirectoryState = {
      ...DEFAULT_DIRECTORY_STATE,
      filters: { status: 'active' },
    };
    expect(parseDirectoryState('', defaults).filters).toEqual({
      status: 'active',
    });
    // any explicit filter param defines the whole set (default dropped)
    expect(parseDirectoryState('f_grade=JS2', defaults).filters).toEqual({
      grade: 'JS2',
    });
  });

  it('accepts a URLSearchParams instance', () => {
    const state = parseDirectoryState(new URLSearchParams('q=lee'));
    expect(state.q).toBe('lee');
  });
});

describe('serializeDirectoryState', () => {
  it('omits values equal to the defaults', () => {
    expect(serializeDirectoryState(DEFAULT_DIRECTORY_STATE)).toBe('');
  });

  it('emits only the changed params in a stable key order', () => {
    const qs = serializeDirectoryState({
      q: 'ada',
      page: 2,
      pageSize: 50,
      sort: { field: 'name', dir: 'asc' },
      filters: { status: 'active', grade: 'SS1' },
      viewId: 'v1',
    });
    // deterministic ordering: view, q, filters (sorted), sort, page, size.
    // Sort is the clean `-field`/`field` form (asc here) — no `%3A`.
    expect(qs).toBe(
      'view=v1&q=ada&f_grade=SS1&f_status=active&sort=name&page=2&size=50',
    );
  });

  it('round-trips through parse', () => {
    const original: DirectoryState = {
      q: 'okafor',
      page: 4,
      pageSize: 10,
      sort: { field: 'fees', dir: 'desc' },
      filters: { status: 'owing' },
      viewId: null,
    };
    expect(parseDirectoryState(serializeDirectoryState(original))).toEqual(
      original,
    );
  });

  it('drops empty filter values', () => {
    const qs = serializeDirectoryState({
      ...DEFAULT_DIRECTORY_STATE,
      filters: { status: '', grade: 'JS1' },
    });
    expect(qs).toBe('f_grade=JS1');
  });
});

describe('parseSort', () => {
  it('parses the canonical -field (desc) / field (asc) forms', () => {
    expect(parseSort('-name')).toEqual({ field: 'name', dir: 'desc' });
    expect(parseSort('name')).toEqual({ field: 'name', dir: 'asc' });
    expect(parseSort('-')).toBeNull();
    expect(parseSort('')).toBeNull();
  });

  it('still accepts the legacy field:dir form (old links / saved views)', () => {
    expect(parseSort('name:desc')).toEqual({ field: 'name', dir: 'desc' });
    expect(parseSort('name:sideways')).toEqual({ field: 'name', dir: 'asc' });
  });

  it('serializeSort emits the clean form', () => {
    expect(serializeSort({ field: 'name', dir: 'desc' })).toBe('-name');
    expect(serializeSort({ field: 'name', dir: 'asc' })).toBe('name');
    expect(serializeSort(null)).toBeNull();
  });
});

describe('cycleSort', () => {
  it('cycles unsorted -> asc -> desc -> unsorted', () => {
    expect(cycleSort(null, 'name')).toEqual({ field: 'name', dir: 'asc' });
    expect(cycleSort({ field: 'name', dir: 'asc' }, 'name')).toEqual({
      field: 'name',
      dir: 'desc',
    });
    expect(cycleSort({ field: 'name', dir: 'desc' }, 'name')).toBeNull();
  });

  it('switching to a different column starts at asc', () => {
    expect(cycleSort({ field: 'name', dir: 'desc' }, 'fees')).toEqual({
      field: 'fees',
      dir: 'asc',
    });
  });
});
