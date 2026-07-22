import { Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';
import { PlatformRiskService } from '../services/platform-risk.service';
import type { PlatformTool } from './platform-ai-tool.types';

/**
 * Platform AI tool registry.
 *
 * Every tool reads ONLY an aggregate service and declares the facet it needs.
 * Each `execute` opens its own short `runPlatform` scope — the RLS scope must
 * never span an LLM round-trip (the tenant analytics chat learned this: a scope
 * is a 15s interactive transaction), so the chat loop holds no scope and each
 * tool unit-of-work scopes itself.
 */
@Injectable()
export class PlatformAiToolsService {
  private readonly tools: PlatformTool[];

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly analytics: PlatformAnalyticsService,
    private readonly risk: PlatformRiskService,
  ) {
    this.tools = [
      {
        requiredFacet: 'platform.metrics',
        definition: {
          name: 'get_platform_totals',
          description:
            'Platform-wide aggregate totals: number of schools, active schools, ' +
            'total students, active students, total user profiles, and a breakdown ' +
            'by institution type. Counts only — never individual records.',
          inputSchema: { type: 'object', properties: {} },
        },
        execute: async (_ctx) => {
          const a = await this.tenantDb.runPlatform(_ctx.userId, () =>
            this.analytics.getAnalytics(),
          );
          return { totals: a.totals, byType: a.byType };
        },
      },
      {
        requiredFacet: 'platform.metrics',
        definition: {
          name: 'get_tenant_metrics',
          description:
            'Per-school aggregate metrics across the platform: for each school, its ' +
            'status, student count, active-student count and profile count. ' +
            'Tenant-level aggregates only — no per-pupil data.',
          inputSchema: { type: 'object', properties: {} },
        },
        execute: async (ctx) => {
          const a = await this.tenantDb.runPlatform(ctx.userId, () =>
            this.analytics.getAnalytics(),
          );
          return { byTenant: a.byTenant };
        },
      },
      {
        requiredFacet: 'platform.metrics',
        definition: {
          name: 'get_at_risk_tenants',
          description:
            'Schools flagged as at-risk or misconfigured, with severity and the ' +
            'reasons (policy drift, stalled onboarding, dormancy, suspension).',
          inputSchema: { type: 'object', properties: {} },
        },
        execute: async (ctx) => {
          return this.tenantDb.runPlatform(ctx.userId, () => this.risk.assess());
        },
      },
    ];
  }

  list(): PlatformTool[] {
    return this.tools;
  }

  get(name: string): PlatformTool | undefined {
    return this.tools.find((t) => t.definition.name === name);
  }
}
