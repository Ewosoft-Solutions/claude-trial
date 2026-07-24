/**
 * Breach Response Service
 *
 * Handles security breach response with graduated response system.
 * Implements items 8.1-8.10.
 *
 * Strategy: MFA re-authentication as primary response, password reset for severe breaches.
 * Aligns with industry practices (GitHub, Microsoft, Google, AWS).
 */

import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@workspace/database';
import { withTenantScope } from '@workspace/database/rls';
import {
  AUDIT_ACTION,
  AUDIT_EVENT,
  AuditAction,
} from '../../common/audit/audit.constants';
import { JWTSecretService, BreachSeverity } from '@workspace/api';
import { DatabaseService } from '../../common';
import { SessionService } from './session.service';
import { writeAuditLog } from '../../common/audit/audit-writer';
// import { PasswordResetService } from './password-reset.service';

/**
 * Breach Response Options
 */
export interface BreachResponseOptions {
  reason: string;
  severity?: BreachSeverity;
  escalateToPasswordReset?: boolean;
  enableEnhancedMonitoring?: boolean;
  enableInvestigationMode?: boolean;
  actorId?: string;
  actorProfileId?: string;
  actorRole?: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Breach Response Service
 *
 * Provides graduated breach response functionality.
 */
@Injectable()
export class BreachResponseService {
  // The privileged owner client, used ONLY to write audit rows. `writeAuditLog`
  // opens its own transaction and self-sets the tenant GUC, so the audit row
  // lands outside any caller-supplied scope — including the @PlatformScoped
  // transaction the profile-breach path runs in — and survives its rollback,
  // exactly as PlatformAuditService does. Never use it to read/write tenant data.
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Respond to breach (8.1, 8.7)
   *
   * Graduated breach response based on severity.
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  async respondToBreach(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    const severity = options.severity || this.classifySeverity(options);

    switch (severity) {
      case BreachSeverity.LOW:
        // Force MFA re-authentication only
        await this.forceMFAReauthentication(prisma, schoolId, {
          ...options,
          escalateToPasswordReset: false,
        });
        break;

      case BreachSeverity.MEDIUM:
        // Force MFA re-auth + enhanced monitoring
        await this.forceMFAReauthentication(prisma, schoolId, {
          ...options,
          escalateToPasswordReset: false,
        });
        await this.enableEnhancedMonitoring(prisma, schoolId, options);
        break;

      case BreachSeverity.HIGH:
        // Force MFA re-auth + password reset
        await this.forceMFAReauthentication(prisma, schoolId, {
          ...options,
          escalateToPasswordReset: true,
        });
        break;

      case BreachSeverity.CRITICAL:
        // Full security response
        await this.forceMFAReauthentication(prisma, schoolId, {
          ...options,
          escalateToPasswordReset: true,
        });
        await this.forceAccountReview(prisma, schoolId, options);
        await this.enhanceMFARequirements(prisma, schoolId, options);
        await this.enableSecurityInvestigationMode(prisma, schoolId, options);
        break;
    }
  }

