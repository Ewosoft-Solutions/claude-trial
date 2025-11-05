/**
 * Profile Suspension Service
 *
 * Service for managing profile-level suspension.
 * Handles suspending and unsuspending user profiles within specific schools.
 */

import { PrismaClient } from '@workspace/database';

/**
 * Suspension Options
 */
export interface SuspensionOptions {
  reason?: string;
  suspendedBy: string; // User ID of the admin performing suspension
  notifyUser?: boolean; // Whether to notify the user
}

/**
 * Profile Suspension Service
 *
 * Manages profile-level suspension within schools.
 */
export class ProfileSuspensionService {
  /**
   * Suspend a user profile in a tenant
   *
   * Suspends a user's profile (UserTenant) within a specific school.
   * This does not affect the user's access to other schools.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID (school)
   * @param options - Suspension options
   * @returns True if suspension was successful
   */
  static async suspendProfile(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    options: SuspensionOptions,
  ): Promise<boolean> {
    try {
      const userTenant = await prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!userTenant) {
        throw new Error('User profile not found in this tenant');
      }

      // Update profile status
      await prisma.userTenant.update({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
        data: {
          suspended: true,
          suspendedAt: new Date(),
          suspendedBy: options.suspendedBy,
          suspensionReason: options.reason,
          status: 'suspended', // Update status to suspended
        },
      });

      // TODO: Invalidate all active sessions for this profile
      // TODO: Send notification if options.notifyUser is true

      return true;
    } catch (error) {
      console.error('Failed to suspend profile:', error);
      return false;
    }
  }

  /**
   * Unsuspend a user profile in a tenant
   *
   * Removes suspension from a user's profile within a specific school.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID (school)
   * @param unsuspendedBy - User ID of the admin performing unsuspension
   * @returns True if unsuspension was successful
   */
  static async unsuspendProfile(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    unsuspendedBy: string,
  ): Promise<boolean> {
    try {
      const userTenant = await prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!userTenant) {
        throw new Error('User profile not found in this tenant');
      }

      // Update profile status
      await prisma.userTenant.update({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
        data: {
          suspended: false,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          status: 'active', // Restore to active status
        },
      });

      // TODO: Send notification to user

      return true;
    } catch (error) {
      console.error('Failed to unsuspend profile:', error);
      return false;
    }
  }

  /**
   * Check if profile is suspended
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns True if profile is suspended
   */
  static async isProfileSuspended(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const userTenant = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      select: {
        suspended: true,
        status: true,
      },
    });

    if (!userTenant) {
      return false; // Profile doesn't exist
    }

    return userTenant.suspended || userTenant.status === 'suspended';
  }

  /**
   * Get suspension details for a profile
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Suspension details or null if not suspended
   */
  static async getSuspensionDetails(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
  ): Promise<{
    suspended: boolean;
    suspendedAt: Date | null;
    suspendedBy: string | null;
    suspensionReason: string | null;
  } | null> {
    const userTenant = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      select: {
        suspended: true,
        suspendedAt: true,
        suspendedBy: true,
        suspensionReason: true,
      },
    });

    if (!userTenant) {
      return null;
    }

    return {
      suspended: userTenant.suspended,
      suspendedAt: userTenant.suspendedAt,
      suspendedBy: userTenant.suspendedBy,
      suspensionReason: userTenant.suspensionReason,
    };
  }

  /**
   * Suspend multiple profiles (bulk operation)
   *
   * @param prisma - Prisma client instance
   * @param profiles - Array of {userId, tenantId} pairs
   * @param options - Suspension options
   * @returns Number of profiles suspended
   */
  static async suspendProfiles(
    prisma: PrismaClient,
    profiles: Array<{ userId: string; tenantId: string }>,
    options: SuspensionOptions,
  ): Promise<number> {
    let suspendedCount = 0;

    for (const profile of profiles) {
      const success = await this.suspendProfile(
        prisma,
        profile.userId,
        profile.tenantId,
        options,
      );

      if (success) {
        suspendedCount++;
      }
    }

    return suspendedCount;
  }

  /**
   * Unsuspend multiple profiles (bulk operation)
   *
   * @param prisma - Prisma client instance
   * @param profiles - Array of {userId, tenantId} pairs
   * @param unsuspendedBy - User ID of the admin performing unsuspension
   * @returns Number of profiles unsuspended
   */
  static async unsuspendProfiles(
    prisma: PrismaClient,
    profiles: Array<{ userId: string; tenantId: string }>,
    unsuspendedBy: string,
  ): Promise<number> {
    let unsuspendedCount = 0;

    for (const profile of profiles) {
      const success = await this.unsuspendProfile(
        prisma,
        profile.userId,
        profile.tenantId,
        unsuspendedBy,
      );

      if (success) {
        unsuspendedCount++;
      }
    }

    return unsuspendedCount;
  }
}
