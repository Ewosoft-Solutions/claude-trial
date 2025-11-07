/**
 * JWT Service
 *
 * Handles JWT token generation and validation with school-specific secrets.
 * Implements items 3.6 and 3.7.
 */

import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@workspace/database';
import { JWTSecretService } from '@workspace/api';

/**
 * JWT Payload
 */
export interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  profileId: string;
  roles: string[];
  iat?: number;
  exp?: number;
  type: 'access' | 'refresh';
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
 * JWT Service
 *
 * Provides JWT token generation and validation with school-specific secrets.
 */
export class AuthJWTService {
  constructor(private readonly jwtService: JwtService) {}

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
    payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>,
    tenantId: string,
    expiresIn: number = 3600, // 1 hour
  ): Promise<string> {
    // Get school-specific JWT secret (internal use, no role check)
    const secret = await JWTSecretService.getTenantJWTSecretInternal(
      prisma,
      tenantId,
    );

    const tokenPayload: JWTPayload = {
      ...payload,
      type: 'access',
    };

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
    payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>,
    tenantId: string,
    expiresIn: number = 604800, // 7 days
  ): Promise<string> {
    // Get school-specific JWT secret (internal use, no role check)
    const secret = await JWTSecretService.getTenantJWTSecretInternal(
      prisma,
      tenantId,
    );

    const tokenPayload: JWTPayload = {
      ...payload,
      type: 'refresh',
    };

    return this.jwtService.signAsync(tokenPayload, {
      secret,
      expiresIn,
    });
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
    } catch {
      // Token is invalid
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
    } catch {
      // Token is invalid
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
      return this.jwtService.decode(token) as Partial<JWTPayload>;
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
    payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>,
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
}
