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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../common/swagger-tags';
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
import { AuthUser } from './decorators';
import type { RequestUser } from './types/request-user';

/**
 * Authentication Controller
 *
 * Provides authentication endpoints.
 */
@ApiTags(SwaggerTags.auth.name)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Login (3.2, 3a.9)
   *
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and issue tokens' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const prisma = this.dbService.client;
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
  @ApiOperation({ summary: 'Verify MFA challenge and complete login' })
  async verifyMfaLogin(
    @Body() verifyMfaForLoginDto: VerifyMfaForLoginDto,
    @Req() req: Request,
  ) {
    const prisma = this.dbService.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

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
      ipAddress,
      userAgent,
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Select active school/tenant context' })
  async selectSchool(
    @Body() selectSchoolDto: SelectSchoolDto,
    @AuthUser() user: RequestUser,
    @Req() req: Request,
  ) {
    const prisma = this.dbService.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

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
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const prisma = this.dbService.client;

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
  @ApiOperation({ summary: 'Request password reset email' })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
    @Req() req: Request,
  ) {
    const prisma = this.dbService.client;
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
  @ApiOperation({ summary: 'Reset password with provided token' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const prisma = this.dbService.client;
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout current session (token blacklist)' })
  async logout(@AuthUser() user: RequestUser, @Req() req: Request) {
    const prisma = this.dbService.client;
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout all sessions for user' })
  async logoutAll(@AuthUser() user: RequestUser) {
    const prisma = this.dbService.client;

    return this.authenticationService.logoutAll(prisma, user.userId);
  }
}
