import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

/**
 * Tenant Audit Service
 *
 * Handles audit logging for tenant and user management actions.
 * 6.11: Implement audit logging for user additions
 */
@Injectable()
export class TenantAuditService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Log tenant action
   *
   * @param data - Audit log data
   */
  async logTenantAction(data: {
    action: string;
    tenantId: string;
    userId: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await this.dbService.client.auditLog.create({
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
   * @param data - Audit log data
   */
  async logUserAction(data: {
    action: string;
    tenantId: string;
    userId: string;
    performedBy: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await this.dbService.client.auditLog.create({
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
