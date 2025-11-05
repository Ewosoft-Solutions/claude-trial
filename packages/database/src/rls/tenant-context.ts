/**
 * Row-Level Security (RLS) Tenant Context
 *
 * Utilities for setting tenant context in database sessions for RLS policies.
 * This ensures that RLS policies can correctly filter data by tenant.
 */

import { PrismaClient } from '@workspace/database';

/**
 * Set tenant context for RLS
 *
 * Sets the tenant context in the database session so RLS policies
 * can filter data appropriately. This should be called before any
 * database queries that need tenant isolation.
 *
 * @param prisma - Prisma client instance
 * @param tenantId - Tenant ID to set as context
 */
export async function setTenantContext(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  // Use SET LOCAL for transaction-scoped context
  // This ensures context is only active for the current transaction
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_tenant_id = '${tenantId}'`,
  );
}

/**
 * Set user context for RLS
 *
 * Sets the user context in the database session for user-specific
 * RLS policies (e.g., users can only see their own data).
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to set as context
 */
export async function setUserContext(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
}

/**
 * Set both tenant and user context
 *
 * Convenience function to set both contexts at once.
 *
 * @param prisma - Prisma client instance
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
 * Clear tenant context
 *
 * Clears the tenant context from the database session.
 * Should be called after operations complete or on error.
 *
 * @param prisma - Prisma client instance
 */
export async function clearTenantContext(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = NULL`);
}

/**
 * Clear user context
 *
 * Clears the user context from the database session.
 *
 * @param prisma - Prisma client instance
 */
export async function clearUserContext(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = NULL`);
}

/**
 * Clear all contexts
 *
 * Convenience function to clear both tenant and user contexts.
 *
 * @param prisma - Prisma client instance
 */
export async function clearContext(prisma: PrismaClient): Promise<void> {
  await clearTenantContext(prisma);
  await clearUserContext(prisma);
}

/**
 * Execute query with tenant context
 *
 * Wrapper function that sets tenant context, executes a query,
 * and clears context afterwards. Useful for ensuring context is
 * properly managed even if an error occurs.
 *
 * @param prisma - Prisma client instance
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