  /**
   * Force MFA re-authentication (8.2)
   *
   * Primary breach response: Force MFA re-authentication for all users in school.
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  async forceMFAReauthentication(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    const escalateToPasswordReset = options.escalateToPasswordReset || false;

    // 1. Rotate secret (if needed for breach)
    await this.emergencySecretRotation(prisma, schoolId, options);

    // 2. Revoke all sessions for school
    await this.revokeAllSchoolSessions(prisma, schoolId);

    // 3. Force MFA re-authentication for all users
    await this.markAllUsersForMFAReauth(prisma, schoolId, options);

    // 4. Optionally force password reset (for severe breaches)
    if (escalateToPasswordReset) {
      await this.forcePasswordReset(prisma, schoolId, options);
    }

    // 5. Notify users
    await this.notifySchoolUsers(prisma, schoolId, {
      message: escalateToPasswordReset
        ? 'Security incident detected. Please log in and reset your password.'
        : 'Security verification required. Please log in with MFA.',
      requiresReauth: true,
      requiresPasswordReset: escalateToPasswordReset,
    });

    // 6. Log breach response
    await this.logBreachResponse(schoolId, {
      ...options,
      action: AUDIT_ACTION.SECURITY.BREACH.FORCE_REAUTH,
      escalatedToPasswordReset: escalateToPasswordReset,
      severity: escalateToPasswordReset ? 'critical' : 'high',
    });
  }

  /**
   * Force password reset (8.3)
   *
   * Force password reset for all users in school (for severe breaches).
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  async forcePasswordReset(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Get all active users in school. Scoped — an unscoped read returns no
    // one, and this is incident response: silently resetting zero passwords
    // during a breach is the worst possible failure mode.
    const userTenants = await withTenantScope(
      prisma,
      schoolId,
      undefined,
      (tx) =>
        tx.userTenant.findMany({
          where: {
            tenantId: schoolId,
            status: 'active',
            suspended: false,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isActive: true,
              },
            },
          },
        }),
    );

    // Force password reset for each user
    for (const userTenant of userTenants) {
      if (!userTenant.user.isActive) {
        continue;
      }

      // Generate password reset token
      const resetToken = await this.generatePasswordResetToken(
        prisma,
        userTenant.user.id,
      );

      // Mark user as requiring password reset
      await prisma.user.update({
        where: { id: userTenant.user.id },
        data: {
          passwordResetToken: resetToken.token,
          passwordResetExpiresAt: resetToken.expiresAt,
        },
      });

      // TODO: Send password reset email
      // await this.emailService.sendPasswordResetEmail(
      //   userTenant.user.email,
      //   resetToken.token,
      // );
    }

    // Log action
    await this.logBreachResponse(schoolId, {
      ...options,
      action: AUDIT_ACTION.SECURITY.BREACH.FORCE_PASSWORD_RESET,
      severity: 'high',
    });
  }

  /**
   * Platform-wide breach response (8.4)
   *
   * Respond to platform-wide security breach.
   *
   * @param prisma - Prisma client instance
   * @param options - Breach response options
   */
  async respondToPlatformBreach(
    prisma: PrismaClient,
    options: BreachResponseOptions,
  ): Promise<void> {
    // 1. Rotate secrets for ALL schools
    await this.rotateAllSchoolSecrets(prisma, options);

    // 2. Force all users to re-authenticate with MFA
    await this.forcePlatformWideMFAReauthentication(prisma, options);

    // 3. Force password reset for all users
    await this.forceGlobalPasswordReset(prisma, options);

    // 4. Enhance MFA requirements
    await this.enforceStricterMFA(prisma, options);

    // 5. Notify all users
    await this.notifyAllUsers(prisma, {
      message:
        'Platform-wide security incident detected. Please log in and reset your password.',
      requiresReauth: true,
      requiresPasswordReset: true,
    });

    // 6. Enable security investigation mode
    await this.enableSecurityInvestigationMode(prisma, null, options);

    // 7. Log platform-wide action
    await this.logBreachResponse(null, {
      ...options,
      action: AUDIT_ACTION.SECURITY.BREACH.PLATFORM_WIDE_RESPONSE,
      severity: 'critical',
    });
  }

