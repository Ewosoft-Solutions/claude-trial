import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClearanceLevelGuard } from '../../auth/guards/clearance-level.guard';
import { PlatformScoped } from '../../auth/decorators/platform-scoped.decorator';
import { PlatformOverviewService } from '../services/platform-overview.service';
import { PlatformAuditQueryService } from '../services/platform-audit-query.service';
import { PlatformPolicyService } from '../services/platform-policy.service';
import { PlatformAuditQueryDto } from '../dto/platform-audit-query.dto';

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
  constructor(
    private readonly overview: PlatformOverviewService,
    private readonly auditQuery: PlatformAuditQueryService,
    private readonly policies: PlatformPolicyService,
  ) {}

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

  /**
   * Cross-tenant audit log. The sanctioned platform audit path — gated on the
   * audit facet and audited by the interceptor, unlike the old clearance-9
   * branch on `/audit-logs` (removed).
   */
  @Get('audit')
  @PlatformScoped(['platform.audit', 'platform.audit.limited'])
  @ApiOperation({ summary: 'Query the audit trail across all tenants' })
  async getAudit(@Query() query: PlatformAuditQueryDto) {
    return this.auditQuery.query({
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  /**
   * Cross-tenant security-policy posture with drift against the platform
   * baseline. Gated on the security facet (Architect).
   */
  @Get('policies')
  @PlatformScoped(['platform.security'])
  @ApiOperation({ summary: 'Cross-tenant policy posture + baseline drift' })
  async getPolicies() {
    return this.policies.getPolicyOverview();
  }
}
