import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { getEnvConfig } from '../config/env.config';

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
 */
@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly envConfig = getEnvConfig();
  private connectionRetries = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 2000; // 2 seconds

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Application shutdown signal: ${signal}`);
    await this.$disconnect();
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
      await this.$connect();
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
      await this.$queryRaw`SELECT 1`;
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
