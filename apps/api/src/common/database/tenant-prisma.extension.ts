import { PrismaClient, Prisma } from '@workspace/database';

/**
 * Tenant-Aware Prisma Extension
 *
 * Automatically injects tenantId into queries for defense-in-depth.
 * Works alongside RLS (Row-Level Security) for multi-layer protection.
 *
 * IMPORTANT: This is OPTIONAL since you're using RLS with session variables.
 * Use this if you want application-level tenant filtering in addition to RLS.
 *
 * Usage:
 * ```ts
 * const tenantPrisma = withTenant(this.client, tenantId);
 * const users = await tenantPrisma.user.findMany();
 * // tenantId is automatically added to where clause
 * ```
 */
export function withTenant<T extends PrismaClient>(
  client: T,
  tenantId: string,
): T {
  const tenantScopedModels = new Set<Prisma.ModelName>([
    'AcademicYear',
    'Course',
    'Announcement',
    'Message',
    'TenantJWTConfig',
    'AuditLog',
    'Student',
    'GradingSystem',
    'UserTenant',
    'Role',
    'PermissionPool',
  ]);

  return client.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          // Skip models that are not tenant-scoped
          if (!tenantScopedModels.has(model)) {
            return query(args);
          }

          // Loosen args typing for mutation; we only apply to tenant-scoped models.
          const scopedArgs = args as {
            where?: Record<string, unknown>;
            data?: Record<string, unknown> | Record<string, unknown>[];
          };

          // Skip if tenantId already in where clause
          if (scopedArgs.where?.tenantId) {
            return query(scopedArgs);
          }

          // Add tenantId to where clause for read operations
          if (
            operation === 'findMany' ||
            operation === 'findFirst' ||
            operation === 'findUnique' ||
            operation === 'count' ||
            operation === 'aggregate' ||
            operation === 'groupBy'
          ) {
            scopedArgs.where = {
              ...scopedArgs.where,
              tenantId,
            };
          }

          // Add tenantId to data for write operations
          if (
            operation === 'create' ||
            operation === 'createMany' ||
            operation === 'update' ||
            operation === 'updateMany' ||
            operation === 'upsert'
          ) {
            if (scopedArgs.data) {
              if (Array.isArray(scopedArgs.data)) {
                // createMany case
                scopedArgs.data = scopedArgs.data.map((item) => ({
                  ...item,
                  tenantId,
                }));
              } else {
                // Single item case
                scopedArgs.data = {
                  ...scopedArgs.data,
                  tenantId,
                };
              }
            }
          }

          return query(scopedArgs);
        },
      },
    },
  }) as T;
}

/**
 * Create tenant-aware client with both extension and RLS context
 *
 * This combines Prisma extensions with RLS for maximum security.
 */
export async function createTenantClient(
  client: PrismaClient,
  tenantId: string,
  userId?: string,
): Promise<PrismaClient> {
  // Set RLS context
  const { setContext } = await import('@workspace/database/rls');
  await setContext(client, tenantId, userId);

  // Apply tenant extension
  return withTenant(client, tenantId);
}
