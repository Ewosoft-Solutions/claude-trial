/**
 * Role Service
 *
 * Handles role management with custom role creation constraints and validation.
 * Implements items 4.13, 4.15.
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';

/**
 * Custom Role Creation Input
 */
export interface CreateCustomRoleInput {
  name: string;
  description?: string;
  clearanceLevel: number; // Must be 0-7 for custom roles
  tenantId: string;
  permissionPoolIds?: string[];
  permissionIds?: string[];
  createdBy: string;
}

/**
 * Role Name Uniqueness Validation Result
 */
export interface RoleNameUniquenessResult {
  unique: boolean;
  error?: string;
}

/**
 * Custom Role Validation Result
 */
export interface CustomRoleValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Role Service
 *
 * Provides role management with custom role creation constraints.
 */
@Injectable()
export class RoleService {
  /**
   * Validate role name uniqueness (4.15)
   *
   * Platform/system roles must be globally unique.
   * Custom roles must be unique per tenant.
   *
   * @param prisma - Prisma client instance
   * @param name - Role name
   * @param roleType - Role type ('platform' | 'system' | 'custom')
   * @param tenantId - Tenant ID (required for custom roles)
   * @param excludeRoleId - Role ID to exclude from check (for updates)
   * @returns Validation result
   */
  async validateRoleNameUniqueness(
    prisma: PrismaClient,
    name: string,
    roleType: 'platform' | 'system' | 'custom',
    tenantId?: string,
    excludeRoleId?: string,
  ): Promise<RoleNameUniquenessResult> {
    if (roleType === 'platform' || roleType === 'system') {
      // Platform/system roles must be globally unique
      const existing = await prisma.role.findFirst({
        where: {
          name,
          roleType: { in: ['platform', 'system'] },
          tenantId: null,
          ...(excludeRoleId ? { id: { not: excludeRoleId } } : {}),
        },
      });

      if (existing) {
        return {
          unique: false,
          error: `Role name '${name}' already exists for platform/system roles`,
        };
      }
    } else if (roleType === 'custom') {
      // Custom roles must be unique per tenant
      if (!tenantId) {
        return {
          unique: false,
          error: 'Tenant ID is required for custom roles',
        };
      }

      const existing = await prisma.role.findFirst({
        where: {
          name,
          roleType: 'custom',
          tenantId,
          ...(excludeRoleId ? { id: { not: excludeRoleId } } : {}),
        },
      });

      if (existing) {
        return {
          unique: false,
          error: `Role name '${name}' already exists for this tenant`,
        };
      }
    }

    return { unique: true };
  }

