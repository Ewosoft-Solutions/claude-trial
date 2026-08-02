import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Put,
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
import { ContactPreferenceService } from '../services/contact-preference.service';
import type { DeliveryChannel } from '../delivery.types';
import { SetContactPreferenceDto } from '../dto';

/**
 * Manage a Person's channel consent / DND / quiet hours. Gated on
 * `communication.preferences.manage` (managing someone else's consent is a
 * privileged action); self-service notification settings are a WB follow-up.
 */
@ApiTags('Communication · Preferences')
@Controller('communication/contact-preferences')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ContactPreferencesController {
  constructor(private readonly preferences: ContactPreferenceService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user?.tenantId || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      profileId: req.userContext.profileId,
    };
  }

  @Get(':personId')
  @RequirePermissions(['communication.preferences.manage'])
  @ApiOperation({ summary: "List a person's contact preferences" })
  list(
    @Param('personId') personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.preferences.list(tenantId, personId);
  }

  @Put(':personId')
  @RequirePermissions(['communication.preferences.manage'])
  @ApiOperation({ summary: 'Set a channel preference / consent for a person' })
  set(
    @Param('personId') personId: string,
    @Body() dto: SetContactPreferenceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.preferences.set(tenantId, personId, profileId, {
      channel: dto.channel as DeliveryChannel,
      optedIn: dto.optedIn,
      isDnd: dto.isDnd,
      consentSource: dto.consentSource,
      quietHoursStart: dto.quietHoursStart,
      quietHoursEnd: dto.quietHoursEnd,
    });
  }
}
