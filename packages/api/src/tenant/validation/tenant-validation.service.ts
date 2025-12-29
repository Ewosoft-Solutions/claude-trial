/**
 * Tenant Validation Service
 *
 * Service for validating tenant context, user access, and profile status.
 * Provides utilities for tenant validation throughout the application.
 */

import { PrismaClient } from '@workspace/database';

/**
 * Tenant Validation Result
 */
export interface TenantValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Tenant Validation Service
 *
 * Provides validation utilities for tenant context, user access, and profile status.
 */
export class TenantValidationService {
  /**
   * Validate tenant exists and is active
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID to validate
   * @returns Validation result
   */
  static async validateTenant(
    prisma: PrismaClient,
    tenantId: string,
  ): Promise<TenantValidationResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, status: true, name: true },
      });

      if (!tenant) {
        return {
          valid: false,
          error: 'Tenant not found',
          errorCode: 'TENANT_NOT_FOUND',
        };
      }

      if (tenant.status !== 'active') {
        return {
          valid: false,
          error: `Tenant is ${tenant.status}`,
          errorCode: `TENANT_${tenant.status.toUpperCase()}`,
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate tenant',
        errorCode: 'TENANT_VALIDATION_ERROR',
      };
    }
  }

  /**
   * Validate user has access to tenant
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Validation result
   */
  static async validateUserAccess(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
  ): Promise<TenantValidationResult> {
    try {
      const userTenant = await prisma.userTenant.findFirst({
        where: {
          userId,
          tenantId,
        },
        select: {
          id: true,
          status: true,
          suspended: true,
          tenant: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!userTenant) {
        return {
          valid: false,
          error: 'User does not have access to this tenant',
          errorCode: 'USER_TENANT_NOT_FOUND',
        };
      }

      // Check tenant status
      if (userTenant.tenant.status !== 'active') {
        return {
          valid: false,
          error: `Tenant is ${userTenant.tenant.status}`,
          errorCode: `TENANT_${userTenant.tenant.status.toUpperCase()}`,
        };
      }

      // Check profile status
      if (userTenant.status !== 'active') {
        return {
          valid: false,
          error: `Profile is ${userTenant.status}`,
          errorCode: `PROFILE_${userTenant.status.toUpperCase()}`,
        };
      }

      // Check suspension
      if (userTenant.suspended) {
        return {
          valid: false,
          error: 'Profile is suspended',
          errorCode: 'PROFILE_SUSPENDED',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate user access',
        errorCode: 'USER_ACCESS_VALIDATION_ERROR',
      };
    }
  }

  /**
   * Validate profile exists and is active
   *
   * @param prisma - Prisma client instance
   * @param profileId - Profile ID (UserTenant ID)
   * @returns Validation result
   */
  static async validateProfile(
    prisma: PrismaClient,
    profileId: string,
  ): Promise<TenantValidationResult> {
    try {
      const profile = await prisma.userTenant.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          status: true,
          suspended: true,
          tenant: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!profile) {
        return {
          valid: false,
          error: 'Profile not found',
          errorCode: 'PROFILE_NOT_FOUND',
        };
      }

      // Check tenant status
      if (profile.tenant.status !== 'active') {
        return {
          valid: false,
          error: `Tenant is ${profile.tenant.status}`,
          errorCode: `TENANT_${profile.tenant.status.toUpperCase()}`,
        };
      }

      // Check profile status
      if (profile.status !== 'active') {
        return {
          valid: false,
          error: `Profile is ${profile.status}`,
          errorCode: `PROFILE_${profile.status.toUpperCase()}`,
        };
      }

      // Check suspension
      if (profile.suspended) {
        return {
          valid: false,
          error: 'Profile is suspended',
          errorCode: 'PROFILE_SUSPENDED',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate profile',
        errorCode: 'PROFILE_VALIDATION_ERROR',
      };
    }
  }

  /**
   * Validate user has specific role in tenant
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param roleName - Role name to check
   * @returns Validation result
   */
  static async validateUserRole(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    roleName: string,
  ): Promise<TenantValidationResult> {
    try {
      const userTenant = await prisma.userTenant.findFirst({
        where: {
          userId,
          tenantId,
        },
        include: {
          userTenantRole: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!userTenant) {
        return {
          valid: false,
          error: 'User does not have access to this tenant',
          errorCode: 'USER_TENANT_NOT_FOUND',
        };
      }

      const role = userTenant.userTenantRole?.role;
      const hasRole = role?.name === roleName && role.isActive === true;

      if (!hasRole) {
        return {
          valid: false,
          error: `User does not have role ${roleName} in this tenant`,
          errorCode: 'ROLE_NOT_FOUND',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate user role',
        errorCode: 'ROLE_VALIDATION_ERROR',
      };
    }
  }

  /**
   * Validate tenant slug exists
   *
   * @param prisma - Prisma client instance
   * @param slug - Tenant slug
   * @returns Validation result with tenant ID if found
   */
  static async validateTenantSlug(
    prisma: PrismaClient,
    slug: string,
  ): Promise<TenantValidationResult & { tenantId?: string }> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });

      if (!tenant) {
        return {
          valid: false,
          error: 'Tenant not found',
          errorCode: 'TENANT_NOT_FOUND',
        };
      }

      if (tenant.status !== 'active') {
        return {
          valid: false,
          error: `Tenant is ${tenant.status}`,
          errorCode: `TENANT_${tenant.status.toUpperCase()}`,
        };
      }

      return {
        valid: true,
        tenantId: tenant.id,
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate tenant slug',
        errorCode: 'TENANT_SLUG_VALIDATION_ERROR',
      };
    }
  }

  /**
   * Validate email domain matches tenant (if configured)
   *
   * @param prisma - Prisma client instance
   * @param tenantId - Tenant ID
   * @param email - Email address to validate
   * @returns Validation result
   */
  static async validateEmailDomain(
    prisma: PrismaClient,
    tenantId: string,
    email: string,
  ): Promise<TenantValidationResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { emailDomain: true },
      });

      if (!tenant) {
        return {
          valid: false,
          error: 'Tenant not found',
          errorCode: 'TENANT_NOT_FOUND',
        };
      }

      // If no email domain is configured, validation passes
      if (!tenant.emailDomain) {
        return { valid: true };
      }

      // Extract domain from email
      const emailDomain = email.split('@')[1]?.toLowerCase();

      if (!emailDomain) {
        return {
          valid: false,
          error: 'Invalid email format',
          errorCode: 'INVALID_EMAIL_FORMAT',
        };
      }

      if (emailDomain !== tenant.emailDomain.toLowerCase()) {
        return {
          valid: false,
          error: `Email domain does not match tenant domain (expected: ${tenant.emailDomain})`,
          errorCode: 'EMAIL_DOMAIN_MISMATCH',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate email domain',
        errorCode: 'EMAIL_DOMAIN_VALIDATION_ERROR',
      };
    }
  }
}
