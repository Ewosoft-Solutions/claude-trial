/**
 * Permission Management Controller
 *
 * Handles permission management endpoints (12.5).
 */

import {
  Controller,
  Get,
  Post,
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../guards/clearance-level.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { DatabaseService } from '../../common/database/database.service';
import { RoleType } from '@workspace/api';

/**
 * Assign Permissions to Role DTO
 */
export class AssignPermissionsToRoleDto {
  permissionIds: string[];
}

/**
 * Permission Management Controller
 *
 * Provides endpoints for viewing permissions and assigning them to roles.
 */
@ApiTags('permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
export class PermissionManagementController {
  constructor(private readonly dbService: DatabaseService) {}

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
        rolePermissions: {
          include: {
            permission: true,
          },
        },
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

    // Combine permissions from direct assignments and pools
    const permissions = new Map<string, any>();

    // Add direct permissions
    for (const rp of role.rolePermissions) {
      permissions.set(rp.permission.id, rp.permission);
    }

    // Add permissions from pools
    for (const rpool of role.rolePools) {
      for (const pp of rpool.pool.poolPermissions) {
        permissions.set(pp.permission.id, pp.permission);
      }
    }

    return Array.from(permissions.values());
  }

  /**
   * Assign permissions to role (12.5)
   *
   * POST /permissions/role/:roleId/assign
   */
  @Post('role/:roleId/assign')
  @HttpCode(HttpStatus.OK)
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Assign permissions to role' })
  @ApiResponse({
    status: 200,
    description: 'Permissions assigned successfully',
  })
  async assignPermissionsToRole(
    @Param('roleId') roleId: string,
    @Body() data: AssignPermissionsToRoleDto,
    @Request() req: any,
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

    // Only allow assigning permissions to custom roles
    if (role.roleType !== RoleType.CUSTOM) {
      throw new Error('Cannot assign permissions to system or platform roles');
    }

    // Remove existing permissions
    await this.dbService.client.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new permissions
    if (data.permissionIds.length > 0) {
      await this.dbService.client.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
          grantedBy: user.userId,
        })),
      });
    }

    // Return updated role with permissions
    return this.dbService.client.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }
}
