import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../../auth/guards/permission.guard';
import { TenantScoped } from '../../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../../auth/middleware/multi-layer-security.middleware';
import { SecureLinkService } from '../services/secure-link.service';
import { CreateSecureLinkDto } from '../dto';

/**
 * SecureLink HTTP surface. Creating/revoking is a privileged action
 * (`communication.delivery.manage`). Redemption is authenticated but has NO
 * static permission gate — the required permission / audience binding is
 * enforced per-link inside the service, because it varies by link.
 */
@ApiTags('Communication · SecureLink')
@Controller('communication/secure-links')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class SecureLinksController {
  constructor(private readonly links: SecureLinkService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user?.tenantId || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      profileId: req.userContext.profileId,
      userContext: req.userContext,
    };
  }

  @Post()
  @RequirePermissions(['communication.delivery.manage'])
  @ApiOperation({ summary: 'Mint a permission-checked, expiring secure link' })
  async create(
    @Body() dto: CreateSecureLinkDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.links.create(tenantId, profileId, {
      purpose: dto.purpose,
      targetType: dto.targetType,
      targetId: dto.targetId,
      ttlSeconds: dto.ttlSeconds,
      requiredPermission: dto.requiredPermission,
      audiencePersonId: dto.audiencePersonId,
      audienceProfileId: dto.audienceProfileId,
      maxUses: dto.maxUses,
      metadata: dto.metadata,
    });
  }

  @Post(':token/redeem')
  @ApiOperation({ summary: 'Redeem a secure link (enforced per-link)' })
  async redeem(
    @Param('token') token: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId, userContext } = this.ctx(req);
    return this.links.redeem(tenantId, token, { userContext, profileId });
  }

  @Delete(':id')
  @RequirePermissions(['communication.delivery.manage'])
  @ApiOperation({ summary: 'Revoke a secure link' })
  async revoke(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, profileId } = this.ctx(req);
    return this.links.revoke(tenantId, id, profileId);
  }
}
