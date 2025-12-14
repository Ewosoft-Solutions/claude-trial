/**
 * Security Policy Controller
 *
 * Handles security policy management for school admins and platform admins
 * Implements items 4a.6, 4a.7, 4a.8, 4a.9
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import {
  SecurityPolicy,
  SecurityPolicyService,
} from '../services/security-policy.service';
import {
  AssignPolicyDto,
  ChangePolicyTierDto,
  SetEmergencyPolicyDto,
  // UpdatePolicyDto,
} from '../dto/security-policy.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { ClearanceLevelGuard } from '../guards/clearance-level.guard';
import { RequireClearanceLevel } from '../guards/clearance-level.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermissions } from '../guards/permission.guard';
import { type AuthenticatedRequest } from '../middleware/multi-layer-security.middleware';
import { EnforcedBy } from '@workspace/api';
import { AUDIT_ACTION, DatabaseService } from '../../common';

@ApiTags(SwaggerTags.securityPolicies.name)
@Controller('security-policies')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
export class SecurityPolicyController {
  constructor(
    private readonly securityPolicyService: SecurityPolicyService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Get school security policy (4a.6)
   *
   * School admins can view their school's security policy
   */
  @Get()
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(1) // School admin or higher
  @RequirePermissions(['security_policy:view'])
  @ApiOperation({ summary: 'Get current security policy for the tenant' })
  async getSchoolPolicy(
    @Request() req: AuthenticatedRequest,
  ): Promise<SecurityPolicy> {
    const { tenantId } = req.user;
    const prisma = this.dbService.client;

    const policy = await this.securityPolicyService.getOrCreateDefaultPolicy(
      prisma,
      tenantId,
    );

    return policy;
  }

  /**
   * Assign or update security policy (4a.6, 4a.8)
   *
   * School admins can assign or update their school's security policy
   */
  @Post()
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(2) // SuperAdmin or higher
  @RequirePermissions(['security_policy:manage'])
  @ApiOperation({ summary: 'Assign or update security policy tier' })
  async assignPolicy(
    @Request() req: AuthenticatedRequest,
    @Body() dto: AssignPolicyDto,
  ): Promise<any> {
    const { tenantId, userId, profileId } = req.user;
    const prisma = this.dbService.client;
    const userContext = req.userContext;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const oldPolicy = await this.securityPolicyService.getSchoolPolicy(
      prisma,
      tenantId,
    );

    const policy = await this.securityPolicyService.assignPolicy(
      prisma,
      tenantId,
      dto.tier,
      EnforcedBy.SCHOOL_ADMIN,
      userId,
      dto.reason,
    );

    // Log policy change (4a.9)
    await this.securityPolicyService.logPolicyChange(
      prisma,
      tenantId,
      AUDIT_ACTION.SECURITY.POLICY.ASSIGN_POLICY,
      userId,
      profileId,
      userContext?.roles?.[0]?.name || null,
      user?.email || null,
      {
        before: oldPolicy
          ? {
              policyTier: oldPolicy.policyTier,
            }
          : null,
        after: {
          policyTier: policy.policyTier,
        },
      },
      req.ip,
      req.headers['user-agent'],
      dto.reason,
    );

    return policy;
  }

  /**
   * Change policy tier (4a.8)
   *
   * School admins can upgrade or downgrade their school's security policy tier
   */
  @Put('tier')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(2) // SuperAdmin or higher
  @RequirePermissions(['security_policy:manage'])
  @ApiOperation({ summary: 'Change security policy tier' })
  async changePolicyTier(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePolicyTierDto,
  ): Promise<any> {
    const { tenantId, userId, profileId } = req.user;
    const prisma = this.dbService.client;
    const userContext = req.userContext;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const oldPolicy = await this.securityPolicyService.getSchoolPolicy(
      prisma,
      tenantId,
    );

    if (!oldPolicy) {
      throw new ForbiddenException('No security policy found for this school');
    }

    const policy = await this.securityPolicyService.changePolicyTier(
      prisma,
      tenantId,
      dto.newTier,
      EnforcedBy.SCHOOL_ADMIN,
      userId,
      dto.reason,
    );

    // Log policy change (4a.9)
    await this.securityPolicyService.logPolicyChange(
      prisma,
      tenantId,
      AUDIT_ACTION.SECURITY.POLICY.CHANGE_POLICY_TIER,
      userId,
      profileId,
      userContext?.roles?.[0]?.name || null,
      user?.email || null,
      {
        before: {
          policyTier: oldPolicy.policyTier,
        },
        after: {
          policyTier: policy.policyTier,
        },
      },
      req.ip,
      req.headers['user-agent'],
      dto.reason,
    );

    return policy;
  }
}

