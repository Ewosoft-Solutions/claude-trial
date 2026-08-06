import { describe, expect, it } from '@jest/globals';

import {
  resolvePaginationOrderBy,
  type SortAllowList,
} from './pagination-order';

/** A tiny stand-in for a Prisma orderBy fragment. */
type OrderBy = Record<string, 'asc' | 'desc' | Record<string, unknown>>;

const ALLOW: SortAllowList<OrderBy> = {
  name: (dir) => [{ lastName: dir }, { firstName: dir }],
  createdAt: (dir) => [{ createdAt: dir }],
};

const FALLBACK: OrderBy[] = [{ createdAt: 'desc' }];

describe('resolvePaginationOrderBy', () => {
  it('falls back to the default order when no sortBy is given', () => {
    expect(
      resolvePaginationOrderBy(undefined, undefined, ALLOW, FALLBACK),
    ).toBe(FALLBACK);
  });

  it('falls back when sortBy is not in the allow-list (never trusts raw input)', () => {
    // `password` is not allow-listed → must NOT reach the DB as an orderBy.
    expect(resolvePaginationOrderBy('password', 'asc', ALLOW, FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it('honours an allow-listed sortBy with the requested direction', () => {
    expect(
      resolvePaginationOrderBy('createdAt', 'asc', ALLOW, FALLBACK),
    ).toEqual([{ createdAt: 'asc' }]);
  });

  it('defaults an allow-listed sort to ascending when direction is omitted', () => {
    expect(
      resolvePaginationOrderBy('name', undefined, ALLOW, FALLBACK),
    ).toEqual([{ lastName: 'asc' }, { firstName: 'asc' }]);
  });

  it('applies the direction to a composite sort', () => {
    expect(resolvePaginationOrderBy('name', 'desc', ALLOW, FALLBACK)).toEqual([
      { lastName: 'desc' },
      { firstName: 'desc' },
    ]);
  });
});
