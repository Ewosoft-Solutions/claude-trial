/**
 * Tenant Queries Service
 *
 * Service for tenant-specific database queries with automatic tenant filtering.
 * Ensures all queries are scoped to the correct tenant context.
 */

import { PrismaClient } from '@workspace/database';
import { withTenantScope } from '@workspace/database/rls';
import { ProfileStatus, RoleType } from '@workspace/api';

/**
 * Tenant Queries Service
 *
 * Provides tenant-scoped database queries with automatic tenant filtering.
 */
export class TenantQueriesService {
  /**
   * Get tenant with full details
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Tenant with relations
   */
  static async getTenant(prisma: PrismaClient, tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        roles: {
          where: { isActive: true },
          include: {
            rolePools: {
              include: {
                pool: {
                  include: {
                    poolPermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get user's profile in tenant, with its role, pools and permission overrides.
   *
   * This is the read behind every authorization decision, so it runs under an
   * explicit tenant scope: `user_tenants`, `user_tenant_roles` and
   * `user_tenant_permissions` are all FORCE RLS and strictly tenant-scoped, and
   * callers reach here from guards — which run before the `@TenantScoped`
   * interceptor, so no request scope exists yet.
   *
   * `tenantId` is required rather than optional on purpose: an unscoped call
   * silently returns null under RLS (denying a legitimate user) or, on a
   * connection that does bypass RLS, returns a profile from another tenant.
   * Making it mandatory turns both into compile errors.
   *
   * @param prisma - Prisma client instance
   * @param profileId - UserTenant id to load
   * @param tenantId - Tenant the profile must belong to (RLS scope)
   * @returns UserTenant profile with roles and permissions
   */
  static async getUserTenantProfile(
    prisma: PrismaClient,
    profileId: string,
    tenantId: string,
  ) {
    return await withTenantScope(prisma, tenantId, undefined, (tx) =>
      tx.userTenant.findUnique({
        where: { id: profileId },
        include: {
          // one-to-one role per profile
          userTenantRole: {
            include: {
              role: {
                include: {
                  // Permission pools are the single canonical source of a
                  // role's permissions (see resolveRolePoolPermissions) —
                  // the direct RolePermission join is intentionally not
                  // queried here to keep permission resolution unambiguous.
                  rolePools: {
                    include: {
                      pool: {
                        include: {
                          poolPermissions: {
                            include: {
                              permission: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          userTenantPermissions: {
            include: {
              permission: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      }),
    );
  }

  /**
   * Get user's roles in tenant
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Array of roles with permissions
   */
  static async getUserTenantRoles(prisma: PrismaClient, profileId: string) {
    const userTenant = await prisma.userTenant.findUnique({
      where: { id: profileId },
      include: {
        userTenantRole: {
          include: {
            role: {
              include: {
                rolePools: {
                  include: {
                    pool: {
                      include: {
                        poolPermissions: {
                          include: {
                            permission: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return userTenant?.userTenantRole?.role
      ? [userTenant.userTenantRole.role]
      : [];
  }

  /**
   * Get user's permissions in tenant (role + profile-specific)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Array of permissions (with granted/denied status)
   */
  static async getUserTenantPermissions(
    prisma: PrismaClient,
    profileId: string,
  ) {
    const userTenant = await prisma.userTenant.findUnique({
      where: { id: profileId },
      include: {
        userTenantRole: {
          include: {
            role: {
              include: {
                // Permission pools are the single canonical source of a
                // role's permissions — see resolveRolePoolPermissions.
                rolePools: {
                  include: {
                    pool: {
                      include: {
                        poolPermissions: {
                          include: {
                            permission: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        userTenantPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!userTenant) {
      return [];
    }

    // Collect all permissions granted to the role via its pools
    const rolePermissions = new Map<string, boolean>();
    const role = userTenant.userTenantRole?.role;
    if (role) {
      for (const permission of TenantQueriesService.resolveRolePoolPermissions(
        role,
      )) {
        rolePermissions.set(permission.name, true);
      }
    }

    // Apply profile-specific overrides
    for (const utp of userTenant.userTenantPermissions) {
      rolePermissions.set(utp.permission.name, utp.granted);
    }

    // Convert to array
    const permissions = Array.from(rolePermissions.entries()).map(
      ([name, granted]) => ({
        name,
        granted,
      }),
    );

    return permissions;
  }

  /**
   * Resolve a role's effective permissions from its permission pools.
   *
   * Permission pools are the single canonical source of a role's
   * permissions — a role is never granted permissions directly. Dedupes
   * across pools (a role may belong to more than one pool) by permission id.
   *
   * @param role - A Role loaded with `rolePools.pool.poolPermissions.permission`
   * @returns Deduplicated array of Permission records
   */
  static resolveRolePoolPermissions(role: {
    clearanceLevel: number;
    rolePools: Array<{
      pool: {
        poolPermissions: Array<{
          permission: {
            id: string;
            name: string;
            requiredClearanceLevel: number;
            [key: string]: unknown;
          };
        }>;
      };
    }>;
  }): Array<{
    id: string;
    name: string;
    requiredClearanceLevel: number;
    [key: string]: unknown;
  }> {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        requiredClearanceLevel: number;
        [key: string]: unknown;
      }
    >();
    for (const rolePool of role.rolePools) {
      for (const poolPermission of rolePool.pool.poolPermissions) {
        // Clearance is a floor at resolution time: never issue a permission
        // whose requiredClearanceLevel exceeds the role's own clearanceLevel,
        // regardless of how the pool-role assignment got there. Guards against
        // a pool's clearance level being raised after assignment.
        if (
          poolPermission.permission.requiredClearanceLevel <=
          role.clearanceLevel
        ) {
          byId.set(poolPermission.permission.id, poolPermission.permission);
        }
      }
    }
    return Array.from(byId.values());
  }

  /**
   * Get all users in tenant
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param options - Query options
   * @returns Array of user profiles
   */
  static async getTenantUsers(
    prisma: PrismaClient,
    tenantId: string,
    options?: {
      status?: ProfileStatus;
      includeSuspended?: boolean;
    },
  ) {
    const where: any = {
      tenantId,
    };

    if (options?.status) {
      where.status = options.status;
    }

    if (!options?.includeSuspended) {
      where.suspended = false;
    }

    return prisma.userTenant.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        userTenantRole: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  /**
   * Get tenant roles (system + custom)
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @returns Array of roles
   */
  static async getTenantRoles(prisma: PrismaClient, tenantId: string) {
    // Scoped: the OR spans global roles (readable unscoped under the
    // nullable-tenant policy) and this tenant's custom roles, which are not.
    return withTenantScope(prisma, tenantId, undefined, (tx) =>
      tx.role.findMany({
        where: {
          OR: [
            {
              tenantId: null,
              roleType: { in: [RoleType.PLATFORM, RoleType.SYSTEM] },
            }, // System roles
            { tenantId, roleType: RoleType.CUSTOM }, // Custom roles for this tenant
          ],
          isActive: true,
        },
        include: {
          rolePools: {
            include: {
              pool: {
                include: {
                  poolPermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          clearanceLevel: 'desc',
        },
      }),
    );
  }

  /**
   * Query with automatic tenant filtering
   *
   * Helper to ensure all queries are scoped to tenant.
   * Use this for queries that need tenant context.
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param queryFn - Query function that receives tenant-scoped prisma
   * @returns Query result
   */
  static async withTenantContext<T>(
    prisma: PrismaClient,
    tenantId: string,
    queryFn: (scopedPrisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    // In a real implementation, this would set RLS context
    // For now, we rely on explicit tenantId filtering in queries
    return queryFn(prisma);
  }
}
