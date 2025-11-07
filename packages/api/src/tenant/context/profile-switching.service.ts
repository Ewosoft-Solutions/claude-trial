/**
 * Profile Switching Service
 *
 * Service for managing profile switching within the same school.
 * Handles role switching and permission updates.
 */

import { PrismaClient } from '@workspace/database';
import {
  TenantContext,
  Permission,
  TenantStatus,
  ProfileStatus,
} from '../../types';
import { TenantQueriesService } from '../queries';
import { TenantValidationService } from '../validation';

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
  status: 'active' | 'inactive' | 'pending' | 'suspended';
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
    const userTenant = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      include: {
        userTenantRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!userTenant) {
      return [];
    }

    return userTenant.userTenantRoles.map((utr) => ({
      profileId: userTenant.id,
      roleName: utr.role.name,
      roleDescription: utr.role.description || undefined,
      isPrimary: utr.isPrimary,
      status: userTenant.status as
        | 'active'
        | 'inactive'
        | 'pending'
        | 'suspended',
    }));
  }

  /**
   * Switch to different profile (role) within same school
   *
   * Switches the active profile/role within the same school context.
   * Updates permissions and role context.
   *
   * @param prisma - Prisma client instance
   * @param context - Current tenant context
   * @param targetRoleName - Target role name to switch to
   * @returns Updated tenant context with new role/permissions
   */
  static async switchProfile(
    prisma: PrismaClient,
    context: TenantContext,
    targetRoleName: string,
  ): Promise<TenantContext | null> {
    // 1. Validate user has the target role in this school
    const roleValidation = await TenantValidationService.validateUserRole(
      prisma,
      context.userId,
      context.tenantId,
      targetRoleName,
    );

    if (!roleValidation.valid) {
      return null;
    }

    // 2. Get user tenant profile with roles
    const userTenant = await TenantQueriesService.getUserTenantProfile(
      prisma,
      context.userId,
      context.tenantId,
    );

    if (!userTenant) {
      return null;
    }

    // 3. Find the target role
    const targetRole = userTenant.userTenantRoles.find(
      (utr) => utr.role.name === targetRoleName && utr.role.isActive,
    );

    if (!targetRole) {
      return null;
    }

    // 4. Get permissions for the target role
    const permissions = await TenantQueriesService.getUserTenantPermissions(
      prisma,
      context.userId,
      context.tenantId,
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

    // 5. Build updated context
    const updatedContext: TenantContext = {
      tenantId: context.tenantId,
      tenantSlug: context.tenantSlug,
      userId: context.userId,
      profileId: context.profileId, // Profile ID stays the same
      roles: [targetRoleName], // Single role for current context
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
    const roleCount = await prisma.userTenantRole.count({
      where: {
        userTenant: {
          userId,
          tenantId,
        },
        role: {
          isActive: true,
        },
      },
    });

    return roleCount > 1;
  }
}
