/**
 * Row-Level Security (RLS) Tenant Context
 *
 * Utilities for setting tenant context in database sessions for RLS policies.
 * This ensures that RLS policies can correctly filter data by tenant.
 *
 * Implementation notes:
 * - Uses `set_config(setting, value, is_local=true)` — the function form of
 *   `SET LOCAL`. It is **transaction-scoped**, so it MUST be called inside a
 *   transaction (see `PrismaTransactionService.runInTransaction`); outside one
 *   it has no lasting effect on a pooled connection.
 * - The value is passed as a **bound parameter** via `$executeRaw` (tagged
 *   template), never string-interpolated — no SQL-injection surface even though
 *   the tenant/user id originates from a (trusted) JWT.
 * - RLS policies should read the value with
 *   `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` so a
 *   missing/empty context resolves to NULL (deny) rather than erroring.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Set tenant context for RLS (transaction-scoped).
 *
 * @param prisma - Prisma client/transaction instance
 * @param tenantId - Tenant ID to set as context
 */
export async function setTenantContext(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

/**
 * Set user context for RLS (transaction-scoped).
 *
 * @param prisma - Prisma client/transaction instance
 * @param userId - User ID to set as context
 */
export async function setUserContext(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
}

/**
 * Set both tenant and user context.
 *
 * @param prisma - Prisma client/transaction instance
 * @param tenantId - Tenant ID
 * @param userId - User ID (optional)
 */
export async function setContext(
  prisma: PrismaClient,
  tenantId: string,
  userId?: string,
): Promise<void> {
  await setTenantContext(prisma, tenantId);
  if (userId) {
    await setUserContext(prisma, userId);
  }
}

/**
 * Run `fn` in a session scoped to a single user, with no tenant context.
 *
 * For the pre-auth identity lookup only: between credential verification and
 * school selection there is no tenant yet, so `app.current_tenant_id` cannot be
 * set — discovering the user's tenants is precisely the question being asked.
 * The `tenant_isolation` policy on `profile.user_tenants` grants a session that
 * has proven which user it is read access to that user's own membership rows
 * across tenants (migration 20260723090000_user_tenants_self_scope), and to
 * nothing else. Writes are excluded from that grant.
 *
 * Opens its own transaction because `set_config(..., true)` is
 * transaction-scoped; the callback must use the supplied `tx`, not the outer
 * client, or it will run on a different pooled connection with no context.
 *
 * @param prisma - Prisma client to open the transaction on
 * @param userId - The authenticated user's id
 * @param fn - Work to run inside the user-scoped transaction
 */
export async function withUserScope<T>(
  prisma: PrismaClient,
  userId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!canOpenTransaction(prisma)) return fn(prisma);

  return prisma.$transaction(async (tx) => {
    await setUserContext(tx as unknown as PrismaClient, userId);
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * Whether this client can open a transaction of its own.
 *
 * A `Prisma.TransactionClient` — what a caller passes when it has *already*
 * opened a scope — has no `$transaction`. Nesting one is impossible, so the
 * scope helpers run the callback directly on it and inherit the caller's
 * context.
 *
 * Deliberately inherit rather than re-`set_config` inside the caller's
 * transaction: the GUC is transaction-scoped, so overwriting it would silently
 * change the scope of every subsequent statement in that transaction, not just
 * the wrapped read. Inheriting is only correct if the caller scoped to the same
 * tenant — which is the contract, since a service is called within its own
 * request's scope.
 */
function canOpenTransaction(prisma: PrismaClient): boolean {
  return (
    typeof (prisma as { $transaction?: unknown }).$transaction === 'function'
  );
}

/**
 * Run `fn` in a session scoped to one tenant (and optionally one user).
 *
 * The transaction-scoped counterpart of `withTenantContext` below: opens its
 * own transaction because `set_config(..., true)` is transaction-scoped, so on
 * a pooled connection the GUC would otherwise not apply to the queries that
 * follow. The callback must use the supplied `tx`, not the outer client.
 *
 * Note for auth flows: it is legitimate to scope to a tenantId the caller has
 * merely *claimed* (e.g. select-school validating a profile). The scope only
 * reveals rows belonging to the claimed tenant — it grants nothing across
 * tenants — and the caller's explicit ownership checks still decide the
 * outcome before anything is issued.
 *
 * @param prisma - Prisma client to open the transaction on
 * @param tenantId - Tenant to scope to
 * @param userId - Optional user id (sets `app.current_user_id` too)
 * @param fn - Work to run inside the scoped transaction
 */
export async function withTenantScope<T>(
  prisma: PrismaClient,
  tenantId: string,
  userId: string | undefined,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!canOpenTransaction(prisma)) return fn(prisma);

  return prisma.$transaction(async (tx) => {
    await setContext(tx as unknown as PrismaClient, tenantId, userId);
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * Run `fn` in a session authorised by possession of an invitation token.
 *
 * For the unauthenticated invitation-acceptance flow only. There is no user yet
 * (the account has no password until acceptance succeeds) and no tenant yet
 * (discovering it from the token IS the operation), so neither other scope can
 * be formed. The grant is exactly one row: the `user_tenants` row carrying this
 * token, read-only (migration 20260723180000_invitation_token_scope).
 *
 * The write that accepts the invitation must run under the tenant scope taken
 * from the row this read returns — the token grant is `USING` only.
 *
 * @param prisma - Prisma client to open the transaction on
 * @param token - The invitation token presented by the caller
 * @param fn - Work to run inside the token-scoped transaction
 */
export async function withInvitationTokenScope<T>(
  prisma: PrismaClient,
  token: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!canOpenTransaction(prisma)) return fn(prisma);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.invitation_token', ${token}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * Clear tenant context.
 *
 * Resets the GUC to an empty string. With transaction-scoped context this is
 * usually unnecessary (it resets at transaction end), but it is kept for the
 * session-scoped fallback path.
 *
 * @param prisma - Prisma client/transaction instance
 */
export async function clearTenantContext(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
}

/**
 * Clear user context.
 *
 * @param prisma - Prisma client/transaction instance
 */
export async function clearUserContext(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
}

/**
 * Clear all contexts.
 *
 * @param prisma - Prisma client/transaction instance
 */
export async function clearContext(prisma: PrismaClient): Promise<void> {
  await clearTenantContext(prisma);
  await clearUserContext(prisma);
}

/**
 * Execute a query with tenant context set, clearing it afterwards.
 *
 * NOTE: For real isolation this must run inside a transaction so the
 * transaction-scoped GUC applies to the wrapped queries on the same connection.
 * Prefer `PrismaTransactionService.runInTransaction`.
 *
 * @param prisma - Prisma client/transaction instance
 * @param tenantId - Tenant ID
 * @param query - Query function to execute
 * @param userId - Optional user ID
 */
export async function withTenantContext<T>(
  prisma: PrismaClient,
  tenantId: string,
  query: () => Promise<T>,
  userId?: string,
): Promise<T> {
  try {
    await setContext(prisma, tenantId, userId);
    return await query();
  } finally {
    await clearContext(prisma);
  }
}
