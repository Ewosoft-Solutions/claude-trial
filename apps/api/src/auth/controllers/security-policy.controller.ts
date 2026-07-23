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
  Patch,
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
  EffectiveSessionPolicy,
  SessionPolicyService,
} from '../services/session-policy.service';
import {
  AssignPolicyDto,
  ChangePolicyTierDto,
  SetEmergencyPolicyDto,
  UpdateSessionPolicyDto,
  UpdateBiometricEnrollmentPolicyDto,
  UpdateSensitiveOperationPolicyDto,
  CreateSensitiveOperationChangeRequestDto,
  ReviewSensitiveOperationChangeRequestDto,
  // UpdatePolicyDto,
} from '../dto/security-policy.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import {
  ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../guards/clearance-level.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../guards/permission.guard';
import { type AuthenticatedRequest } from '../middleware/multi-layer-security.middleware';
import { EnforcedBy, PermissionMode } from '@workspace/api';
import { AUDIT_ACTION, DatabaseService } from '../../common';
import { AUDIT_EVENT } from '../../common';
import { SensitiveOperationPolicyService } from '../services/sensitive-operation-policy.service';
import { RequireStepUp, StepUpGuard } from '../guards/step-up.guard';
import { STEP_UP_OPERATION } from '../step-up.operations';
import { Prisma } from '@workspace/database';
import { writeAuditLog } from '../../common/audit/audit-writer';

@ApiTags(SwaggerTags.securityPolicies.name)
@Controller('security-policies')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
export class SecurityPolicyController {
  constructor(
    private readonly securityPolicyService: SecurityPolicyService,
    private readonly sessionPolicyService: SessionPolicyService,
    private readonly sensitiveOperationPolicies: SensitiveOperationPolicyService,
    private readonly dbService: DatabaseService,
  ) {}

  @Get('biometrics')
  @UseGuards(PermissionGuard)
  @RequirePermissions(
    ['settings.view', 'settings.security'],
    PermissionMode.ANY,
  )
  @ApiOperation({ summary: 'Get this tenant biometric enrolment policy' })
  getBiometricEnrollmentPolicy(@Request() req: AuthenticatedRequest) {
    return this.sensitiveOperationPolicies.getBiometricEnrollmentPolicy(
      this.dbService.client,
      req.user.tenantId,
    );
  }

  @Patch('biometrics')
  @UseGuards(PermissionGuard, StepUpGuard)
  @RequirePermissions(['settings.security'])
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
  @ApiOperation({ summary: 'Update this tenant biometric enrolment policy' })
  async updateBiometricEnrollmentPolicy(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateBiometricEnrollmentPolicyDto,
  ) {
    const before =
      await this.sensitiveOperationPolicies.getBiometricEnrollmentPolicy(
        this.dbService.client,
        req.user.tenantId,
      );
    const after =
      await this.sensitiveOperationPolicies.updateBiometricEnrollmentPolicy(
        this.dbService.client,
        req.user.tenantId,
        dto.policy,
        req.user.userId,
      );
    await this.recordGovernanceAudit(
      req,
      AUDIT_ACTION.SECURITY.POLICY.UPDATE_BIOMETRIC_ENROLLMENT_POLICY,
      'biometric_enrollment_policy',
      req.user.tenantId,
      { before, after },
    );
    return after;
  }

  @Get('step-up-policies')
  @UseGuards(PermissionGuard)
  @RequirePermissions(
    ['settings.view', 'settings.security'],
    PermissionMode.ANY,
  )
  @ApiOperation({ summary: 'Get the platform-owned sensitive-action summary' })
  getSensitiveOperationSummary() {
    return this.sensitiveOperationPolicies.listPolicies(this.dbService.client);
  }

  @Get('step-up-change-requests')
  @UseGuards(PermissionGuard)
  @RequirePermissions(
    ['settings.view', 'settings.security'],
    PermissionMode.ANY,
  )
  @ApiOperation({ summary: 'List this tenant policy change requests' })
  getSensitiveOperationChangeRequests(@Request() req: AuthenticatedRequest) {
    return this.sensitiveOperationPolicies.listTenantChangeRequests(
      this.dbService.client,
      req.user.tenantId,
    );
  }

