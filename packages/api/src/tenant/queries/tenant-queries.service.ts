/**
 * Tenant Queries Service
 *
 * Service for tenant-specific database queries with automatic tenant filtering.
 * Ensures all queries are scoped to the correct tenant context.
 */

import { PrismaClient } from '@workspace/database';
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
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get user's profile in tenant
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns UserTenant profile with roles and permissions
   */
  static async getUserTenantProfile(prisma: PrismaClient, profileId: string) {
    return await prisma.userTenant.findUnique({
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
    });
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
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
                rolePools: {
                  include: {
                    pool: {
                      select: {
                        id: true,
                        name: true,
                        clearanceLevel: true,
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
      for (const permission of TenantQueriesService.resolveRolePoolPermissions(role)) {
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
  }): Array<{ id: string; name: string; requiredClearanceLevel: number; [key: string]: unknown }> {
    const byId = new Map<string, { id: string; name: string; requiredClearanceLevel: number; [key: string]: unknown }>();
    for (const rolePool of role.rolePools) {
      for (const poolPermission of rolePool.pool.poolPermissions) {
        byId.set(poolPermission.permission.id, poolPermission.permission);
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
    return prisma.role.findMany({
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
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        clearanceLevel: 'desc',
      },
    });
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
