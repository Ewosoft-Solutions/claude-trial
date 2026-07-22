import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { aiConfig } from '../ai/config/ai.config';
import { PlatformController } from './controllers/platform.controller';
import { PlatformOverviewService } from './services/platform-overview.service';
import { PlatformAuditQueryService } from './services/platform-audit-query.service';
import { PlatformPolicyService } from './services/platform-policy.service';
import { PlatformAnalyticsService } from './services/platform-analytics.service';
import { PlatformRiskService } from './services/platform-risk.service';
import { PlatformAiToolsService } from './ai/platform-ai-tools.service';
import { PlatformAnalyticsChatService } from './ai/platform-analytics-chat.service';

/**
 * Platform Module
 *
 * Cross-tenant platform-operator features (the platform console's own APIs, as
 * distinct from the per-tenant management under TenantModule). Handlers here are
 * `@PlatformScoped` and read across tenants through the audited RLS scope.
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
    AiModule,
    ConfigModule.forFeature(aiConfig),
  ],
  controllers: [PlatformController],
  providers: [
    PlatformOverviewService,
    PlatformAuditQueryService,
    PlatformPolicyService,
    PlatformAnalyticsService,
    PlatformRiskService,
    PlatformAiToolsService,
    PlatformAnalyticsChatService,
  ],
  exports: [
    PlatformOverviewService,
    PlatformAuditQueryService,
    PlatformPolicyService,
    PlatformAnalyticsService,
    PlatformRiskService,
  ],
})
export class PlatformModule {}
