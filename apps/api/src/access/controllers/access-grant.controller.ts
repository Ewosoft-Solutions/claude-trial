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
import { RequireStepUp, StepUpGuard } from '../../auth/guards/step-up.guard';
import { STEP_UP_OPERATION } from '../../auth/step-up.operations';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import {
  AccessGrantService,
  type GrantActor,
} from '../services/access-grant.service';
import { RequestGrantDto, ReviewGrantDto } from '../dto/access.dto';

/**
 * WB1-6 · Time-boxed + scoped access grants with maker-checker/step-up for the
 * high-risk ones. Every route is gated `access.grants.manage` (clearance 7);
 * granting/approving additionally require a fresh step-up (`users.role.assign`),
 * so scenario 4 ("granting payroll export triggers step-up + a second approval")
 * is enforced server-side. All routes are authenticated + RLS-scoped.
 */
@ApiTags('People')
@Controller('access')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AccessGrantController {
  constructor(private readonly grants: AccessGrantService) {}

  private ctx(req: AuthenticatedRequest): {
    tenantId: string;
    actor: GrantActor;
  } {
    if (!req.user) throw new ForbiddenException('User context not found');
    // PermissionGuard has already resolved + cached the permission context for
    // this route (it carries the actor's clearance + grant scope).
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

  @Get('profiles/:profileId/grants')
  @RequirePermissions(['access.grants.manage'])
  @ApiOperation({
    summary: "A profile's active grant + pending grant requests",
  })
  async state(
    @Param('profileId') profileId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.grants.getState(tenantId, profileId);
  }

  @Post('grants')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.USERS_ROLE_ASSIGN)
  @RequirePermissions(['access.grants.manage'])
  @ApiOperation({
    summary:
      'Request a scoped/time-boxed role grant (high-risk → maker-checker)',
  })
  async request(
    @Body() dto: RequestGrantDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.grants.requestGrant(tenantId, actor, dto);
  }

  @Post('grants/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.USERS_ROLE_ASSIGN)
  @RequirePermissions(['access.grants.manage'])
  @ApiOperation({
    summary: 'Approve a pending high-risk grant (must not be the requester)',
  })
  async approve(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewGrantDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.grants.approveGrant(tenantId, actor, requestId, dto.reason);
  }

  @Post('grants/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['access.grants.manage'])
  @ApiOperation({ summary: 'Reject a pending high-risk grant' })
  async reject(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewGrantDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.grants.rejectGrant(
      tenantId,
      actor,
      requestId,
      dto.reason ?? 'Rejected',
    );
  }

  @Post('profiles/:profileId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['access.grants.manage'])
  @ApiOperation({ summary: "Revoke a profile's role grant" })
  async revoke(
    @Param('profileId') profileId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.grants.revokeGrant(tenantId, actor, profileId);
  }
}