  /**
   * School-specific breach response (8.5)
   *
   * Respond to security breach for a specific school.
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  async respondToSchoolBreach(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    await this.respondToBreach(prisma, schoolId, options);
  }

  /**
   * Profile-level breach response (8.6)
   *
   * Respond to security breach for a specific profile. Genuinely cross-tenant:
   * the profile may belong to ANY tenant, so this runs under the audited
   * platform bypass (@PlatformScoped in the controller). `prisma` is the scoped
   * `TenantDbService.client` — a transaction with `app.is_platform='on'` — so
   * the `user_tenants` read/update sees every tenant under FORCE RLS. All
   * tenant work here shares that one transaction and is therefore atomic; the
   * audit row alone is written outside it (see logBreachResponse).
   *
   * @param prisma - Scoped platform-bypass transaction client
   * @param profileId - UserTenant profile ID
   * @param options - Breach response options
   */
  async respondToProfileBreach(
    prisma: Prisma.TransactionClient,
    profileId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Get profile
    const profile = await prisma.userTenant.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // 1. Suspend profile immediately
    await prisma.userTenant.update({
      where: { id: profileId },
      data: {
        suspended: true,
        suspendedAt: new Date(),
        suspendedBy: options.actorId || null,
        suspensionReason: options.reason || 'Security breach',
      },
    });

    // 2. Revoke all sessions for this profile
    await SessionService.revokeAllProfileSessions(prisma, profileId);

    // 3. Force password reset for user account
    const resetToken = await this.generatePasswordResetToken(
      prisma,
      profile.user.id,
    );

    await prisma.user.update({
      where: { id: profile.user.id },
      data: {
        passwordResetToken: resetToken.token,
        passwordResetExpiresAt: resetToken.expiresAt,
      },
    });

    // 4. Enhance MFA requirements
    await this.requireStricterMFA(prisma, profileId, options);

    // 5. Notify user
    await this.notifyUser(prisma, profile.user.id, {
      message:
        'Your account security has been compromised. Please reset your password.',
      requiresReauth: true,
      requiresPasswordReset: true,
    });

    // 6. Log breach response
    await this.logBreachResponse(profile.tenant.id, {
      ...options,
      action: AUDIT_ACTION.SECURITY.BREACH.PROFILE_REVIEW,
      resource: 'user_tenant',
      resourceId: profileId,
      severity: 'high',
    });
  }

  /**
   * Classify breach severity (8.7)
   *
   * Automatically classify breach severity based on context.
   *
   * @param options - Breach response options
   * @returns Breach severity
   */
  private classifySeverity(options: BreachResponseOptions): BreachSeverity {
    // Default to medium if not specified
    if (options.severity) {
      return options.severity;
    }

    // Auto-classify based on escalateToPasswordReset flag
    if (options.escalateToPasswordReset) {
      return BreachSeverity.HIGH;
    }

    return BreachSeverity.MEDIUM;
  }

  /**
   * Emergency secret rotation
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  private async emergencySecretRotation(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    await JWTSecretService.emergencyRotateSecret(
      prisma,
      schoolId,
      options.actorRole || 'platform_admin',
    );
  }

  /**
   * Revoke all school sessions
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   */
  private async revokeAllSchoolSessions(
    prisma: PrismaClient,
    schoolId: string,
  ): Promise<void> {
    // Get all active profiles for school. Scoped for the same reason as
    // forcePasswordReset: revoking zero sessions during a breach is silent.
    const profiles = await withTenantScope(prisma, schoolId, undefined, (tx) =>
      tx.userTenant.findMany({
        where: {
          tenantId: schoolId,
          status: 'active',
        },
        select: {
          id: true,
        },
      }),
    );

    // Revoke sessions for each profile
    for (const profile of profiles) {
      await SessionService.revokeAllProfileSessions(prisma, profile.id);
    }
  }

  /**
   * Mark all users for MFA re-authentication
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  private async markAllUsersForMFAReauth(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Mark all profiles as requiring MFA re-authentication
    // We'll track this in the UserTenant model or use a separate tracking mechanism
    // For now, we'll use a metadata field in the tenant settings
    await prisma.tenant.update({
      where: { id: schoolId },
      data: {
        settings: {
          ...((
            await prisma.tenant.findUnique({
              where: { id: schoolId },
              select: { settings: true },
            })
          )?.settings as any),
          breachResponse: {
            requiresMfaReauth: true,
            requiresMfaReauthAt: new Date().toISOString(),
            reason: options.reason,
          },
        },
      },
    });
  }

  /**
   * Enable enhanced monitoring (8.10)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  private async enableEnhancedMonitoring(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    await prisma.tenant.update({
      where: { id: schoolId },
      data: {
        settings: {
          ...((
            await prisma.tenant.findUnique({
              where: { id: schoolId },
              select: { settings: true },
            })
          )?.settings as any),
          enhancedMonitoring: {
            enabled: true,
            enabledAt: new Date().toISOString(),
            reason: options.reason,
          },
        },
      },
    });
  }

  /**
   * Enable security investigation mode (8.9)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID (null for platform-wide)
   * @param options - Breach response options
   */
  private async enableSecurityInvestigationMode(
    prisma: PrismaClient,
    schoolId: string | null,
    options: BreachResponseOptions,
  ): Promise<void> {
    if (schoolId) {
      await prisma.tenant.update({
        where: { id: schoolId },
        data: {
          settings: {
            ...((
              await prisma.tenant.findUnique({
                where: { id: schoolId },
                select: { settings: true },
              })
            )?.settings as any),
            investigationMode: {
              enabled: true,
              enabledAt: new Date().toISOString(),
              reason: options.reason,
            },
          },
        },
      });
    } else {
      // Platform-wide investigation mode
      // Store in a global settings table or environment variable
      // For now, we'll log it
      console.log(
        '[Security Investigation Mode] Platform-wide investigation mode enabled',
      );
    }
  }

