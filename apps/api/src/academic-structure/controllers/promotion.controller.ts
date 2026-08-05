import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import type { AuthenticatedRequest } from 'src/auth';
import {
  PromotionService,
  type PromotionActor,
} from '../services/promotion.service';
import {
  CreatePromotionRunDto,
  SetPromotionExceptionDto,
  ReviewPromotionDto,
} from '../dto';

/**
 * WB2-4 · Promotion workbench — year rollover as one reviewable operation.
 * Reads gated `academics.promotion.view`; run/preview/exception management need
 * `academics.promotion.manage`; the commit approval needs
 * `academics.promotion.approve` (the second approver) and is additionally
 * gated by the WB1-6 maker-checker (maker ≠ checker) in the service. Campus-
 * scoped via the WB1-6 `AccessScopeService`. All routes authenticated + RLS-scoped.
 */
@ApiTags('Promotion')
@Controller('academics/promotion')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class PromotionController {
  constructor(private readonly promotion: PromotionService) {}

  private ctx(req: AuthenticatedRequest): {
    tenantId: string;
    actor: PromotionActor;
  } {
    if (!req.user) throw new ForbiddenException('User context not found');
    const context = req.userContext;
    return {
      tenantId: req.user.tenantId,
      actor: {
        userId: req.user.userId,
        clearanceLevel: context?.clearanceLevel ?? 0,
        grantScope: context?.grantScope ?? null,
      },
    };
  }

  // ---- reads ----
  @Get('runs')
  @RequirePermissions(['academics.promotion.view'])
  @ApiOperation({ summary: 'List promotion runs' })
  listRuns(@Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.listRuns(tenantId, actor);
  }

  @Get('runs/:id')
  @RequirePermissions(['academics.promotion.view'])
  @ApiOperation({ summary: 'A promotion run + its items' })
  getRun(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.getRun(tenantId, actor, id);
  }

  // ---- manage ----
  @Post('runs')
  @RequirePermissions(['academics.promotion.manage'])
  @ApiOperation({ summary: 'Create a promotion run (year rollover)' })
  createRun(
    @Body() dto: CreatePromotionRunDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.createRun(tenantId, actor, dto);
  }

  @Post('runs/:id/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.promotion.manage'])
  @ApiOperation({ summary: 'Preview the cohort with proposed placements' })
  preview(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.preview(tenantId, actor, id);
  }

  @Post('runs/:id/items/:itemId/exception')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.promotion.manage'])
  @ApiOperation({
    summary: 'Mark one student an exception (repeat/withhold/manual)',
  })
  setException(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SetPromotionExceptionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.setException(tenantId, actor, id, itemId, dto);
  }

  @Post('runs/:id/request-commit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.promotion.manage'])
  @ApiOperation({ summary: 'Submit the run for approval (maker-checker)' })
  requestCommit(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.requestCommit(tenantId, actor, id);
  }

  @Post('runs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.promotion.manage'])
  @ApiOperation({
    summary: 'Cancel a run (withdraws any pending approval; not for committed)',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: ReviewPromotionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.cancelRun(tenantId, actor, id, dto.reason);
  }

  // ---- approve + commit (second approver) ----
  @Post('runs/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.promotion.approve'])
  @ApiOperation({
    summary: 'Approve + commit the run (must not be the requester)',
  })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewPromotionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.promotion.approveAndCommit(tenantId, actor, id, dto.reason);
  }
}
