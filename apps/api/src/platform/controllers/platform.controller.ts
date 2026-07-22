import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../../auth/guards/clearance-level.guard';
import { PlatformScoped } from '../../auth/decorators/platform-scoped.decorator';
import { PLATFORM_MIN_CLEARANCE } from '../../auth/decorators/platform-scoped.decorator';
import type { AuthenticatedRequest } from '../../auth/middleware';
import { PlatformAnalyticsChatService } from '../ai/platform-analytics-chat.service';
import { PlatformAiQueryDto } from '../dto/platform-ai-query.dto';
import { PlatformOverviewService } from '../services/platform-overview.service';
import { PlatformAuditQueryService } from '../services/platform-audit-query.service';
import { PlatformPolicyService } from '../services/platform-policy.service';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';
import { PlatformRiskService } from '../services/platform-risk.service';
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
    private readonly analytics: PlatformAnalyticsService,
    private readonly risk: PlatformRiskService,
    private readonly aiChat: PlatformAnalyticsChatService,
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

  /**
   * Cross-tenant analytics — aggregate-only (counts/rates/distributions, never
   * per-person). Gated on the metrics facet (Architect). This is the surface
   * the platform AI reads.
   */
  @Get('analytics')
  @PlatformScoped(['platform.metrics'])
  @ApiOperation({ summary: 'Cross-tenant aggregate analytics' })
  async getAnalytics() {
    return this.analytics.getAnalytics();
  }

  /**
   * At-risk / misconfigured tenant detection — combines policy drift, stalled
   * onboarding, dormancy and suspension into per-tenant risk flags.
   */
  @Get('risk')
  @PlatformScoped(['platform.metrics'])
  @ApiOperation({ summary: 'At-risk / misconfigured tenant detection' })
  async getRisk() {
    return this.risk.assess();
  }

  /**
   * Platform AI assistant (3.2). Cross-tenant, aggregate-only, facet-gated.
   *
   * NOT `@PlatformScoped`: the AI tool loop must not hold an RLS scope across an
   * LLM round-trip, so each tool opens its own short scope. Gated at clearance 9
   * (populates userContext); the caller's own facets are passed to the chat
   * service, which checks each tool's facet at execution — a SuperAdmin without
   * `platform.metrics` is refused the metrics tools.
   */
  @Post('ai/query')
  @UseGuards(ClearanceLevelGuard)
  @RequireClearanceLevel(PLATFORM_MIN_CLEARANCE)
  @ApiOperation({ summary: 'Ask the platform AI assistant (aggregate-only)' })
  async aiQuery(
    @Body() body: PlatformAiQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ctx = req.userContext;
    const facets = new Set<string>();
    ctx?.permissions?.forEach((value, key) => {
      if (value.granted && key.startsWith('platform.')) facets.add(key);
    });
    return this.aiChat.query({
      userId: req.user.userId,
      facets,
      clearanceLevel: ctx?.clearanceLevel ?? 0,
      question: body.question,
    });
  }
}
