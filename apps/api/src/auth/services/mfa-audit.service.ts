/**
 * MFA Audit Service
 *
 * Handles MFA audit logging (3a.11).
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';

/**
 * MFA Audit Event Types
 */
export type MfaAuditEventType =
  | 'mfa_method_setup'
  | 'mfa_method_activated'
  | 'mfa_method_disabled'
  | 'mfa_method_deleted'
  | 'mfa_verification_initiated'
  | 'mfa_verification_success'
  | 'mfa_verification_failed'
  | 'mfa_recovery_code_generated'
  | 'mfa_recovery_code_used'
  | 'mfa_primary_method_changed';

/**
 * MFA Audit Service
 *
 * Provides MFA audit logging functionality.
 */
@Injectable()
export class MfaAuditService {
  /**
   * Log MFA event (3a.11)
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param eventType - Event type
   * @param details - Event details
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logMfaEvent(
    prisma: PrismaClient,
    userId: string,
    eventType: MfaAuditEventType,
    details: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // TODO: Implement audit logging when audit log system is implemented
    // For now, this is a placeholder
    // When audit logging is implemented, uncomment and use:
    //
    // await prisma.auditLog.create({
    //   data: {
    //     userId,
    //     action: eventType,
    //     resource: 'mfa',
    //     details: JSON.stringify(details),
    //     ipAddress,
    //     userAgent,
    //     createdAt: new Date(),
    //   },
    // });

    // Log to console for now (remove in production)
    console.log('[MFA Audit]', {
      userId,
      eventType,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log MFA method setup
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID
   * @param methodType - MFA method type
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logMfaMethodSetup(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
    methodType: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logMfaEvent(
      prisma,
      userId,
      'mfa_method_setup',
      {
        methodId,
        methodType,
      },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Log MFA method activation
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param methodId - MFA method ID
   * @param methodType - MFA method type
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logMfaMethodActivated(
    prisma: PrismaClient,
    userId: string,
    methodId: string,
    methodType: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logMfaEvent(
      prisma,
      userId,
      'mfa_method_activated',
      {
        methodId,
        methodType,
      },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Log MFA verification attempt
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param challengeId - Challenge ID
   * @param methodType - MFA method type
   * @param success - Whether verification was successful
   * @param operation - Operation type
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logMfaVerification(
    prisma: PrismaClient,
    userId: string,
    challengeId: string,
    methodType: string,
    success: boolean,
    operation: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logMfaEvent(
      prisma,
      userId,
      success ? 'mfa_verification_success' : 'mfa_verification_failed',
      {
        challengeId,
        methodType,
        operation,
        success,
      },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Log MFA recovery code generation
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param count - Number of codes generated
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logMfaRecoveryCodeGenerated(
    prisma: PrismaClient,
    userId: string,
    count: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logMfaEvent(
      prisma,
      userId,
      'mfa_recovery_code_generated',
      {
        count,
      },
      ipAddress,
      userAgent,
    );
  }

  /**
   * Log MFA recovery code usage
   *
   * @param prisma - Prisma client instance
   * @param userId - User ID
   * @param success - Whether recovery code was valid
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  async logMfaRecoveryCodeUsed(
    prisma: PrismaClient,
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logMfaEvent(
      prisma,
      userId,
      'mfa_recovery_code_used',
      {
        success,
      },
      ipAddress,
      userAgent,
    );
  }
}
