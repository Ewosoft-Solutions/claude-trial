/**
 * Permission Pool Service
 *
 * Handles permission pool inheritance system.
 * Implements item 4.12.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
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
    const pools = await prisma.permissionPool.findMany({
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
}
