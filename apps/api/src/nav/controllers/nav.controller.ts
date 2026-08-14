import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { NavCountsService } from '../services/nav-counts.service';
import type { AuthenticatedRequest } from '../../auth';

/**
 * Nav Controller
 *
 * Lean, tenant-scoped counts for the sidebar badges. Available to every
 * authenticated tenant user (the nav is universal); the web layer maps these
 * figures onto destinations and gates which badges a viewer actually sees.
 */
@ApiTags('Nav')
@Controller('nav')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class NavController {
  constructor(private readonly navCountsService: NavCountsService) {}

  @Get('counts')
  @ApiOperation({ summary: 'Actionable counts for the sidebar badges' })
  async counts(@Request() req: AuthenticatedRequest) {
    return this.navCountsService.getCounts(req.user.tenantId);
  }
}
