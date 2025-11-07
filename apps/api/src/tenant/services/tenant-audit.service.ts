import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';

/**
 * Tenant Audit Service
 *
 * Handles audit logging for tenant and user management actions.
 * 6.11: Implement audit logging for user additions
 */
@Injectable()
export class TenantAuditService {
  /**
   * Log tenant action
   *
   * @param prisma - Prisma client instance
   * @param data - Audit log data
   */
  async logTenantAction(
    prisma: PrismaClient,
    data: {
      action: string;
      tenantId: string;
      userId: string;
      metadata?: Record<string, any>;
    },
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          action: data.action,
          entityType: 'tenant',
          entityId: data.tenantId,
          userId: data.userId,
          metadata: data.metadata || {},
          ipAddress: null, // Can be added from request context
          userAgent: null, // Can be added from request context
        },
      });
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('Failed to log tenant action:', error);
    }
  }

  /**
   * Log user action
   *
   * @param prisma - Prisma client instance
   * @param data - Audit log data
   */
  async logUserAction(
    prisma: PrismaClient,
    data: {
      action: string;
      tenantId: string;
      userId: string;
      performedBy: string;
      metadata?: Record<string, any>;
    },
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          action: data.action,
          entityType: 'user',
          entityId: data.userId,
          userId: data.performedBy,
          tenantId: data.tenantId,
          metadata: data.metadata || {},
          ipAddress: null, // Can be added from request context
          userAgent: null, // Can be added from request context
        },
      });
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('Failed to log user action:', error);
    }
  }
}
