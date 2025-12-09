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
import { BreachSeverity } from '@workspace/api';
import { DatabaseService } from '../../common';
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
} from '../guards';
import { type AuthenticatedRequest } from '../middleware/multi-layer-security.middleware';

/**
 * Breach Response Controller
 *
 * Provides endpoints for breach response operations.
 * Only platform admins (clearance level 9+) can trigger breach responses.
 */
@Controller('breach-response')
@UseGuards(JwtAuthGuard, ClearanceLevelGuard)
export class BreachResponseController {
  constructor(
    private readonly breachResponseService: BreachResponseService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Respond to school breach (8.5)
   *
   * @param request - Authenticated request
   * @param dto - Breach response DTO
   */
  @Post('school')
  @RequireClearanceLevel(9) // Platform admin only
  @HttpCode(HttpStatus.OK)
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
        actorRole: request.user!.roles[0] || null,
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
  @RequireClearanceLevel(9) // Platform admin only
  @HttpCode(HttpStatus.OK)
  async respondToProfileBreach(
    @Request() request: AuthenticatedRequest,
    @Body() dto: RespondToProfileBreachDto,
  ) {
    const prisma = this.dbService.client;

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
        actorRole: request.user!.roles[0] || null,
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
  @RequireClearanceLevel(10) // Architect only (highest level)
  @HttpCode(HttpStatus.OK)
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
      actorRole: request.user!.roles[0] || null,
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
