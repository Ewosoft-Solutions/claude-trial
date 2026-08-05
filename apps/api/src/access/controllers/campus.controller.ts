import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { CampusService } from '../services/campus.service';
import { CreateCampusDto, UpdateCampusDto } from '../dto/access.dto';

/**
 * WB1-6 · Campuses — the operating units within a tenant that access grants are
 * scoped to (ADR-11 Option A). Reading needs `campus.view`; creating/editing is
 * gated `campus.manage` (clearance 7). All routes are authenticated + RLS-scoped.
 */
@ApiTags('Tenant')
@Controller('campuses')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class CampusController {
  constructor(private readonly campuses: CampusService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  @Get()
  @RequirePermissions(['campus.view'])
  @ApiOperation({ summary: 'List the tenant’s campuses' })
  async list(@Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    return this.campuses.list(tenantId);
  }

  @Post()
  @RequirePermissions(['campus.manage'])
  @ApiOperation({ summary: 'Create a campus' })
  async create(
    @Body() dto: CreateCampusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.campuses.create(tenantId, userId, dto);
  }

  @Patch(':campusId')
  @RequirePermissions(['campus.manage'])
  @ApiOperation({ summary: 'Update a campus' })
  async update(
    @Param('campusId') campusId: string,
    @Body() dto: UpdateCampusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.campuses.update(tenantId, userId, campusId, dto);
  }
}
