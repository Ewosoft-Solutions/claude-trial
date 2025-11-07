/**
 * Security Policy Service
 *
 * Manages school security policies (Tier 1: Basic, Tier 2: Enhanced, Tier 3: Maximum)
 * Implements items 4a.1, 4a.2, 4a.3, 4a.4, 4a.8
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import {
  EnforcedBy,
  PolicyTier,
  DeviceManagement,
  AuditLevel,
} from '@workspace/api';

export interface TimeRestrictions {
  allowedHours: Array<{ start: number; end: number }>;
  allowedDays: string[];
}

export interface SecurityPolicy {
  id: string;
  schoolId: string;
  policyTier: PolicyTier;
  requireMFA: boolean;
  requireMFAForSensitiveOperations: boolean;
  sensitiveOperations: string[];
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordMaxAge: number;
  passwordPreventReuse: number;
  sessionTimeout: number;
  requireMFAForSessionExtension: boolean;
  maxConcurrentSessions: number;
  deviceManagement: DeviceManagement;
  loginAttemptLimit: number;
  lockoutDuration: number;
  timeRestrictions: TimeRestrictions | null;
  ipWhitelist: string[] | null;
  requireVPN: boolean;
  auditLevel: AuditLevel;
  auditRetention: number;
  isDefault: boolean;
  isEmergency: boolean;
  enforcedBy: EnforcedBy | null;
  enforcedByUserId: string | null;
  enforcedAt: Date | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default policy configurations for each tier
 */
