/**
 * Audit Log Controller
 *
 * Handles audit log query endpoints (12.10).
 */

import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  Res,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../guards/clearance-level.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { DatabaseService } from '../../common/database/database.service';
import { withTenantScope } from '@workspace/database/rls';
import { writeAuditLog } from '../../common/audit/audit-writer';
import {
  TableExportService,
  isExportFormat,
  type ExportFormat,
} from '../../common/export/table-export.service';
import type { AuthenticatedRequest } from '../middleware';

/** Filters shared by the list + export handlers. */
interface AuditFilters {
  eventType?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  actorId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

/** Hard cap on an export so a single request can't stream the whole table. */
const EXPORT_ROW_CAP = 10000;

/**
 * Audit Log Controller
 *
 * Provides endpoints for querying audit logs.
 */
@ApiTags(SwaggerTags.auditLogs.name)
@Controller('audit-logs')
// ClearanceLevelGuard both enforces @RequireClearanceLevel(7) AND populates
// req.userContext (clearanceLevel + tenantId). Without it the decorator was
// inert and userContext was undefined, so these handlers 403'd for everyone —
// a pre-existing bug surfaced while hardening the cross-tenant branch (2.1).
@UseGuards(JwtAuthGuard, TenantContextGuard, ClearanceLevelGuard)
@ApiBearerAuth('JWT-auth')
export class AuditLogController {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly tableExport: TableExportService,
  ) {}

