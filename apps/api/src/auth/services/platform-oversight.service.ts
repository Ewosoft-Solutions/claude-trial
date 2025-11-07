/**
 * Platform Oversight Service
 *
 * Implements platform oversight capabilities for emergency access.
 * Implements item 4.9.
 */

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { ClearanceLevel, ClearanceLevelHelpers } from '@workspace/api';
import { PermissionService, UserPermissionContext } from './permission.service';

/**
 * Platform Override Context
 */
export interface PlatformOverrideContext {
  userId: string;
  tenantId: string;
  profileId: string;
  clearanceLevel: number;
  overrideReason: string;
  emergencyAccess: boolean;
}

/**
 * Platform Oversight Service
 *
 * Provides platform-level oversight and emergency access capabilities.
 */
@Injectable()
export class PlatformOversightService {
  constructor(private readonly permissionService: PermissionService) {}

  /**
   * Check platform override access (4.9)
   *
   * Validates that user has platform-level clearance (Architect or SuperAdmin).
   *
   * @param userContext - User permission context
   * @returns Whether user has platform override access
   */
  hasPlatformOverrideAccess(userContext: UserPermissionContext): boolean {
    // Only Architect (10) and SuperAdmin (9) have platform override access
    return ClearanceLevelHelpers.isSuperAdminOrHigher(
      userContext.clearanceLevel,
    );
  }

  /**
   * Check emergency access (4.9)
   *
   * Validates that user has emergency access capabilities.
   *
   * @param userContext - User permission context
   * @returns Whether user has emergency access
   */
  hasEmergencyAccess(userContext: UserPermissionContext): boolean {
    // Only Architect (10) has emergency access without approval
    return ClearanceLevelHelpers.isArchitect(userContext.clearanceLevel);
  }

  /**
   * Create platform override context (4.9)
   *
   * Creates a context for platform-level access to school data.
   *
   * @param prisma - Prisma client instance
   * @param platformUserId - Platform user ID (Architect or SuperAdmin)
   * @param targetTenantId - Target tenant ID to access
   * @param overrideReason - Reason for override
   * @param emergencyAccess - Whether this is emergency access
   * @returns Platform override context
   */
  async createPlatformOverrideContext(
    prisma: PrismaClient,
    platformUserId: string,
    targetTenantId: string,
    overrideReason: string,
    emergencyAccess: boolean = false,
  ): Promise<PlatformOverrideContext> {
    // Get platform user's permission context
    const platformUserContext =
      await this.permissionService.getUserPermissionContext(
        prisma,
        platformUserId,
        targetTenantId, // Platform users can access any tenant
        platformUserId, // Profile ID same as user ID for platform users
      );

    if (!platformUserContext) {
      throw new ForbiddenException('Platform user not found');
    }

    // Verify platform override access
    if (!this.hasPlatformOverrideAccess(platformUserContext)) {
      throw new ForbiddenException(
        'Insufficient clearance for platform override',
      );
    }

    // Verify emergency access if required
    if (emergencyAccess && !this.hasEmergencyAccess(platformUserContext)) {
      throw new ForbiddenException(
        'Insufficient clearance for emergency access',
      );
    }

    // TODO: Log platform override access for audit
    // await this.auditService.logPlatformOverride({ ... });

    return {
      userId: platformUserId,
      tenantId: targetTenantId,
      profileId: platformUserId,
      clearanceLevel: platformUserContext.clearanceLevel,
      overrideReason,
      emergencyAccess,
    };
  }

  /**
   * Check platform audit access (4.9)
   *
   * Validates that user can access platform audit logs.
   *
   * @param userContext - User permission context
   * @returns Whether user has platform audit access
   */
  hasPlatformAuditAccess(userContext: UserPermissionContext): boolean {
    // Architect (10) has full audit access
    // SuperAdmin (9) has limited audit access
    return ClearanceLevelHelpers.isSuperAdminOrHigher(
      userContext.clearanceLevel,
    );
  }

  /**
   * Check platform maintenance access (4.9)
   *
   * Validates that user can perform platform maintenance.
   *
   * @param userContext - User permission context
   * @returns Whether user has platform maintenance access
   */
  hasPlatformMaintenanceAccess(userContext: UserPermissionContext): boolean {
    // Only Architect (10) and SuperAdmin (9) have maintenance access
    return ClearanceLevelHelpers.isSuperAdminOrHigher(
      userContext.clearanceLevel,
    );
  }

  /**
   * Check platform tenant management access (4.9)
   *
   * Validates that user can manage tenant accounts.
   *
   * @param userContext - User permission context
   * @returns Whether user has tenant management access
   */
  hasTenantManagementAccess(userContext: UserPermissionContext): boolean {
    // Only Architect (10) and SuperAdmin (9) have tenant management access
    return ClearanceLevelHelpers.isSuperAdminOrHigher(
      userContext.clearanceLevel,
    );
  }

  /**
   * Validate platform operation (4.9)
   *
   * Validates that user can perform platform-level operations.
   *
   * @param userContext - User permission context
   * @param operation - Operation name
   * @returns Whether user can perform the operation
   */
  canPerformPlatformOperation(
    userContext: UserPermissionContext,
    operation: string,
  ): boolean {
    // Check specific platform permissions
    const platformPermissions = [
      'platform.override',
      'platform.audit',
      'platform.maintenance',
      'platform.tenants',
      'platform.security',
    ];

    for (const perm of platformPermissions) {
      if (userContext.permissions.get(perm)) {
        return true;
      }
    }

    // Fallback to clearance level check
    return userContext.clearanceLevel >= 9;
  }
}
