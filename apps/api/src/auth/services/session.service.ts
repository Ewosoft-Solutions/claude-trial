/**
 * Session Service
 *
 * Handles session management, refresh tokens, and session invalidation.
 * Implements items 3.8 and 3.12.
 */

import { randomUUID } from 'node:crypto';

import { ProfileStatus } from '@workspace/api';
import { Prisma, PrismaClient } from '@workspace/database';

/**
 * Grace window after a refresh token is rotated during which a replay of the
 * just-superseded token is treated as an idempotent retry (returning the
 * already-issued successor) rather than a reuse attack. The web layer already
 * single-flights refresh within a tab and coordinates across tabs with Web
 * Locks, but a network retry or an unload keepalive can still resend the same
 * token; this window absorbs that without a false family logout.
 */
export const REFRESH_ROTATION_GRACE_MS = 10_000;

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
  /**
   * Rotation lineage id. Every rotation of a single login shares one familyId,
   * so reuse detection can revoke exactly that lineage. Generated fresh at
   * login/select-school and threaded through each rotation.
   */
  familyId?: string;
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
        familyId: options.familyId ?? null,
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
  static async findSessionByToken(
    prisma: Prisma.TransactionClient,
    token: string,
  ) {
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
   * Rotate a refresh session (single-use rotation).
   *
   * Atomically claims the rotation by flipping the current row's `rotatedAt`
   * from null to now — so two concurrent refreshes can never both mint a
   * successor — then creates the successor row carrying the SAME absolute
   * `expiresAt`, because rotation must never extend the 7-day cap. Returns the
   * successor's id + token, or `null` when another in-flight refresh already
   * claimed the rotation (the caller then treats the replay as idempotent).
   *
   * @param prisma - Prisma client (full or scoped transaction client)
   * @param current - The session row being rotated
   * @param newToken - The freshly-signed refresh token for the successor
   */
  static async rotateSession(
    prisma: Prisma.TransactionClient,
    current: {
      id: string;
      familyId: string | null;
      userId: string;
      userTenantId: string;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
      deviceFingerprint: string | null;
    },
    newToken: string,
  ): Promise<{ id: string; token: string } | null> {
    const successorId = randomUUID();

    // Claim the rotation. Only the first caller sees `rotatedAt: null`; a
    // concurrent refresh gets count 0 and is handled as a grace-window replay.
    const claimed = await prisma.session.updateMany({
      where: { id: current.id, rotatedAt: null },
      data: { rotatedAt: new Date(), replacedById: successorId },
    });
    if (claimed.count === 0) {
      return null;
    }

    await prisma.session.create({
      data: {
        id: successorId,
        userId: current.userId,
        userTenantId: current.userTenantId,
        token: newToken,
        ipAddress: current.ipAddress,
        userAgent: current.userAgent,
        deviceFingerprint: current.deviceFingerprint,
        expiresAt: current.expiresAt, // same absolute cap — never extended
        familyId: current.familyId ?? current.id,
      },
    });

    return { id: successorId, token: newToken };
  }

  /**
   * Look up a rotation successor by id for the grace-window replay decision.
   * Selects only the scalar fields needed to judge whether the successor is
   * still the live head of its family — no RLS-scoped includes, so it resolves
   * under any client (`sessions` carries no tenant policy).
   *
   * @param prisma - Prisma client (full or scoped transaction client)
   * @param successorId - The `replacedById` recorded on the rotated row
   */
  static async findSuccessor(
    prisma: Prisma.TransactionClient,
    successorId: string,
  ) {
    return prisma.session.findUnique({
      where: { id: successorId },
      select: {
        id: true,
        token: true,
        rotatedAt: true,
        revokedAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Revoke an entire rotation family — used when a retired refresh token is
   * replayed outside the grace window (reuse detection). Scoped to this login's
   * lineage only, so the user's other sessions/devices stay signed in.
   *
   * @param prisma - Prisma client (full or scoped transaction client)
   * @param familyId - The rotation family to revoke
   * @returns Number of sessions revoked
   */
  static async revokeFamily(
    prisma: Prisma.TransactionClient,
    familyId: string,
  ): Promise<number> {
    const result = await prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
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
