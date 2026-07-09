/**
 * AI Module
 *
 * Shared plumbing for both AI systems (Analytics AI and the Academic AI
 * tutor — see docs/ai-integration-plan.md). Owns the access-control front
 * door (AIMediatorService, moved here from auth/), the Anthropic SDK
 * wrapper (AnthropicService — the only file that imports the SDK, first
 * LlmProvider implementation), and the Step 2 Analytics AI backend
 * (tool set, manual tool loop, SSE chat endpoint).
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EventsModule } from '../events/events.module';
import { FinanceModule } from '../finance/finance.module';
import { ParentPortalModule } from '../parent-portal/parent-portal.module';
import { ReportingAnalyticsModule } from '../reporting-analytics/reporting-analytics.module';
import { StudentModule } from '../student/student.module';
import { aiConfig } from './config/ai.config';
import { AiHealthController } from './controllers/ai-health.controller';
import { AiAnalyticsController } from './controllers/ai-analytics.controller';
import { AiAdminController } from './controllers/ai-admin.controller';
import { AIMediatorService } from './services/ai-mediator.service';
import { AnthropicService } from './services/anthropic.service';
import { AiThrottleService } from './services/ai-throttle.service';
import { AiUsageService } from './services/ai-usage.service';
import { AnalyticsChatService } from './services/analytics-chat.service';
import { AnalyticsToolsService } from './tools/analytics-tools.service';
import { LlmProviderFactory } from './llm/llm-provider.factory';
import { EMBEDDINGS_PROVIDER } from './embeddings/embeddings.types';
import { VoyageEmbeddingsService } from './embeddings/voyage-embeddings.service';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    ConfigModule.forFeature(aiConfig),
    AttendanceModule,
    EventsModule,
    FinanceModule,
    ParentPortalModule,
    ReportingAnalyticsModule,
    StudentModule,
  ],
  controllers: [AiHealthController, AiAnalyticsController, AiAdminController],
  providers: [
    AIMediatorService,
    AnthropicService,
    AiThrottleService,
    AiUsageService,
    AnalyticsToolsService,
    AnalyticsChatService,
    LlmProviderFactory,
    VoyageEmbeddingsService,
    { provide: EMBEDDINGS_PROVIDER, useExisting: VoyageEmbeddingsService },
  ],
  exports: [
    AIMediatorService,
    AnthropicService,
    AiThrottleService,
    AiUsageService,
    LlmProviderFactory,
    EMBEDDINGS_PROVIDER,
  ],
})
export class AiModule {}