  /**
   * Force account review
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  private async forceAccountReview(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Mark all accounts for review
    await prisma.tenant.update({
      where: { id: schoolId },
      data: {
        settings: {
          ...((
            await prisma.tenant.findUnique({
              where: { id: schoolId },
              select: { settings: true },
            })
          )?.settings as any),
          accountReview: {
            required: true,
            requiredAt: new Date().toISOString(),
            reason: options.reason,
          },
        },
      },
    });
  }

  /**
   * Enhance MFA requirements
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param options - Breach response options
   */
  private async enhanceMFARequirements(
    prisma: PrismaClient,
    schoolId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Update security policy to require stricter MFA
    // This would typically involve updating the security policy
    // For now, we'll mark it in tenant settings
    await prisma.tenant.update({
      where: { id: schoolId },
      data: {
        settings: {
          ...((
            await prisma.tenant.findUnique({
              where: { id: schoolId },
              select: { settings: true },
            })
          )?.settings as any),
          mfaRequirements: {
            enhanced: true,
            enhancedAt: new Date().toISOString(),
            reason: options.reason,
          },
        },
      },
    });
  }

  /**
   * Require stricter MFA for profile
   *
   * @param prisma - Prisma client instance
   * @param profileId - Profile ID
   * @param options - Breach response options
   */
  private async requireStricterMFA(
    prisma: Prisma.TransactionClient,
    profileId: string,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Mark profile as requiring stricter MFA
    // This would typically involve updating MFA requirements
    // For now, we'll log it
    console.log(`[Stricter MFA] Required for profile ${profileId}`);
  }

  /**
   * Rotate all school secrets
   *
   * @param prisma - Prisma client instance
   * @param options - Breach response options
   */
  private async rotateAllSchoolSecrets(
    prisma: PrismaClient,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Get all schools
    const schools = await prisma.tenant.findMany({
      select: { id: true },
    });

    // Rotate secrets for each school
    for (const school of schools) {
      await JWTSecretService.emergencyRotateSecret(
        prisma,
        school.id,
        options.actorRole || 'platform_admin',
      );
    }
  }

  /**
   * Force platform-wide MFA re-authentication
   *
   * @param prisma - Prisma client instance
   * @param options - Breach response options
   */
  private async forcePlatformWideMFAReauthentication(
    prisma: PrismaClient,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Get all schools
    const schools = await prisma.tenant.findMany({
      select: { id: true },
    });

    // Force MFA re-auth for each school
    for (const school of schools) {
      await this.markAllUsersForMFAReauth(prisma, school.id, options);
    }
  }

  /**
   * Force global password reset
   *
   * @param prisma - Prisma client instance
   * @param options - Breach response options
   */
  private async forceGlobalPasswordReset(
    prisma: PrismaClient,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    // Force password reset for each user
    for (const user of users) {
      const resetToken = await this.generatePasswordResetToken(prisma, user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken.token,
          passwordResetExpiresAt: resetToken.expiresAt,
        },
      });

