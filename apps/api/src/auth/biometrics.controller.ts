/**
 * Biometrics Controller
 *
 * Endpoints for enrolling and managing platform authenticators (passkeys /
 * Face ID / Touch ID / Windows Hello). All routes require an authenticated
 * session — enrolment happens from Account settings after a normal login.
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUDIT_ACTION, AUDIT_EVENT, DatabaseService } from '../common';
import { AuthUser } from './decorators';
import type { RequestUser } from './types/request-user';
import { JwtAuthGuard, RequireStepUp, StepUpGuard } from './guards';
import { STEP_UP_OPERATION } from './step-up.operations';
import { BiometricsService } from './services/biometrics.service';
import { SensitiveOperationPolicyService } from './services/sensitive-operation-policy.service';
import {
  VerifyBiometricRegistrationDto,
  RenameBiometricDeviceDto,
  RemoveBiometricDeviceDto,
} from './dto/biometrics.dto';
import { writeAuditLog } from '../common/audit/audit-writer';

@ApiTags('Biometrics')
@Controller('auth/biometrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BiometricsController {
  private readonly logger = new Logger(BiometricsController.name);

  constructor(
    private readonly biometricsService: BiometricsService,
    private readonly sensitiveOperationPolicies: SensitiveOperationPolicyService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Begin enrolment — get registration options for a platform authenticator.
   *
   * POST /auth/biometrics/register/options
   */
  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get options to enrol a biometric device (passkey)',
  })
  async registerOptions(@AuthUser() user: RequestUser) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    await this.sensitiveOperationPolicies.assertEnrollmentAllowed(
      prisma,
      user.tenantId,
    );
    const options = await this.biometricsService.generateRegistrationOptions(
      prisma,
      user.userId,
    );

    return { challengeId: options.challengeId, options };
  }

  /**
   * Complete enrolment — verify the attestation and store the credential.
   *
   * POST /auth/biometrics/register/verify
   */
  @Post('register/verify')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.BIOMETRICS_ENROLL)
  @ApiOperation({ summary: 'Verify and store an enrolled biometric device' })
  async registerVerify(
    @Body() dto: VerifyBiometricRegistrationDto,
    @AuthUser() user: RequestUser,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    await this.sensitiveOperationPolicies.assertEnrollmentAllowed(
      prisma,
      user.tenantId,
    );
    try {
      const id = await this.biometricsService.verifyRegistration(
        prisma,
        dto.challengeId,
        dto.registrationResponse,
        dto.label,
      );
      await this.recordBiometricAudit(
        user,
        AUDIT_ACTION.AUTHENTICATION.BIOMETRIC_ENROLLED,
        id,
        'Biometric sign-in method enrolled',
      );
      return { success: true, id };
    } catch (err) {
      // WebAuthn verification failures are client/config errors (bad origin,
      // expired/invalid challenge, failed attestation), not server faults —
      // surface a 400 with a friendly message and log the real cause (e.g. an
      // origin/RP-ID mismatch) for operators instead of an opaque 500.
      this.logger.warn(
        `Biometric enrolment verification failed for user ${user.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadRequestException(
        'Could not verify this device. Please try setting it up again.',
      );
    }
  }

  /**
   * List the user's enrolled biometric devices.
   *
   * GET /auth/biometrics/devices
   */
  @Get('devices')
  @ApiOperation({ summary: 'List enrolled biometric devices' })
  async listDevices(@AuthUser() user: RequestUser) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    return this.biometricsService.listDevices(prisma, user.userId);
  }

  @Get('policy')
  @ApiOperation({ summary: 'Get biometric enrolment policy for this session' })
  async getEnrollmentPolicy(@AuthUser() user: RequestUser) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.sensitiveOperationPolicies.getBiometricEnrollmentPolicy(
      this.dbService.client,
      user.tenantId,
    );
  }

  /**
   * Rename an enrolled biometric device.
   *
   * PATCH /auth/biometrics/devices/:id
   */
  @Patch('devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename an enrolled biometric device' })
  async renameDevice(
    @Param('id') id: string,
    @Body() dto: RenameBiometricDeviceDto,
    @AuthUser() user: RequestUser,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    await this.biometricsService.renameDevice(
      prisma,
      user.userId,
      id,
      dto.label,
    );
    return { success: true };
  }

  /**
   * Remove an enrolled biometric device.
   *
   * DELETE /auth/biometrics/devices/:id
   */
  @Delete('devices/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.BIOMETRICS_REMOVE)
  @ApiOperation({ summary: 'Remove an enrolled biometric device' })
  async removeDevice(
    @Param('id') id: string,
    @Body() _dto: RemoveBiometricDeviceDto,
    @AuthUser() user: RequestUser,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    await this.sensitiveOperationPolicies.assertCanRemovePasskey(
      prisma,
      user.tenantId,
      user.userId,
    );
    const removed = await this.biometricsService.removeDevice(
      prisma,
      user.userId,
      id,
    );
    await this.recordBiometricAudit(
      user,
      AUDIT_ACTION.AUTHENTICATION.BIOMETRIC_REMOVED,
      id,
      'Biometric sign-in method removed',
    );
    return { success: true, ...removed };
  }

  /** Audit persistence is best-effort and must not break account recovery. */
  private async recordBiometricAudit(
    user: RequestUser,
    action:
      | typeof AUDIT_ACTION.AUTHENTICATION.BIOMETRIC_ENROLLED
      | typeof AUDIT_ACTION.AUTHENTICATION.BIOMETRIC_REMOVED,
    methodId: string,
    description: string,
  ): Promise<void> {
    try {
      await writeAuditLog(this.dbService.client, {
        tenantId: user.tenantId || null,
        eventType: AUDIT_EVENT.AUTHENTICATION,
        action,
        resource: 'biometric_method',
        resourceId: methodId,
        actorId: user.userId,
        actorProfileId: user.profileId || null,
        actorEmail: user.email || null,
        description,
        status: 'success',
      });
    } catch (auditError) {
      this.logger.error('Failed to audit biometric device change', auditError);
    }
  }
}
