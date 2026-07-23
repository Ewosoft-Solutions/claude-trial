/**
 * School Selection Service
 *
 * Service for managing school selection and switching.
 * Handles user's available schools and profile switching between schools.
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
  status: ProfileStatus;

  /** Tenant status */
  tenantStatus: TenantStatus;

  /** Institution category (nullable until explicitly set on the tenant) */
  schoolType?: string;
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
   * @param prisma - Prisma client instance
   * @param userId - User ID to get schools for
   * @returns Array of school profiles user can access
   */
  static async getAvailableSchools(
    prisma: PrismaClient,
    userId: string,
  ): Promise<UserSchoolProfile[]> {
    const userTenants = await prisma.userTenant.findMany({
      where: {
        userId,
        status: 'active',
        suspended: false,
      },
      include: {
        tenant: true,
        userTenantRole: {
          where: {
            role: {
              isActive: true,
            },
          },
          include: {
            role: true,
          },
        },
      },
    });

    return userTenants
      .filter((ut) => ut.tenant.status === TenantStatus.ACTIVE)
      .map((ut) => {
        const roles = ut.userTenantRole ? [ut.userTenantRole.role.name] : [];
        const primaryRole = ut.userTenantRole?.role.name;

        return {
          tenantId: ut.tenantId,
          tenantName: ut.tenant.name,
          tenantSlug: ut.tenant.slug || undefined,
          profileId: ut.id,
          roles,
          primaryRole,
          status: ut.status as ProfileStatus,
          tenantStatus: ut.tenant.status as TenantStatus,
          schoolType: (ut.tenant as any).schoolType ?? undefined,
        };
      });
  }

  /**
   * Switch to different school context
   *
   * Validates that user has access to the requested school and returns
   * the new tenant context.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Target tenant ID to switch to
   * @param profileId - Target profile ID within tenant
   * @returns New tenant context if switch is successful
   */
  static async switchSchool(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    profileId: string,
  ): Promise<TenantContext | null> {
    // 1. Validate user has access to tenant
    const accessValidation = await TenantValidationService.validateUserAccess(
      prisma,
      userId,
      tenantId,
    );

    if (!accessValidation.valid) {
      return null;
    }

    // 2. Load UserTenant profile
    const userTenant = await TenantQueriesService.getUserTenantProfile(
      prisma,
      profileId,
      tenantId,
    );

    if (userTenant?.userId !== userId || userTenant.tenantId !== tenantId) {
      return null;
    }

    // 3. Load role and permissions (single role per profile)
    const activeRole = userTenant.userTenantRole?.role;
    const roles = activeRole && activeRole.isActive ? [activeRole.name] : [];

    if (!activeRole || !activeRole.isActive) {
      return null;
    }

    const permissions = await TenantQueriesService.getUserTenantPermissions(
      prisma,
      profileId,
    );

    // Filter permissions to only granted ones and map to Permission format
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

    // 4. Build and return new TenantContext
    const context: TenantContext = {
      tenantId: userTenant.tenantId,
      tenantSlug: userTenant.tenant.slug || undefined,
      userId,
      profileId: userTenant.id,
      roles,
      permissions: grantedPermissions,
      tenantStatus: userTenant.tenant.status as TenantStatus,
      profileStatus: userTenant.status as ProfileStatus,
    };

    return context;
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
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns True if user has access
   */
  static async validateSchoolAccess(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const validation = await TenantValidationService.validateUserAccess(
      prisma,
      userId,
      tenantId,
    );

    return validation.valid;
  }
}
