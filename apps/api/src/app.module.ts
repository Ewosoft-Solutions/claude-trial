import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RlsTenantInterceptor } from './common/database/rls-tenant.interceptor';
import {
  envConfig,
  envValidationSchema,
  EnvConfig,
} from './common/config/env.config';

import { CommonModule } from './common';
import { LinksModule } from './links/links.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { StudentModule } from './student/student.module';
import { AcademicStructureModule } from './academic-structure/academic-structure.module';
import { AssessmentGradingModule } from './assessment-grading/assessment-grading.module';
import { CommunicationModule } from './communication/communication.module';
import { ReportingAnalyticsModule } from './reporting-analytics/reporting-analytics.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FinanceModule } from './finance/finance.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { TransportModule } from './transport/transport.module';
import { LibraryModule } from './library/library.module';
import { HealthModule } from './health/health.module';
import { HrModule } from './hr/hr.module';
import { EventsModule } from './events/events.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { RequestLoggerMiddleware } from './common/middleware';
import { DatabaseModule } from './common/database/database.module';
import { Prisma } from '@workspace/database';

import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
      },
    }),
    // Database module with async configuration
    DatabaseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const envConfig: EnvConfig = configService.getOrThrow<EnvConfig>('env', {
          infer: true,
        });

        const logLevels: Prisma.LogLevel[] = [];
        if (envConfig.DB_LOG_QUERIES && envConfig.NODE_ENV === 'development') {
          logLevels.push('query');
        }
        if (envConfig.DB_LOG_ERRORS) {
          logLevels.push('error');
        }
        if (envConfig.DB_LOG_WARNINGS) {
          logLevels.push('warn');
        }
        if (envConfig.NODE_ENV === 'development') {
          logLevels.push('info');
        }

        return {
          databaseUrl: envConfig.DATABASE_URL,
          tenantDatabaseUrl: envConfig.APP_RUNTIME_DATABASE_URL,
          poolMin: envConfig.DB_POOL_MIN,
          poolMax: envConfig.DB_POOL_MAX,
          connectionTimeout: envConfig.DB_CONNECTION_TIMEOUT,
          queryTimeout: envConfig.DB_QUERY_TIMEOUT,
          logLevels,
          errorFormat:
            envConfig.NODE_ENV === 'development' ? 'pretty' : 'minimal',
          isServerless: process.env.IS_SERVERLESS === 'true',
        };
      },
      inject: [ConfigService],
    }),
    CommonModule,
    LinksModule,
    AuthModule,
    TenantModule,
    StudentModule,
    AcademicStructureModule,
    AssessmentGradingModule,
    CommunicationModule,
    ReportingAnalyticsModule,
    AttendanceModule,
    FinanceModule,
    AdmissionsModule,
    TransportModule,
    LibraryModule,
    HealthModule,
    HrModule,
    EventsModule,
    ParentPortalModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Opens the per-request RLS scope for @TenantScoped handlers (no-op otherwise).
    { provide: APP_INTERCEPTOR, useClass: RlsTenantInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware to all routes
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
