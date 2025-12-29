/**
 * Profile Switching Service
 *
 * Service for managing profile switching within the same school.
 * Handles role switching and permission updates.
 */

import { Prisma, PrismaClient } from '@workspace/database';
import {
  TenantContext,
  Permission,
  TenantStatus,
  ProfileStatus,
} from '../../types';
import { TenantQueriesService } from '../queries';

/**
 * Available Profile
 *
 * Represents a profile (role) available within the same school.
 */
export interface AvailableProfile {
  /** UserTenant profile ID */
  profileId: string;

  /** Role name */
  roleName: string;

  /** Role description */
  roleDescription?: string;

  /** Is this the primary role? */
  isPrimary: boolean;

  /** Profile status */
  status: ProfileStatus;
}

/**
 * Profile Switching Service
 *
 * Manages profile (role) switching within the same school context.
 */
export class ProfileSwitchingService {
  /**
   * Get available profiles for user in a school
   *
   * Returns all profiles (roles) that a user has in a specific school.
   * A user can have multiple roles in the same school (e.g., Teacher + Parent).
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID (school)
   * @returns Array of available profiles
   */
  static async getAvailableProfiles(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
  ): Promise<AvailableProfile[]> {
    const profiles = await prisma.userTenant.findMany({
      where: {
        userId,
        tenantId,
      },
      include: {
        userTenantRole: {
          include: { role: true },
        },
        tenant: { select: { id: true, slug: true, status: true } },
      },
    });

    return profiles
      .map((ut: Prisma.UserTenantGetPayload<{ include: { userTenantRole: { include: { role: true } }; tenant: { select: { id: true, slug: true, status: true } } } }>) => ({
        profileId: ut.id,
        roleName: ut.userTenantRole?.role.name,
        roleDescription: ut.userTenantRole?.role.description || undefined,
        isPrimary: ut.userTenantRole?.isPrimary ?? false,
        status: ut.status as ProfileStatus,
      }))
      .filter((p) => p.roleName) as AvailableProfile[];
  }

  /**
   * Switch to different profile (role) within same school
   *
   * Switches the active profile/role within the same school context.
   * Updates permissions and role context.
   *
   * @param prisma - Prisma client instance
   * @param context - Current tenant context
   * @param targetProfileId - Target profile ID to switch to
   * @returns Updated tenant context with new role/permissions
   */
  static async switchProfile(
    prisma: PrismaClient,
    context: TenantContext,
    targetProfileId: string,
  ): Promise<TenantContext | null> {
    // 1. Load target profile and validate ownership/tenant
    const userTenant = await prisma.userTenant.findUnique({
      where: { id: targetProfileId },
      include: {
        tenant: { select: { id: true, slug: true, status: true } },
        userTenantRole: {
          where: { role: { isActive: true } },
          include: { role: true },
        },
      },
    });

    if (
      !userTenant ||
      userTenant.userId !== context.userId ||
      userTenant.tenantId !== context.tenantId
    ) {
      return null;
    }

    // Each profile has exactly one role; guard against drift
    const targetRole = userTenant.userTenantRole;
    if (!targetRole) {
      return null;
    }

    // 2. Validate profile status
    if (
      userTenant.status !== ProfileStatus.ACTIVE ||
      userTenant.suspended ||
      userTenant.tenant.status !== TenantStatus.ACTIVE
    ) {
      return null;
    }

    // 3. Get permissions for the target profile
    const permissions = await TenantQueriesService.getUserTenantPermissions(
      prisma,
      userTenant.id,
    );

    // Filter permissions to only granted ones
    const grantedPermissions = permissions
      .filter((p) => p.granted)
      .map((p) => ({
        name: p.name,
        label: p.name, // Will be enriched by permission service
        description: undefined,
        resource: p.name.split('.')[0] || '',
        action: p.name.split('.')[1] || '',
        context: p.name.includes('.')
          ? p.name.split('.').slice(2).join('.')
          : undefined,
        category: 'general', // Will be enriched by permission service
      })) as Permission[];

    // 4. Build updated context
    const updatedContext: TenantContext = {
      tenantId: userTenant.tenantId,
      tenantSlug: userTenant.tenant.slug || undefined,
      userId: context.userId,
      profileId: userTenant.id,
      roles: [targetRole.role.name], // Single role for current context
      permissions: grantedPermissions,
      tenantStatus: userTenant.tenant.status as TenantStatus,
      profileStatus: userTenant.status as ProfileStatus,
    };

    return updatedContext;
  }

  /**
   * Get current active profile
   *
   * Returns the currently active profile/role from context.
   */
  static getCurrentProfile(context: TenantContext | null): {
    profileId: string | null;
    roles: string[];
  } {
    if (!context) {
      return { profileId: null, roles: [] };
    }

    return {
      profileId: context.profileId,
      roles: context.roles,
    };
  }

  /**
   * Check if user has multiple profiles in school
   *
   * Returns true if user has multiple roles in the same school.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns True if user has multiple roles
   */
  static async hasMultipleProfiles(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const profileCount = await prisma.userTenant.count({
      where: {
        userId,
        tenantId,
      },
    });

    return profileCount > 1;
  }
}
