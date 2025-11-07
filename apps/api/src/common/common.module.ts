import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';
import { EncryptionModule } from './encryption/encryption.module';

/**
 * Common Module
 *
 * Global module providing shared services and utilities.
 * This module is imported globally to make common services available
 * throughout the application.
 */
@Global()
@Module({
  imports: [DatabaseModule, LoggerModule, EncryptionModule],
  exports: [DatabaseModule, LoggerModule, EncryptionModule],
})
export class CommonModule {}
