import { Global, Module } from '@nestjs/common';
import { PrismaClient, Prisma } from '@workspace/database';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { DatabaseService, PRISMA_CLIENT_TOKEN } from './database.service';
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
      provide: PRISMA_CLIENT_TOKEN,
      useFactory: () => {
        const envConfig = getEnvConfig();

        const { Pool } = pg;
        const pool = new Pool({
          connectionString: envConfig.DATABASE_URL,
        });

        const adapter = new PrismaPg(pool);

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
          log: logLevels.length ? logLevels : undefined,
          errorFormat:
            envConfig.NODE_ENV === 'development' ? 'pretty' : 'minimal',
        });
      },
    },
    DatabaseService,
  ],
  exports: [PRISMA_CLIENT_TOKEN, DatabaseService],
})
export class DatabaseModule {}

