/**
 * Session Service
 *
 * Handles session management, refresh tokens, and session invalidation.
 * Implements items 3.8 and 3.12.
 */

import { ProfileStatus } from '@workspace/api';
import { Prisma, PrismaClient } from '@workspace/database';

/**
 * Session Creation Options
 */
export interface SessionCreationOptions {
  userId: string;
  userTenantId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  expiresAt: Date;
}

/**
 * Session Service
 *
 * Manages user sessions and refresh tokens.
 */
export class SessionService {
  /**
   * Create session (3.8)
   *
   * @param prisma - Prisma client instance
   * @param options - Session creation options
   * @returns Created session
   */
  static async createSession(
    prisma: PrismaClient,
    options: SessionCreationOptions,
  ) {
    return prisma.session.create({
      data: {
        userId: options.userId,
        userTenantId: options.userTenantId,
        token: options.token,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        deviceFingerprint: options.deviceFingerprint || null,
        expiresAt: options.expiresAt,
      },
    });
  }

  /**
   * Find session by token
   *
   * @param prisma - Prisma client instance
   * @param token - Session token
   * @returns Session or null
   */
  static async findSessionByToken(prisma: PrismaClient, token: string) {
    return prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        userTenant: {
          select: {
            id: true,
            status: true,
            suspended: true,
          },
        },
      },
    });
  }

  /**
   * Validate session
   *
   * @param session - Session to validate
   * @returns True if session is valid
   */
  static isSessionValid(session: any): boolean {
    if (!session) {
      return false;
    }

    // Check if session is revoked
    if (session.revokedAt) {
      return false;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      return false;
    }

    // Check if user is active
    if (!session.user?.isActive) {
      return false;
    }

    // Check if profile is active
    if (
      !session.userTenant ||
      session.userTenant.status !== ProfileStatus.ACTIVE ||
      session.userTenant.suspended
    ) {
      return false;
    }

    return true;
  }

  /**
   * Revoke session
   *
   * @param prisma - Prisma client instance
   * @param userId - Owner of the session
   * @param token - Refresh token stored on the session
   */
  static async revokeSession(
    prisma: PrismaClient,
    userId: string,
    token: string,
  ): Promise<void> {
    // Logout is idempotent: an expired, previously revoked, or already-cleaned
    // session is still successfully logged out from the caller's perspective.
    await prisma.session.updateMany({
      where: { userId, token, revokedAt: null },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all user sessions (3.12)
   *
   * Invalidates all active sessions for a user.
   * Used when password is reset or account is compromised.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   */
  static async revokeAllUserSessions(
    prisma: PrismaClient,
    userId: string,
  ): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all sessions for a profile.
   *
   * Accepts a `Prisma.TransactionClient` (a full `PrismaClient` satisfies it) so
   * it can run inside a caller's scope — e.g. the @PlatformScoped breach path,
   * whose client is a transaction. `sessions` is not RLS-scoped, so it works
   * under any client, but taking the narrower type keeps the scope intact.
   *
   * @param prisma - Prisma client (full or scoped transaction client)
   * @param userTenantId - UserTenant profile ID
   */
  static async revokeAllProfileSessions(
    prisma: Prisma.TransactionClient,
    userTenantId: string,
  ): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userTenantId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Get active sessions for user
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Array of active sessions
   */
  static async getActiveUserSessions(prisma: PrismaClient, userId: string) {
    return prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Clean up expired sessions
   *
   * @param prisma - Prisma client instance
   * @returns Number of sessions cleaned up
   */
  static async cleanupExpiredSessions(prisma: PrismaClient): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get session count for user
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Number of active sessions
   */
  static async getSessionCount(
    prisma: PrismaClient,
    userId: string,
  ): Promise<number> {
    return prisma.session.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }
}
