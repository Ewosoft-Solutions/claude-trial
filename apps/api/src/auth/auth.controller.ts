/**
 * Authentication Controller
 *
 * Handles authentication endpoints.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
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
  SetDefaultProfileDto,
  UpdateAccountDto,
  RefreshTokenDto,
  LogoutDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ChangePasswordDto,
  PasskeyLoginOptionsDto,
  PasskeyLoginVerifyDto,
} from './dto';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password-reset.service';
import { PermissionService } from './services/permission.service';
import { SessionPolicyService } from './services/session-policy.service';
import { SensitiveOperationPolicyService } from './services/sensitive-operation-policy.service';
import { JwtAuthGuard, PreAuthGuard } from './guards';
import { AUDIT_ACTION, AUDIT_EVENT, DatabaseService } from '../common';
import { AuthUser } from './decorators';
import type { RequestUser } from './types/request-user';
import { SchoolSelectionService, type UserSchoolProfile } from '@workspace/api';
import { withUserScope } from '@workspace/database/rls';
import { resolveEnabledFeatures } from '../tenant/tenant-features';
import { writeAuditLog } from '../common/audit/audit-writer';

/**
 * Groups one-entry-per-profile UserSchoolProfile rows into one entry per
 * school, each with a nested `profiles` array. A user can hold more than
 * one profile at the same school (e.g. parent + teacher) — without this
 * grouping the same school would appear multiple times under a "schools"
 * label, each time with a different role, which misrepresents distinct
 * profiles as if they were distinct schools.
 */
