import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { CurriculumOverlayService } from '../services/curriculum-overlay.service';
import { CurriculumMappingService } from '../services/curriculum-mapping.service';
import { CreateOverlayDto, UpsertMappingDto } from '../dto/curriculum.dto';

/**
 * Tenant customization of national curriculum (F6 / ADR-03): overlays (edits
 * layered over an immutable national version) + subject-name aliases (dirty ↔
 * canonical de-dup for transfer/migration).
 */
@ApiTags('Curriculum · Customization')
@Controller('curriculum')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class CurriculumCustomizationController {
  constructor(
    private readonly overlays: CurriculumOverlayService,
    private readonly mappings: CurriculumMappingService,
  ) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user?.tenantId || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      profileId: req.userContext.profileId,
    };
  }

  // ---- overlays ----
  @Get('overlays')
  @RequirePermissions(['curriculum.view'])
  listOverlays(
    @Query('baseVersionId') baseVersionId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.overlays.list(this.ctx(req).tenantId, baseVersionId);
  }

  @Post('overlays')
  @RequirePermissions(['curriculum.manage'])
  createOverlay(
    @Body() dto: CreateOverlayDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.overlays.create(tenantId, profileId, dto);
  }

  @Post('overlays/:id/approve')
  @RequirePermissions(['curriculum.manage'])
  approveOverlay(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.overlays.approve(tenantId, profileId, id);
  }

  // ---- subject aliases ----
  @Get('mappings')
  @RequirePermissions(['curriculum.view'])
  listMappings(@Request() req: AuthenticatedRequest) {
    return this.mappings.list(this.ctx(req).tenantId);
  }

  @Get('mappings/resolve')
  @RequirePermissions(['curriculum.view'])
  @ApiOperation({
    summary: 'Resolve a dirty subject name to its canonical mapping',
  })
  resolveMapping(
    @Query('name') name: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.mappings.resolve(this.ctx(req).tenantId, name ?? '');
  }

  @Post('mappings')
  @RequirePermissions(['curriculum.manage'])
  upsertMapping(
    @Body() dto: UpsertMappingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.mappings.upsert(tenantId, profileId, dto);
  }
}
