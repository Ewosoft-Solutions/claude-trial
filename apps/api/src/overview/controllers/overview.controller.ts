import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { OverviewService } from '../services/overview.service';
import type { AuthenticatedRequest } from '../../auth';

/**
 * Overview Controller
 *
 * The signed-in user's home dashboard data. Available to every authenticated
 * tenant user (no extra permission) — each role's UI selects which slices to
 * render from the same tenant-scoped snapshot.
 */
@ApiTags('Overview')
@Controller('overview')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Real tenant-scoped dashboard stats' })
  async stats(@Request() req: AuthenticatedRequest) {
    const user = req.user;
    return this.overviewService.getStats(user.tenantId, user.profileId);
  }
}