export const POLICY_TIERS = {
  basic: {
    policyTier: 'basic' as PolicyTier,
    requireMFA: true,
    requireMFAForSensitiveOperations: true,
    sensitiveOperations: [
      'view_student_data',
      'modify_grades',
      'view_medical_records',
      'modify_financial_data',
      'export_data',
      'delete_records',
    ],
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: false,
    passwordMaxAge: 90,
    passwordPreventReuse: 5,
    sessionTimeout: 30,
    requireMFAForSessionExtension: true,
    maxConcurrentSessions: 3,
    deviceManagement: 'basic' as DeviceManagement,
    loginAttemptLimit: 5,
    lockoutDuration: 15,
    timeRestrictions: null,
    ipWhitelist: null,
    requireVPN: false,
    auditLevel: 'standard' as AuditLevel,
    auditRetention: 365,
  },
  enhanced: {
    policyTier: 'enhanced' as PolicyTier,
    requireMFA: true,
    requireMFAForSensitiveOperations: true,
    sensitiveOperations: [
      'view_student_data',
      'modify_grades',
      'view_medical_records',
      'modify_financial_data',
      'export_data',
      'delete_records',
    ],
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordMaxAge: 60,
    passwordPreventReuse: 10,
    sessionTimeout: 15,
    requireMFAForSessionExtension: true,
    maxConcurrentSessions: 1,
    deviceManagement: 'strict' as DeviceManagement,
    loginAttemptLimit: 3,
    lockoutDuration: 30,
    timeRestrictions: {
      allowedHours: [{ start: 6, end: 22 }],
      allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
    ipWhitelist: null,
    requireVPN: false,
    auditLevel: 'comprehensive' as AuditLevel,
    auditRetention: 730,
  },
  maximum: {
    policyTier: 'maximum' as PolicyTier,
    requireMFA: true,
    requireMFAForSensitiveOperations: true,
    sensitiveOperations: [
      'view_student_data',
      'modify_grades',
      'view_medical_records',
      'modify_financial_data',
      'export_data',
      'delete_records',
    ],
    passwordMinLength: 16,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordMaxAge: 30,
    passwordPreventReuse: 20,
    sessionTimeout: 5,
    requireMFAForSessionExtension: true,
    maxConcurrentSessions: 1,
    deviceManagement: 'strict' as DeviceManagement,
    loginAttemptLimit: 2,
    lockoutDuration: 60,
    timeRestrictions: {
      allowedHours: [{ start: 8, end: 18 }],
      allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
    ipWhitelist: null,
    requireVPN: true,
    auditLevel: 'comprehensive' as AuditLevel,
    auditRetention: 1095,
  },
};

@Injectable()
export class SecurityPolicyService {
  /**
   * Get security policy for a school (4a.4)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @returns Security policy or null if not found
   */
  async getSchoolPolicy(
    prisma: PrismaClient,
    schoolId: string,
  ): Promise<SecurityPolicy | null> {
    const policy = await prisma.schoolSecurityPolicy.findUnique({
      where: { schoolId },
    });

    if (!policy) {
      return null;
    }

    return this.mapToSecurityPolicy(policy);
  }

  /**
   * Get or create default policy for a school (4a.4)
   *
   * If no policy exists, creates a default Basic tier policy.
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @returns Security policy
   */
  async getOrCreateDefaultPolicy(
    prisma: PrismaClient,
    schoolId: string,
  ): Promise<SecurityPolicy> {
    let policy = await this.getSchoolPolicy(prisma, schoolId);

    if (!policy) {
      // Create default Basic tier policy
      policy = await this.assignPolicy(
        prisma,
        schoolId,
        'basic',
        EnforcedBy.SCHOOL_ADMIN,
        null,
        'Default policy assigned on school creation',
      );
    }

    return policy;
  }

  /**
   * Assign security policy to a school (4a.4, 4a.8)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param tier - Policy tier
   * @param enforcedBy - Who is enforcing this policy
   * @param enforcedByUserId - User ID of the enforcer
   * @param reason - Reason for policy assignment/change
   * @returns Created or updated security policy
   */
  async assignPolicy(
    prisma: PrismaClient,
    schoolId: string,
    tier: PolicyTier,
    enforcedBy: EnforcedBy,
    enforcedByUserId: string | null,
    reason?: string,
  ): Promise<SecurityPolicy> {
    // Verify school exists
    const school = await prisma.tenant.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }

    // Get tier configuration
    const tierConfig = POLICY_TIERS[tier];
    if (!tierConfig) {
      throw new BadRequestException(`Invalid policy tier: ${tier}`);
    }

    // Check if policy already exists
    const existingPolicy = await prisma.schoolSecurityPolicy.findUnique({
      where: { schoolId },
    });

    if (existingPolicy) {
      // Update existing policy
      const updated = await prisma.schoolSecurityPolicy.update({
        where: { schoolId },
        data: {
          policyTier: tier,
          ...tierConfig,
          isDefault: tier === 'basic',
          isEmergency: false,
          enforcedBy,
          enforcedByUserId,
          enforcedAt: new Date(),
          reason: reason || null,
          updatedAt: new Date(),
          updatedBy: enforcedByUserId,
        },
      });

      return this.mapToSecurityPolicy(updated);
    } else {
      // Create new policy
      const created = await prisma.schoolSecurityPolicy.create({
        data: {
          schoolId,
          ...tierConfig,
          isDefault: tier === 'basic',
          isEmergency: false,
          enforcedBy,
          enforcedByUserId,
          enforcedAt: new Date(),
          reason: reason || null,
        },
      });

      return this.mapToSecurityPolicy(created);
    }
  }

  /**
   * Upgrade or downgrade policy tier (4a.8)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param newTier - New policy tier
   * @param enforcedBy - Who is making the change
   * @param enforcedByUserId - User ID of the changer
   * @param reason - Reason for upgrade/downgrade
   * @returns Updated security policy
   */
  async changePolicyTier(
    prisma: PrismaClient,
    schoolId: string,
    newTier: PolicyTier,
    enforcedBy: EnforcedBy,
    enforcedByUserId: string | null,
    reason?: string,
  ): Promise<SecurityPolicy> {
    const currentPolicy = await this.getSchoolPolicy(prisma, schoolId);

    if (!currentPolicy) {
      throw new NotFoundException(
        `No security policy found for school ${schoolId}`,
      );
    }

    // Validate tier change
    const tierOrder: PolicyTier[] = ['basic', 'enhanced', 'maximum'];
    const newIndex = tierOrder.indexOf(newTier);

    if (newIndex === -1) {
      throw new BadRequestException(`Invalid policy tier: ${newTier}`);
    }

    // Assign new tier (will update existing policy)
    return this.assignPolicy(
      prisma,
      schoolId,
      newTier,
      enforcedBy,
      enforcedByUserId,
      reason ||
        `Policy tier changed from ${currentPolicy.policyTier} to ${newTier}`,
    );
  }

  /**
   * Set emergency policy (platform admin only) (4a.7)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param tier - Emergency policy tier
   * @param enforcedByUserId - Platform admin user ID
   * @param reason - Reason for emergency policy
   * @returns Updated security policy
   */
  async setEmergencyPolicy(
    prisma: PrismaClient,
    schoolId: string,
    tier: PolicyTier,
    enforcedByUserId: string,
    reason: string,
  ): Promise<SecurityPolicy> {
    const tierConfig = POLICY_TIERS[tier];

    const existingPolicy = await prisma.schoolSecurityPolicy.findUnique({
      where: { schoolId },
    });

    if (existingPolicy) {
      const updated = await prisma.schoolSecurityPolicy.update({
        where: { schoolId },
        data: {
          policyTier: tier,
          ...tierConfig,
          isEmergency: true,
          enforcedBy: EnforcedBy.PLATFORM_ADMIN,
          enforcedByUserId,
          enforcedAt: new Date(),
          reason,
          updatedAt: new Date(),
          updatedBy: enforcedByUserId,
        },
      });

      return this.mapToSecurityPolicy(updated);
    } else {
      const created = await prisma.schoolSecurityPolicy.create({
        data: {
          schoolId,
          ...tierConfig,
          isEmergency: true,
          enforcedBy: EnforcedBy.PLATFORM_ADMIN,
          enforcedByUserId,
          enforcedAt: new Date(),
          reason,
        },
      });

      return this.mapToSecurityPolicy(created);
    }
  }

  /**
   * Remove emergency policy (platform admin only) (4a.7)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param enforcedByUserId - Platform admin user ID
   * @returns Updated security policy (reverts to previous tier or Basic)
   */
  async removeEmergencyPolicy(
    prisma: PrismaClient,
    schoolId: string,
    enforcedByUserId: string,
  ): Promise<SecurityPolicy> {
    const policy = await prisma.schoolSecurityPolicy.findUnique({
      where: { schoolId },
    });

    if (!policy) {
      throw new NotFoundException(
        `No security policy found for school ${schoolId}`,
      );
    }

    if (!policy.isEmergency) {
      throw new BadRequestException('Policy is not an emergency policy');
    }

    // Revert to Basic tier (default)
    return this.assignPolicy(
      prisma,
      schoolId,
      'basic',
      EnforcedBy.PLATFORM_ADMIN,
      enforcedByUserId,
      'Emergency policy removed, reverted to Basic tier',
    );
  }

  /**
   * Validate policy compliance for an operation (4a.5)
   *
   * @param policy - Security policy
   * @param operation - Operation name
   * @param ipAddress - Client IP address
   * @param currentTime - Current time
   * @returns Validation result
   */
  validatePolicyCompliance(
    policy: SecurityPolicy,
    operation: string,
    ipAddress?: string,
    currentTime?: Date,
  ): {
    compliant: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if operation requires MFA
    if (
      policy.requireMFAForSensitiveOperations &&
      policy.sensitiveOperations.includes(operation)
    ) {
      // MFA check is done separately in MFA guard
      // This just validates that MFA is required
    }

    // Check IP whitelist
    if (policy.ipWhitelist && policy.ipWhitelist.length > 0 && ipAddress) {
      if (!policy.ipWhitelist.includes(ipAddress)) {
        errors.push(`IP address ${ipAddress} is not in the allowed whitelist`);
      }
    }

    // Check time restrictions
    if (policy.timeRestrictions && currentTime) {
      const hour = currentTime.getHours();
      const dayName = currentTime
        .toLocaleDateString('en-US', { weekday: 'short' })
        .toLowerCase(); // 'mon', 'tue', etc.

      const allowedDay = policy.timeRestrictions.allowedDays.some(
        (d) => d.toLowerCase().substring(0, 3) === dayName,
      );

      if (!allowedDay) {
        errors.push(
          `Access not allowed on ${currentTime.toLocaleDateString()}`,
        );
      }

      const allowedHour = policy.timeRestrictions.allowedHours.some(
        (range) => hour >= range.start && hour < range.end,
      );

      if (!allowedHour) {
        errors.push(
          `Access not allowed at ${hour}:00 (allowed hours: ${policy.timeRestrictions.allowedHours.map((r) => `${r.start}-${r.end}`).join(', ')})`,
        );
      }
    }

    // Check VPN requirement
    if (policy.requireVPN) {
      // VPN check would be done at network level or via header
      // This is a placeholder for VPN validation
    }

    return {
      compliant: errors.length === 0,
      errors,
    };
  }

  /**
   * Log policy change to audit log (4a.9)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param action - Action type (e.g., 'assign_policy', 'change_tier', 'set_emergency')
   * @param actorId - User ID of the actor
   * @param actorProfileId - Profile ID of the actor
   * @param actorRole - Role of the actor
   * @param actorEmail - Email of the actor
   * @param changes - Before/after changes
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   * @param reason - Reason for change
   */
  async logPolicyChange(
    prisma: PrismaClient,
    schoolId: string,
    action: string,
    actorId: string | null,
    actorProfileId: string | null,
    actorRole: string | null,
    actorEmail: string | null,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
    reason?: string,
  ): Promise<void> {
    // TODO: Implement audit logging when audit log system is fully implemented
    // For now, this is a placeholder similar to MfaAuditService
    // When audit logging is implemented, uncomment and use:
    //
    // await prisma.auditLog.create({
    //   data: {
    //     tenantId: schoolId,
    //     eventType: 'security_event',
    //     action,
    //     resource: 'security_policy',
    //     resourceId: schoolId,
    //     actorId,
    //     actorProfileId,
    //     actorRole,
    //     actorEmail,
    //     ipAddress,
    //     userAgent,
    //     description: `Security policy ${action} for school ${schoolId}${reason ? `: ${reason}` : ''}`,
    //     changes,
    //     metadata: { reason },
    //     status: 'success',
    //   },
    // });

    // Log to console for now (remove in production)
    console.log('[Security Policy Audit]', {
      schoolId,
      action,
      actorId,
      actorProfileId,
      actorRole,
      actorEmail,
      changes,
      ipAddress,
      userAgent,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Map Prisma model to SecurityPolicy interface
   */
  private mapToSecurityPolicy(policy: any): SecurityPolicy {
    return {
      id: policy.id,
      schoolId: policy.schoolId,
      policyTier: policy.policyTier,
      requireMFA: policy.requireMFA,
      requireMFAForSensitiveOperations: policy.requireMFAForSensitiveOperations,
      sensitiveOperations: Array.isArray(policy.sensitiveOperations)
        ? policy.sensitiveOperations
        : [],
      passwordMinLength: policy.passwordMinLength,
      passwordRequireUppercase: policy.passwordRequireUppercase,
      passwordRequireLowercase: policy.passwordRequireLowercase,
      passwordRequireNumbers: policy.passwordRequireNumbers,
      passwordRequireSpecialChars: policy.passwordRequireSpecialChars,
      passwordMaxAge: policy.passwordMaxAge,
      passwordPreventReuse: policy.passwordPreventReuse,
      sessionTimeout: policy.sessionTimeout,
      requireMFAForSessionExtension: policy.requireMFAForSessionExtension,
      maxConcurrentSessions: policy.maxConcurrentSessions,
      deviceManagement: policy.deviceManagement,
      loginAttemptLimit: policy.loginAttemptLimit,
      lockoutDuration: policy.lockoutDuration,
      timeRestrictions: policy.timeRestrictions
        ? (policy.timeRestrictions as TimeRestrictions)
        : null,
      ipWhitelist: Array.isArray(policy.ipWhitelist)
        ? policy.ipWhitelist
        : null,
      requireVPN: policy.requireVPN,
      auditLevel: policy.auditLevel,
      auditRetention: policy.auditRetention,
      isDefault: policy.isDefault,
      isEmergency: policy.isEmergency,
      enforcedBy: policy.enforcedBy as EnforcedBy | null,
      enforcedByUserId: policy.enforcedByUserId,
      enforcedAt: policy.enforcedAt,
      reason: policy.reason,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }
}
