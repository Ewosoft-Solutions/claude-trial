import { Global, Module } from '@nestjs/common';
import { PrismaClient, Prisma } from '@workspace/database';
import { DatabaseService } from './database.service';
import { getEnvConfig } from '../config/env.config';

/**
 * Database Module
 *
 * Provides Prisma client instance and database-related services.
 * This module is global to make database services available throughout the app.
 *
 * Features:
 * - Connection pooling configuration
 * - Environment-based logging
 * - Error handling and retry logic
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        const envConfig = getEnvConfig();

        // Prisma handles connection pooling automatically via the connection string
        // Connection pooling can be configured via DATABASE_URL parameters:
        // - Use a connection pooler (PgBouncer) in the connection string
        // - Or configure PostgreSQL connection limits in the database
        // The DB_POOL_MIN, DB_POOL_MAX, and DB_CONNECTION_TIMEOUT env vars
        // are available for documentation and future use with custom poolers

        // Configure logging based on environment
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

        return new PrismaClient({
          datasources: {
            db: {
              url: envConfig.DATABASE_URL,
            },
          },
          log: logLevels.length > 0 ? logLevels : undefined,
          errorFormat:
            envConfig.NODE_ENV === 'development' ? 'pretty' : 'minimal',
        });
      },
    },
    DatabaseService,
  ],
  exports: [PrismaClient, DatabaseService],
})
export class DatabaseModule {}
