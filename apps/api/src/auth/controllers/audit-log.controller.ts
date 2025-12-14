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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  // ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../guards/clearance-level.guard';
import { TenantContextGuard } from '../guards/tenant-context.guard';
import { DatabaseService } from '../../common/database/database.service';
import type { AuthenticatedRequest } from '../middleware';

/**
 * Audit Log Controller
 *
 * Provides endpoints for querying audit logs.
 */
@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
export class AuditLogController {
  constructor(private readonly dbService: DatabaseService) {}

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

    const where: any = {};

    // Filter by tenant (platform admins can see all, others see only their tenant)
    const userClearanceLevel = userContext?.clearanceLevel || 0;
    if (userClearanceLevel < 9) {
      // Not platform admin, filter by tenant
      where.tenantId = tenantId;
    } else if (tenantId) {
      // Platform admin can optionally filter by tenant
      where.tenantId = tenantId;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (actorId) {
      where.actorId = actorId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      this.dbService.client.auditLog.findMany({
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
      this.dbService.client.auditLog.count({ where }),
    ]);

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
   * Get audit log by ID (12.10)
   *
   * GET /audit-logs/:id
   */
  @Get(':id')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log details' })
  async getAuditLog(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userContext = req.userContext;
    const tenantId = userContext?.tenantId;
    const userClearanceLevel = userContext?.clearanceLevel || 0;

    const where: any = { id };

    // Filter by tenant (platform admins can see all, others see only their tenant)
    if (userClearanceLevel < 9) {
      where.tenantId = tenantId;
    }

    const log = await this.dbService.client.auditLog.findFirst({
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
    });

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
    const userClearanceLevel = userContext?.clearanceLevel || 0;

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      resource,
      resourceId,
    };

    // Filter by tenant (platform admins can see all, others see only their tenant)
    if (userClearanceLevel < 9) {
      where.tenantId = tenantId;
    } else if (tenantId) {
      where.tenantId = tenantId;
    }

    const [logs, total] = await Promise.all([
      this.dbService.client.auditLog.findMany({
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
      this.dbService.client.auditLog.count({ where }),
    ]);

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
    const userClearanceLevel = userContext?.clearanceLevel || 0;

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      actorId,
    };

    // Filter by tenant (platform admins can see all, others see only their tenant)
    if (userClearanceLevel < 9) {
      where.tenantId = tenantId;
    } else if (tenantId) {
      where.tenantId = tenantId;
    }

    const [logs, total] = await Promise.all([
      this.dbService.client.auditLog.findMany({
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
      this.dbService.client.auditLog.count({ where }),
    ]);

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
