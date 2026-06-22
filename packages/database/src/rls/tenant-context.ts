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
