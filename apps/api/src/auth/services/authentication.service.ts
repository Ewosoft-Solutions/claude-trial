/**
 * Authentication Service
 *
 * Main authentication service that handles login, school selection, and token management.
 * Implements items 3.2 and 3.3.
 */

// External imports
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// Workspace imports
import {
  SchoolSelectionService,
  UserSchoolProfile,
  TenantStatus,
  ProfileStatus,
  MfaMethodType,
} from '@workspace/api';
import { PrismaClient } from '@workspace/database';
import { withTenantScope, withUserScope } from '@workspace/database/rls';
import { AUDIT_ACTION, AUDIT_EVENT } from '../../common/audit/audit.constants';
import { writeAuditLog } from '../../common/audit/audit-writer';
// Local imports
import { PasswordService } from './password.service';
import { LoginAttemptService } from './login-attempt.service';
import { AuthJWTService } from './jwt.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { MfaBaseService } from './mfa-base.service';
import { AuthenticationResponseJSON } from '@simplewebauthn/server';

/**
 * School picker option — the minimal subset of UserSchoolProfile needed to
 * let a user pick which school to sign into. Deliberately omits `roles`
 * and `primaryRole`: at this point in the flow the user has supplied
 * credentials but has not completed MFA (if enabled) or selected a school,
 * so no role/organizational detail should be disclosed yet. Full profile
 * detail (including role) is only returned post-authentication, from
 * GET /auth/me.
 */
export type SchoolPickerOption = Omit<
  UserSchoolProfile,
  'roles' | 'primaryRole'
>;

function toSchoolPickerOptions(
  schools: UserSchoolProfile[],
): SchoolPickerOption[] {
  return schools.map(
    ({ roles: _roles, primaryRole: _primaryRole, ...rest }) => rest,
  );
}

/**
 * Orders a user's profiles for the post-login auto-select step: the
 * frontend always takes index 0 (see apps/web/app/api/auth/login/route.ts)
 * as the default sign-in context. Without this, that index was whatever
 * order the DB query happened to return (effectively insertion order) —
 * arbitrary and meaningless to the user.
 *
 * Sorts deterministically by school name then profile id (so the default
 * fallback is at least stable and predictable), then — if the user has set
 * a preferred profile via PATCH /auth/default-profile and it's still in
 * the list — moves that one to the front, overriding the deterministic
 * order.
 */
function orderWithDefaultFirst(
  schools: UserSchoolProfile[],
  defaultUserTenantId: string | null | undefined,
): UserSchoolProfile[] {
  const sorted = [...schools].sort(
    (a, b) =>
      a.tenantName.localeCompare(b.tenantName) ||
      a.profileId.localeCompare(b.profileId),
  );

  if (!defaultUserTenantId) return sorted;

  const defaultIndex = sorted.findIndex(
    (s) => s.profileId === defaultUserTenantId,
  );
  if (defaultIndex <= 0) return sorted;

  const [preferred] = sorted.splice(defaultIndex, 1);
  return [preferred!, ...sorted];
}

/**
 * Login Response
 */
export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  schools: SchoolPickerOption[];
  /** Short-lived pre-auth token for the select-school step. */
  token?: string;
  /**
   * The account's password was assigned rather than chosen and must be rotated
   * before anything else. No token is issued while this is true — the client
   * must call POST /auth/change-password with the current password.
   */
  mustChangePassword?: boolean;
  requiresMfa?: boolean;
  mfaChallengeId?: string;
  mfaMethodType?: MfaMethodType;
  mfaExpiresAt?: Date;
  webauthnOptions?: any; // For WebAuthn
}

/**
 * School Selection Response
 */
export interface SchoolSelectionResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tenantContext: {
    tenantId: string;
    tenantSlug?: string;
    userId: string;
    profileId: string;
    roleId: string;
    tenantStatus: TenantStatus;
    profileStatus: ProfileStatus;
  };
}

type MfaVerificationPayload = {
  code?: string;
  token?: string;
  webauthnResponse?: AuthenticationResponseJSON;
  recoveryCode?: string;
};

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type VerifyMfaAndCompleteLoginParams = {
  prisma: PrismaClient;
  userId: string;
  challengeId: string;
  mfa?: MfaVerificationPayload;
  requestContext?: RequestContext;
};

