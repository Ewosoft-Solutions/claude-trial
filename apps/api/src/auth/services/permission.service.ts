/**
 * Permission Service
 *
 * Handles permission checking, clearance level validation, and context-aware permissions.
 * Implements items 4.4, 4.5, 4.7, 4.10.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient, Role } from '@workspace/database';
import {
  TenantQueriesService,
  ProfileStatus,
  ClearanceLevel,
  ClearanceLevelHelpers,
  AccessScope,
} from '@workspace/api';

/**
 * Permission Check Result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  clearanceLevel?: number;
  requiredClearanceLevel?: number;
}

/**
 * User Permission Context
 */
export interface UserPermissionContext {
  userId: string;
  tenantId: string;
  profileId: string;
  clearanceLevel: number;
  roles: Role[];
  permissions: Map<string, boolean>; // permission name -> granted/denied
  roleIds: string[];
}

/**
 * Permission Service
 *
 * Provides permission checking, clearance level validation, and context-aware permissions.
 */
@Injectable()
export class PermissionService {
  /**
   * Get user's permission context (4.5, 4.10)
   *
   * Loads user's roles, permissions, and clearance level for a profile.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID
   * @returns User permission context
   */
  async getUserPermissionContext(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    profileId: string,
  ): Promise<UserPermissionContext | null> {
    // Get user tenant profile
    const userTenant = await TenantQueriesService.getUserTenantProfile(
      prisma,
      userId,
      tenantId,
    );

    if (!userTenant) {
      return null;
    }

    // Verify profile is active and not suspended
    if (userTenant.status !== ProfileStatus.ACTIVE || userTenant.suspended) {
      return null;
    }

    // Get roles and their clearance levels
    const roles = userTenant.userTenantRoles.map((utr) => utr.role);
    const roleIds = roles.map((r) => r.id);
    const roleNames = roles.map((r) => r.name);

    // Get maximum clearance level from roles
    const clearanceLevel = Math.max(...roles.map((r) => r.clearanceLevel), 0);

    // Get permissions from roles
    const permissions = new Map<string, boolean>();
    for (const role of roles) {
      for (const rp of role.rolePermissions) {
        // Only set if not already set (first role wins)
        if (!permissions.has(rp.permission.name)) {
          permissions.set(rp.permission.name, true);
        }
      }
    }

    // Apply profile-specific overrides (highest priority)
    for (const utp of userTenant.userTenantPermissions) {
      permissions.set(utp.permission.name, utp.granted);
    }

    return {
      userId,
      tenantId,
      profileId,
      clearanceLevel,
      roles,
      permissions,
      roleIds,
    };
  }

  /**
   * Check clearance level (4.4)
   *
   * Validates that user's clearance level meets the required level.
   *
   * @param userContext - User permission context
   * @param requiredClearanceLevel - Required clearance level (0-10)
   * @returns Permission check result
   */
  checkClearanceLevel(
    userContext: UserPermissionContext,
    requiredClearanceLevel: number,
  ): PermissionCheckResult {
    if (userContext.clearanceLevel < requiredClearanceLevel) {
      return {
        granted: false,
        reason: 'insufficient_clearance',
        clearanceLevel: userContext.clearanceLevel,
        requiredClearanceLevel,
      };
    }

    return {
      granted: true,
      clearanceLevel: userContext.clearanceLevel,
      requiredClearanceLevel,
    };
  }

