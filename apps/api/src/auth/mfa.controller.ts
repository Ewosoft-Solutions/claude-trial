/**
 * MFA Controller
 *
 * Handles MFA endpoints (3a.5, 3a.6, 3a.7, 3a.8).
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { PrismaClient } from '@workspace/database';
import {
  SetupSmsMfaDto,
  SetupEmailMfaDto,
  SetupTotpMfaDto,
  SetupTotpMfaResponseDto,
  SetupWebAuthnMfaResponseDto,
  VerifyAndActivateMfaDto,
  InitiateMfaVerificationDto,
  InitiateMfaVerificationResponseDto,
  VerifyMfaChallengeDto,
  VerifyMfaChallengeResponseDto,
  GenerateRecoveryCodesDto,
  GenerateRecoveryCodesResponseDto,
  VerifyRecoveryCodeDto,
  VerifyRecoveryCodeResponseDto,
} from './dto';
import { MfaService } from './services/mfa.service';
import { JwtAuthGuard } from './guards';

/**
 * MFA Controller
 *
 * Provides MFA endpoints for setup, verification, and recovery.
 */
@Controller('auth/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  /**
   * Get active MFA methods (3a.5)
   *
   * GET /auth/mfa/methods
   */
  @Get('methods')
  async getActiveMethods(@Req() req: Request) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    return this.mfaService.getActiveMfaMethods(prisma, user.userId);
  }

  /**
   * Setup SMS MFA method (3a.1, 3a.5)
   *
   * POST /auth/mfa/setup/sms
   */
  @Post('setup/sms')
  @HttpCode(HttpStatus.CREATED)
  async setupSms(@Body() setupSmsMfaDto: SetupSmsMfaDto, @Req() req: Request) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    const methodId = await this.mfaService.setupSmsMethod(
      prisma,
      user.userId,
      setupSmsMfaDto.phoneNumber,
      setupSmsMfaDto.name,
    );

    // Send verification code
    const challenge = await this.mfaService.initiateVerification(
      prisma,
      user.userId,
      methodId,
      'settings_change',
      req.ip || req.socket.remoteAddress || 'unknown',
      req.headers['user-agent'],
    );

    return {
      methodId,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
    };
  }

  /**
   * Setup Email MFA method (3a.2, 3a.5)
   *
   * POST /auth/mfa/setup/email
   */
  @Post('setup/email')
  @HttpCode(HttpStatus.CREATED)
  async setupEmail(
    @Body() setupEmailMfaDto: SetupEmailMfaDto,
    @Req() req: Request,
  ) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    const methodId = await this.mfaService.setupEmailMethod(
      prisma,
      user.userId,
      setupEmailMfaDto.emailAddress,
      setupEmailMfaDto.name,
    );

    // Send verification code
    const challenge = await this.mfaService.initiateVerification(
      prisma,
      user.userId,
      methodId,
      'settings_change',
      req.ip || req.socket.remoteAddress || 'unknown',
      req.headers['user-agent'],
    );

    return {
      methodId,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
    };
  }

  /**
   * Setup TOTP MFA method (3a.3, 3a.5)
   *
   * POST /auth/mfa/setup/totp
   */
  @Post('setup/totp')
  @HttpCode(HttpStatus.CREATED)
  async setupTotp(
    @Body() setupTotpMfaDto: SetupTotpMfaDto,
    @Req() req: Request,
  ): Promise<SetupTotpMfaResponseDto> {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId || !user.email) {
      throw new Error('User not authenticated');
    }

    return this.mfaService.setupTotpMethod(
      prisma,
      user.userId,
      user.email,
      setupTotpMfaDto.name,
    );
  }

  /**
   * Setup WebAuthn MFA method (3a.4, 3a.5)
   *
   * POST /auth/mfa/setup/webauthn
   */
  @Post('setup/webauthn')
  @HttpCode(HttpStatus.CREATED)
  async setupWebAuthn(
    @Req() req: Request,
  ): Promise<SetupWebAuthnMfaResponseDto> {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId || !user.email) {
      throw new Error('User not authenticated');
    }

    const options = await this.mfaService.setupWebAuthnMethod(
      prisma,
      user.userId,
      user.email,
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email,
    );

    return {
      challengeId: options.challengeId,
      options: options,
    };
  }

  /**
   * Verify and activate MFA method (3a.5)
   *
   * POST /auth/mfa/verify-activate
   */
  @Post('verify-activate')
  @HttpCode(HttpStatus.OK)
  async verifyAndActivate(
    @Body() verifyAndActivateMfaDto: VerifyAndActivateMfaDto,
    @Req() req: Request,
  ) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    // Get method to determine type
    const method = await prisma.mfaMethod.findUnique({
      where: { id: verifyAndActivateMfaDto.methodId },
    });

    if (!method || method.userId !== user.userId) {
      throw new Error('MFA method not found');
    }

    let verified = false;

    switch (method.type) {
      case 'sms':
        if (!verifyAndActivateMfaDto.code) {
          throw new Error('Verification code required');
        }
        verified = await this.mfaService.verifyAndActivateSmsMethod(
          prisma,
          verifyAndActivateMfaDto.methodId,
          verifyAndActivateMfaDto.code,
        );
        break;

      case 'email':
        if (!verifyAndActivateMfaDto.code) {
          throw new Error('Verification code required');
        }
        verified = await this.mfaService.verifyAndActivateEmailMethod(
          prisma,
          verifyAndActivateMfaDto.methodId,
          verifyAndActivateMfaDto.code,
        );
        break;

      case 'totp':
        if (!verifyAndActivateMfaDto.token) {
          throw new Error('TOTP token required');
        }
        verified = await this.mfaService.verifyAndActivateTotpMethod(
          prisma,
          verifyAndActivateMfaDto.methodId,
          verifyAndActivateMfaDto.token,
        );
        break;

      case 'webauthn':
        if (!verifyAndActivateMfaDto.registrationResponse) {
          throw new Error('WebAuthn registration response required');
        }
        // Find challenge for this method
        const challenge = await prisma.mfaChallenge.findFirst({
          where: {
            userId: user.userId,
            mfaMethodId: verifyAndActivateMfaDto.methodId,
            type: 'webauthn',
            verified: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (!challenge) {
          throw new Error('WebAuthn challenge not found');
        }

        await this.mfaService.verifyAndActivateWebAuthnMethod(
          prisma,
          challenge.id,
          verifyAndActivateMfaDto.registrationResponse,
        );
        verified = true;
        break;

      default:
        throw new Error('Unsupported MFA method type');
    }

    if (!verified) {
      throw new Error('MFA verification failed');
    }

    return { success: true, message: 'MFA method activated successfully' };
  }

  /**
   * Initiate MFA verification (3a.6)
   *
   * POST /auth/mfa/verify/initiate
   */
  @Post('verify/initiate')
  @HttpCode(HttpStatus.OK)
  async initiateVerification(
    @Body() initiateMfaVerificationDto: InitiateMfaVerificationDto,
    @Req() req: Request,
  ): Promise<InitiateMfaVerificationResponseDto> {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    return this.mfaService.initiateVerification(
      prisma,
      user.userId,
      initiateMfaVerificationDto.methodId || null,
      'sensitive_operation',
      req.ip || req.socket.remoteAddress || 'unknown',
      req.headers['user-agent'],
    );
  }

  /**
   * Verify MFA challenge (3a.6)
   *
   * POST /auth/mfa/verify
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyChallenge(
    @Body() verifyMfaChallengeDto: VerifyMfaChallengeDto,
    @Req() req: Request,
  ): Promise<VerifyMfaChallengeResponseDto> {
    const prisma = this.getPrisma(req);

    const verified = await this.mfaService.verifyChallenge(
      prisma,
      verifyMfaChallengeDto.challengeId,
      verifyMfaChallengeDto.code,
      verifyMfaChallengeDto.token,
      verifyMfaChallengeDto.webauthnResponse,
    );

    return {
      verified,
      challengeId: verifyMfaChallengeDto.challengeId,
    };
  }

  /**
   * Generate recovery codes (3a.7, 3a.8)
   *
   * POST /auth/mfa/recovery/generate
   */
  @Post('recovery/generate')
  @HttpCode(HttpStatus.OK)
  async generateRecoveryCodes(
    @Body() generateRecoveryCodesDto: GenerateRecoveryCodesDto,
    @Req() req: Request,
  ): Promise<GenerateRecoveryCodesResponseDto> {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    const codes = await this.mfaService.generateRecoveryCodes(
      prisma,
      user.userId,
      generateRecoveryCodesDto.count || 10,
    );

    return {
      codes,
      message:
        'Recovery codes generated. Please save these codes in a secure location. They will not be shown again.',
    };
  }

  /**
   * Verify recovery code (3a.8)
   *
   * POST /auth/mfa/recovery/verify
   */
  @Post('recovery/verify')
  @HttpCode(HttpStatus.OK)
  async verifyRecoveryCode(
    @Body() verifyRecoveryCodeDto: VerifyRecoveryCodeDto,
    @Req() req: Request,
  ): Promise<VerifyRecoveryCodeResponseDto> {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    const verified = await this.mfaService.verifyRecoveryCode(
      prisma,
      user.userId,
      verifyRecoveryCodeDto.code,
    );

    return { verified };
  }

  /**
   * Set primary MFA method (3a.5)
   *
   * PUT /auth/mfa/methods/:methodId/primary
   */
  @Put('methods/:methodId/primary')
  @HttpCode(HttpStatus.OK)
  async setPrimaryMethod(
    @Param('methodId') methodId: string,
    @Req() req: Request,
  ) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    await this.mfaService.setPrimaryMethod(prisma, user.userId, methodId);

    return { success: true, message: 'Primary MFA method updated' };
  }

  /**
   * Disable MFA method
   *
   * PUT /auth/mfa/methods/:methodId/disable
   */
  @Put('methods/:methodId/disable')
  @HttpCode(HttpStatus.OK)
  async disableMethod(
    @Param('methodId') methodId: string,
    @Req() req: Request,
  ) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    await this.mfaService.disableMethod(prisma, user.userId, methodId);

    return { success: true, message: 'MFA method disabled' };
  }

  /**
   * Delete MFA method
   *
   * DELETE /auth/mfa/methods/:methodId
   */
  @Delete('methods/:methodId')
  @HttpCode(HttpStatus.OK)
  async deleteMethod(@Param('methodId') methodId: string, @Req() req: Request) {
    const prisma = this.getPrisma(req);
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    await this.mfaService.deleteMethod(prisma, user.userId, methodId);

    return { success: true, message: 'MFA method deleted' };
  }

  /**
   * Get Prisma client from request
   *
   * @param req - Request object
   * @returns Prisma client
   */
  private getPrisma(req: Request): PrismaClient {
    // This is a simplified version
    // In production, inject PrismaService via NestJS dependency injection
    return (req as any).prisma || (global as any).prisma;
  }
}
