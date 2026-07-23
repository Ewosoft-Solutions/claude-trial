/**
 * JWT Service
 *
 * Handles JWT token generation and validation with school-specific secrets.
 * Implements items 3.6 and 3.7.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@workspace/database';
import { JWTSecretService, JWTTokenType } from '@workspace/api';

/**
 * JWT Payload
 */
export interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  profileId: string;
  roleId: string;
  iat?: number;
  exp?: number;
  type: JWTTokenType;
}

/**
 * JWT Token Response
 */
export interface JWTTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Pre-Auth JWT Payload
 *
 * Lightweight payload for pre-authentication tokens issued after login
 * but before school selection.
 */
export interface PreAuthPayload {
  sub: string; // User ID
  type: 'pre_auth';
  iat?: number;
  exp?: number;
}

/**
 * IatExpType
 *
 * Type for Iat and Exp fields in JWT payload.
 */
export type IatExpType = 'iat' | 'exp' | 'type';

/**
 * Pre-auth token expiry in seconds (5 minutes).
 */
const PRE_AUTH_TOKEN_EXPIRY = 300;

/**
 * JWT Service
 *
 * Provides JWT token generation and validation with school-specific secrets.
 */

@Injectable()
export class AuthJWTService {
  private readonly logger = new Logger(AuthJWTService.name);
  private readonly globalSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.globalSecret =
      configService.get<string>('JWT_SECRET') ||
      'schoolwithease-default-secret';
  }

  /**
   * Generate access token with school-specific secret (3.6)
   *
   * @param prisma - Prisma client instance
   * @param payload - JWT payload
   * @param tenantId - Tenant ID for school-specific secret
   * @param expiresIn - Token expiration in seconds (default: 1 hour)
   * @returns Access token
   */
  async generateAccessToken(
    prisma: PrismaClient,
    payload: Omit<JWTPayload, IatExpType>,
    tenantId: string,
    expiresIn: number = 3600, // 1 hour
  ): Promise<string> {
    // Get school-specific JWT secret (internal use, no role check)
    const secret = await JWTSecretService.getTenantJWTSecretInternal(
      prisma,
      tenantId,
    );

    const tokenPayload: JWTPayload = { ...payload, type: 'access' };

    return this.jwtService.signAsync(tokenPayload, {
      secret,
      expiresIn,
    });
  }

  /**
   * Generate refresh token with school-specific secret (3.8)
   *
   * @param prisma - Prisma client instance
   * @param payload - JWT payload
   * @param tenantId - Tenant ID for school-specific secret
   * @param expiresIn - Token expiration in seconds (default: 7 days)
   * @returns Refresh token
   */
  async generateRefreshToken(
    prisma: PrismaClient,
    payload: Omit<JWTPayload, IatExpType>,
    tenantId: string,
    expiresIn: number = 604800, // 7 days
  ): Promise<string> {
    // Get school-specific JWT secret (internal use, no role check)
    const secret = await JWTSecretService.getTenantJWTSecretInternal(
      prisma,
      tenantId,
    );

    const tokenPayload: JWTPayload = { ...payload, type: 'refresh' };

    return this.jwtService.signAsync(tokenPayload, {
      secret,
      expiresIn,
    });
  }

  /**
   * Both validators return null for "this token is not usable", which is the
   * right contract — but it used to swallow the REASON, and the two reasons are
   * nothing alike:
   *
   *   - the token is expired, malformed or signed with another key. Routine,
   *     happens constantly, says nothing is wrong.
   *   - the tenant's signing secret could not be READ. That is infrastructure
   *     failing, and it reports as "invalid token" → 401 → the web client
   *     clears its cookies and bounces to /login. A login loop with no error
   *     anywhere, which is precisely how this cost an afternoon on demo.
   *
   * So: JWT verification errors stay quiet, anything else is logged loudly.
   */
  private explainValidationFailure(
    error: unknown,
    tokenType: 'access' | 'refresh',
    tenantId: string,
  ): void {
    const name = error instanceof Error ? error.name : '';
    const isJwtError =
      name === 'JsonWebTokenError' ||
      name === 'TokenExpiredError' ||
      name === 'NotBeforeError';

    if (isJwtError) return;

    this.logger.error(
      `Could not validate ${tokenType} token for tenant ${tenantId} — this is ` +
        `NOT a bad token. Callers will see a 401 and treat the session as ` +
        `expired: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    );
  }

  /**
   * Validate access token with school-specific secret (3.7)
   *
   * @param prisma - Prisma client instance
   * @param token - JWT token
   * @param tenantId - Tenant ID for school-specific secret
   * @returns Decoded payload or null if invalid
   */
  async validateAccessToken(
    prisma: PrismaClient,
    token: string,
    tenantId: string,
  ): Promise<JWTPayload | null> {
    try {
      // Get school-specific JWT secret (internal use, no role check)
      const secret = await JWTSecretService.getTenantJWTSecretInternal(
        prisma,
        tenantId,
      );

      const payload = await this.jwtService.verifyAsync<JWTPayload>(token, {
        secret,
      });

      // Verify token type
      if (payload.type !== 'access') {
        return null;
      }

      // Verify tenant matches
      if (payload.tenantId !== tenantId) {
        return null;
      }

      return payload;
    } catch (error) {
      this.explainValidationFailure(error, 'access', tenantId);
      return null;
    }
  }

  /**
   * Validate refresh token with school-specific secret (3.7, 3.8)
   *
   * @param prisma - Prisma client instance
   * @param token - JWT refresh token
   * @param tenantId - Tenant ID for school-specific secret
   * @returns Decoded payload or null if invalid
   */
  async validateRefreshToken(
    prisma: PrismaClient,
    token: string,
    tenantId: string,
  ): Promise<JWTPayload | null> {
    try {
      // Get school-specific JWT secret (internal use, no role check)
      const secret = await JWTSecretService.getTenantJWTSecretInternal(
        prisma,
        tenantId,
      );

      const payload = await this.jwtService.verifyAsync<JWTPayload>(token, {
        secret,
      });

      // Verify token type
      if (payload.type !== 'refresh') {
        return null;
      }

      // Verify tenant matches
      if (payload.tenantId !== tenantId) {
        return null;
      }

      return payload;
    } catch (error) {
      this.explainValidationFailure(error, 'refresh', tenantId);
      return null;
    }
  }

  /**
   * Decode token without verification (for extracting tenant ID)
   *
   * @param token - JWT token
   * @returns Decoded payload or null if invalid
   */
  decodeToken(token: string): Partial<JWTPayload> | null {
    try {
      return this.jwtService.decode(token);
    } catch {
      return null;
    }
  }

  /**
   * Generate both access and refresh tokens (3.6, 3.8)
   *
   * @param prisma - Prisma client instance
   * @param payload - JWT payload
   * @param tenantId - Tenant ID for school-specific secret
   * @param accessExpiresIn - Access token expiration in seconds
   * @param refreshExpiresIn - Refresh token expiration in seconds
   * @returns Token response with access and refresh tokens
   */
  async generateTokens(
    prisma: PrismaClient,
    payload: Omit<JWTPayload, IatExpType>,
    tenantId: string,
    accessExpiresIn: number = 3600,
    refreshExpiresIn: number = 604800,
  ): Promise<JWTTokenResponse> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(prisma, payload, tenantId, accessExpiresIn),
      this.generateRefreshToken(prisma, payload, tenantId, refreshExpiresIn),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  /**
   * Generate a pre-auth token after successful login (before school selection).
   *
   * Signed with the global JWT_SECRET, valid for 5 minutes.
   * Only contains the user ID — no tenant/role context.
   *
   * @param userId - Authenticated user ID
   * @returns Signed pre-auth JWT
   */
  async generatePreAuthToken(userId: string): Promise<string> {
    const payload: Omit<PreAuthPayload, 'iat' | 'exp'> = {
      sub: userId,
      type: 'pre_auth',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.globalSecret,
      expiresIn: PRE_AUTH_TOKEN_EXPIRY,
    });
  }

  /**
   * Validate a pre-auth token.
   *
   * @param token - Pre-auth JWT to validate
   * @returns The decoded payload, or null if invalid / expired / wrong type
   */
  async validatePreAuthToken(token: string): Promise<PreAuthPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<PreAuthPayload>(token, {
        secret: this.globalSecret,
      });

      if (payload.type !== 'pre_auth') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}
