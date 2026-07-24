/**
 * Breach Response Controller
 *
 * Handles breach response operations.
 * Implements items 8.1-8.10.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { BreachSeverity } from '@workspace/api';
import { DatabaseService, TenantDbService } from '../../common';
import { PlatformScoped } from '../decorators/platform-scoped.decorator';
import { BreachResponseService } from '../services/breach-response.service';
import {
  // RespondToBreachDto,
  RespondToSchoolBreachDto,
  RespondToProfileBreachDto,
  RespondToPlatformBreachDto,
} from '../dto/breach-response.dto';
import {
  JwtAuthGuard,
  ClearanceLevelGuard,
  RequireClearanceLevel,
  RequireStepUp,
  StepUpGuard,
} from '../guards';
import { STEP_UP_OPERATION } from '../step-up.operations';
import { type AuthenticatedRequest } from '../middleware/multi-layer-security.middleware';

/**
 * Breach Response Controller
 *
 * Provides endpoints for breach response operations.
 * Only platform admins (clearance level 9+) can trigger breach responses.
 */
@ApiTags(SwaggerTags.breachResponse.name)
@Controller('breach-response')
@UseGuards(JwtAuthGuard, ClearanceLevelGuard)
@ApiBearerAuth('JWT-auth')
export class BreachResponseController {
  constructor(
    private readonly breachResponseService: BreachResponseService,
    private readonly dbService: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  /**
   * Respond to school breach (8.5)
   *
   * @param request - Authenticated request
   * @param dto - Breach response DTO
   */
  @Post('school')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.BREACH_RESPONSE)
  @RequireClearanceLevel(9) // Platform admin only
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate breach response for a school' })
  async respondToSchoolBreach(
    @Request() request: AuthenticatedRequest,
    @Body() dto: RespondToSchoolBreachDto,
  ) {
    const prisma = this.dbService.client;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { email: true },
    });

    await this.breachResponseService.respondToSchoolBreach(
      prisma,
      dto.schoolId,
      {
        reason: dto.reason,
        severity: dto.severity,
        escalateToPasswordReset: dto.escalateToPasswordReset,
        enableEnhancedMonitoring: dto.enableEnhancedMonitoring,
        enableInvestigationMode: dto.enableInvestigationMode,
        actorId: request.user!.userId,
        actorProfileId: request.user!.profileId,
        actorRole: request.user!.roleId || null,
        actorEmail: user?.email || null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );

    return {
      success: true,
      message: 'Breach response initiated for school',
      schoolId: dto.schoolId,
    };
  }

  /**
   * Respond to profile breach (8.6)
   *
   * @param request - Authenticated request
   * @param dto - Breach response DTO
   */
  @Post('profile')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.BREACH_RESPONSE)
  // Genuinely cross-tenant: the profile can be in ANY tenant, so this reads a
  // tenant-scoped row (`user_tenants`) with no tenant known up front. Under
  // FORCE RLS the privileged owner client returns zero rows for that read, so
  // this runs inside the audited platform bypass instead of a clearance gate.
  // `platform.breach` is clearance 9 (SuperAdmin + Architect); the interceptor
  // (RlsPlatformInterceptor) enforces the permission + clearance and audits the
  // attempt, opening `app.is_platform='on'` on the TenantDbService client.
  @PlatformScoped(['platform.breach'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate breach response for a user profile' })
  async respondToProfileBreach(
    @Request() request: AuthenticatedRequest,
    @Body() dto: RespondToProfileBreachDto,
  ) {
    // Read/write through the scoped client: the @PlatformScoped interceptor has
    // opened `app.is_platform='on'` on this transaction, so the cross-tenant
    // `user_tenants` read/update sees every tenant. The privileged
    // `dbService.client` would NOT — it is a separate connection with no scope.
    const prisma = this.tenantDb.client;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { email: true },
    });

    await this.breachResponseService.respondToProfileBreach(
      prisma,
      dto.profileId,
      {
        reason: dto.reason,
        severity: dto.severity,
        escalateToPasswordReset: dto.escalateToPasswordReset,
        enableEnhancedMonitoring: dto.enableEnhancedMonitoring,
        enableInvestigationMode: dto.enableInvestigationMode,
        actorId: request.user!.userId,
        actorProfileId: request.user!.profileId,
        actorRole: request.user!.roleId || null,
        actorEmail: user?.email || null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );

    return {
      success: true,
      message: 'Breach response initiated for profile',
      profileId: dto.profileId,
    };
  }

  /**
   * Respond to platform breach (8.4)
   *
   * @param request - Authenticated request
   * @param dto - Breach response DTO
   */
  @Post('platform')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.BREACH_RESPONSE)
  @RequireClearanceLevel(10) // Architect only (highest level)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate platform-wide breach response' })
  async respondToPlatformBreach(
    @Request() request: AuthenticatedRequest,
    @Body() dto: RespondToPlatformBreachDto,
  ) {
    const prisma = this.dbService.client;

    // Get user info for audit logging
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { email: true },
    });

    await this.breachResponseService.respondToPlatformBreach(prisma, {
      reason: dto.reason,
      severity: dto.severity || BreachSeverity.CRITICAL,
      escalateToPasswordReset: true, // Always escalate for platform breaches
      enableEnhancedMonitoring: true,
      enableInvestigationMode: true,
      actorId: request.user!.userId,
      actorProfileId: request.user!.profileId,
      actorRole: request.user!.roleId || null,
      actorEmail: user?.email || null,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Platform-wide breach response initiated',
    };
  }
}
