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
import { DatabaseService } from '../common';
import { AuthUser } from './decorators';
import type { RequestUser } from './types/request-user';
import { JwtAuthGuard } from './guards';
import { BiometricsService } from './services/biometrics.service';
import {
  VerifyBiometricRegistrationDto,
  RenameBiometricDeviceDto,
} from './dto/biometrics.dto';

@ApiTags('Biometrics')
@Controller('auth/biometrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BiometricsController {
  private readonly logger = new Logger(BiometricsController.name);

  constructor(
    private readonly biometricsService: BiometricsService,
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
  @ApiOperation({ summary: 'Verify and store an enrolled biometric device' })
  async registerVerify(
    @Body() dto: VerifyBiometricRegistrationDto,
    @AuthUser() user: RequestUser,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    try {
      const id = await this.biometricsService.verifyRegistration(
        prisma,
        dto.challengeId,
        dto.registrationResponse,
        dto.label,
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
    await this.biometricsService.renameDevice(prisma, user.userId, id, dto.label);
    return { success: true };
  }

  /**
   * Remove an enrolled biometric device.
   *
   * DELETE /auth/biometrics/devices/:id
   */
  @Delete('devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an enrolled biometric device' })
  async removeDevice(@Param('id') id: string, @AuthUser() user: RequestUser) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const prisma = this.dbService.client;
    await this.biometricsService.removeDevice(prisma, user.userId, id);
    return { success: true };
  }
}
