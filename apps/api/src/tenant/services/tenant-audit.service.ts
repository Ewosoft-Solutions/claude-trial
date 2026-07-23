import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import {
  AuditEventType,
  AUDIT_EVENT,
  DEFAULT_AUDIT_EVENT_TYPE,
  AuditAction,
} from '../../common/audit/audit.constants';
import { writeAuditLog } from '../../common/audit/audit-writer';

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
    action: AuditAction;
    tenantId: string;
    userId: string;
    eventType?: AuditEventType;
    metadata?: Record<string, any>;
  }) {
    try {
      const eventType =
        data.eventType ?? AUDIT_EVENT.USER_ACTION ?? DEFAULT_AUDIT_EVENT_TYPE;

      await writeAuditLog(this.dbService.client, {
        tenantId: data.tenantId,
        eventType,
        action: data.action,
        resource: 'tenant',
        resourceId: data.tenantId,
        actorId: data.userId,
        description: `Tenant action: ${data.action}`,
        metadata: data.metadata || {},
        ipAddress: null, // Can be added from request context
        userAgent: null, // Can be added from request context
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
    action: AuditAction;
    tenantId: string;
    userId: string;
    performedBy: string;
    eventType?: AuditEventType;
    metadata?: Record<string, any>;
  }) {
    try {
      const eventType =
        data.eventType ?? AUDIT_EVENT.USER_ACTION ?? DEFAULT_AUDIT_EVENT_TYPE;

      await writeAuditLog(this.dbService.client, {
        tenantId: data.tenantId,
        eventType,
        action: data.action,
        resource: 'user',
        resourceId: data.userId,
        actorId: data.performedBy,
        description: `User action: ${data.action}`,
        metadata: data.metadata || {},
        ipAddress: null, // Can be added from request context
        userAgent: null, // Can be added from request context
      });
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      console.error('Failed to log user action:', error);
    }
  }
}
