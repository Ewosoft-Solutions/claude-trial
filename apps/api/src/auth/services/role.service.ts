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
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { RoleType, ClearanceLevel } from '@workspace/api';
import { MakerCheckerService } from './maker-checker.service';

/**
 * Custom Role Creation Input
 */
export interface CreateCustomRoleInput {
  name: string;
  description?: string;
  clearanceLevel: number; // Must be 0-7 for custom roles
  tenantId: string;
  permissionPoolIds: string[];
  permissionIds?: string[];
  createdBy: string;
  creatorClearanceLevel: number;
}

export interface CreateCustomRoleResult {
  role: any;
  approvalStatus: 'active' | 'pending_approval';
  approvalRequestId?: string;
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
  constructor(private readonly makerCheckerService: MakerCheckerService) {}
  /**
   * Validate role name uniqueness (4.15)
   *
   * Platform/system roles must be globally unique.
   * Custom roles must be unique per tenant.
   *
   * @param prisma - Prisma client instance
   * @param name - Role name
   * @param roleType - Role type
   * @param tenantId - Tenant ID (required for custom roles)
   * @param excludeRoleId - Role ID to exclude from check (for updates)
   * @returns Validation result
   */
  async validateRoleNameUniqueness(
    prisma: PrismaClient,
    name: string,
    roleType: RoleType,
    tenantId?: string,
    excludeRoleId?: string,
  ): Promise<RoleNameUniquenessResult> {
    if (roleType === RoleType.PLATFORM || roleType === RoleType.SYSTEM) {
      // Platform/system roles must be globally unique
      const existing = await prisma.role.findFirst({
        where: {
          name,
          roleType: { in: [RoleType.PLATFORM, RoleType.SYSTEM] },
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
    } else if (roleType === RoleType.CUSTOM) {
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
          roleType: RoleType.CUSTOM,
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
    if (
      input.clearanceLevel < ClearanceLevel.GUEST ||
      input.clearanceLevel > ClearanceLevel.MANAGEMENT
    ) {
      return {
        valid: false,
        error: 'Custom roles cannot exceed clearance level 7',
      };
    }

    // 2. Validate permission pools (required for custom roles)
    if (!input.permissionPoolIds || input.permissionPoolIds.length === 0) {
      return {
        valid: false,
        error: 'Custom roles must inherit from permission pools',
      };
    }

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

      // Check clearance levels for selected permissions
      const overClearance = permissions.filter(
        (p) => p.requiredClearanceLevel > input.clearanceLevel,
      );
      if (overClearance.length > 0) {
        return {
          valid: false,
          error: `Permissions require higher clearance level: ${overClearance
            .map((p) => p.name)
            .join(', ')}`,
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
  async createCustomRole(
    prisma: PrismaClient,
    input: CreateCustomRoleInput,
  ): Promise<CreateCustomRoleResult> {
    // 1. Validate role name uniqueness
    const nameCheck = await this.validateRoleNameUniqueness(
      prisma,
      input.name,
      RoleType.CUSTOM,
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

    // Enforce permission pools requirement for custom roles
    if (!input.permissionPoolIds || input.permissionPoolIds.length === 0) {
      throw new BadRequestException(
        'Custom roles must select permission pools matching their clearance level',
      );
    }

    const requiresApproval = input.clearanceLevel === ClearanceLevel.MANAGEMENT;

    // 3. Create role
    const role = await prisma.role.create({
      data: {
        name: input.name,
        description: input.description,
        roleType: RoleType.CUSTOM,
        clearanceLevel: input.clearanceLevel,
        tenantId: input.tenantId,
        isSystemRole: false,
        isActive: !requiresApproval,
        createdBy: input.createdBy,
      },
    });

    let approvalRequestId: string | undefined;

    if (requiresApproval) {
      approvalRequestId = await this.makerCheckerService.createApprovalRequest(
        prisma,
        'roles.custom.level7.create',
        input.createdBy,
        input.creatorClearanceLevel,
        {
          roleId: role.id,
          tenantId: input.tenantId,
          clearanceLevel: input.clearanceLevel,
        },
        input.tenantId,
      );
    }

    // 4. Assign permission pools (mandatory for custom roles)
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

    // Permission resolution is pools-only (see TenantQueriesService.resolveRolePoolPermissions) —
    // direct per-permission grants are not written here. `input.permissionIds`, when present, has
    // already been validated (clearance + pool membership) in validateCustomRoleCreation purely as
    // an input constraint; the role's actual permissions come entirely from its assigned pools.

    // 5. Return role with relations
    const roleWithRelations = await prisma.role.findUnique({
      where: { id: role.id },
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
    });

    return {
      role: roleWithRelations,
      approvalStatus: requiresApproval ? 'pending_approval' : 'active',
      approvalRequestId,
    };
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

  /**
   * Gate 4 (role side) — change a custom role's clearance level with the
   * update-time consistency check from
   * requirements/role-permissions-management.md.
   *
   * Lowering a role's clearance can strand pools whose own clearance now
   * exceeds it; rather than let Gate 3 silently narrow the role's effective
   * permissions, we reject-and-list the conflicting pools so the admin sees
   * the misconfiguration they are about to cause.
   */
  async updateRoleClearance(
    prisma: PrismaClient,
    input: {
      roleId: string;
      tenantId: string;
      newClearanceLevel: number;
      actorClearanceLevel: number;
    },
  ) {
    const { roleId, tenantId, newClearanceLevel, actorClearanceLevel } = input;

    if (
      !Number.isInteger(newClearanceLevel) ||
      newClearanceLevel < ClearanceLevel.GUEST ||
      newClearanceLevel > ClearanceLevel.MANAGEMENT
    ) {
      throw new BadRequestException(
        `Custom role clearance must be an integer between ${ClearanceLevel.GUEST} and ${ClearanceLevel.MANAGEMENT}`,
      );
    }

    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId, roleType: RoleType.CUSTOM },
      include: { rolePools: { include: { pool: true } } },
    });
    if (!role) {
      throw new NotFoundException('Custom role not found for this tenant');
    }

    // Actor must out-rank both the role's current and requested level, so a
    // change cannot smuggle a role past the actor's own authority.
    if (
      !this.canCreateCustomRole(actorClearanceLevel, newClearanceLevel) ||
      !this.canCreateCustomRole(actorClearanceLevel, role.clearanceLevel)
    ) {
      throw new ForbiddenException(
        "Insufficient clearance to change this role's clearance level",
      );
    }

    const conflictingPools = role.rolePools
      .map((rp) => rp.pool)
      .filter((pool) => pool.clearanceLevel > newClearanceLevel)
      .map((pool) => ({
        id: pool.id,
        name: pool.name,
        clearanceLevel: pool.clearanceLevel,
      }));

    if (conflictingPools.length > 0) {
      throw new BadRequestException({
        message: `Cannot lower role clearance to ${newClearanceLevel}: ${conflictingPools.length} assigned pool(s) exceed it. Detach them first.`,
        conflictingPools,
      });
    }

    return prisma.role.update({
      where: { id: roleId },
      data: { clearanceLevel: newClearanceLevel },
    });
  }
}
