/**
 * Authentication Controller
 *
 * Handles authentication endpoints.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  UnauthorizedException,
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
import { PermissionService } from './services/permission.service';
import { JwtAuthGuard, PreAuthGuard } from './guards';
import { DatabaseService, extractBearerToken } from '../common';
import { AuthUser } from './decorators';
import type { RequestUser } from './types/request-user';
import { SchoolSelectionService } from '@workspace/api';

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
    private readonly permissionService: PermissionService,
    private readonly dbService: DatabaseService,
  ) {}

  /**
   * Get current session context (me)
   *
   * GET /auth/me
   *
   * Returns the full session payload needed by the web frontend.
   * Protected by JwtAuthGuard — requires a valid access token.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user session context' })
  async getMe(@AuthUser() user: RequestUser) {
    const prisma = this.dbService.client;
    const { userId, tenantId, profileId } = user;

    // Resolve permission context (role, clearanceLevel, permission names)
    const ctx = await this.permissionService.getUserPermissionContext(
      prisma,
      userId,
      tenantId,
      profileId,
    );

    if (!ctx) {
      throw new UnauthorizedException('Session context unavailable');
    }

    // Resolve user profile
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    // Resolve role name (for caption)
    const role = await prisma.role.findUnique({
      where: { id: ctx.roleId },
      select: { name: true, clearanceLevel: true },
    });

    // Resolve all accessible schools for the user
    const schools = await SchoolSelectionService.getAvailableSchools(
      prisma,
      userId,
    );

    const firstName = dbUser.firstName ?? '';
    const lastName = dbUser.lastName ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || dbUser.email;
    const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || dbUser.email[0].toUpperCase();

    return {
      user: {
        name: fullName,
        email: dbUser.email,
        initials,
        caption: role?.name ?? 'Staff',
        color: '#334155',
      },
      scope: 'school' as const,
      clearanceLevel: ctx.clearanceLevel,
      roles: [role?.name ?? 'Staff'],
      permissions: [...ctx.permissions.entries()]
        .filter(([, v]) => v.granted)
        .map(([name]) => name),
      defaultSchoolId: tenantId,
      schools: schools.map((s) => ({
        id: s.tenantId,
        name: s.tenantName,
        initials: s.tenantName
          .split(/\s+/)
          .slice(0, 2)
          .map((w: string) => w[0])
          .join('')
          .toUpperCase(),
        caption: s.primaryRole ?? 'Staff',
        color: '#4f6df5',
        schoolType: (s.schoolType || 'secondary') as string,
      })),
    };
  }

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

    return this.authenticationService.verifyMfaAndCompleteLogin({
      prisma,
      userId: challenge.userId,
      challengeId: verifyMfaForLoginDto.challengeId,
      mfa: {
        code: verifyMfaForLoginDto.code,
        token: verifyMfaForLoginDto.token,
        webauthnResponse: verifyMfaForLoginDto.webauthnResponse,
        recoveryCode: verifyMfaForLoginDto.recoveryCode,
      },
      requestContext: {
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Select school / Switch context (3.3)
   *
   * POST /auth/select-school
   *
   * Requires the short-lived pre-auth token returned from /auth/login
   * (or /auth/verify-mfa-login) in the Authorization header.
   */
  @Post('select-school')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PreAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Select active school/tenant context' })
  async selectSchool(
    @Body() selectSchoolDto: SelectSchoolDto,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    const prisma = this.dbService.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    const userId = req.user!.userId;

    return this.authenticationService.selectSchool(
      prisma,
      userId,
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
    const token = extractBearerToken(req.headers.authorization);

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