function groupProfilesBySchool(profiles: UserSchoolProfile[]) {
  const bySchool = new Map<
    string,
    {
      id: string;
      name: string;
      initials: string;
      color: string;
      schoolType: string;
      profiles: Array<{ profileId: string; role: string; caption: string }>;
    }
  >();

  for (const p of profiles) {
    let school = bySchool.get(p.tenantId);
    if (!school) {
      school = {
        id: p.tenantId,
        name: p.tenantName,
        initials: p.tenantName
          .split(/\s+/)
          .slice(0, 2)
          .map((w: string) => w[0])
          .join('')
          .toUpperCase(),
        color: '#4f6df5',
        schoolType: p.schoolType || 'secondary',
        profiles: [],
      };
      bySchool.set(p.tenantId, school);
    }
    const role = p.primaryRole ?? 'Staff';
    school.profiles.push({ profileId: p.profileId, role, caption: role });
  }

  return Array.from(bySchool.values());
}

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
    private readonly sessionPolicyService: SessionPolicyService,
    private readonly sensitiveOperationPolicies: SensitiveOperationPolicyService,
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

    // Permission and session-policy reads are independent; start both before
    // awaiting either to avoid a serial waterfall on every app navigation.
    const [ctx, sessionPolicy, biometricEnrollmentPolicy, passkeyCount] =
      await Promise.all([
        this.permissionService.getUserPermissionContext(
          prisma,
          userId,
          tenantId,
          profileId,
        ),
        this.sessionPolicyService.getEffectivePolicy(prisma, tenantId),
        this.sensitiveOperationPolicies.getEffectiveBiometricEnrollmentPolicy(
          prisma,
          tenantId,
          userId,
        ),
        prisma.mfaMethod.count({
          where: {
            userId,
            type: 'webauthn',
            webauthnAttachment: 'platform',
            isActive: true,
          },
        }),
      ]);

    if (!ctx) {
      throw new UnauthorizedException('Session context unavailable');
    }

    // Resolve user profile
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        defaultUserTenantId: true,
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    // Resolve role name (for caption)
    const role = await prisma.role.findUnique({
      where: { id: ctx.roleId },
      select: { name: true, clearanceLevel: true, roleType: true },
    });
    const scope = role?.roleType === 'platform' ? 'platform' : 'school';

    // Resolve all accessible schools for the user — one entry per profile
    // (UserTenant row); a user can hold multiple profiles at the same
    // school (e.g. parent + teacher), so group these into one entry per
    // school with a nested `profiles` array rather than reporting the
    // same school once per profile under a misleading "schools" label.
    // Same cross-tenant, no-tenant-chosen question as login asks, so it needs
    // the same user-scoped RLS grant — see availableSchoolsForUser in
    // AuthenticationService and migration 20260723090000_user_tenants_self_scope.
    const profiles = await withUserScope(prisma, userId, (tx) =>
      SchoolSelectionService.getAvailableSchools(tx, userId),
    );

    // Per-school enabled feature modules, for polymorphic navigation gating.
    const schools = groupProfilesBySchool(profiles);
    const settingsRows =
      schools.length > 0
        ? await prisma.tenant.findMany({
            where: { id: { in: schools.map((s) => s.id) } },
            select: { id: true, settings: true },
          })
        : [];
    const settingsById = new Map(
      settingsRows.map((r) => [r.id, r.settings] as const),
    );
    const schoolsWithFeatures = schools.map((s) => ({
      ...s,
      enabledFeatures: resolveEnabledFeatures(settingsById.get(s.id)),
    }));

    const firstName = dbUser.firstName ?? '';
    const lastName = dbUser.lastName ?? '';
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ') || dbUser.email;
    const initials =
      [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() ||
      dbUser.email[0].toUpperCase();

    return {
      accountId: userId,
      user: {
        name: fullName,
        email: dbUser.email,
        initials,
        caption: role?.name ?? 'Staff',
        color: '#334155',
        firstName: dbUser.firstName ?? undefined,
        lastName: dbUser.lastName ?? undefined,
        phone: dbUser.phone ?? undefined,
      },
      scope,
      clearanceLevel: ctx.clearanceLevel,
      roles: [role?.name ?? 'Staff'],
      permissions: [...ctx.permissions.entries()]
        .filter(([, v]) => v.granted)
        .map(([name]) => name),
      defaultSchoolId: scope === 'school' ? tenantId : undefined,
      /** The profile the current access token was issued for — lets the
       *  frontend switcher highlight which of a user's several profiles
       *  (e.g. Teacher vs Parent at the same school) is currently active. */
      activeProfileId: profileId,
      /** The profile the user has pinned as their sign-in default (Account &
       *  preferences › Schools & roles), distinct from activeProfileId — this is the
       *  stored preference, not necessarily the one live right now. */
      defaultProfileId: dbUser.defaultUserTenantId ?? undefined,
      schools: scope === 'school' ? schoolsWithFeatures : [],
      sessionPolicy,
      biometricEnrollment: {
        policy: biometricEnrollmentPolicy.policy,
        activePolicy: biometricEnrollmentPolicy.activePolicy,
        requiredBy: biometricEnrollmentPolicy.requiredBy,
        enrolled: passkeyCount > 0,
      },
      accessExpiresAt: user.accessTokenExpiresAt
        ? user.accessTokenExpiresAt * 1000
        : Date.now() + 60 * 60 * 1000,
    };
  }

  /** Update personal, account-level profile fields. Email changes use a
   * separate verified flow and are intentionally not accepted here. */
  @Patch('account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update the current user account profile' })
  async updateAccount(
    @Body() dto: UpdateAccountDto,
    @AuthUser() user: RequestUser,
  ) {
    const updated = await this.dbService.client.user.update({
      where: { id: user.userId },
      data: {
        ...(dto.firstName !== undefined
          ? { firstName: dto.firstName || null }
          : {}),
        ...(dto.lastName !== undefined
          ? { lastName: dto.lastName || null }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        updatedBy: user.userId,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });
    return { success: true, user: updated };
  }

  /**
   * Set default sign-in profile (Account & preferences › Schools & roles)
   *
   * PATCH /auth/default-profile
   *
   * Lets a user pin which profile they hold should be auto-selected at
   * future logins, instead of login always picking the first profile in a
   * deterministic-but-otherwise-arbitrary order. Validated against the
   * calling user in AuthenticationService.setDefaultProfile — a caller can
   * never point their default at a profile they don't hold.
   */
  @Patch('default-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Set the profile to auto-select at future logins' })
  async setDefaultProfile(
    @Body() dto: SetDefaultProfileDto,
    @AuthUser() user: RequestUser,
  ) {
    const prisma = this.dbService.client;
    return this.authenticationService.setDefaultProfile(
      prisma,
      user.userId,
      dto.profileId,
    );
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
   * Begin passwordless passkey login (Biometrics Phase 2)
   *
   * POST /auth/passkey/login/options
   *
   * Public: the caller isn't authenticated yet. Returns WebAuthn options when
   * the account has passkeys, else `{ hasPasskey: false }`.
   */
  @Post('passkey/login/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get passkey authentication options for login' })
  async passkeyLoginOptions(@Body() dto: PasskeyLoginOptionsDto) {
    return this.authenticationService.beginPasskeyLogin(
      this.dbService.client,
      dto.email,
    );
  }

  /**
   * Complete passwordless passkey login (Biometrics Phase 2)
   *
   * POST /auth/passkey/login/verify
   *
   * Public. Verifies the WebAuthn assertion and returns the same pre-auth
   * token + school list as a completed password login.
   */
  @Post('passkey/login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a passkey assertion and complete login' })
  async passkeyLoginVerify(
    @Body() dto: PasskeyLoginVerifyDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    return this.authenticationService.completePasskeyLogin({
      prisma: this.dbService.client,
      challengeId: dto.challengeId,
      authenticationResponse: dto.authenticationResponse as never,
      requestContext: { ipAddress, userAgent },
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
   * Switch active profile (mid-session context switch)
   *
   * POST /auth/switch-profile
   *
   * Distinct from /auth/select-school: this is called with a *current,
   * already-authenticated* access token, for a signed-in user switching
   * between profiles they hold (e.g. Teacher and Parent at the same
   * school, or a different school entirely) — not the one-time post-login
   * school picker, which runs off the short-lived pre-auth token instead.
   * Reuses AuthenticationService.selectSchool, which validates the target
   * profile belongs to the calling user before issuing new tokens, so a
   * caller cannot switch into another user's profile.
   */
  @Post('switch-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Switch to a different profile the signed-in user holds',
  })
  async switchProfile(
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

    // The service returns { token, expiresAt } so a caller (e.g. an email
    // delivery job) can act on it, but the reset token must never be
    // returned in the HTTP response — doing so would let anyone reset any
    // account's password without ever touching the account's inbox.
    await this.passwordResetService.requestPasswordReset(
      prisma,
      requestPasswordResetDto.email,
      ipAddress,
    );

    return {
      success: true,
      message:
        'If an account exists for this email, a reset link has been sent.',
    };
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
   * Change password using the current password
   *
   * POST /auth/change-password
   *
   * Deliberately unauthenticated: an account flagged mustChangePassword is
   * refused a token at login, so it has no way to call a guarded endpoint.
   * The current password is the credential here, and it is re-validated in
   * full — including the lockout check — inside the service.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password by supplying the current password',
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const prisma = this.dbService.client;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    return this.authenticationService.changePassword(
      prisma,
      changePasswordDto.email,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      ipAddress,
      userAgent,
    );
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
  @ApiOperation({ summary: 'Logout current refresh-token session' })
  async logout(@AuthUser() user: RequestUser, @Body() logoutDto: LogoutDto) {
    const prisma = this.dbService.client;
    const result = await this.authenticationService.logout(
      prisma,
      user.userId,
      logoutDto.refreshToken,
    );

    try {
      await writeAuditLog(prisma, {
        tenantId: user.tenantId,
        eventType: AUDIT_EVENT.AUTHENTICATION,
        action: AUDIT_ACTION.AUTHENTICATION.LOGOUT,
        resource: 'session',
        actorId: user.userId,
        actorProfileId: user.profileId,
        actorRole: user.roleId || null,
        description:
          logoutDto.reason === 'idle'
            ? 'User signed out after inactivity'
            : 'User signed out',
        metadata: { reason: logoutDto.reason ?? 'manual' },
        status: 'success',
      });
    } catch (auditError) {
      console.error('Failed to audit logout', auditError);
    }

    return result;
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
