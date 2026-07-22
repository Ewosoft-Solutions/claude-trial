import { Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { TenantDbService } from '../../common/database/tenant-db.service';

export interface PlatformAuditQuery {
  tenantId?: string;
  action?: string;
  eventType?: string;
  actorId?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Platform Audit Query Service
 *
 * Reads the audit trail **across all tenants**. Runs inside the audited
 * `@PlatformScoped` cross-tenant scope, so `tenantDb.client` sees every tenant's
 * rows through the `app.is_platform` RLS branch — and the read of the audit
 * trail is itself audited by the interceptor.
 *
 * This is the sanctioned cross-tenant audit path. It replaces the ad-hoc
 * clearance-9 branch that `AuditLogController` used to carry on the privileged
 * client (unaudited, permission-ungated); that branch has been removed.
 */
@Injectable()
export class PlatformAuditQueryService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async query(params: PlatformAuditQuery) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(params.limit) || DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.action) where.action = params.action;
    if (params.eventType) where.eventType = params.eventType;
    if (params.actorId) where.actorId = params.actorId;
    if (params.resource) where.resource = params.resource;
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = new Date(params.startDate);
      if (params.endDate) where.timestamp.lte = new Date(params.endDate);
    }

    const client = this.tenantDb.client;
    const [logs, total] = await Promise.all([
      client.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          tenantId: true,
          eventType: true,
          action: true,
          resource: true,
          resourceId: true,
          actorId: true,
          actorRole: true,
          description: true,
          timestamp: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      client.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}
