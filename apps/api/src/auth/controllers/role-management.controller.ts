/**
 * Role Management Controller
 *
 * Handles role management endpoints (12.4).
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireClearanceLevel } from '../guards/clearance-level.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { RoleService, CreateCustomRoleInput } from '../services/role.service';
import { PermissionService } from '../services/permission.service';
import { DatabaseService } from '../../common/database/database.service';
import { RoleType, TenantQueriesService } from '@workspace/api';
import { AuthUser } from '../decorators';
import { withTenantScope } from '@workspace/database/rls';
import type { RequestUser } from '../types/request-user';
import { RequireStepUp, StepUpGuard } from '../guards/step-up.guard';
import { STEP_UP_OPERATION } from '../step-up.operations';

/**
 * Create Custom Role DTO
 */
export class CreateCustomRoleDto {
  name: string;
  description?: string;
  clearanceLevel: number;
  permissionPoolIds: string[];
  permissionIds?: string[];
}

/** Gate 4: change a custom role's clearance level. */
export class UpdateRoleClearanceDto {
  clearanceLevel: number;
}

/**
 * Role Management Controller
 *
 * Provides endpoints for viewing and creating custom roles.
 */
@ApiTags(SwaggerTags.roles.name)
@Controller('roles')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
export class RoleManagementController {
  constructor(
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Get all roles for tenant (12.4)
   *
   * GET /roles
   */
  @Get()
  @ApiOperation({ summary: 'Get all roles for tenant' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  async getRoles(@AuthUser() user: RequestUser) {
    return TenantQueriesService.getTenantRoles(
      this.dbService.client,
      user.tenantId,
    );
  }

  /**
   * Get role by ID (12.4)
   *
   * GET /roles/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, description: 'Role details' })
  async getRole(@Param('id') id: string, @AuthUser() user: RequestUser) {
    const tenantId = user.tenantId;

    // Scoped: the OR spans global roles (tenant_id IS NULL, readable either
    // way under the nullable-tenant policy) and this tenant's custom roles,
    // which are not. Unscoped, the custom-role arm silently matches nothing.
    const role = await withTenantScope(
      this.dbService.client,
      tenantId,
      user.userId,
      (tx) =>
        tx.role.findFirst({
          where: {
            id,
            OR: [
              {
                tenantId: null,
                roleType: { in: [RoleType.PLATFORM, RoleType.SYSTEM] },
              },
              { tenantId, roleType: RoleType.CUSTOM },
            ],
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
        }),
    );

    if (!role) {
      throw new Error('Role not found');
    }

    return role;
  }

  /**
   * Create custom role (12.4)
   *
   * POST /roles
   *
   * A role's clearanceLevel is changed through PATCH /roles/:id/clearance
   * below, which applies Gate 4 (update-time consistency) from
   * requirements/role-permissions-management.md — a pool's clearanceLevel
   * likewise through PATCH /permissions/pool/:id/clearance.
   */
  @Post()
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.ROLES_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Create custom role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  async createCustomRole(
    @Body() data: CreateCustomRoleDto,
    @AuthUser() user: RequestUser,
  ) {
    const prisma = this.dbService.client;
    const tenantId = user.tenantId;

    const userPermissionContext =
      await this.permissionService.getUserPermissionContext(
        prisma,
        user.userId,
        tenantId,
        user.profileId,
      );

    const userClearanceLevel = userPermissionContext?.clearanceLevel || 0;

    if (
      !this.roleService.canCreateCustomRole(
        userClearanceLevel,
        data.clearanceLevel,
      )
    ) {
      throw new ForbiddenException(
        'Insufficient clearance level to create role with requested clearance level',
      );
    }

    if (!data.permissionPoolIds || data.permissionPoolIds.length === 0) {
      throw new BadRequestException(
        'permissionPoolIds is required and cannot be empty for custom roles',
      );
    }

    const input: CreateCustomRoleInput = {
      name: data.name,
      description: data.description,
      clearanceLevel: data.clearanceLevel,
      tenantId,
      permissionPoolIds: data.permissionPoolIds,
      permissionIds: data.permissionIds,
      createdBy: user.userId,
      creatorClearanceLevel: userClearanceLevel,
    };

    return this.roleService.createCustomRole(prisma, input);
  }

  /**
   * Update a custom role's clearance level (Gate 4).
   *
   * PATCH /roles/:id/clearance
   *
   * Re-validates that no pool already assigned to the role exceeds the new
   * level (reject-and-list), so lowering a role's clearance surfaces the
   * conflict instead of silently narrowing its permissions.
   */
  @Patch(':id/clearance')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.ROLES_UPDATE)
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: "Update a custom role's clearance level (Gate 4)" })
  @ApiResponse({ status: 200, description: 'Role clearance updated' })
  async updateRoleClearance(
    @Param('id') id: string,
    @Body() data: UpdateRoleClearanceDto,
    @AuthUser() user: RequestUser,
  ) {
    const prisma = this.dbService.client;
    const context = await this.permissionService.getUserPermissionContext(
      prisma,
      user.userId,
      user.tenantId,
      user.profileId,
    );
    return this.roleService.updateRoleClearance(prisma, {
      roleId: id,
      tenantId: user.tenantId,
      newClearanceLevel: data.clearanceLevel,
      actorClearanceLevel: context?.clearanceLevel ?? 0,
    });
  }
}
