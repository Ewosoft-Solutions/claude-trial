import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

import { CommonModule } from './common';
import { LinksModule } from './links/links.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { StudentModule } from './student/student.module';
import { AcademicStructureModule } from './academic-structure/academic-structure.module';
import { AssessmentGradingModule } from './assessment-grading/assessment-grading.module';
import { CommunicationModule } from './communication/communication.module';
import { RequestLoggerMiddleware } from './common/middleware';
import { DatabaseModule } from './common/database/database.module';
import { getEnvConfig } from './common/config/env.config';
import { Prisma } from '@workspace/database';

import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Database module with async configuration
    DatabaseModule.forRootAsync({
      useFactory: () => {
        const envConfig = getEnvConfig();

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
    }),
    CommonModule,
    LinksModule,
    AuthModule,
    TenantModule,
    StudentModule,
    AcademicStructureModule,
    AssessmentGradingModule,
    CommunicationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware to all routes
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