/**
 * Platform Admin Security Policy Controller
 *
 * Handles emergency policy management for platform admins
 * Implements item 4a.7
 */
@ApiTags(SwaggerTags.platformSecurityPolicies.name)
@Controller('platform/security-policies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PlatformSecurityPolicyController {
  constructor(
    private readonly securityPolicyService: SecurityPolicyService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Set emergency policy (4a.7)
   *
   * Platform admins can set emergency policies for any school
   */
  @Post(':schoolId/emergency')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(9) // SuperAdmin or Architect only
  @RequirePermissions(['security_policy:emergency_override'])
  @ApiOperation({ summary: 'Set emergency policy for a school' })
  async setEmergencyPolicy(
    @Request() req: AuthenticatedRequest,
    @Param('schoolId') schoolId: string,
    @Body() dto: SetEmergencyPolicyDto,
  ): Promise<any> {
    const { userId, profileId } = req.user;
    const prisma = this.dbService.client;
    const userContext = req.userContext;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const oldPolicy = await this.securityPolicyService.getSchoolPolicy(
      prisma,
      schoolId,
    );

    const policy = await this.securityPolicyService.setEmergencyPolicy(
      prisma,
      schoolId,
      dto.tier,
      userId,
      dto.reason,
    );

    // Log policy change (4a.9)
    await this.securityPolicyService.logPolicyChange(
      prisma,
      schoolId,
      AUDIT_ACTION.SECURITY.POLICY.SET_EMERGENCY_POLICY,
      userId,
      profileId,
      userContext?.roles?.[0]?.name || null,
      user?.email || null,
      {
        before: oldPolicy
          ? {
              policyTier: oldPolicy.policyTier,
              isEmergency: oldPolicy.isEmergency,
            }
          : null,
        after: {
          policyTier: policy.policyTier,
          isEmergency: policy.isEmergency,
        },
      },
      req.ip,
      req.headers['user-agent'],
      dto.reason,
    );

    return policy;
  }

  /**
   * Remove emergency policy (4a.7)
   *
   * Platform admins can remove emergency policies and revert to previous tier
   */
  @Delete(':schoolId/emergency')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(9) // SuperAdmin or Architect only
  @RequirePermissions(['security_policy:emergency_override'])
  @ApiOperation({ summary: 'Remove emergency policy for a school' })
  async removeEmergencyPolicy(
    @Request() req: AuthenticatedRequest,
    @Param('schoolId') schoolId: string,
  ): Promise<any> {
    const { userId, profileId } = req.user;
    const prisma = this.dbService.client;
    const userContext = req.userContext;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const oldPolicy = await this.securityPolicyService.getSchoolPolicy(
      prisma,
      schoolId,
    );

    if (!oldPolicy || !oldPolicy.isEmergency) {
      throw new ForbiddenException('No emergency policy found for this school');
    }

    const policy = await this.securityPolicyService.removeEmergencyPolicy(
      prisma,
      schoolId,
      userId,
    );

    // Log policy change (4a.9)
    await this.securityPolicyService.logPolicyChange(
      prisma,
      schoolId,
      AUDIT_ACTION.SECURITY.POLICY.REMOVE_EMERGENCY_POLICY,
      userId,
      profileId,
      userContext?.roles?.[0]?.name || null,
      user?.email || null,
      {
        before: {
          policyTier: oldPolicy.policyTier,
          isEmergency: oldPolicy.isEmergency,
        },
        after: {
          policyTier: policy.policyTier,
          isEmergency: policy.isEmergency,
        },
      },
      req.ip,
      req.headers['user-agent'],
      'Emergency policy removed, reverted to Basic tier',
    );

    return policy;
  }

  /**
   * Get security policy for any school (4a.7)
   *
   * Platform admins can view any school's security policy
   */
  @Get(':schoolId')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(9) // SuperAdmin or Architect only
  @RequirePermissions(['security_policy:view_all'])
  @ApiOperation({ summary: 'Get security policy for any school' })
  async getSchoolPolicy(
    @Request() req: AuthenticatedRequest,
    @Param('schoolId') schoolId: string,
  ): Promise<any> {
    const prisma = this.dbService.client;

    const policy = await this.securityPolicyService.getOrCreateDefaultPolicy(
      prisma,
      schoolId,
    );

    return policy;
  }
}