      // TODO: Send password reset email
      // await this.emailService.sendPasswordResetEmail(user.email, resetToken.token);
    }
  }

  /**
   * Enforce stricter MFA
   *
   * @param prisma - Prisma client instance
   * @param options - Breach response options
   */
  private async enforceStricterMFA(
    prisma: PrismaClient,
    options: BreachResponseOptions,
  ): Promise<void> {
    // Get all schools
    const schools = await prisma.tenant.findMany({
      select: { id: true },
    });

    // Enhance MFA requirements for each school
    for (const school of schools) {
      await this.enhanceMFARequirements(prisma, school.id, options);
    }
  }

  /**
   * Notify school users (8.8)
   *
   * @param prisma - Prisma client instance
   * @param schoolId - School ID
   * @param notification - Notification data
   */
  private async notifySchoolUsers(
    prisma: PrismaClient,
    schoolId: string,
    notification: {
      message: string;
      requiresReauth: boolean;
      requiresPasswordReset: boolean;
    },
  ): Promise<void> {
    // Get all active users in school (scoped — see forcePasswordReset).
    const userTenants = await withTenantScope(
      prisma,
      schoolId,
      undefined,
      (tx) =>
        tx.userTenant.findMany({
          where: {
            tenantId: schoolId,
            status: 'active',
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        }),
    );

    // TODO: Send notifications to users
    // For now, we'll log it
    console.log(
      `[Breach Notification] School ${schoolId}: ${notification.message}`,
    );
    console.log(`[Breach Notification] Affected users: ${userTenants.length}`);

    // In production, send email notifications or push notifications
    // await this.emailService.sendBreachNotification(user.email, notification);
  }

  /**
   * Notify all users (8.8)
   *
   * @param prisma - Prisma client instance
   * @param notification - Notification data
   */
  private async notifyAllUsers(
    prisma: PrismaClient,
    notification: {
      message: string;
      requiresReauth: boolean;
      requiresPasswordReset: boolean;
    },
  ): Promise<void> {
    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    // TODO: Send notifications to all users
    // For now, we'll log it
    console.log(`[Breach Notification] Platform-wide: ${notification.message}`);
    console.log(`[Breach Notification] Affected users: ${users.length}`);

    // In production, send email notifications or push notifications
    // for (const user of users) {
    //   await this.emailService.sendBreachNotification(user.email, notification);
    // }
  }

  /**
   * Notify user
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param notification - Notification data
   */
  private async notifyUser(
    prisma: Prisma.TransactionClient,
    userId: string,
    notification: {
      message: string;
      requiresReauth: boolean;
      requiresPasswordReset: boolean;
    },
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return;
    }

    // TODO: Send notification to user
    // For now, we'll log it
    console.log(
      `[Breach Notification] User ${user.email}: ${notification.message}`,
    );

    // In production, send email notification or push notification
    // await this.emailService.sendBreachNotification(user.email, notification);
  }

  /**
   * Generate password reset token
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @returns Reset token and expiration
   */
  private async generatePasswordResetToken(
    prisma: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

    return { token, expiresAt };
  }

  /**
   * Log breach response.
   *
   * Always writes on the privileged `dbService.client`, never the caller's
   * client: `writeAuditLog` opens its own transaction (which a caller-supplied
   * `Prisma.TransactionClient`, as the profile path passes, cannot nest), and
   * the audit row must land outside the breach-response transaction so it
   * survives a rollback. Matches PlatformAuditService.
   *
   * @param schoolId - School ID (null for platform-wide)
   * @param data - Log data
   */
  private async logBreachResponse(
    schoolId: string | null,
    data: {
      action: AuditAction;
      reason: string;
      severity?: string;
      escalatedToPasswordReset?: boolean;
      resource?: string;
      resourceId?: string;
      actorId?: string;
      actorProfileId?: string;
      actorRole?: string;
      actorEmail?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    try {
      await writeAuditLog(this.dbService.client, {
        tenantId: schoolId,
        eventType: AUDIT_EVENT.SECURITY_EVENT,
        action: data.action,
        resource: data.resource || 'breach_response',
        resourceId: data.resourceId || null,
        actorId: data.actorId || null,
        actorProfileId: data.actorProfileId || null,
        actorRole: data.actorRole || null,
        actorEmail: data.actorEmail || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        description: `Breach response: ${data.reason}`,
        metadata: {
          severity: data.severity || 'medium',
          escalatedToPasswordReset: data.escalatedToPasswordReset || false,
        },
        status: 'success',
      });
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('Failed to log breach response:', error);
    }
  }
}
