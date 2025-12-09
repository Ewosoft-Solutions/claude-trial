import { Global, Module, DynamicModule, FactoryProvider } from '@nestjs/common';
import { PrismaClient, Prisma } from '@workspace/database';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { DatabaseService, PRISMA_CLIENT_TOKEN } from './database.service';
import { PrismaTransactionService } from './prisma-transaction.service';

/**
 * Database Module Options
 *
 * Configuration for database module initialization.
 */
export interface DatabaseModuleOptions {
  databaseUrl: string;
  poolMin?: number;
  poolMax?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  logLevels?: Prisma.LogLevel[];
  errorFormat?: 'pretty' | 'minimal' | 'colorless';
  isServerless?: boolean;
}

/**
 * Database Module
 *
 * Provides Prisma client instance and database-related services.
 * This module is global to make database services available throughout the app.
 *
 * Features:
 * - Connection pooling configuration (Kubernetes/serverless aware)
 * - Environment-based logging
 * - Error handling and retry logic
 * - Dynamic configuration via forRootAsync()
 * - Request-scoped transaction service
 */
@Global()
@Module({})
export class DatabaseModule {
  /**
   * Configure database module asynchronously
   *
   * This pattern allows:
   * - Dependency injection of config
   * - Test-friendly mock configurations
   * - Environment-specific settings
   * - Better separation of concerns
   */
  static forRootAsync(options: {
    useFactory: (
      ...args: Parameters<FactoryProvider['useFactory']>
    ) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: FactoryProvider['inject'];
  }): DynamicModule {
    const prismaProvider = {
      provide: PRISMA_CLIENT_TOKEN,
      useFactory: async (...args: unknown[]): Promise<PrismaClient> => {
        const config = await options.useFactory(...args);

        const { Pool } = pg;

        // Serverless-aware pool configuration
        // For serverless: max=1-3, for Kubernetes: max=10-20
        const poolConfig: pg.PoolConfig = {
          connectionString: config.databaseUrl,
          min: config.poolMin ?? (config.isServerless ? 0 : 2),
          max: config.poolMax ?? (config.isServerless ? 1 : 10),
          idleTimeoutMillis: config.isServerless ? 10_000 : 30_000,
          connectionTimeoutMillis: config.connectionTimeout ?? 5_000,
          // Query timeout via statement_timeout
          statement_timeout: config.queryTimeout ?? 30_000,
        };

        const pool = new Pool(poolConfig);

        const adapter = new PrismaPg(pool);

        return new PrismaClient({
          adapter,
          log: config.logLevels?.length ? config.logLevels : undefined,
          errorFormat: config.errorFormat ?? 'minimal',
        });
      },
      inject: options.inject ?? [],
    };

    return {
      module: DatabaseModule,
      providers: [prismaProvider, DatabaseService, PrismaTransactionService],
      exports: [PRISMA_CLIENT_TOKEN, DatabaseService, PrismaTransactionService],
    };
  }

  /**
   * Legacy static configuration (for backward compatibility)
   * Prefer forRootAsync() for new code
   */
  static forRoot(): DynamicModule {
    // This will be used if you want to keep the old pattern temporarily
    // But you should migrate to forRootAsync()
    return DatabaseModule.forRootAsync({
      useFactory: () => {
        // Import here to avoid circular dependencies
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getEnvConfig } = require('../config/env.config');
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
    });
  }
}
