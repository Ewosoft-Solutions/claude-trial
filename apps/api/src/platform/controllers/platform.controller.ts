import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClearanceLevelGuard } from '../../auth/guards/clearance-level.guard';
import { PlatformScoped } from '../../auth/decorators/platform-scoped.decorator';
import { PlatformOverviewService } from '../services/platform-overview.service';

/**
 * Platform Controller
 *
 * Cross-tenant platform-operator surfaces. Every handler is `@PlatformScoped`,
 * so it runs inside the audited `app.is_platform` scope and is permission-gated
 * and audited by `RlsPlatformInterceptor`.
 */
@ApiTags('Platform')
@Controller('platform')
@UseGuards(JwtAuthGuard, ClearanceLevelGuard)
@ApiBearerAuth('JWT-auth')
export class PlatformController {
  constructor(private readonly overview: PlatformOverviewService) {}

  /**
   * Tenant-health overview for the platform dashboard. Gated on the read facet
   * so a SuperAdmin support role gets the operational view, not just Architects.
   */
  @Get('overview')
  @PlatformScoped(['platform.tenants.read'])
  @ApiOperation({ summary: 'Cross-tenant health overview for the platform dashboard' })
  async getOverview() {
    return this.overview.getOverview();
  }
}
