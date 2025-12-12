import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { ReportingAnalyticsService } from './services/reporting-analytics.service';
import { ReportingController } from './controllers/reporting.controller';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [ReportingController],
  providers: [ReportingAnalyticsService],
  exports: [ReportingAnalyticsService],
})
export class ReportingAnalyticsModule {}