  /**
   * Check permission (4.5)
   *
   * Validates that user has the required permission.
   * Checks both role permissions and profile-specific overrides.
   *
   * @param userContext - User permission context
   * @param permissionName - Permission name (e.g., 'students.view')
   * @param requiredClearanceLevel - Optional required clearance level
   * @returns Permission check result
   */
  checkPermission(
    userContext: UserPermissionContext,
    permissionName: string,
    requiredClearanceLevel?: number,
  ): PermissionCheckResult {
    // Check clearance level if required
    if (requiredClearanceLevel !== undefined) {
      const clearanceCheck = this.checkClearanceLevel(
        userContext,
        requiredClearanceLevel,
      );
      if (!clearanceCheck.granted) {
        return clearanceCheck;
      }
    }

    // Check if permission is explicitly granted or denied
    const permissionStatus = userContext.permissions.get(permissionName);

    if (permissionStatus === undefined) {
      // Permission not found in user's permissions
      return {
        granted: false,
        reason: 'permission_not_found',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

    if (!permissionStatus) {
      // Permission explicitly denied
      return {
        granted: false,
        reason: 'permission_denied',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

    // Permission granted
    return {
      granted: true,
      clearanceLevel: userContext.clearanceLevel,
    };
  }

  /**
   * Check multiple permissions (4.5)
   *
   * Validates that user has all required permissions (AND logic).
   *
   * @param userContext - User permission context
   * @param permissionNames - Array of permission names
   * @param requiredClearanceLevel - Optional required clearance level
   * @returns Permission check result
   */
  checkPermissions(
    userContext: UserPermissionContext,
    permissionNames: string[],
    requiredClearanceLevel?: number,
  ): PermissionCheckResult {
    // Check clearance level if required
    if (requiredClearanceLevel !== undefined) {
      const clearanceCheck = this.checkClearanceLevel(
        userContext,
        requiredClearanceLevel,
      );
      if (!clearanceCheck.granted) {
        return clearanceCheck;
      }
    }

    // Check all permissions
    for (const permissionName of permissionNames) {
      const check = this.checkPermission(
        userContext,
        permissionName,
        undefined, // Don't check clearance again
      );
      if (!check.granted) {
        return {
          ...check,
          reason: `missing_permission: ${permissionName}`,
        };
      }
    }

    return {
      granted: true,
      clearanceLevel: userContext.clearanceLevel,
    };
  }

  /**
   * Check any permission (4.5)
   *
   * Validates that user has at least one of the required permissions (OR logic).
   *
   * @param userContext - User permission context
   * @param permissionNames - Array of permission names
   * @param requiredClearanceLevel - Optional required clearance level
   * @returns Permission check result
   */
  checkAnyPermission(
    userContext: UserPermissionContext,
    permissionNames: string[],
    requiredClearanceLevel?: number,
  ): PermissionCheckResult {
    // Check clearance level if required
    if (requiredClearanceLevel !== undefined) {
      const clearanceCheck = this.checkClearanceLevel(
        userContext,
        requiredClearanceLevel,
      );
      if (!clearanceCheck.granted) {
        return clearanceCheck;
      }
    }

    // Check if any permission is granted
    for (const permissionName of permissionNames) {
      const check = this.checkPermission(
        userContext,
        permissionName,
        undefined, // Don't check clearance again
      );
      if (check.granted) {
        return check;
      }
    }

    return {
      granted: false,
      reason: 'none_of_permissions_granted',
      clearanceLevel: userContext.clearanceLevel,
    };
  }

  /**
   * Check context-aware permission (4.7)
   *
   * Validates permission with context-specific checks (e.g., 'own_classes', 'children').
   *
   * @param userContext - User permission context
   * @param permissionName - Permission name (e.g., 'students.edit.own_classes')
   * @param context - Context data for validation
   * @param requiredClearanceLevel - Optional required clearance level
   * @returns Permission check result
   */
  async checkContextAwarePermission(
    prisma: PrismaClient,
    userContext: UserPermissionContext,
    permissionName: string,
    context: {
      resourceId?: string;
      resourceType?: string;
      ownerId?: string;
      tenantId?: string;
      [key: string]: any;
    },
    requiredClearanceLevel?: number,
  ): Promise<PermissionCheckResult> {
    // First check base permission
    const baseCheck = this.checkPermission(
      userContext,
      permissionName,
      requiredClearanceLevel,
    );
    if (!baseCheck.granted) {
      return baseCheck;
    }

    // Extract context from permission name (e.g., 'students.edit.own_classes')
    const parts = permissionName.split('.');
    const contextPart = parts[parts.length - 1];

    // Handle context-specific checks
    switch (contextPart) {
      case 'own_classes':
        // Check if user owns the class
        return this.checkOwnClassesContext(
          prisma,
          userContext,
          context,
          baseCheck,
        );

      case 'children':
        // Check if resource belongs to user's children
        return this.checkChildrenContext(
          prisma,
          userContext,
          context,
          baseCheck,
        );

      case 'own':
        // Check if resource belongs to user
        return this.checkOwnContext(prisma, userContext, context, baseCheck);

      case 'department':
        // Check if user is in the same department
        return this.checkDepartmentContext(
          prisma,
          userContext,
          context,
          baseCheck,
        );

      default:
        // No context-specific check, base permission is sufficient
        return baseCheck;
    }
  }

  /**
   * Check own classes context
   */
  private async checkOwnClassesContext(
    prisma: PrismaClient,
    userContext: UserPermissionContext,
    context: any,
    baseCheck: PermissionCheckResult,
  ): Promise<PermissionCheckResult> {
    // TODO: Implement class ownership check
    // For now, return base check
    return baseCheck;
  }

  /**
   * Check children context
   */
  private async checkChildrenContext(
    prisma: PrismaClient,
    userContext: UserPermissionContext,
    context: any,
    baseCheck: PermissionCheckResult,
  ): Promise<PermissionCheckResult> {
    // TODO: Implement children relationship check
    // For now, return base check
    return baseCheck;
  }

  /**
   * Check own context
   */
  private async checkOwnContext(
    prisma: PrismaClient,
    userContext: UserPermissionContext,
    context: any,
    baseCheck: PermissionCheckResult,
  ): Promise<PermissionCheckResult> {
    if (context.ownerId && context.ownerId !== userContext.userId) {
      return {
        granted: false,
        reason: 'resource_not_owned',
        clearanceLevel: userContext.clearanceLevel,
      };
    }
    return baseCheck;
  }

  /**
   * Check department context
   */
  private async checkDepartmentContext(
    prisma: PrismaClient,
    userContext: UserPermissionContext,
    context: any,
    baseCheck: PermissionCheckResult,
  ): Promise<PermissionCheckResult> {
    // TODO: Implement department membership check
    // For now, return base check
    return baseCheck;
  }

  /**
   * Validate strict context (4.10)
   *
   * Ensures user belongs to school and profile is active.
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID
   * @returns Validation result
   */
  async validateStrictContext(
    prisma: PrismaClient,
    userId: string,
    tenantId: string,
    profileId: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const userTenant = await TenantQueriesService.getUserTenantProfile(
      prisma,
      userId,
      tenantId,
    );

    if (!userTenant) {
      return {
        valid: false,
        error: 'User profile not found',
      };
    }

    if (userTenant.id !== profileId) {
      return {
        valid: false,
        error: 'Profile ID mismatch',
      };
    }

    if (userTenant.status !== ProfileStatus.ACTIVE) {
      return {
        valid: false,
        error: 'Profile is not active',
      };
    }

    if (userTenant.suspended) {
      return {
        valid: false,
        error: 'Profile is suspended',
      };
    }

    if (userTenant.tenantId !== tenantId) {
      return {
        valid: false,
        error: 'Tenant ID mismatch',
      };
    }

    return { valid: true };
  }

  /**
   * Get AI Mediator Context (4.16 groundwork)
   *
   * Formats user permission context for AI mediator integration.
   * Provides consistent clearance level context for AI queries.
   *
   * @param userContext - User permission context
   * @returns AI mediator context
   */
  getAIMediatorContext(userContext: UserPermissionContext): AIMediatorContext {
    // Determine access scope from clearance level
    let accessScope: AccessScope;
    if (
      ClearanceLevelHelpers.isSuperAdminOrHigher(userContext.clearanceLevel)
    ) {
      accessScope = AccessScope.PLATFORM;
    } else if (
      ClearanceLevelHelpers.isManagementOrHigher(userContext.clearanceLevel)
    ) {
      accessScope = AccessScope.SCHOOL;
    } else if (
      ClearanceLevelHelpers.isTeacherOrHigher(userContext.clearanceLevel)
    ) {
      accessScope = AccessScope.DEPARTMENT;
    } else {
      accessScope = AccessScope.OWN;
    }

    // Get granted permissions only
    const grantedPermissions = Array.from(userContext.permissions.entries())
      .filter(([, granted]) => granted)
      .map(([name]) => name);

    // Get permission pools from roles (would need to be loaded from database)
    // For now, return empty array - will be populated when AI mediator is integrated
    const permissionPools: string[] = [];

    return {
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      profileId: userContext.profileId,
      clearanceLevel: userContext.clearanceLevel,
      roleIds: userContext.roleIds,
      roles: userContext.roles,
      permissions: grantedPermissions,
      permissionPools,
      accessScope,
    };
  }
}

/**
 * AI Mediator Context
 *
 * Context provided to AI mediator for access control and data filtering.
 * Groundwork for item 4.16.
 */
export interface AIMediatorContext {
  userId: string;
  tenantId: string;
  profileId: string;
  clearanceLevel: number; // 0-10
  roleIds: string[]; // All roles for this profile
  // TODO: Role or Role Names, which is better?
  roles: Role[]; // Role names
  permissions: string[]; // Effective permissions (granted only)
  permissionPools: string[]; // Permission pools this user has access to
  accessScope: AccessScope; // Derived from clearance level
}
