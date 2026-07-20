/**
 * Tenant feature toggles for the *current* tenant (Settings › Modules).
 *
 * Reads/writes the on/off state of optional operational modules for the
 * signed-in admin's own school. Read is gated on `settings.view`, write on
 * `settings.features`. Distinct from the platform-facing tenant management
 * endpoints, which act on an arbitrary `:tenantId`.
 */
import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import type { AuthenticatedRequest } from 'src/auth';
import { TenantConfigurationService } from '../services/tenant-configuration.service';
import { UpdateFeaturesDto } from '../dto/tenant-features.dto';

@ApiTags(SwaggerTags.tenant.name)
@Controller('tenant/features')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class TenantFeaturesController {
  constructor(private readonly configService: TenantConfigurationService) {}

  @Get()
  @RequirePermissions(['settings.view'])
  @ApiOperation({ summary: 'Get the current tenant feature toggles' })
  async getFeatures(@Request() req: AuthenticatedRequest) {
    const features = await this.configService.getFeatures(req.user!.tenantId);
    return { features };
  }

  @Patch()
  @RequirePermissions(['settings.features'])
  @ApiOperation({ summary: 'Update the current tenant feature toggles' })
  async updateFeatures(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateFeaturesDto,
  ) {
    const features = await this.configService.updateFeatures(
      req.user!.tenantId,
      dto.features,
      req.user!.userId,
    );
    return { features };
  }
}
