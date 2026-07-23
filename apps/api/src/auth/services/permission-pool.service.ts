/**
 * Permission Pool Service
 *
 * Handles permission pool inheritance system.
 * Implements item 4.12.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { withTenantScope } from '@workspace/database/rls';
import { AuditAction } from 'src/common';

/**
 * Permission Pool with Permissions
 */
export interface PermissionPoolWithPermissions {
  id: string;
  name: string;
  clearanceLevel: number;
  description?: string;
  isSystemPool: boolean;
  tenantId?: string;
  permissions: Array<{
    id: string;
    name: string;
    label: string;
    resource: string;
    action: AuditAction;
  }>;
}

/**
 * Permission Pool Service
 *
 * Provides permission pool management and inheritance.
 */
@Injectable()
export class PermissionPoolService {
  /**
   * Get permission pools by clearance level (4.12)
   *
   * Returns pools that match or are below the specified clearance level.
   *
   * @param prisma - Prisma client instance
   * @param clearanceLevel - Maximum clearance level
   * @param tenantId - Optional tenant ID for tenant-specific pools
   * @returns Permission pools
   */
  async getPermissionPoolsByClearanceLevel(
    prisma: PrismaClient,
    clearanceLevel: number,
    tenantId?: string,
  ): Promise<PermissionPoolWithPermissions[]> {
    // Scoped when a tenant is in play: system pools (tenant_id IS NULL) resolve
    // either way under the nullable-tenant policy, but the tenant-specific arm
    // of this OR silently matches nothing without it.
    const run = <T>(fn: (tx: PrismaClient) => Promise<T>) =>
      tenantId ? withTenantScope(prisma, tenantId, undefined, fn) : fn(prisma);

    const pools = await run((tx) =>
      tx.permissionPool.findMany({
        where: {
          clearanceLevel: { lte: clearanceLevel },
          OR: [
            { tenantId: null }, // System pools
            ...(tenantId ? [{ tenantId }] : []), // Tenant-specific pools
          ],
        },
        include: {
          poolPermissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: {
          clearanceLevel: 'desc',
        },
      }),
    );

    return pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      clearanceLevel: pool.clearanceLevel,
      description: pool.description || undefined,
      isSystemPool: pool.isSystemPool,
      tenantId: pool.tenantId || undefined,
      permissions: pool.poolPermissions.map((pp) => ({
        id: pp.permission.id,
        name: pp.permission.name,
        label: pp.permission.label,
        resource: pp.permission.resource,
        action: pp.permission.action as AuditAction,
      })),
    }));
  }

  /**
   * Get permissions from pools (4.12)
   *
   * Returns all permissions from the specified permission pools.
   *
   * @param prisma - Prisma client instance
   * @param poolIds - Permission pool IDs
   * @returns Permissions
   */
  async getPermissionsFromPools(
    prisma: PrismaClient,
    poolIds: string[],
  ): Promise<Array<{ id: string; name: string; label: string }>> {
    const pools = await prisma.permissionPool.findMany({
      where: {
        id: { in: poolIds },
      },
      include: {
        poolPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const permissionMap = new Map<
      string,
      { id: string; name: string; label: string }
    >();

    for (const pool of pools) {
      for (const pp of pool.poolPermissions) {
        if (!permissionMap.has(pp.permission.id)) {
          permissionMap.set(pp.permission.id, {
            id: pp.permission.id,
            name: pp.permission.name,
            label: pp.permission.label,
          });
        }
      }
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Validate permission pool assignment (4.12)
   *
   * Ensures pools match the role's clearance level.
   *
   * @param prisma - Prisma client instance
   * @param roleId - Role ID
   * @param poolIds - Permission pool IDs to assign
   * @returns Validation result
   */
  async validatePermissionPoolAssignment(
    prisma: PrismaClient,
    roleId: string,
    poolIds: string[],
  ): Promise<{ valid: boolean; error?: string }> {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role?.id) {
      return { valid: false, error: 'Role not found' };
    }

    const pools = await prisma.permissionPool.findMany({
      where: {
        id: { in: poolIds },
      },
    });

    // Fail closed on any pool that did not resolve — otherwise the check below
    // is fail-OPEN, because `Math.max(...[])` is -Infinity and never exceeds
    // the role's clearance level. A pool hidden by RLS, or simply a bad id,
    // would validate silently.
    if (pools.length !== poolIds.length) {
      return {
        valid: false,
        error: 'One or more permission pools were not found',
      };
    }

    // Check if any pool exceeds the role's clearance level
    const maxPoolLevel = Math.max(...pools.map((p) => p.clearanceLevel));
    if (maxPoolLevel > role?.clearanceLevel) {
      return {
        valid: false,
        error: `Selected permission pools exceed role clearance level ${role.clearanceLevel}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get system permission pools (4.12)
   *
   * Returns all system-defined permission pools.
   *
   * @param prisma - Prisma client instance
   * @returns System permission pools
   */
  async getSystemPermissionPools(
    prisma: PrismaClient,
  ): Promise<PermissionPoolWithPermissions[]> {
    const pools = await prisma.permissionPool.findMany({
      where: {
        isSystemPool: true,
        tenantId: null,
      },
      include: {
        poolPermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        clearanceLevel: 'desc',
      },
    });

    return pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      clearanceLevel: pool.clearanceLevel,
      description: pool.description || undefined,
      isSystemPool: pool.isSystemPool,
      tenantId: pool.tenantId || undefined,
      permissions: pool.poolPermissions.map((pp) => ({
        id: pp.permission.id,
        name: pp.permission.name,
        label: pp.permission.label,
        resource: pp.permission.resource,
        action: pp.permission.action as AuditAction,
      })),
    }));
  }

  /**
   * Gate 4 (pool side) — change a permission pool's clearance level with the
   * update-time consistency check from
   * requirements/role-permissions-management.md.
   *
   * Raising a pool's clearance can strand roles that reference it but now sit
   * below the pool's new level; rather than let Gate 3 silently drop the
   * pool's permissions from those roles, reject-and-list the affected roles.
   * Only tenant-owned pools are mutable — system pools are shared and immutable.
   */
  async updatePoolClearance(
    prisma: PrismaClient,
    input: { poolId: string; tenantId: string; newClearanceLevel: number },
  ) {
    const { poolId, tenantId, newClearanceLevel } = input;

    if (
      !Number.isInteger(newClearanceLevel) ||
      newClearanceLevel < 0 ||
      newClearanceLevel > 10
    ) {
      throw new BadRequestException(
        'Permission pool clearance must be an integer between 0 and 10',
      );
    }

    // Read, check and write in one scope. The conflict check below rests on
    // `rolePools.role` resolving: unscoped, those roles are invisible,
    // `conflictingRoles` comes back empty, and the pool's clearance is raised
    // above roles that still reference it.
    return withTenantScope(prisma, tenantId, undefined, async (tx) => {
      const pool = await tx.permissionPool.findUnique({
        where: { id: poolId },
        include: { rolePools: { include: { role: true } } },
      });
      if (!pool) {
        throw new NotFoundException('Permission pool not found');
      }
      if (pool.isSystemPool || pool.tenantId !== tenantId) {
        throw new ForbiddenException(
          'System permission pools cannot be modified',
        );
      }

      const conflictingRoles = pool.rolePools
        .map((rp) => rp.role)
        .filter((role) => role.clearanceLevel < newClearanceLevel)
        .map((role) => ({
          id: role.id,
          name: role.name,
          clearanceLevel: role.clearanceLevel,
        }));

      if (conflictingRoles.length > 0) {
        throw new BadRequestException({
          message: `Cannot raise pool clearance to ${newClearanceLevel}: ${conflictingRoles.length} assigned role(s) fall below it. Detach the pool from them first.`,
          conflictingRoles,
        });
      }

      return tx.permissionPool.update({
        where: { id: poolId },
        data: { clearanceLevel: newClearanceLevel },
      });
    });
  }
}
