/**
 * `toListQuery` maps the F7 directory URL encoding (q / page / size / sort /
 * f_*) onto the REST params a PaginationDto list endpoint expects (page /
 * limit / search / sortBy / sortOrder + mapped filters). These pin that
 * mapping so a server-driven list page and its endpoint stay in agreement.
 */
import { describe, expect, it } from 'vitest';

import { toListQuery } from './list-query';

function params(
  search: Record<string, string | string[] | undefined>,
  opts?: Parameters<typeof toListQuery>[1],
) {
  return Object.fromEntries(toListQuery(search, opts).params.entries());
}

describe('toListQuery', () => {
  it('defaults to page 1 and the given default page size', () => {
    expect(params({}, { defaultPageSize: 25 })).toEqual({
      page: '1',
      limit: '25',
    });
  });

  it('maps q → search, page, and size → limit', () => {
    expect(params({ q: 'ada', page: '2', size: '50' })).toMatchObject({
      page: '2',
      limit: '50',
      search: 'ada',
    });
  });

  it('splits a descending sort token into sortBy + sortOrder', () => {
    expect(params({ sort: '-title' })).toMatchObject({
      sortBy: 'title',
      sortOrder: 'desc',
    });
  });

  it('treats a bare sort token as ascending', () => {
    expect(params({ sort: 'title' })).toMatchObject({
      sortBy: 'title',
      sortOrder: 'asc',
    });
  });

  it('maps allow-listed filters (f_<key>) to their API param, ignoring others', () => {
    const out = params(
      { f_status: 'available', f_bogus: 'x' },
      { filters: { status: 'status' } },
    );
    expect(out.status).toBe('available');
    expect(out.bogus).toBeUndefined();
  });

  it('takes the first value of a repeated param', () => {
    expect(params({ q: ['first', 'second'] })).toMatchObject({
      search: 'first',
    });
  });
});
