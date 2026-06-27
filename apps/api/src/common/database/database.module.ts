import { Global, Module, DynamicModule, FactoryProvider } from '@nestjs/common';
import { PrismaClient, Prisma } from '@workspace/database';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import {
  DatabaseService,
  PRISMA_CLIENT_TOKEN,
  TENANT_PRISMA_CLIENT_TOKEN,
} from './database.service';
import { PrismaTransactionService } from './prisma-transaction.service';
import { TenantDbService } from './tenant-db.service';

/**
 * Database Module Options
 *
 * Configuration for database module initialization.
 */
export interface DatabaseModuleOptions {
  databaseUrl: string;
  /**
   * Connection for the restricted `app_runtime` role (RLS-enforcing), used by
   * `TenantDbService`. Defaults to `databaseUrl` when unset (RLS bypassed).
   */
  tenantDatabaseUrl?: string;
  poolMin?: number;
  poolMax?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  logLevels?: Prisma.LogLevel[];
  errorFormat?: 'pretty' | 'minimal' | 'colorless';
  isServerless?: boolean;
}

/** Build a PrismaClient over a pg pool for the given connection string. */
function buildPrismaClient(
  connectionString: string,
  config: DatabaseModuleOptions,
): PrismaClient {
  const { Pool } = pg;
  const poolConfig: pg.PoolConfig = {
    connectionString,
    min: config.poolMin ?? (config.isServerless ? 0 : 2),
    max: config.poolMax ?? (config.isServerless ? 1 : 10),
    idleTimeoutMillis: config.isServerless ? 10_000 : 30_000,
    connectionTimeoutMillis: config.connectionTimeout ?? 5_000,
  };
  const adapter = new PrismaPg(new Pool(poolConfig));
  return new PrismaClient({
    adapter,
    log: config.logLevels?.length ? config.logLevels : undefined,
    errorFormat: config.errorFormat ?? 'minimal',
  });
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
        return buildPrismaClient(config.databaseUrl, config);
      },
      inject: options.inject ?? [],
    };

    // Tenant-scoped client (connects as `app_runtime` when configured) used by
    // TenantDbService so RLS enforces isolation at runtime. Falls back to the
    // privileged URL when APP_RUNTIME_DATABASE_URL is unset (pre-cutover).
    const tenantPrismaProvider = {
      provide: TENANT_PRISMA_CLIENT_TOKEN,
      useFactory: async (...args: unknown[]): Promise<PrismaClient> => {
        const config = await options.useFactory(...args);
        return buildPrismaClient(
          config.tenantDatabaseUrl ?? config.databaseUrl,
          config,
        );
      },
      inject: options.inject ?? [],
    };

    return {
      module: DatabaseModule,
      providers: [
        prismaProvider,
        tenantPrismaProvider,
        DatabaseService,
        PrismaTransactionService,
        TenantDbService,
      ],
      exports: [
        PRISMA_CLIENT_TOKEN,
        TENANT_PRISMA_CLIENT_TOKEN,
        DatabaseService,
        PrismaTransactionService,
        TenantDbService,
      ],
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
        const { loadEnvConfig } = require('../config/env.config');
        const envConfig = loadEnvConfig();

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
    });
  }
}
