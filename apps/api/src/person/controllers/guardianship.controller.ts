import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { GuardianshipService } from '../services/guardianship.service';
import {
  CreateGuardianshipDto,
  EndGuardianshipDto,
  GuardianAudienceQueryDto,
  ListGuardianshipsQueryDto,
  UpdateGuardianshipDto,
  VerifyGuardianshipDto,
} from '../dto/guardianship.dto';

/**
 * Guardianship management (WB1-4). Model real caregiver relationships beyond a
 * gender label: authority, per-category contact consent, verification, and an
 * effective-dated lifecycle. Reads are gated `guardians.view`; mutations
 * `guardians.manage`. Every route is authenticated, tenant-context-guarded,
 * permission-checked server-side, and RLS-scoped.
 */
@ApiTags('People')
@Controller('guardianships')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class GuardianshipController {
  constructor(private readonly guardianships: GuardianshipService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  @Get()
  @RequirePermissions(['guardians.view'])
  @ApiOperation({
    summary: 'List guardianships for a ward or a guardian person',
  })
  async list(
    @Query() query: ListGuardianshipsQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.guardianships.list(tenantId, {
      wardPersonId: query.wardPersonId,
      guardianPersonId: query.guardianPersonId,
      includeEnded: query.includeEnded === 'true',
    });
  }

  @Get('audience')
  @RequirePermissions(['guardians.view'])
  @ApiOperation({
    summary:
      'Resolve comms recipients for a ward by relationship + consent (not a gender label)',
  })
  async audience(
    @Query() query: GuardianAudienceQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.guardianships.resolveAudience(
      tenantId,
      query.wardPersonId,
      query.category,
    );
  }

  @Post()
  @RequirePermissions(['guardians.manage'])
  @ApiOperation({ summary: 'Create a guardian relationship' })
  async create(
    @Body() dto: CreateGuardianshipDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.guardianships.create(tenantId, userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(['guardians.manage'])
  @ApiOperation({ summary: 'Update authority / consent / priority' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGuardianshipDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.guardianships.update(tenantId, userId, id, dto);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['guardians.manage'])
  @ApiOperation({ summary: 'Record verification of the caregiver claim' })
  async verify(
    @Param('id') id: string,
    @Body() dto: VerifyGuardianshipDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.guardianships.verify(tenantId, userId, id, dto.method);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['guardians.manage'])
  @ApiOperation({
    summary: 'End a relationship (effective-dated, keeps history)',
  })
  async end(
    @Param('id') id: string,
    @Body() dto: EndGuardianshipDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.guardianships.end(tenantId, userId, id, dto.reason);
  }
}