/**
 * Authentication Service
 *
 * Provides authentication functionality including login and school selection.
 */
@Injectable()
export class AuthenticationService {
  constructor(
    private readonly jwtService: AuthJWTService,
    private readonly mfaService: MfaService,
  ) {}

  /**
   * Login user (3.2)
   *
   * Validates credentials and returns list of schools/profiles user belongs to.
   * Does NOT return JWT token - user must select school first.
   *
   * @param prisma - Prisma client instance
   * @param email - User email
   * @param password - User password
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @returns Login response with user and schools
   */
  async login(
    prisma: PrismaClient,
    email: string,
    password: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isVerified: true,
        loginAttempts: true,
        lockedUntil: true,
        mustChangePassword: true,
        defaultUserTenantId: true,
      },
    });

    // Check if user exists
    if (!user) {
      // Record failed attempt
      await LoginAttemptService.recordAttempt(prisma, {
        email: email.toLowerCase(),
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'User not found',
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked (3.11)
    const lockoutStatus = await LoginAttemptService.checkLockoutStatus(
      prisma,
      user.id,
    );

    if (lockoutStatus.isLocked) {
      await LoginAttemptService.recordAttempt(prisma, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Account locked',
      });

      throw new UnauthorizedException(
        `Account is locked until ${lockoutStatus.lockedUntil?.toISOString()}`,
      );
    }

    // Check if user is active
    if (!user.isActive) {
      await LoginAttemptService.recordAttempt(prisma, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Account inactive',
      });

      throw new UnauthorizedException('Account is inactive');
    }

    // Check if user is verified
    if (!user.isVerified) {
      await LoginAttemptService.recordAttempt(prisma, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Account not verified',
      });

      throw new UnauthorizedException('Account is not verified');
    }

    // Validate password
    if (!user.passwordHash) {
      await LoginAttemptService.recordAttempt(prisma, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'No password set',
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await PasswordService.comparePassword(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      await LoginAttemptService.recordAttempt(prisma, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Invalid password',
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Record successful login
    await LoginAttemptService.recordAttempt(prisma, {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      success: true,
    });

    // Check if user has active MFA methods (3a.9)
    const hasMfa = await MfaBaseService.hasActiveMfaMethods(prisma, user.id);

    // Audit: successful primary authentication
    await writeAuditLog(prisma, {
      tenantId: null,
      eventType: AUDIT_EVENT.AUTHENTICATION,
      action: AUDIT_ACTION.AUTHENTICATION.LOGIN,
      resource: 'auth_login',
      resourceId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      ipAddress,
      userAgent: userAgent || null,
      description: 'User login successful (pre-MFA)',
      metadata: {
        requiresMfa: hasMfa,
      },
      status: 'success',
    });

    // Get available schools for user
    // Note: Type definitions missing prisma parameter, but implementation requires it
    const schools = await this.availableSchoolsForUser(prisma, user.id);

    // If MFA is required, initiate verification (no pre-auth token yet)
    if (hasMfa) {
      const primaryMethod = await MfaBaseService.getPrimaryMfaMethod(
        prisma,
        user.id,
      );

      if (primaryMethod) {
        const mfaChallenge = await this.mfaService.initiateVerification(
          prisma,
          user.id,
          primaryMethod.id,
          'login',
          ipAddress,
          userAgent,
        );

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          schools: [], // Don't return schools until MFA is verified
          requiresMfa: true,
          mfaChallengeId: mfaChallenge.challengeId,
          mfaMethodType: primaryMethod.type as MfaMethodType,
          mfaExpiresAt: mfaChallenge.expiresAt,
          webauthnOptions: mfaChallenge.webauthnOptions,
        };
      }
    }

    // An assigned password must be rotated before it can be used for anything.
    // Deliberately placed after the MFA branch above, so an enrolled user still
    // proves their second factor first.
    if (user.mustChangePassword) {
      return this.passwordRotationRequiredResponse(user);
    }

    const preAuthToken = await this.jwtService.generatePreAuthToken(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      schools: toSchoolPickerOptions(
        orderWithDefaultFirst(schools, user.defaultUserTenantId),
      ),
      token: preAuthToken,
      requiresMfa: false,
    };
  }

  /**
   * The user's profiles across every tenant, read under the user-scoped RLS
   * grant (`app.current_user_id`).
   *
   * This question is cross-tenant by nature and is asked before a tenant has
   * been chosen, so there is no `app.current_tenant_id` to scope it with. Under
   * FORCE RLS on managed Postgres — where the owner connection is a normal role
   * and bypasses nothing — an unscoped read here returns zero rows, which the
   * web login surfaces as "not linked to an active school or platform
   * workspace". See migration 20260723090000_user_tenants_self_scope.
   */
  private async availableSchoolsForUser(
    prisma: PrismaClient,
    userId: string,
  ): Promise<UserSchoolProfile[]> {
    return withUserScope(prisma, userId, (tx) =>
      SchoolSelectionService.getAvailableSchools(tx, userId),
    );
  }

  /**
   * Shape returned when login stops short because the password must be rotated.
   *
   * No token and no school list. Every downstream step — select-school,
   * switch-profile, refresh — requires a token, so withholding it is what
   * actually enforces the rotation rather than merely signalling it to the
   * client. POST /auth/change-password is the only way forward.
   */
  private passwordRotationRequiredResponse(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): LoginResponse {
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      schools: [],
      mustChangePassword: true,
      requiresMfa: false,
    };
  }

  /**
   * Change password using the current password (no session required).
   *
   * Exists so a forced rotation can be completed by an account that cannot
   * obtain a token yet. It is also the reason forced rotation does not depend
   * on the email-based reset flow, which needs a working mail transport a
   * freshly deployed environment may not have.
   *
   * Re-validates credentials from scratch: holding a mustChangePassword account
   * hostage is not an authenticated state, so nothing here may be skipped.
   */
  async changePassword(
    prisma: PrismaClient,
    email: string,
    currentPassword: string,
    newPassword: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isActive: true,
      },
    });

    const recordFailure = async (failureReason: string) => {
      await LoginAttemptService.recordAttempt(prisma, {
        userId: user?.id,
        email: email.toLowerCase(),
        ipAddress,
        userAgent,
        success: false,
        failureReason,
      });
    };

    // Lockout is checked before the password comparison so this endpoint cannot
    // be used as an oracle that sidesteps the login rate limiting.
    if (user) {
      const lockoutStatus = await LoginAttemptService.checkLockoutStatus(
        prisma,
        user.id,
      );

      if (lockoutStatus.isLocked) {
        await recordFailure('Account locked');
        throw new UnauthorizedException(
          `Account is locked until ${lockoutStatus.lockedUntil?.toISOString()}`,
        );
      }
    }

    if (!user || !user.passwordHash || !user.isActive) {
      await recordFailure('Change password: no usable account');
      throw new UnauthorizedException('Invalid credentials');
    }

    const currentValid = await PasswordService.comparePassword(
      currentPassword,
      user.passwordHash,
    );

    if (!currentValid) {
      await recordFailure('Change password: invalid current password');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (newPassword === currentPassword) {
      throw new BadRequestException(
        'New password must differ from the current password',
      );
    }

    // Same policy and reuse rules the reset flow applies — a forced rotation
    // must not be a way to set a weaker password than the policy allows.
    const validation = await PasswordService.validatePasswordAgainstAllSchools(
      prisma,
      user.id,
      newPassword,
    );

    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(' '));
    }

    const reused = await PasswordService.checkPasswordReuse(
      prisma,
      user.id,
      newPassword,
    );

    if (reused) {
      throw new BadRequestException(
        'New password matches a recently used password',
      );
    }

    const newHash = await PasswordService.hashPassword(newPassword);

    await PasswordService.savePasswordHistory(
      prisma,
      user.id,
      user.passwordHash,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        updatedBy: user.id,
      },
    });

    await writeAuditLog(prisma, {
      tenantId: null,
      eventType: AUDIT_EVENT.AUTHENTICATION,
      action: AUDIT_ACTION.AUTHENTICATION.LOGIN,
      resource: 'auth_change_password',
      resourceId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      ipAddress,
      userAgent: userAgent || null,
      description: 'Password changed via current-password flow',
      status: 'success',
    });

    return {
      success: true,
      message: 'Password changed successfully. Please sign in again.',
    };
  }

  /**
   * Verify MFA and complete login (3a.9)
   *
   * @param params.prisma - Prisma client instance
   * @param params.userId - User ID
   * @param params.challengeId - MFA challenge ID
   * @param params.mfa - MFA verification payload (code/token/webauthn/recovery)
   * @param params.requestContext - Request metadata (ip/user agent)
   * @returns Login response with schools
   */
  async verifyMfaAndCompleteLogin({
    prisma,
    userId,
    challengeId,
    mfa = {},
    requestContext,
  }: VerifyMfaAndCompleteLoginParams): Promise<LoginResponse> {
    const { code, token, webauthnResponse, recoveryCode } = mfa;
    const { ipAddress, userAgent } = requestContext || {};

    // Verify recovery code if provided
    if (recoveryCode) {
      const recoveryValid = await this.mfaService.verifyRecoveryCode(
        prisma,
        userId,
        recoveryCode,
      );

      if (!recoveryValid) {
        throw new UnauthorizedException('Invalid recovery code');
      }
    } else {
      // Verify MFA challenge
      const verified = await this.mfaService.verifyChallenge(
        prisma,
        challengeId,
        code,
        token,
        webauthnResponse,
      );

      if (!verified) {
        throw new UnauthorizedException('MFA verification failed');
      }
    }

    // Get available schools for user
    const schools = await this.availableSchoolsForUser(prisma, userId);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mustChangePassword: true,
        defaultUserTenantId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Audit: MFA verified / login completed
    await writeAuditLog(prisma, {
      tenantId: null,
      eventType: AUDIT_EVENT.AUTHENTICATION,
      action: AUDIT_ACTION.AUTHENTICATION.MFA_VERIFIED,
      resource: 'auth_login',
      resourceId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      description: 'MFA challenge verified',
      metadata: {
        challengeId,
        method: token ? 'totp_or_code' : 'webauthn_or_recovery',
      },
      status: 'success',
    });

    if (user.mustChangePassword) {
      return this.passwordRotationRequiredResponse(user);
    }

    const preAuthToken = await this.jwtService.generatePreAuthToken(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      schools: toSchoolPickerOptions(
        orderWithDefaultFirst(schools, user.defaultUserTenantId),
      ),
      token: preAuthToken,
      requiresMfa: false,
    };
  }

  /**
   * Begin a passwordless passkey login.
   *
   * With an `email`, options are scoped to that (active) account's passkeys, and
   * the response is `{ hasPasskey: false }` when there's no account/passkey —
   * uniform across unknown/inactive accounts so it's no stronger an enumeration
   * oracle than password login. Without an `email`, it's a **usernameless /
   * discoverable** login: options over any resident passkey for this RP, with
   * the user resolved from the assertion at verify time.
   */
  async beginPasskeyLogin(
    prisma: PrismaClient,
    email?: string,
  ): Promise<
    | { hasPasskey: false }
    | { hasPasskey: true; challengeId: string; options: unknown }
  > {
    if (!email) {
      const result =
        await this.mfaService.beginUsernamelessWebAuthnLogin(prisma);
      return {
        hasPasskey: true,
        challengeId: result.challengeId,
        options: result.options,
      };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return { hasPasskey: false };
    }

    const result = await this.mfaService.beginWebAuthnLogin(prisma, user.id);
    if (!result) {
      return { hasPasskey: false };
    }

    return {
      hasPasskey: true,
      challengeId: result.challengeId,
      options: result.options,
    };
  }

  /**
   * Complete a passwordless passkey login: verify the WebAuthn assertion for a
   * `login` challenge and, on success, issue the same pre-auth token + school
   * list a password (or password+MFA) login returns. A user-verified passkey is
   * itself multi-factor, so no additional MFA step is required (3a.9, item C).
   *
   * Handles both flows: a per-user challenge (verify scoped to `challenge.userId`)
   * and a usernameless one (`challenge.userId` is null → resolve the user from
   * the credential).
   */
  async completePasskeyLogin({
    prisma,
    challengeId,
    authenticationResponse,
    requestContext,
  }: {
    prisma: PrismaClient;
    challengeId: string;
    authenticationResponse: AuthenticationResponseJSON;
    requestContext?: RequestContext;
  }): Promise<LoginResponse> {
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
      select: { userId: true, operation: true },
    });

    if (!challenge || challenge.operation !== 'login') {
      throw new UnauthorizedException('Invalid login challenge');
    }

    let userId: string;
    if (challenge.userId) {
      const verified = await this.mfaService.verifyChallenge(
        prisma,
        challengeId,
        undefined,
        undefined,
        authenticationResponse,
      );
      if (!verified) {
        throw new UnauthorizedException('Passkey verification failed');
      }
      userId = challenge.userId;
    } else {
      const resolved = await this.mfaService.verifyUsernamelessWebAuthnLogin(
        prisma,
        challengeId,
        authenticationResponse,
      );
      if (!resolved) {
        throw new UnauthorizedException('Passkey verification failed');
      }
      userId = resolved;
    }

    return this.issueLoginForUser(prisma, userId, challengeId, requestContext);
  }

  /**
   * Shared tail for a completed passkey login: record the attempt, audit, and
   * return the pre-auth token + school list for the resolved user.
   */
  private async issueLoginForUser(
    prisma: PrismaClient,
    userId: string,
    challengeId: string,
    requestContext?: RequestContext,
  ): Promise<LoginResponse> {
    const { ipAddress, userAgent } = requestContext || {};

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mustChangePassword: true,
        defaultUserTenantId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await LoginAttemptService.recordAttempt(prisma, {
      userId: user.id,
      email: user.email,
      ipAddress: ipAddress || 'unknown',
      userAgent,
      success: true,
    });

    await writeAuditLog(prisma, {
      tenantId: null,
      eventType: AUDIT_EVENT.AUTHENTICATION,
      action: AUDIT_ACTION.AUTHENTICATION.LOGIN,
      resource: 'auth_login',
      resourceId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      description: 'Passwordless passkey login successful',
      metadata: { challengeId, method: 'webauthn_passwordless' },
      status: 'success',
    });

    const schools = await this.availableSchoolsForUser(prisma, user.id);

    // Gated here too: a passkey login never touches the password, but the
    // assigned password stays a valid credential on the account until it is
    // rotated, so letting passkeys through would leave that credential live.
    if (user.mustChangePassword) {
      return this.passwordRotationRequiredResponse(user);
    }

    const preAuthToken = await this.jwtService.generatePreAuthToken(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      schools: toSchoolPickerOptions(
        orderWithDefaultFirst(schools, user.defaultUserTenantId),
      ),
      token: preAuthToken,
      requiresMfa: false,
    };
  }

  /**
   * Select school / Switch context (3.3)
   *
   * Validates user access to school and generates JWT tokens.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param profileId - UserTenant profile ID
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @returns School selection response with tokens
   */
  async selectSchool(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    profileId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SchoolSelectionResponse> {
    // Get user tenant profile by profileId and verify ownership/tenant match.
    //
    // `user_tenants` and the `user_tenant_roles` include are strictly
    // tenant-scoped under FORCE RLS, and no request scope exists yet — minting
    // one is what this method does. Scoping to the *claimed* tenantId is safe:
    // it only reveals rows of the tenant being requested, and the explicit
    // ownership check below still decides before any token is issued. See
    // docs/rls-privileged-client-plan.md.
    const userTenant = await withTenantScope(prisma, tenantId, userId, (tx) =>
      tx.userTenant.findUnique({
        where: { id: profileId },
        include: {
          user: { select: { email: true, id: true } },
          tenant: {
            select: { id: true, name: true, slug: true, status: true },
          },
          userTenantRole: {
            where: { role: { isActive: true } },
            include: { role: true },
          },
        },
      }),
    );

    if (userTenant?.userId !== userId || userTenant.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid profile');
    }

    // Check profile status
    if (
      userTenant.status !== ProfileStatus.ACTIVE ||
      userTenant.suspended ||
      userTenant.tenant.status !== TenantStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Profile is not active');
    }

    // Get roles (one per profile now enforced)
    const roleId = userTenant.userTenantRole?.role.id;

    if (!roleId) {
      throw new UnauthorizedException('No active roles for this profile');
    }

    // Generate JWT tokens (3.6, 3.8)
    const tokens = await this.jwtService.generateTokens(
      prisma,
      {
        sub: userId,
        tenantId,
        profileId,
        roleId,
      },
      tenantId,
      3600, // 1 hour access token
      604800, // 7 days refresh token
    );

    // Create session (3.8)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + 604800); // 7 days

    await SessionService.createSession(prisma, {
      userId,
      userTenantId: profileId,
      token: tokens.refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    });

    // Audit: authorization context selection
    await writeAuditLog(prisma, {
      tenantId,
      eventType: AUDIT_EVENT.AUTHORIZATION,
      action: AUDIT_ACTION.AUTHORIZATION.SELECT_SCHOOL,
      resource: 'auth_context',
      resourceId: tenantId,
      actorId: userId,
      actorProfileId: profileId,
      actorRole: roleId || null,
      actorEmail: userTenant.user?.email || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      description: `User selected school ${userTenant.tenant.name}`,
      metadata: {
        roleId,
      },
      status: 'success',
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tenantContext: {
        tenantId,
        tenantSlug: userTenant.tenant.slug || undefined,
        userId,
        profileId,
        roleId: roleId || null,
        tenantStatus: userTenant.tenant.status as TenantStatus,
        profileStatus: userTenant.status as ProfileStatus,
      },
    };
  }

  /**
   * Set the profile to auto-select at future logins (Account settings ›
   * Profile). Reuses the same ownership check as selectSchool: the target
   * profile must belong to the calling user, so a caller can never point
   * their default at someone else's profile.
   *
   * @param prisma - Prisma client instance
   * @param userId - Calling user's id
   * @param profileId - UserTenant id to set as the sign-in default
   */
  async setDefaultProfile(
    prisma: PrismaClient,
    userId: string,
    profileId: string,
  ): Promise<{ success: true; defaultProfileId: string }> {
    // Reading one's own membership row — the user-scope RLS grant covers it
    // (migration 20260723090000_user_tenants_self_scope).
    const userTenant = await withUserScope(prisma, userId, (tx) =>
      tx.userTenant.findUnique({
        where: { id: profileId },
        select: { userId: true },
      }),
    );

    if (userTenant?.userId !== userId) {
      throw new UnauthorizedException('Invalid profile');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { defaultUserTenantId: profileId },
    });

    return { success: true, defaultProfileId: profileId };
  }

  /**
   * Refresh access token (3.8)
   *
   * Validates refresh token and generates new access token.
   *
   * @param prisma - Prisma client instance
   * @param refreshToken - Refresh token
   * @returns New access token
   */
  async refreshToken(
    prisma: PrismaClient,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Find session by refresh token
    const session = await SessionService.findSessionByToken(
      prisma,
      refreshToken,
    );

    if (!session || !SessionService.isSessionValid(session)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Decode token to get tenant ID
    const decoded = this.jwtService.decodeToken(refreshToken);
    if (!decoded?.tenantId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Validate refresh token
    const payload = await this.jwtService.validateRefreshToken(
      prisma,
      refreshToken,
      decoded.tenantId,
    );

    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new access token
    const accessToken = await this.jwtService.generateAccessToken(
      prisma,
      {
        sub: payload.sub,
        tenantId: payload.tenantId,
        profileId: payload.profileId,
        roleId: payload.roleId || '',
      },
      payload.tenantId,
      3600, // 1 hour
    );

    await writeAuditLog(prisma, {
      tenantId: payload.tenantId,
      eventType: AUDIT_EVENT.AUTHENTICATION,
      action: AUDIT_ACTION.AUTHENTICATION.SESSION_REFRESHED,
      resource: 'session',
      resourceId: session.id,
      actorId: payload.sub,
      actorProfileId: payload.profileId,
      actorRole: payload.roleId || null,
      actorEmail: session.user?.email ?? null,
      description: 'Access token refreshed',
      status: 'success',
    });

    return {
      accessToken,
      expiresIn: 3600,
    };
  }

  /**
   * Logout user (12.1)
   *
   * Revokes the current session token.
   *
   * @param prisma - Prisma client instance
   * @param userId - Authenticated user who owns the session
   * @param refreshToken - Refresh token identifying the stored session
   * @returns Success response
   */
  async logout(
    prisma: PrismaClient,
    userId: string,
    refreshToken: string,
  ): Promise<{ success: boolean; message: string }> {
    await SessionService.revokeSession(prisma, userId, refreshToken);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  /**
   * Logout all sessions for user (12.1)
   *
   * Revokes all active sessions for a user.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Success response
   */
  async logoutAll(
    prisma: PrismaClient,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Revoke all user sessions
    await SessionService.revokeAllUserSessions(prisma, userId);

    return {
      success: true,
      message: 'All sessions logged out successfully',
    };
  }
}
