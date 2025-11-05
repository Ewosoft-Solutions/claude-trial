/**
 * Profile Switching Service
 *
 * Service for managing profile switching within the same school.
 * Handles role switching and permission updates.
 */

import { TenantContext } from '../../types/tenant-context.types';

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
   * @param userId - User ID
   * @param tenantId - Tenant ID (school)
   * @returns Array of available profiles
   */
  static async getAvailableProfiles(
    userId: string,
    tenantId: string,
    // prisma: PrismaClient
  ): Promise<AvailableProfile[]> {
    // TODO: Implement profile retrieval
    // Query UserTenantRoles for the user's profile in this tenant
    // Return all roles user has in this school

    // Example query:
    // const userTenant = await prisma.userTenant.findUnique({
    //   where: { userId_tenantId: { userId, tenantId } },
    //   include: {
    //     userTenantRoles: {
    //       include: { role: true }
    //     }
    //   }
    // });

    return [];
  }

  /**
   * Switch to different profile (role) within same school
   *
   * Switches the active profile/role within the same school context.
   * Updates permissions and role context.
   *
   * @param context - Current tenant context
   * @param targetRoleId - Target role ID to switch to
   * @returns Updated tenant context with new role/permissions
   */
  static async switchProfile(
    context: TenantContext,
    targetRoleId: string,
    // permissionsService: PermissionsService
  ): Promise<TenantContext | null> {
    // TODO: Implement profile switching
    // 1. Validate user has the target role in this school
    // 2. Load permissions for the target role
    // 3. Update context with new role and permissions
    // 4. Return updated context

    // Note: ProfileId stays the same (UserTenant), only role/permissions change

    return null;
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
   */
  static async hasMultipleProfiles(
    userId: string,
    tenantId: string,
    // prisma: PrismaClient
  ): Promise<boolean> {
    // TODO: Check if user has multiple UserTenantRoles in this tenant
    // const roleCount = await prisma.userTenantRole.count({
    //   where: {
    //     userTenant: {
    //       userId,
    //       tenantId
    //     }
    //   }
    // });
    // return roleCount > 1;

    return false;
  }
}
