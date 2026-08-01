import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
import { SavedViewService } from '../services/saved-view.service';
import {
  CreateSavedViewDto,
  ListSavedViewsDto,
  UpdateSavedViewDto,
} from '../dto';

/**
 * Saved views for the directory pattern (F7). Owner-scoped personal views plus
 * tenant-shared ones. Gated on the resource's view permission — `students.view`
 * today, since students is the only resource that has adopted F7; extend the
 * gate as more lists opt in.
 */
@ApiTags('Directory')
@Controller('directory/saved-views')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class SavedViewsController {
  constructor(private readonly savedViews: SavedViewService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      profileId: req.userContext.profileId,
    };
  }

  @Get()
  @RequirePermissions(['students.view'])
  @ApiOperation({ summary: 'List saved views for a resource (own + shared)' })
  async list(
    @Query() query: ListSavedViewsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.savedViews.list(tenantId, profileId, query.resource);
  }

  @Post()
  @RequirePermissions(['students.view'])
  @ApiOperation({ summary: 'Save the current directory view' })
  async create(
    @Body() dto: CreateSavedViewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId, profileId } = this.ctx(req);
    return this.savedViews.create(tenantId, profileId, userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(['students.view'])
  @ApiOperation({ summary: 'Update a saved view you own' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSavedViewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId, profileId } = this.ctx(req);
    return this.savedViews.update(tenantId, profileId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(['students.view'])
  @ApiOperation({ summary: 'Delete a saved view you own' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId, profileId } = this.ctx(req);
    return this.savedViews.remove(tenantId, profileId, userId, id);
  }
}
