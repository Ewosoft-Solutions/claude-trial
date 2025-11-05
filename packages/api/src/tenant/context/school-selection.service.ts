/**
 * School Selection Service
 *
 * Service for managing school selection and switching.
 * Handles user's available schools and profile switching between schools.
 */

import { TenantContext } from '../../types/tenant-context.types';

/**
 * User School Profile
 *
 * Represents a school that a user has access to.
 */
export interface UserSchoolProfile {
  /** Tenant ID */
  tenantId: string;

  /** Tenant name */
  tenantName: string;

  /** Tenant slug */
  tenantSlug?: string;

  /** UserTenant profile ID */
  profileId: string;

  /** User's roles in this school */
  roles: string[];

  /** Primary role name */
  primaryRole?: string;

  /** Profile status */
  status: 'active' | 'inactive' | 'pending' | 'suspended';

  /** Tenant status */
  tenantStatus: 'active' | 'pending' | 'suspended';
}

/**
 * School Selection Service
 *
 * Manages school selection and switching functionality.
 */
export class SchoolSelectionService {
  /**
   * Get available schools for user
   *
   * Returns all schools (profiles) that a user has access to.
   * This would typically query the database for UserTenant relationships.
   *
   * @param userId - User ID to get schools for
   * @returns Array of school profiles user can access
   */
  static async getAvailableSchools(
    userId: string,
    // prisma: PrismaClient - would be injected in real implementation
  ): Promise<UserSchoolProfile[]> {
    // TODO: Implement database query
    // This would query:
    // - UserTenant where userId = userId
    // - Join with Tenant to get tenant details
    // - Join with UserTenantRole to get roles
    // - Filter by active status

    // Example query structure:
    // const userTenants = await prisma.userTenant.findMany({
    //   where: { userId },
    //   include: {
    //     tenant: true,
    //     userTenantRoles: {
    //       include: { role: true }
    //     }
    //   }
    // });

    // Transform to UserSchoolProfile format
    return [];
  }

  /**
   * Switch to different school context
   *
   * Validates that user has access to the requested school and returns
   * the new tenant context.
   *
   * @param userId - User ID
   * @param tenantId - Target tenant ID to switch to
   * @returns New tenant context if switch is successful
   */
  static async switchSchool(
    userId: string,
    tenantId: string,
    // prisma: PrismaClient, permissionsService: PermissionsService
  ): Promise<TenantContext | null> {
    // TODO: Implement school switching
    // 1. Validate user has access to tenant
    // 2. Load UserTenant profile
    // 3. Load roles and permissions
    // 4. Build and return new TenantContext

    return null;
  }

  /**
   * Get user's current school context
   *
   * Returns the tenant context for the user's currently selected school.
   * This is typically stored in the session or JWT token.
   */
  static getCurrentSchool(context: TenantContext | null): string | null {
    return context?.tenantId || null;
  }

  /**
   * Validate school access
   *
   * Checks if user has access to a specific school.
   */
  static async validateSchoolAccess(
    userId: string,
    tenantId: string,
    // prisma: PrismaClient
  ): Promise<boolean> {
    // TODO: Implement access validation
    // Check if UserTenant exists and is active

    return false;
  }
}
