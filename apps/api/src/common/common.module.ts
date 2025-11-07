import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';

/**
 * Common Module
 *
 * Global module providing shared services and utilities.
 * This module is imported globally to make common services available
 * throughout the application.
 */
@Global()
@Module({
  imports: [DatabaseModule, LoggerModule],
  exports: [DatabaseModule, LoggerModule],
})
export class CommonModule {}
