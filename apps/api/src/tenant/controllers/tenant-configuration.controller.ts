import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionMode } from '@workspace/api';

import type { AuthenticatedRequest } from '../../auth';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { SwaggerTags } from '../../common/swagger-tags';
import { UpdateTenantConfigurationDto } from '../dto';
import { TenantConfigurationService } from '../services/tenant-configuration.service';

/** School-facing configuration for the signed-in user's active tenant. */
@ApiTags(SwaggerTags.tenant.name)
@Controller('tenant/configuration')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class TenantConfigurationController {
  constructor(
    private readonly configurationService: TenantConfigurationService,
  ) {}

  @Get()
  @RequirePermissions(['settings.view', 'settings.school'], PermissionMode.ANY)
  @ApiOperation({ summary: 'Get the active school configuration' })
  getConfiguration(@Request() req: AuthenticatedRequest) {
    return this.configurationService.getTenantConfiguration(req.user!.tenantId);
  }

  @Put()
  @RequirePermissions(['settings.school'])
  @ApiOperation({ summary: 'Update the active school configuration' })
  updateConfiguration(
    @Request() req: AuthenticatedRequest,
    @Body() data: UpdateTenantConfigurationDto,
  ) {
    return this.configurationService.updateTenantConfiguration(
      req.user!.tenantId,
      data,
      req.user!.userId,
    );
  }
}
