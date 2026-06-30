/**
 * Permission Service
 *
 * Handles permission checking, clearance level validation, and context-aware permissions.
 * Implements items 4.4, 4.5, 4.7, 4.10.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import {
  TenantQueriesService,
  ProfileStatus,
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
  roleId: string;
  clearanceLevel: number;
  permissions: Map<
    string,
    {
      granted: boolean;
      clearanceLevel?: number;
    }
  >; // permission name -> grant + metadata
  permissionIds: string[];
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
    // Get user tenant profile with role and permission data
    const userTenant = await TenantQueriesService.getUserTenantProfile(
      prisma,
      profileId,
    );

    if (userTenant?.userId !== userId || userTenant.tenantId !== tenantId) {
      return null;
    }

    // Verify profile is active and not suspended
    if (userTenant.status !== ProfileStatus.ACTIVE || userTenant.suspended) {
      return null;
    }

    // Get role and its clearance level (one per profile)
    const role = userTenant.userTenantRole?.role;
    if (!role) {
      return null;
    }

    const roleId = role.id;
    const clearanceLevel = role?.clearanceLevel ?? 0;

    // Build permission map keyed by permission name (activity identifier).
    // Permission pools are the single canonical source of a role's
    // permissions — see TenantQueriesService.resolveRolePoolPermissions.
    const rolePoolPermissions = role
      ? TenantQueriesService.resolveRolePoolPermissions(role)
      : [];

    const permissions = new Map<
      string,
      { granted: boolean; clearanceLevel?: number }
    >();
    for (const permission of rolePoolPermissions) {
      const permissionName = permission?.name;
      if (typeof permissionName !== 'string') continue;

      permissions.set(permissionName, {
        granted: true,
        clearanceLevel: permission.requiredClearanceLevel ?? undefined,
      });
    }

    // Apply profile-specific overrides (highest priority)
    for (const utp of userTenant.userTenantPermissions) {
      const permission = utp.permission;
      const permissionName = permission?.name;
      if (typeof permissionName !== 'string') continue;

      // keep permissionIds list aligned with loaded permissions
      permissions.set(permissionName, {
        granted: utp.granted,
        clearanceLevel: permission.requiredClearanceLevel ?? undefined,
      });
    }

    const permissionIds = Array.from(
      new Set([
        ...rolePoolPermissions
          .map((permission) => permission?.id)
          .filter((id): id is string => typeof id === 'string'),
        ...userTenant.userTenantPermissions
          .map((utp) => utp.permission?.id)
          .filter((id): id is string => typeof id === 'string'),
      ]),
    );

    return {
      userId,
      tenantId,
      profileId,
      clearanceLevel,
      roleId,
      permissions,
      permissionIds,
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

    const effectiveRequiredClearance =
      requiredClearanceLevel ?? permissionStatus.clearanceLevel;

    if (effectiveRequiredClearance !== undefined) {
      const clearanceCheck = this.checkClearanceLevel(
        userContext,
        effectiveRequiredClearance,
      );
      if (!clearanceCheck.granted) {
        return clearanceCheck;
      }
    }

    if (!permissionStatus.granted) {
      // Permission explicitly denied (after clearance check)
      return {
        granted: false,
        reason: 'permission_denied',
        clearanceLevel: userContext.clearanceLevel,
        requiredClearanceLevel: effectiveRequiredClearance,
      };
    }

    // Permission granted
    return {
      granted: true,
      clearanceLevel: userContext.clearanceLevel,
      requiredClearanceLevel: effectiveRequiredClearance,
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
      const check = this.checkPermission(userContext, permissionName);
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
      const check = this.checkPermission(userContext, permissionName);
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
    const contextPart = parts.at(-1) ?? undefined;

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
    const classId =
      (typeof context.classId === 'string' && context.classId) ||
      (await this.resolveClassIdFromContext(prisma, context));

    if (!classId) {
      return {
        granted: false,
        reason: 'missing_class_context',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

    const isTeacherForClass = await prisma.classTeacher.findFirst({
      where: {
        classId,
        userTenantId: userContext.profileId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!isTeacherForClass) {
      return {
        granted: false,
        reason: 'not_class_teacher',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

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
    const studentId = context.studentId || context.resourceId;
    if (!studentId) {
      return {
        granted: false,
        reason: 'missing_student_context',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

    const guardianLink = await prisma.studentGuardian.findFirst({
      where: {
        tenantId: userContext.tenantId,
        studentId,
        userTenantId: userContext.profileId,
      },
      select: { id: true },
    });

    if (!guardianLink) {
      return {
        granted: false,
        reason: 'not_guardian_of_student',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

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
    const departmentId =
      typeof context.departmentId === 'string' ? context.departmentId : null;
    const userDepartments: string[] | undefined = Array.isArray(
      context.userDepartmentIds,
    )
      ? context.userDepartmentIds.filter(
          (dept: any): dept is string => typeof dept === 'string',
        )
      : undefined;

    if (!departmentId || !Array.isArray(userDepartments)) {
      return {
        granted: false,
        reason: 'missing_department_context',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

    const deptId = departmentId as string;
    if (!userDepartments.includes(deptId)) {
      return {
        granted: false,
        reason: 'not_in_department',
        clearanceLevel: userContext.clearanceLevel,
      };
    }

    return baseCheck;
  }

  /**
   * Resolve classId from context hints (classId | enrollmentId | assessmentId | gradeId)
   */
  private async resolveClassIdFromContext(
    prisma: PrismaClient,
    context: any,
  ): Promise<string | null> {
    if (typeof context.classId === 'string') return context.classId;

    if (typeof context.enrollmentId === 'string') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { id: context.enrollmentId },
        select: { classId: true },
      });
      if (enrollment?.classId) return enrollment.classId;
    }

    if (typeof context.assessmentId === 'string') {
      const assessment = await prisma.assessment.findFirst({
        where: { id: context.assessmentId },
        select: { classId: true },
      });
      if (assessment?.classId) return assessment.classId;
    }

    if (typeof context.gradeId === 'string') {
      const grade = await prisma.grade.findFirst({
        where: { id: context.gradeId },
        select: { enrollment: { select: { classId: true } } },
      });
      if (grade?.enrollment?.classId) return grade.enrollment.classId;
    }

    return null;
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
    const userTenant = await (TenantQueriesService as any).getUserTenantProfile(
      prisma,
      profileId,
    );

    if (userTenant?.userId !== userId || userTenant?.tenantId !== tenantId) {
      return {
        valid: false,
        error: 'User profile not found',
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
      .filter(([, value]) => value?.granted)
      .map(([name]) => name);

    return {
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      profileId: userContext.profileId,
      clearanceLevel: userContext.clearanceLevel,
      roleId: userContext.roleId,
      roleIds: [userContext.roleId],
      permissions: grantedPermissions,
      permissionIds: userContext.permissionIds,
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
  roleId: string; // Role ID
  permissions: string[]; // Effective permissions (granted only)
  permissionIds: string[]; // Permission IDs
  accessScope: AccessScope; // Derived from clearance level
}
