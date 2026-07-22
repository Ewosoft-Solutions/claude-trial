import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  AUDIT_ACTION,
  AUDIT_EVENT,
  type AuditAction,
} from './audit.constants';

/**
 * Platform Audit Service
 *
 * Records use of the audited cross-tenant RLS bypass (`app.is_platform`).
 * Platform scope is the widest data access in the system, so every entry into
 * it is logged whether or not the request succeeds.
 *
 * Deliberately writes on the **privileged** `DatabaseService` client rather
 * than through `TenantDbService`: the audit row must land outside the platform
 * transaction, so that a handler which throws (and rolls its transaction back)
 * still leaves a record that cross-tenant access was attempted.
 *
 * FILING RULE: every row here is filed against the **acting platform user's own
 * tenant** (the platform tenant), with the tenant being acted upon carried in
 * `targetTenantId` / `resourceId`. Platform work is system activity, not an
 * account intrusion, so it belongs in the platform's trail rather than the
 * target's user-facing audit log. Because audit rows are tenant-scoped by RLS,
 * this also means a tenant cannot see platform activity through its own scoped
 * queries — the desired behaviour falls out of existing isolation.
 * Do not pass a target tenant as `tenantId`. See docs/platform-scope-plan.md §7.1.
 */
@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Record a cross-tenant access attempt.
   *
   * @param data.tenantId    Acting user's own tenant (the platform tenant) —
   *                         where the audit row is filed, not what was read.
   * @param data.targetTenantId Tenant the request was about, when it targets
   *                         one specific tenant rather than aggregating.
   */
  async logCrossTenantAccess(data: {
    userId: string;
    tenantId: string;
    permissions: string[];
    method: string;
    path: string;
    granted: boolean;
    targetTenantId?: string;
    failureReason?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const action: AuditAction = data.granted
      ? AUDIT_ACTION.PLATFORM.CROSS_TENANT_ACCESS
      : AUDIT_ACTION.PLATFORM.CROSS_TENANT_ACCESS_DENIED;

    await this.write({
      action,
      tenantId: data.tenantId,
      actorId: data.userId,
      resource: 'platform',
      resourceId: data.targetTenantId ?? null,
      description: `Cross-tenant access ${data.granted ? 'granted' : 'denied'}: ${data.method} ${data.path}`,
      metadata: {
        permissions: data.permissions,
        method: data.method,
        path: data.path,
        targetTenantId: data.targetTenantId ?? null,
        failureReason: data.failureReason ?? null,
      },
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    });
  }

  /**
   * Record a platform override (emergency or otherwise) against one tenant.
   * Used by `PlatformOversightService` when it mints an override context.
   */
  async logOverride(data: {
    userId: string;
    tenantId: string;
    targetTenantId: string;
    overrideReason: string;
    emergencyAccess: boolean;
    granted: boolean;
    clearanceLevel?: number;
    failureReason?: string;
  }): Promise<void> {
    const action: AuditAction = data.granted
      ? AUDIT_ACTION.PLATFORM.OVERRIDE_GRANTED
      : AUDIT_ACTION.PLATFORM.OVERRIDE_DENIED;

    await this.write({
      action,
      tenantId: data.tenantId,
      actorId: data.userId,
      resource: 'tenant',
      resourceId: data.targetTenantId,
      description: `Platform override ${data.granted ? 'granted' : 'denied'} over tenant ${data.targetTenantId}`,
      metadata: {
        targetTenantId: data.targetTenantId,
        overrideReason: data.overrideReason,
        emergencyAccess: data.emergencyAccess,
        clearanceLevel: data.clearanceLevel ?? null,
        failureReason: data.failureReason ?? null,
      },
      ipAddress: null,
      userAgent: null,
    });
  }

  /**
   * Record a tenant activate/suspend performed on the platform plane — whether
   * applied directly by an Architect or executed from an approved SuperAdmin
   * request. `viaApproval` distinguishes the two and links back to the request.
   */
  async logTenantStatusAction(data: {
    userId: string;
    tenantId: string;
    targetTenantId: string;
    status: string;
    viaApproval?: { requestId: string; makerId: string };
  }): Promise<void> {
    await this.write({
      action: AUDIT_ACTION.PLATFORM.TENANT_STATUS_ACTION,
      tenantId: data.tenantId,
      actorId: data.userId,
      resource: 'tenant',
      resourceId: data.targetTenantId,
      description: `Tenant set to ${data.status} on tenant ${data.targetTenantId}${
        data.viaApproval ? ' (via approved request)' : ' (direct)'
      }`,
      metadata: {
        targetTenantId: data.targetTenantId,
        status: data.status,
        viaApproval: data.viaApproval ?? null,
      },
      ipAddress: null,
      userAgent: null,
    });
  }

  private async write(data: {
    action: AuditAction;
    tenantId: string;
    actorId: string;
    resource: string;
    resourceId: string | null;
    description: string;
    metadata: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    try {
      await this.dbService.client.auditLog.create({
        data: {
          tenantId: data.tenantId,
          eventType: AUDIT_EVENT.SECURITY_EVENT,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          actorId: data.actorId,
          description: data.description,
          metadata: data.metadata as never,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      // Never break the request on an audit failure, but make the gap loud:
      // a missing platform-access record is a security-relevant event itself.
      this.logger.error(
        `Failed to write platform audit row (${data.action}, actor ${data.actorId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