  /**
   * Validate custom role creation (4.13)
   *
   * Ensures custom roles:
   * - Have clearance level 0-7 only
   * - Only inherit from permission pools matching their clearance level or below
   * - Cannot access platform-level permissions
   *
   * @param prisma - Prisma client instance
   * @param input - Custom role creation input
   * @returns Validation result
   */
  async validateCustomRoleCreation(
    prisma: PrismaClient,
    input: CreateCustomRoleInput,
  ): Promise<CustomRoleValidationResult> {
    // 1. Check clearance level constraint (0-7 only)
    if (input.clearanceLevel < 0 || input.clearanceLevel > 7) {
      return {
        valid: false,
        error: 'Custom roles cannot exceed clearance level 7',
      };
    }

    // 2. Validate permission pools if provided
    if (input.permissionPoolIds && input.permissionPoolIds.length > 0) {
      const pools = await prisma.permissionPool.findMany({
        where: {
          id: { in: input.permissionPoolIds },
        },
      });

      // Check if any pool exceeds the role's clearance level
      const maxPoolLevel = Math.max(...pools.map((p) => p.clearanceLevel));
      if (maxPoolLevel > input.clearanceLevel) {
        return {
          valid: false,
          error: `Selected permission pools exceed role clearance level ${input.clearanceLevel}`,
        };
      }
    }

    // 3. Validate individual permissions if provided
    if (input.permissionIds && input.permissionIds.length > 0) {
      const permissions = await prisma.permission.findMany({
        where: {
          id: { in: input.permissionIds },
        },
        include: {
          poolPermissions: {
            include: {
              pool: true,
            },
          },
        },
      });

      // Check for platform-level permissions
      const platformPermissions = permissions.filter(
        (p) => p.resource === 'platform',
      );
      if (platformPermissions.length > 0) {
        return {
          valid: false,
          error: 'Custom roles cannot include platform-level permissions',
        };
      }

      // Check if permissions are from valid pools
      if (input.permissionPoolIds && input.permissionPoolIds.length > 0) {
        const validPoolIds = new Set(input.permissionPoolIds);
        const invalidPermissions = permissions.filter((p) => {
          const permissionPoolIds = p.poolPermissions.map((pp) => pp.pool.id);
          return !permissionPoolIds.some((pid) => validPoolIds.has(pid));
        });

        if (invalidPermissions.length > 0) {
          return {
            valid: false,
            error: `Permissions not in selected pools: ${invalidPermissions.map((p) => p.name).join(', ')}`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Create custom role (4.13)
   *
   * Creates a custom role with validation and permission pool inheritance.
   *
   * @param prisma - Prisma client instance
   * @param input - Custom role creation input
   * @returns Created role
   */
  async createCustomRole(prisma: PrismaClient, input: CreateCustomRoleInput) {
    // 1. Validate role name uniqueness
    const nameCheck = await this.validateRoleNameUniqueness(
      prisma,
      input.name,
      'custom',
      input.tenantId,
    );

    if (!nameCheck.unique) {
      throw new BadRequestException(nameCheck.error);
    }

    // 2. Validate custom role constraints
    const validation = await this.validateCustomRoleCreation(prisma, input);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // 3. Create role
    const role = await prisma.role.create({
      data: {
        name: input.name,
        description: input.description,
        roleType: 'custom',
        clearanceLevel: input.clearanceLevel,
        tenantId: input.tenantId,
        isSystemRole: false,
        isActive: true,
        createdBy: input.createdBy,
      },
    });

    // 4. Assign permission pools if provided
    if (input.permissionPoolIds && input.permissionPoolIds.length > 0) {
      await prisma.rolePermissionPool.createMany({
        data: input.permissionPoolIds.map((poolId) => ({
          roleId: role.id,
          poolId,
          assignedBy: input.createdBy,
        })),
      });

      // Get permissions from pools and assign to role
      const pools = await prisma.permissionPool.findMany({
        where: {
          id: { in: input.permissionPoolIds },
        },
        include: {
          poolPermissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      const permissionIds = new Set<string>();
      for (const pool of pools) {
        for (const pp of pool.poolPermissions) {
          permissionIds.add(pp.permissionId);
        }
      }

      // Add any additional permissions
      if (input.permissionIds) {
        for (const permId of input.permissionIds) {
          permissionIds.add(permId);
        }
      }

      // Assign permissions to role
      if (permissionIds.size > 0) {
        await prisma.rolePermission.createMany({
          data: Array.from(permissionIds).map((permissionId) => ({
            roleId: role.id,
            permissionId,
            grantedBy: input.createdBy,
          })),
          skipDuplicates: true,
        });
      }
    } else if (input.permissionIds && input.permissionIds.length > 0) {
      // Assign permissions directly if no pools
      await prisma.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
          grantedBy: input.createdBy,
        })),
      });
    }

    // 5. Return role with relations
    return prisma.role.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        rolePools: {
          include: {
            pool: true,
          },
        },
      },
    });
  }

  /**
   * Check if user can create custom role
   *
   * Management (clearance 7) can create roles 0-6.
   * Owner (clearance 8) can create roles 0-7.
   *
   * @param userClearanceLevel - User's clearance level
   * @param requestedClearanceLevel - Requested clearance level for new role
   * @returns Whether user can create the role
   */
  canCreateCustomRole(
    userClearanceLevel: number,
    requestedClearanceLevel: number,
  ): boolean {
    // Only Management (7) and Owner (8) can create custom roles
    if (userClearanceLevel < 7) {
      return false;
    }

    // Management can create roles 0-6
    if (userClearanceLevel === 7 && requestedClearanceLevel >= 7) {
      return false;
    }

    // Owner can create roles 0-7
    if (userClearanceLevel === 8 && requestedClearanceLevel > 7) {
      return false;
    }

    return true;
  }
}
