/**
 * Login Attempt Service
 *
 * Handles login attempt tracking, rate limiting, and account lockout.
 * Implements item 3.11.
 */

import { PrismaClient } from '@workspace/database';

/**
 * Login Attempt Options
 */
export interface LoginAttemptOptions {
  userId?: string;
  email: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}

/**
 * Account Lockout Status
 */
export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil?: Date;
  remainingAttempts?: number;
}

/**
 * Default lockout configuration (Tier 1: Basic)
 */
const DEFAULT_LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMinutes: 15,
};

/**
 * Login Attempt Service
 *
 * Tracks login attempts and implements account lockout.
 */
export class LoginAttemptService {
  /**
   * Record login attempt
   *
   * @param prisma - Prisma client instance
   * @param options - Login attempt options
   */
  static async recordAttempt(
    prisma: PrismaClient,
    options: LoginAttemptOptions,
  ): Promise<void> {
    await prisma.loginAttempt.create({
      data: {
        userId: options.userId || null,
        email: options.email,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent || null,
        success: options.success,
        failureReason: options.success ? null : options.failureReason || null,
      },
    });

    // Update user's login attempts count if failed
    if (!options.success && options.userId) {
      await this.incrementLoginAttempts(prisma, options.userId);
    } else if (options.success && options.userId) {
      // Reset login attempts on successful login
      await this.resetLoginAttempts(prisma, options.userId);
    }
  }

  /**
   * Increment login attempts count
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   */
  static async incrementLoginAttempts(
    prisma: PrismaClient,
    userId: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { loginAttempts: true },
    });

    if (!user) {
      return;
    }

    const newAttempts = user.loginAttempts + 1;
    const maxAttempts = DEFAULT_LOCKOUT_CONFIG.maxAttempts;

    // Lock account if max attempts reached
    if (newAttempts >= maxAttempts) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(
        lockedUntil.getMinutes() +
          DEFAULT_LOCKOUT_CONFIG.lockoutDurationMinutes,
      );

      await prisma.user.update({
        where: { id: userId },
        data: {
          loginAttempts: newAttempts,
          lockedUntil,
        },
      });
    } else {
      // Just increment attempts
      await prisma.user.update({
        where: { id: userId },
        data: {
          loginAttempts: newAttempts,
        },
      });
    }
  }

  /**
   * Reset login attempts (on successful login)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   */
  static async resetLoginAttempts(
    prisma: PrismaClient,
    userId: string,
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Check if account is locked (3.11)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Lockout status
   */
  static async checkLockoutStatus(
    prisma: PrismaClient,
    userId: string,
  ): Promise<LockoutStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      return { isLocked: false };
    }

    // Check if still locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        isLocked: true,
        lockedUntil: user.lockedUntil,
        remainingAttempts: 0,
      };
    }

    // Check if lockout expired
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      // Unlock account
      await prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: null,
          loginAttempts: 0,
        },
      });

      return { isLocked: false };
    }

    // Check if approaching lockout threshold
    const maxAttempts = DEFAULT_LOCKOUT_CONFIG.maxAttempts;
    const remainingAttempts = Math.max(0, maxAttempts - user.loginAttempts);

    return {
      isLocked: false,
      remainingAttempts,
    };
  }

  /**
   * Check if account is locked by email
   *
   * @param prisma - Prisma client instance
   * @param email - User email
   * @returns Lockout status
   */
  static async checkLockoutStatusByEmail(
    prisma: PrismaClient,
    email: string,
  ): Promise<LockoutStatus | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      return null;
    }

    return LoginAttemptService.checkLockoutStatus(prisma, user.id);
  }

  /**
   * Get recent failed login attempts for rate limiting
   *
   * @param prisma - Prisma client instance
   * @param email - User email
   * @param ipAddress - IP address
   * @param windowMinutes - Time window in minutes (default: 15)
   * @returns Number of failed attempts in window
   */
  static async getRecentFailedAttempts(
    prisma: PrismaClient,
    email: string,
    ipAddress: string,
    windowMinutes: number = 15,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - windowMinutes);

    const attempts = await prisma.loginAttempt.findMany({
      where: {
        OR: [{ email }, { ipAddress }],
        success: false,
        createdAt: {
          gte: cutoffDate,
        },
      },
    });

    return attempts.length;
  }

  /**
   * Check if should throttle login attempts (rate limiting)
   *
   * @param prisma - Prisma client instance
   * @param email - User email
   * @param ipAddress - IP address
   * @param maxAttempts - Maximum attempts in window (default: 5)
   * @param windowMinutes - Time window in minutes (default: 15)
   * @returns True if should throttle
   */
  static async shouldThrottle(
    prisma: PrismaClient,
    email: string,
    ipAddress: string,
    maxAttempts: number = 5,
    windowMinutes: number = 15,
  ): Promise<boolean> {
    const recentAttempts = await this.getRecentFailedAttempts(
      prisma,
      email,
      ipAddress,
      windowMinutes,
    );

    return recentAttempts >= maxAttempts;
  }
}
