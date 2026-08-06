import type { PaginationSortOrder } from '@workspace/api';

/**
 * Allow-list mapping a public sort key → a function that builds the Prisma
 * `orderBy` fragments for a direction. Composite sorts (e.g. `name` →
 * lastName then firstName) return several fragments; the direction applies to
 * the primary key, and any tie-breakers are fixed for a stable order.
 */
export type SortAllowList<TOrderBy> = Record<
  string,
  (dir: PaginationSortOrder) => TOrderBy[]
>;

/**
 * Resolve a `PaginationDto`'s `sortBy`/`sortOrder` into a Prisma `orderBy`,
 * honouring an explicit per-endpoint allow-list.
 *
 * Why an allow-list rather than trusting `sortBy` directly: a raw column name
 * from the client is a footgun (sorting an un-indexed or relational column, or
 * a column that does not exist, either tanks the query or throws). The
 * allow-list also lets composite/tie-broken orders be expressed once.
 *
 * An absent or unknown `sortBy` falls back to the endpoint's default order — so
 * behaviour is unchanged for callers that don't sort, while endpoints stop
 * silently *ignoring* the sort params the DTO advertises (the bug this fixes).
 */
export function resolvePaginationOrderBy<TOrderBy>(
  sortBy: string | undefined,
  sortOrder: PaginationSortOrder | undefined,
  allow: SortAllowList<TOrderBy>,
  fallback: TOrderBy[],
): TOrderBy[] {
  const dir: PaginationSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
  const make = sortBy ? allow[sortBy] : undefined;
  return make ? make(dir) : fallback;
}
