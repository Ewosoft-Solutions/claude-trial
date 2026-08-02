import {
  Body,
  Controller,
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
import { CampaignService } from '../services/campaign.service';
import type { DeliveryCategory, DeliveryChannel } from '../delivery.types';
import { CreateCampaignDto, SendCampaignDto } from '../dto';

/**
 * Bulk campaign surface. Every recipient is routed through DeliveryService, so
 * consent/DND/quiet-hours + the ledger apply uniformly. Gated on
 * `communication.campaigns.manage` (clearance 7 — bulk reach is high-impact).
 */
@ApiTags('Communication · Campaigns')
@Controller('communication/campaigns')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user?.tenantId || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      profileId: req.userContext.profileId,
    };
  }

  @Post()
  @RequirePermissions(['communication.campaigns.manage'])
  @ApiOperation({ summary: 'Create a campaign (draft)' })
  create(@Body() dto: CreateCampaignDto, @Request() req: AuthenticatedRequest) {
    const { tenantId, profileId } = this.ctx(req);
    return this.campaigns.create(tenantId, profileId, {
      name: dto.name,
      channel: dto.channel as DeliveryChannel,
      category: dto.category as DeliveryCategory | undefined,
      audience: dto.audience,
    });
  }

  @Post(':id/send')
  @RequirePermissions(['communication.campaigns.manage'])
  @ApiOperation({ summary: 'Send a campaign to a resolved audience' })
  send(
    @Param('id') id: string,
    @Body() dto: SendCampaignDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.campaigns.send(tenantId, profileId, id, {
      recipientPersonIds: dto.recipientPersonIds,
      subject: dto.subject,
      body: dto.body,
      variables: dto.variables,
    });
  }
}
