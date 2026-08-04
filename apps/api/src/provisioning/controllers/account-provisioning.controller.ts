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
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { AccountProvisioningService } from '../services/account-provisioning.service';
import { InvitePersonDto, SuspendAccountDto } from '../dto/provisioning.dto';

/**
 * Account provisioning (WB1-3). Lifecycle actions on a person's login, consumed
 * by the People workbench. Reading state needs `users.view`; every mutation is
 * gated `users.provision` (security-sensitive, clearance 7) and enforced
 * server-side. All routes are authenticated, tenant-context-guarded, and
 * RLS-scoped.
 */
@ApiTags('People')
@Controller('directory/people/:personId/account')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AccountProvisioningController {
  constructor(private readonly provisioning: AccountProvisioningService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  @Get()
  @RequirePermissions(['users.view'])
  @ApiOperation({ summary: "A person's account/access state" })
  async state(
    @Param('personId') personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.provisioning.getState(tenantId, personId);
  }

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users.provision'])
  @ApiOperation({
    summary: 'Invite this person to create an account (sends a SecureLink)',
  })
  async invite(
    @Param('personId') personId: string,
    @Body() dto: InvitePersonDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.provisioning.invite(tenantId, userId, personId, dto);
  }

  @Post('resend-invite')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users.provision'])
  @ApiOperation({ summary: 'Re-send a still-pending invitation' })
  async resend(
    @Param('personId') personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.provisioning.resend(tenantId, userId, personId);
  }

  @Post('suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users.provision'])
  @ApiOperation({ summary: 'Suspend the account (blocks login, audited)' })
  async suspend(
    @Param('personId') personId: string,
    @Body() dto: SuspendAccountDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.provisioning.suspend(tenantId, userId, personId, dto);
  }

  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users.provision'])
  @ApiOperation({ summary: 'Reactivate a suspended account' })
  async reactivate(
    @Param('personId') personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.provisioning.reactivate(tenantId, userId, personId);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users.provision'])
  @ApiOperation({
    summary:
      'Send an admin-initiated password-reset link (user chooses password)',
  })
  async resetPassword(
    @Param('personId') personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.provisioning.sendPasswordReset(tenantId, userId, personId);
  }
}
