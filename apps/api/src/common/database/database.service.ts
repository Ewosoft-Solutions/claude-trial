import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  OnApplicationShutdown,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@workspace/database';
import { EnvConfig } from '../config/env.config';

/**
 * Injection token for PrismaClient
 * Using a string token to avoid TypeScript export resolution issues
 */
export const PRISMA_CLIENT_TOKEN = 'PrismaClient';

/**
 * Injection token for the tenant-scoped PrismaClient that connects as the
 * restricted `app_runtime` role (RLS-enforcing). Used by `TenantDbService`.
 * Falls back to the privileged connection when `APP_RUNTIME_DATABASE_URL` is
 * unset (pre-cutover; RLS bypassed, no regression).
 */
export const TENANT_PRISMA_CLIENT_TOKEN = 'TenantPrismaClient';

/**
 * Database Service
 *
 * Manages Prisma client lifecycle and provides database utilities.
 *
 * Features:
 * - Connection management with retry logic
 * - Health check functionality
 * - Graceful shutdown handling
 * - Connection pooling management
 *
 * Note: This service uses composition instead of inheritance to ensure
 * only one PrismaClient instance exists (the one created by the factory).
 * This prevents multiple database connection pools and resource leaks.
 *
 * Previously, DatabaseService extended PrismaClient, which caused NestJS
 * to create a second PrismaClient instance when instantiating the service.
 * This resulted in two separate connection pools and potential resource leaks.
 * By injecting the factory-created PrismaClient, we ensure a single instance.
 */
@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly envConfig: EnvConfig;
  private connectionRetries = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000; // 2 seconds

  constructor(
    @Inject(PRISMA_CLIENT_TOKEN)
    public readonly client: PrismaClient,
    private readonly configService: ConfigService,
  ) {
    const config: EnvConfig = this.configService.getOrThrow<EnvConfig>('env', {
      infer: true,
    });

    this.envConfig = config;
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private disconnected = false;

  private async safeDisconnect() {
    if (this.disconnected) return;
    this.disconnected = true;
    await this.client.$disconnect();
  }

  async onModuleDestroy() {
    await this.safeDisconnect();
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutdown signal: ${signal}`);
    await this.safeDisconnect();
    this.logger.log('Database connection closed gracefully');
  }

  /**
   * Connect to database with retry logic
   *
   * Attempts to connect to the database with exponential backoff retry.
   * This is useful for handling transient connection issues during startup.
   */
  private async connectWithRetry(): Promise<void> {
    try {
      await this.client.$connect();
      this.logger.log('Database connection established successfully');
      this.connectionRetries = 0;
    } catch (error) {
      this.connectionRetries++;
      const errorDetails =
        error instanceof Error
          ? `${error.message}\n${error.stack}`
          : String(error);
      this.logger.error(
        `Database connection attempt ${this.connectionRetries} failed`,
        errorDetails,
      );

      if (this.connectionRetries >= this.maxRetries) {
        this.logger.error(
          `Failed to connect to database after ${this.maxRetries} attempts`,
        );
        // CRITICAL: Crash the app if DB can't connect
        // Let orchestrator (K8s, PM2, etc.) restart it
        this.logger.error(
          'Application will exit due to database connection failure',
        );
        process.exit(1);
      }

      this.logger.warn(
        `Database connection attempt ${this.connectionRetries}/${this.maxRetries} failed. Retrying in ${this.retryDelay}ms...`,
      );

      await this.delay(this.retryDelay * this.connectionRetries);
      return this.connectWithRetry();
    }
  }

  /**
   * Health check for database connection
   *
   * @returns True if database is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get database connection status
   *
   * @returns Connection status information
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    poolSize: { min: number; max: number };
    timeout: number;
  }> {
    const isConnected = await this.healthCheck();

    return {
      connected: isConnected,
      poolSize: {
        min: this.envConfig.DB_POOL_MIN,
        max: this.envConfig.DB_POOL_MAX,
      },
      timeout: this.envConfig.DB_CONNECTION_TIMEOUT,
    };
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
