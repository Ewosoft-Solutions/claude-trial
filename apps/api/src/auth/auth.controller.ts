/**
 * Authentication Controller
 *
 * Handles authentication endpoints.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import {
  LoginDto,
  VerifyMfaForLoginDto,
  SelectSchoolDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password-reset.service';
import { JwtAuthGuard } from './guards';
import { DatabaseService } from '../common';

/**
 * Authentication Controller
 *
 * Provides authentication endpoints.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Login (3.2, 3a.9)
   *
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const prisma = this.db.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    return this.authenticationService.login(
      prisma,
      loginDto.email,
      loginDto.password,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Verify MFA and complete login (3a.9)
   *
   * POST /auth/verify-mfa-login
   */
  @Post('verify-mfa-login')
  @HttpCode(HttpStatus.OK)
  async verifyMfaLogin(
    @Body() verifyMfaForLoginDto: VerifyMfaForLoginDto,
    @Req() req: Request,
  ) {
    const prisma = this.db.client;

    // Get user ID from challenge
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: verifyMfaForLoginDto.challengeId },
      select: { userId: true },
    });

    if (!challenge) {
      throw new Error('Invalid challenge');
    }

    return this.authenticationService.verifyMfaAndCompleteLogin(
      prisma,
      challenge.userId,
      verifyMfaForLoginDto.challengeId,
      verifyMfaForLoginDto.code,
      verifyMfaForLoginDto.token,
      verifyMfaForLoginDto.webauthnResponse,
      verifyMfaForLoginDto.recoveryCode,
    );
  }

  /**
   * Select school / Switch context (3.3)
   *
   * POST /auth/select-school
   */
  @Post('select-school')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard) // Simplified - in production, use proper auth
  async selectSchool(
    @Body() selectSchoolDto: SelectSchoolDto,
    @Req() req: Request,
  ) {
    const prisma = this.db.client;
    const user = (req as any).user;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    return this.authenticationService.selectSchool(
      prisma,
      user.userId,
      selectSchoolDto.tenantId,
      selectSchoolDto.profileId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Refresh token (3.8)
   *
   * POST /auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    const prisma = this.db.client;

    return this.authenticationService.refreshToken(
      prisma,
      refreshTokenDto.refreshToken,
    );
  }

  /**
   * Request password reset (3.10)
   *
   * POST /auth/request-password-reset
   */
  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
    @Req() req: Request,
  ) {
    const prisma = this.db.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    return this.passwordResetService.requestPasswordReset(
      prisma,
      requestPasswordResetDto.email,
      ipAddress,
    );
  }

  /**
   * Reset password (3.10, 3.12)
   *
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const prisma = this.db.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    await this.passwordResetService.resetPassword(
      prisma,
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      resetPasswordDto.mfaCode,
      ipAddress,
    );

    return { success: true, message: 'Password reset successfully' };
  }

  /**
   * Logout (12.1)
   *
   * POST /auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const prisma = this.db.client;
    const user = (req as any).user;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Token not found');
    }

    return this.authenticationService.logout(prisma, token);
  }

  /**
   * Logout all sessions (12.1)
   *
   * POST /auth/logout-all
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req: Request) {
    const prisma = this.db.client;
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User not authenticated');
    }

    return this.authenticationService.logoutAll(prisma, user.userId);
  }
}
