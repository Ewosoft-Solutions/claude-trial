import { Global, Module } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@workspace/database';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
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

        // Create PostgreSQL adapter for Prisma v7
        const { Pool } = pg;
        const pool = new Pool({ connectionString: envConfig.DATABASE_URL });
        const adapter = new PrismaPg(pool);

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
          adapter,
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