  /** Build the Prisma `where` shared by the list + export queries. Every arm is
   *  tenant-scoped; `search` is a case-insensitive OR across the human-facing
   *  columns. */
  private buildWhere(
    tenantId: string,
    f: AuditFilters,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = { tenantId };
    if (f.eventType) where.eventType = f.eventType;
    if (f.action) where.action = f.action;
    if (f.resource) where.resource = f.resource;
    if (f.resourceId) where.resourceId = f.resourceId;
    if (f.actorId) where.actorId = f.actorId;
    if (f.status) where.status = f.status;
    if (f.startDate || f.endDate) {
      const timestamp: Record<string, Date> = {};
      if (f.startDate) timestamp.gte = new Date(f.startDate);
      if (f.endDate) timestamp.lte = new Date(f.endDate);
      where.timestamp = timestamp;
    }
    const q = f.search?.trim();
    if (q) {
      where.OR = [
        { actorEmail: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { resource: { contains: q, mode: 'insensitive' } },
        { actorRole: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  /**
   * Query audit logs (12.10)
   *
   * GET /audit-logs
   */
  @Get()
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  async queryAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('eventType') eventType?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorId') actorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    const skip = (pageNum - 1) * limitNum;

    // Strictly tenant-scoped. This endpoint is a tenant's own audit view; it no
    // longer carries a clearance-9 "see all tenants" branch. That branch read
    // cross-tenant on the privileged client, unaudited and gated on clearance
    // rather than permission — the exact anti-pattern the platform scope exists
    // to replace. Cross-tenant audit now goes through GET /platform/audit
    // (@PlatformScoped, permission-gated, audited). See docs/platform-scope-plan.md.
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    const where = this.buildWhere(tenantId, {
      eventType,
      action,
      resource,
      resourceId,
      actorId,
      status,
      search,
      startDate,
      endDate,
    });

    // `audit_logs` is FORCE RLS. This handler runs outside @TenantScoped, so
    // the reads carry their own scope — without it they return an empty page
    // on any deployed database. See docs/rls-privileged-client-plan.md.
    const [logs, total] = await withTenantScope(
      this.dbService.client,
      tenantId,
      userContext?.userId,
      (tx) =>
        Promise.all([
          tx.auditLog.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: {
              timestamp: 'desc',
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
          tx.auditLog.count({ where }),
        ]),
    );

    return {
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    };
  }

  /**
   * Export audit logs honoring the current filters (12.10).
   *
   * GET /audit-logs/export?format=csv|xlsx|pdf&<filters>
   *
   * Declared BEFORE `:id` so it isn't captured by the param route. Streams a
   * file of every row matching the filters (capped) and writes its OWN audit
   * event — exporting the audit trail is itself an auditable action.
   */
  @Get('export')
  @RequireClearanceLevel(7)
  @ApiOperation({ summary: 'Export audit logs (CSV / XLSX / PDF)' })
  @ApiResponse({ status: 200, description: 'A CSV / XLSX / PDF file' })
  async exportAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('eventType') eventType?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorId') actorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const fmt: ExportFormat = isExportFormat(format) ? format : 'csv';
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    const filters: AuditFilters = {
      eventType,
      action,
      resource,
      resourceId,
      actorId,
      status,
      search,
      startDate,
      endDate,
    };
    const where = this.buildWhere(tenantId, filters);

    const logs = await withTenantScope(
      this.dbService.client,
      tenantId,
      userContext?.userId,
      (tx) =>
        tx.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: EXPORT_ROW_CAP,
        }),
    );
    if (logs.length >= EXPORT_ROW_CAP) {
      throw new BadRequestException(
        `Too many rows to export (max ${EXPORT_ROW_CAP}). Narrow the filters or date range.`,
      );
    }

    const result = await this.tableExport.export(
      {
        title: 'Audit log',
        filename: `audit-log-${new Date().toISOString().slice(0, 10)}`,
        columns: [
          { key: 'timestamp', header: 'Timestamp', width: 22 },
          { key: 'actor', header: 'Actor', width: 30 },
          { key: 'actorRole', header: 'Role', width: 16 },
          { key: 'eventType', header: 'Event', width: 16 },
          { key: 'action', header: 'Action', width: 18 },
          { key: 'resource', header: 'Resource', width: 20 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'description', header: 'Description', width: 44 },
          { key: 'ipAddress', header: 'IP', width: 16 },
        ],
        rows: logs.map((log) => ({
          timestamp: log.timestamp.toISOString(),
          actor: log.actorEmail ?? log.actorId ?? 'System',
          actorRole: log.actorRole ?? '',
          eventType: log.eventType,
          action: log.action,
          resource: [log.resource, log.resourceId].filter(Boolean).join(':'),
          status: log.status,
          description: log.description,
          ipAddress: log.ipAddress ?? '',
        })),
      },
      fmt,
    );

    // Exporting the audit trail is itself auditable.
    await writeAuditLog(this.dbService.client, {
      tenantId,
      eventType: 'security_event',
      action: 'export',
      resource: 'audit_log',
      actorId: userContext?.userId,
      description: `Exported ${logs.length} audit ${
        logs.length === 1 ? 'entry' : 'entries'
      } as ${fmt.toUpperCase()}`,
      metadata: { format: fmt, rowCount: logs.length, filters },
      status: 'success',
    });

    res.setHeader('Content-Type', result.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  /**
   * Get audit log by ID (12.10)
   *
   * GET /audit-logs/:id
   */
  @Get(':id')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log details' })
  async getAuditLog(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;

    // Strictly tenant-scoped — cross-tenant audit is GET /platform/audit now.
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    const where: any = { id, tenantId };

    const log = await withTenantScope(
      this.dbService.client,
      tenantId,
      userContext?.userId,
      (tx) =>
        tx.auditLog.findFirst({
          where,
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
    );

    if (!log) {
      throw new Error('Audit log not found');
    }

    return log;
  }

  /**
   * Get audit logs for resource (12.10)
   *
   * GET /audit-logs/resource/:resource/:resourceId
   */
  @Get('resource/:resource/:resourceId')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Get audit logs for a specific resource' })
  @ApiResponse({ status: 200, description: 'List of audit logs for resource' })
  async getAuditLogsForResource(
    @Request() req: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    const skip = (pageNum - 1) * limitNum;

    // Strictly tenant-scoped — cross-tenant audit is GET /platform/audit now.
    const where: any = {
      resource,
      resourceId,
      tenantId,
    };

    const [logs, total] = await withTenantScope(
      this.dbService.client,
      tenantId,
      userContext?.userId,
      (tx) =>
        Promise.all([
          tx.auditLog.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: {
              timestamp: 'desc',
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
          tx.auditLog.count({ where }),
        ]),
    );

    return {
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    };
  }

  /**
   * Get audit logs for actor (12.10)
   *
   * GET /audit-logs/actor/:actorId
   */
  @Get('actor/:actorId')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Get audit logs for a specific actor (user)' })
  @ApiResponse({ status: 200, description: 'List of audit logs for actor' })
  async getAuditLogsForActor(
    @Request() req: AuthenticatedRequest,
    @Param('actorId') actorId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    const skip = (pageNum - 1) * limitNum;

    // Strictly tenant-scoped — cross-tenant audit is GET /platform/audit now.
    const where: any = {
      actorId,
      tenantId,
    };

    const [logs, total] = await withTenantScope(
      this.dbService.client,
      tenantId,
      userContext?.userId,
      (tx) =>
        Promise.all([
          tx.auditLog.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: {
              timestamp: 'desc',
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
          tx.auditLog.count({ where }),
        ]),
    );

    return {
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    };
  }
}
