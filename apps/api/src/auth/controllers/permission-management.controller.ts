/**
 * Permission Management Controller
 *
 * Handles permission management endpoints (12.5).
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  // ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../guards/clearance-level.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { DatabaseService } from '../../common/database/database.service';
import { PermissionPoolService } from '../services/permission-pool.service';
import { RoleType } from '@workspace/api';
import type { AuthenticatedRequest } from '../middleware';
import { RequireStepUp, StepUpGuard } from '../guards/step-up.guard';
import { STEP_UP_OPERATION } from '../step-up.operations';

/**
 * Assign Permission Pools to Role DTO
 *
 * Permission resolution is pools-only (see TenantQueriesService.resolveRolePoolPermissions);
 * roles never carry direct per-permission grants, so this assigns whole pools.
 */
export class AssignPermissionPoolsToRoleDto {
  poolIds: string[];
}

/** Gate 4: change a tenant permission pool's clearance level. */
export class UpdatePoolClearanceDto {
  clearanceLevel: number;
}

/**
 * Permission Management Controller
 *
 * Provides endpoints for viewing permissions and assigning them to roles.
 */
@ApiTags(SwaggerTags.permissions.name)
@Controller('permissions')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
export class PermissionManagementController {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly permissionPoolService: PermissionPoolService,
  ) {}

  /**
   * Get all permissions (12.5)
   *
   * GET /permissions
   */
  @Get()
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  async getPermissions(
    @Query('category') category?: string,
    @Query('resource') resource?: string,
    @Query('search') search?: string,
  ) {
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (resource) {
      where.resource = resource;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.dbService.client.permission.findMany({
      where,
      orderBy: [{ category: 'asc' }, { resource: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get permission by ID (12.5)
   *
   * GET /permissions/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiResponse({ status: 200, description: 'Permission details' })
  async getPermission(@Param('id') id: string) {
    const permission = await this.dbService.client.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    return permission;
  }

  /**
   * Get permissions by category (12.5)
   *
   * GET /permissions/category/:category
   */
  @Get('category/:category')
  @ApiOperation({ summary: 'Get permissions by category' })
  @ApiResponse({ status: 200, description: 'List of permissions in category' })
  async getPermissionsByCategory(@Param('category') category: string) {
    return this.dbService.client.permission.findMany({
      where: { category },
      orderBy: [{ resource: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get permissions for role (12.5)
   *
   * GET /permissions/role/:roleId
   */
  @Get('role/:roleId')
  @ApiOperation({ summary: 'Get permissions for a role' })
  @ApiResponse({ status: 200, description: 'List of permissions for role' })
  async getPermissionsForRole(@Param('roleId') roleId: string) {
    const role = await this.dbService.client.role.findUnique({
      where: { id: roleId },
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

    if (!role) {
      throw new Error('Role not found');
    }

    const permissions = new Map<string, any>();
    for (const rpool of role.rolePools) {
      for (const pp of rpool.pool.poolPermissions) {
        permissions.set(pp.permission.id, pp.permission);
      }
    }

    return Array.from(permissions.values());
  }

  /**
   * Assign permission pools to role (12.5)
   *
   * POST /permissions/role/:roleId/assign
   *
   * Permission resolution is pools-only — a role's permissions come entirely
   * from its assigned pools, so this gates every pool's clearanceLevel
   * against the target role's clearanceLevel before assigning. Without this
   * gate a clearance-7 caller could hand a low-clearance role permissions
   * (e.g. users.delete) that exceed what its clearance level should allow.
   */
  @Post('role/:roleId/assign')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.PERMISSIONS_MODIFY)
  @HttpCode(HttpStatus.OK)
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Assign permission pools to role' })
  @ApiResponse({
    status: 200,
    description: 'Permission pools assigned successfully',
  })
  async assignPermissionPoolsToRole(
    @Param('roleId') roleId: string,
    @Body() data: AssignPermissionPoolsToRoleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;

    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // Verify role exists and belongs to tenant
    const role = await this.dbService.client.role.findFirst({
      where: {
        id: roleId,
        OR: [
          {
            tenantId: null,
            roleType: { in: [RoleType.PLATFORM, RoleType.SYSTEM] },
          },
          { tenantId, roleType: RoleType.CUSTOM },
        ],
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Only allow assigning permission pools to custom roles
    if (role.roleType !== RoleType.CUSTOM) {
      throw new Error('Cannot assign permissions to system or platform roles');
    }

    // Gate: no pool may exceed the target role's clearance level
    const pools = await this.dbService.client.permissionPool.findMany({
      where: { id: { in: data.poolIds } },
    });

    if (pools.length !== data.poolIds.length) {
      throw new Error('One or more permission pools not found');
    }

    const overClearance = pools.filter(
      (p) => p.clearanceLevel > role.clearanceLevel,
    );
    if (overClearance.length > 0) {
      throw new Error(
        `Pools exceed role clearance level ${role.clearanceLevel}: ${overClearance.map((p) => p.name).join(', ')}`,
      );
    }

    // Replace existing pool assignments
    await this.dbService.client.rolePermissionPool.deleteMany({
      where: { roleId },
    });

    if (data.poolIds.length > 0) {
      await this.dbService.client.rolePermissionPool.createMany({
        data: data.poolIds.map((poolId) => ({
          roleId,
          poolId,
          assignedBy: user.userId,
        })),
      });
    }

    // Return updated role with pool-resolved permissions
    return this.dbService.client.role.findUnique({
      where: { id: roleId },
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
  }

  /**
   * Update a tenant permission pool's clearance level (Gate 4).
   *
   * PATCH /permissions/pool/:poolId/clearance
   *
   * Re-validates that every role currently referencing the pool still
   * out-ranks (or equals) the pool's new level (reject-and-list), so raising
   * a pool's clearance surfaces the conflict instead of silently dropping the
   * pool's permissions from under-clearance roles.
   */
  @Patch('pool/:poolId/clearance')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.PERMISSIONS_MODIFY)
  @HttpCode(HttpStatus.OK)
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({
    summary: "Update a permission pool's clearance level (Gate 4)",
  })
  @ApiResponse({ status: 200, description: 'Pool clearance updated' })
  async updatePoolClearance(
    @Param('poolId') poolId: string,
    @Body() data: UpdatePoolClearanceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.userContext?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant context required');
    }
    return this.permissionPoolService.updatePoolClearance(
      this.dbService.client,
      { poolId, tenantId, newClearanceLevel: data.clearanceLevel },
    );
  }
}
