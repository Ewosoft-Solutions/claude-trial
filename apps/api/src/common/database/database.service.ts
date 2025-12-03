import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  OnApplicationShutdown,
  Inject,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - PrismaClient is exported from @workspace/database via re-export
import type { PrismaClient } from '@workspace/database';
import { getEnvConfig } from '../config/env.config';

/**
 * Injection token for PrismaClient
 * Using a string token to avoid TypeScript export resolution issues
 */
export const PRISMA_CLIENT_TOKEN = 'PrismaClient';

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
  private readonly envConfig = getEnvConfig();
  private connectionRetries = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000; // 2 seconds

  constructor(
    @Inject(PRISMA_CLIENT_TOKEN)
    public readonly client: PrismaClient,
  ) {}

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutdown signal: ${signal}`);
    await this.client.$disconnect();
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

      if (this.connectionRetries >= this.maxRetries) {
        this.logger.error(
          `Failed to connect to database after ${this.maxRetries} attempts`,
        );
        throw error;
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