  @Post('step-up-change-requests')
  @UseGuards(PermissionGuard)
  @RequirePermissions(['settings.security'])
  @ApiOperation({
    summary: 'Request a platform sensitive-action policy change',
  })
  async createSensitiveOperationChangeRequest(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateSensitiveOperationChangeRequestDto,
  ) {
    const request = await this.sensitiveOperationPolicies.createChangeRequest(
      this.dbService.client,
      req.user.tenantId,
      req.user.userId,
      dto,
    );
    await this.recordGovernanceAudit(
      req,
      AUDIT_ACTION.SECURITY.POLICY.REQUEST_SENSITIVE_OPERATION_CHANGE,
      'sensitive_operation_change_request',
      request.id,
      { operation: request.operation },
    );
    return request;
  }

  @Get('session')
  @UseGuards(PermissionGuard)
  @RequirePermissions(
    ['settings.view', 'settings.security'],
    PermissionMode.ANY,
  )
  @ApiOperation({
    summary: 'Get the effective inactivity policy for this tenant',
  })
  getSessionPolicy(
    @Request() req: AuthenticatedRequest,
  ): Promise<EffectiveSessionPolicy> {
    return this.sessionPolicyService.getEffectivePolicy(
      this.dbService.client,
      req.user.tenantId,
    );
  }

  @Patch('session')
  @UseGuards(PermissionGuard, StepUpGuard)
  @RequirePermissions(['settings.security'])
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
  @ApiOperation({ summary: 'Update this tenant inactivity policy' })
  async updateSessionPolicy(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateSessionPolicyDto,
  ): Promise<EffectiveSessionPolicy> {
    const before = await this.sessionPolicyService.getEffectivePolicy(
      this.dbService.client,
      req.user.tenantId,
    );
    const after = await this.sessionPolicyService.updateIdleTimeout(
      this.dbService.client,
      req.user.tenantId,
      dto.idleTimeoutMinutes,
      req.user.userId,
      EnforcedBy.SCHOOL_ADMIN,
    );
    await this.securityPolicyService.logPolicyChange(
      this.dbService.client,
      req.user.tenantId,
      AUDIT_ACTION.SECURITY.POLICY.UPDATE_SESSION_POLICY,
      req.user.userId,
      req.user.profileId,
      req.userContext?.roleId ?? null,
      null,
      { before, after },
      req.ip,
      req.headers['user-agent'],
      'Tenant inactivity policy updated',
    );
    return after;
  }

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
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
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
      userContext?.roleId || null,
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
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
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
      userContext?.roleId || null,
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

  private async recordGovernanceAudit(
    req: AuthenticatedRequest,
    action: string,
    resource: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await writeAuditLog(this.dbService.client, {
      tenantId: req.user.tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action,
      resource,
      resourceId,
      actorId: req.user.userId,
      actorProfileId: req.user.profileId,
      actorRole: req.userContext?.roleId ?? null,
      actorEmail: req.user.email ?? null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      description: 'Security governance policy changed',
      metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
      status: 'success',
    });
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
    private readonly sessionPolicyService: SessionPolicyService,
    private readonly sensitiveOperationPolicies: SensitiveOperationPolicyService,
    private readonly dbService: DatabaseService,
  ) {}

  @Get('step-up-policies')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(9)
  @RequirePermissions(['platform.security'])
  @ApiOperation({ summary: 'List platform sensitive-operation policies' })
  listSensitiveOperationPolicies() {
    return this.sensitiveOperationPolicies.listPolicies(this.dbService.client);
  }

  @Patch('step-up-policies/:operation')
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireClearanceLevel(9)
  @RequirePermissions(['platform.security'])
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
  @ApiOperation({ summary: 'Update a sensitive-operation policy' })
  async updateSensitiveOperationPolicy(
    @Request() req: AuthenticatedRequest,
    @Param('operation') operation: string,
    @Body() dto: UpdateSensitiveOperationPolicyDto,
  ) {
    const before = await this.sensitiveOperationPolicies.getPolicy(
      this.dbService.client,
      operation,
    );
    const after = await this.sensitiveOperationPolicies.updatePolicy(
      this.dbService.client,
      operation,
      dto,
      req.user.userId,
    );
    await this.recordPlatformGovernanceAudit(
      req,
      AUDIT_ACTION.SECURITY.POLICY.UPDATE_SENSITIVE_OPERATION_POLICY,
      'sensitive_operation_policy',
      operation,
      { before, after },
    );
    return after;
  }

