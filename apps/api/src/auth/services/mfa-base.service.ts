/**
 * MFA Base Service
 *
 * Base utilities and common functionality for MFA operations.
 */

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaClient } from '@workspace/database';
import {
  MfaMethodType,
  MfaChallengeType,
  MfaOperationType,
} from '@workspace/api';

// Re-export for backward compatibility
export type { MfaMethodType, MfaChallengeType, MfaOperationType };

/**
 * MFA Base Service
 *
 * Provides common utilities for MFA operations.
 */
export class MfaBaseService {
  /**
   * Generate random verification code
   *
   * @param length - Code length (default: 6)
   * @returns Random numeric code
   */
  static generateVerificationCode(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Hash verification code
   *
   * @param code - Plain text code
   * @returns Bcrypt hash
   */
  static async hashCode(code: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(code, saltRounds);
  }

  /**
   * Compare verification code with hash
   *
   * @param code - Plain text code
   * @param hash - Bcrypt hash
   * @returns True if code matches
   */
  static async compareCode(code: string, hash: string): Promise<boolean> {
    return bcrypt.compare(code, hash);
  }

  /**
   * Generate recovery code
   *
   * @returns Random recovery code (format: XXXX-XXXX-XXXX)
   */
  static generateRecoveryCode(): string {
    const segments = [];
    for (let i = 0; i < 3; i++) {
      const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
      segments.push(segment);
    }
    return segments.join('-');
  }

  /**
   * Generate random string for WebAuthn challenge
   *
   * @param length - String length (default: 32)
   * @returns Random base64url string
   */
  static generateWebAuthnChallenge(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Check if user has active MFA methods
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns True if user has active MFA methods
   */
  static async hasActiveMfaMethods(
    prisma: PrismaClient,
    userId: string,
  ): Promise<boolean> {
    const count = await prisma.mfaMethod.count({
      where: {
        userId,
        isActive: true,
        verifiedAt: { not: null },
      },
    });

    return count > 0;
  }

  /**
   * Get user's active MFA methods
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns List of active MFA methods
   */
  static async getActiveMfaMethods(prisma: PrismaClient, userId: string) {
    return prisma.mfaMethod.findMany({
      where: {
        userId,
        isActive: true,
        verifiedAt: { not: null },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        name: true,
        isPrimary: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get user's primary MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Primary MFA method or null
   */
  static async getPrimaryMfaMethod(prisma: PrismaClient, userId: string) {
    return prisma.mfaMethod.findFirst({
      where: {
        userId,
        isActive: true,
        isPrimary: true,
        verifiedAt: { not: null },
      },
    });
  }

  /**
   * Set primary MFA method
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID to set as primary
   */
  static async setPrimaryMfaMethod(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
  ): Promise<void> {
    // Unset all primary methods for user
    await prisma.mfaMethod.updateMany({
      where: {
        userId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });

    // Set new primary method
    await prisma.mfaMethod.update({
      where: {
        id: methodId,
        userId, // Ensure user owns this method
      },
      data: {
        isPrimary: true,
      },
    });
  }

  /**
   * Clean up expired challenges
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID (optional, if not provided cleans all)
   */
  static async cleanupExpiredChallenges(
    prisma: PrismaClient,
    userId?: string,
  ): Promise<void> {
    await prisma.mfaChallenge.deleteMany({
      where: {
        ...(userId ? { userId } : {}),
        expiresAt: { lt: new Date() },
        verified: false,
      },
    });
  }

  /**
   * Clean up old unused recovery codes
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param keepCount - Number of unused codes to keep (default: 10)
   */
  static async cleanupOldRecoveryCodes(
    prisma: PrismaClient,
    userId: string,
    keepCount: number = 10,
  ): Promise<void> {
    // Get unused codes ordered by creation date
    const unusedCodes = await prisma.mfaRecoveryCode.findMany({
      where: {
        userId,
        used: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Delete codes beyond keepCount
    if (unusedCodes.length > keepCount) {
      const codesToDelete = unusedCodes.slice(keepCount);
      await prisma.mfaRecoveryCode.deleteMany({
        where: {
          id: { in: codesToDelete.map((c) => c.id) },
        },
      });
    }
  }
}
