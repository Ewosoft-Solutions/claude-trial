/**
 * Authentication Service
 *
 * Main authentication service that handles login, school selection, and token management.
 * Implements items 3.2 and 3.3.
 */

// External imports
import { Injectable, UnauthorizedException } from '@nestjs/common';
// Workspace imports
import { SchoolSelectionService, UserSchoolProfile } from '@workspace/api';
import { PrismaClient } from '@workspace/database';
// Local imports
import { PasswordService } from './password.service';
import { LoginAttemptService } from './login-attempt.service';
import { AuthJWTService } from './jwt.service';
import { SessionService } from './session.service';

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
  schools: UserSchoolProfile[];
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
    roles: string[];
    tenantStatus: 'active' | 'pending' | 'suspended';
    profileStatus: 'active' | 'inactive' | 'pending' | 'suspended';
  };
}

/**
 * Authentication Service
 *
 * Provides authentication functionality including login and school selection.
 */
@Injectable()
export class AuthenticationService {
  constructor(private readonly jwtService: AuthJWTService) {}

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
      user.id as string,
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
      user.passwordHash as string,
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

    // Get available schools for user
    // Note: Type definitions missing prisma parameter, but implementation requires it
    const schools = await (SchoolSelectionService.getAvailableSchools as any)(
      prisma,
      user.id as string,
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      schools,
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
    // Validate user has access to school
    // Note: Type definitions missing prisma parameter, but implementation requires it
    const hasAccess = await (
      SchoolSelectionService.validateSchoolAccess as any
    )(prisma, userId as string, tenantId as string);

    if (!hasAccess) {
      throw new UnauthorizedException('Access denied to this school');
    }

    // Get user tenant profile
    const userTenant = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
        userTenantRoles: {
          where: {
            role: {
              isActive: true,
            },
          },
          include: {
            role: true,
          },
        },
      },
    });

    if (!userTenant || userTenant.id !== profileId) {
      throw new UnauthorizedException('Invalid profile');
    }

    // Check profile status
    if (
      userTenant.status !== 'active' ||
      userTenant.suspended ||
      userTenant.tenant.status !== 'active'
    ) {
      throw new UnauthorizedException('Profile is not active');
    }

    // Get roles
    const roles = userTenant.userTenantRoles.map((utr) => utr.role.name);

    if (roles.length === 0) {
      throw new UnauthorizedException('No active roles for this profile');
    }

    // Generate JWT tokens (3.6, 3.8)
    const tokens = await this.jwtService.generateTokens(
      prisma,
      {
        sub: userId,
        tenantId,
        profileId,
        roles,
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
        roles,
        tenantStatus: userTenant.tenant.status as
          | 'active'
          | 'pending'
          | 'suspended',
        profileStatus: userTenant.status as
          | 'active'
          | 'inactive'
          | 'pending'
          | 'suspended',
      },
    };
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
    if (!decoded || !decoded.tenantId) {
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
        roles: payload.roles,
      },
      payload.tenantId,
      3600, // 1 hour
    );

    return {
      accessToken,
      expiresIn: 3600,
    };
  }
}
