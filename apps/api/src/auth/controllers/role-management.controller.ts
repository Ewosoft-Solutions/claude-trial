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
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  RequireClearanceLevel,
  ClearanceLevelGuard,
} from '../guards/clearance-level.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { RoleService, CreateCustomRoleInput } from '../services/role.service';
import { PermissionService } from '../services/permission.service';
import { RoleTemplateService } from '../services/role-template.service';
import { EffectiveAccessService } from '../services/effective-access.service';
import type { ScopeDescriptor } from '../services/access-scope.service';
import { DatabaseService } from '../../common/database/database.service';
import { RoleType, TenantQueriesService } from '@workspace/api';
import { AuthUser } from '../decorators';
import { withTenantScope } from '@workspace/database/rls';
import type { RequestUser } from '../types/request-user';
import { RequireStepUp, StepUpGuard } from '../guards/step-up.guard';
import { STEP_UP_OPERATION } from '../step-up.operations';

/**
 * Create Custom Role DTO.
 *
 * The global ValidationPipe runs `whitelist` + `forbidNonWhitelisted`, so EVERY
 * accepted property must carry a class-validator decorator — an undecorated DTO
 * makes every field non-whitelisted and the request 400s before the handler.
 * (`scope` is validated only as an object; its inner shape is defensively parsed
 * by the effective-access evaluator.)
 */
export class CreateCustomRoleDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  clearanceLevel: number;

  @IsArray()
  @IsString({ each: true })
  permissionPoolIds: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];

  // WB1-5: optional scope descriptor + the template this role was built from.
  @IsOptional()
  @IsObject()
  scope?: ScopeDescriptor | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  templateKey?: string | null;
}

/** Gate 4: change a custom role's clearance level. */
export class UpdateRoleClearanceDto {
  @IsInt()
  @Min(0)
  @Max(10)
  clearanceLevel: number;
}

/** WB1-5: preview the effective access of a role the editor is assembling. */
export class PreviewRoleDto {
  @IsInt()
  @Min(0)
  @Max(10)
  clearanceLevel: number;

  @IsArray()
  @IsString({ each: true })
  poolIds: string[];

  @IsOptional()
  @IsObject()
  scope?: ScopeDescriptor | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  templateKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string | null;
}

/** WB1-5: ask whether a role would allow one permission (optionally in a scope). */
export class ExplainAccessDto {
  @IsString()
  @MaxLength(120)
  permission: string;

  @IsOptional()
  @IsObject()
  targetScope?: ScopeDescriptor | null;
}

/**
 * Role Management Controller
 *
 * Provides endpoints for viewing and creating custom roles.
 */
@ApiTags(SwaggerTags.roles.name)
@Controller('roles')
// ClearanceLevelGuard is a no-op where no @RequireClearanceLevel is set (it
// allows when the metadata is absent), so getRoles/getRole keep their existing
// open-to-tenant behaviour while the management + effective-access reads below
// are actually enforced at clearance 7 (WB1-5 review: those reads exposed the
// permission matrix + holder emails ungated).
@UseGuards(JwtAuthGuard, TenantContextGuard, ClearanceLevelGuard)
@ApiBearerAuth('JWT-auth')
export class RoleManagementController {
  constructor(
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
    private readonly roleTemplateService: RoleTemplateService,
    private readonly effectiveAccess: EffectiveAccessService,
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
   * WB1-5 · Role templates the editor builds from (shared system + tenant).
   *
   * GET /roles/templates — declared before `:id` so it is not captured by it.
   */
  @Get('templates')
  @RequireClearanceLevel(7) // Management: the role editor is a management surface
  @ApiOperation({ summary: 'List role templates (presets) for the editor' })
  @ApiResponse({
    status: 200,
    description: 'Role templates with resolved pools',
  })
  async getTemplates(@AuthUser() user: RequestUser) {
    return this.roleTemplateService.list(this.dbService.client, user.tenantId);
  }

  /**
   * WB1-5 · Effective-access PREVIEW for a draft the editor is assembling —
   * the "explain access before you save" surface. Management (7) only, like
   * create.
   *
   * POST /roles/preview
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequireClearanceLevel(7)
  @ApiOperation({ summary: 'Preview a draft role’s effective access' })
  @ApiResponse({ status: 200, description: 'Effective access (matrix + SoD)' })
  async previewRole(
    @Body() data: PreviewRoleDto,
    @AuthUser() user: RequestUser,
  ) {
    return this.effectiveAccess.evaluateDraft(
      this.dbService.client,
      user.tenantId,
      {
        clearanceLevel: data.clearanceLevel,
        poolIds: data.poolIds ?? [],
        scope: data.scope ?? null,
        templateKey: data.templateKey ?? null,
        name: data.name ?? null,
      },
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
      scope: data.scope ?? null,
      templateKey: data.templateKey ?? null,
    };

    return this.roleService.createCustomRole(prisma, input);
  }

  /**
   * WB1-5 · Effective access of an EXISTING role — the matrix + SoD + sensitive
   * capabilities, each with its source pool and a plain-language reason.
   *
   * GET /roles/:id/effective-access
   */
  @Get(':id/effective-access')
  @RequireClearanceLevel(7) // reveals the full permission matrix
  @ApiOperation({ summary: 'Explain a role’s effective access' })
  @ApiResponse({ status: 200, description: 'Effective access' })
  async effectiveAccessForRole(
    @Param('id') id: string,
    @AuthUser() user: RequestUser,
  ) {
    return this.effectiveAccess.evaluateRole(
      this.dbService.client,
      user.tenantId,
      id,
    );
  }

  /**
   * WB1-5 · Ask whether a role allows one permission (optionally in a target
   * scope) — the per-permission "Allowed / Denied + why" of the preview.
   *
   * POST /roles/:id/explain
   */
  @Post(':id/explain')
  @HttpCode(HttpStatus.OK)
  @RequireClearanceLevel(7)
  @ApiOperation({ summary: 'Explain one access decision for a role' })
  @ApiResponse({ status: 200, description: 'Allow/deny + reason' })
  async explainRoleAccess(
    @Param('id') id: string,
    @Body() data: ExplainAccessDto,
    @AuthUser() user: RequestUser,
  ) {
    return this.effectiveAccess.explainRole(
      this.dbService.client,
      user.tenantId,
      id,
      { permission: data.permission, targetScope: data.targetScope ?? null },
    );
  }

  /**
   * WB1-5 · Who currently holds this role — the "who's affected" view before a
   * change.
   *
   * GET /roles/:id/affected
   */
  @Get(':id/affected')
  @RequireClearanceLevel(7) // exposes holder identities/emails
  @ApiOperation({ summary: 'Profiles that currently hold this role' })
  @ApiResponse({ status: 200, description: 'Affected profiles' })
  async affectedByRole(@Param('id') id: string, @AuthUser() user: RequestUser) {
    return this.effectiveAccess.whoIsAffected(
      this.dbService.client,
      user.tenantId,
      id,
    );
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