  @Get('step-up-change-requests')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(9)
  @RequirePermissions(['platform.security'])
  @ApiOperation({ summary: 'List tenant sensitive-operation change requests' })
  listSensitiveOperationChangeRequests() {
    return this.sensitiveOperationPolicies.listPlatformChangeRequests(
      this.dbService.client,
    );
  }

  @Patch('step-up-change-requests/:requestId')
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireClearanceLevel(9)
  @RequirePermissions(['platform.security'])
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
  @ApiOperation({
    summary: 'Review a tenant sensitive-operation change request',
  })
  async reviewSensitiveOperationChangeRequest(
    @Request() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewSensitiveOperationChangeRequestDto,
  ) {
    const reviewed = await this.sensitiveOperationPolicies.reviewChangeRequest(
      this.dbService.client,
      requestId,
      req.user.userId,
      dto,
    );
    await this.recordPlatformGovernanceAudit(
      req,
      AUDIT_ACTION.SECURITY.POLICY.REVIEW_SENSITIVE_OPERATION_CHANGE,
      'sensitive_operation_change_request',
      requestId,
      { operation: reviewed.operation, decision: reviewed.status },
      reviewed.tenantId,
    );
    return reviewed;
  }

  @Get(':schoolId/session')
  @UseGuards(ClearanceLevelGuard, PermissionGuard)
  @RequireClearanceLevel(10)
  @RequirePermissions(['platform.security'])
  @ApiOperation({ summary: 'Get a tenant inactivity policy' })
  getTenantSessionPolicy(
    @Param('schoolId') schoolId: string,
  ): Promise<EffectiveSessionPolicy> {
    return this.sessionPolicyService.getEffectivePolicy(
      this.dbService.client,
      schoolId,
    );
  }

  @Patch(':schoolId/session')
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
  @RequireClearanceLevel(10)
  @RequirePermissions(['platform.security'])
  @ApiOperation({ summary: 'Update a tenant inactivity policy' })
  async updateTenantSessionPolicy(
    @Request() req: AuthenticatedRequest,
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateSessionPolicyDto,
  ): Promise<EffectiveSessionPolicy> {
    const before = await this.sessionPolicyService.getEffectivePolicy(
      this.dbService.client,
      schoolId,
    );
    const after = await this.sessionPolicyService.updateIdleTimeout(
      this.dbService.client,
      schoolId,
      dto.idleTimeoutMinutes,
      req.user.userId,
      EnforcedBy.PLATFORM_ADMIN,
    );
    await this.securityPolicyService.logPolicyChange(
      this.dbService.client,
      schoolId,
      AUDIT_ACTION.SECURITY.POLICY.UPDATE_SESSION_POLICY,
      req.user.userId,
      req.user.profileId,
      req.userContext?.roleId ?? null,
      null,
      { before, after },
      req.ip,
      req.headers['user-agent'],
      'Platform inactivity policy update',
    );
    return after;
  }

  /**
   * Set emergency policy (4a.7)
   *
   * Platform admins can set emergency policies for any school
   */
  @Post(':schoolId/emergency')
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
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
      userContext?.roleId || null,
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
  @UseGuards(ClearanceLevelGuard, PermissionGuard, StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.SECURITY_POLICY_UPDATE)
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

    if (!oldPolicy?.isEmergency) {
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
      userContext?.roleId || null,
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

  private async recordPlatformGovernanceAudit(
    req: AuthenticatedRequest,
    action: string,
    resource: string,
    resourceId: string,
    metadata: Record<string, unknown>,
    tenantId?: string,
  ): Promise<void> {
    await writeAuditLog(this.dbService.client, {
      tenantId: tenantId ?? req.user.tenantId ?? null,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action,
      resource,
      resourceId,
      actorId: req.user.userId,
      actorProfileId: req.user.profileId,
      actorRole: req.userContext?.roleId ?? null,
      actorEmail: req.user.email ?? null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      description: 'Platform security governance policy changed',
      metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
      status: 'success',
    });
  }
}
