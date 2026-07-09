import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';
import { EncryptionModule } from './encryption/encryption.module';
import { QueueService } from './queue/queue.service';
import { StorageModule } from './storage/storage.module';
import { AcademicsAccessService } from './academics/academics-access.service';

/**
 * Common Module
 *
 * Global module providing shared services and utilities.
 * This module is imported globally to make common services available
 * throughout the application.
 */
@Global()
@Module({
  imports: [DatabaseModule, LoggerModule, EncryptionModule, StorageModule],
  providers: [QueueService, AcademicsAccessService],
  exports: [
    DatabaseModule,
    LoggerModule,
    EncryptionModule,
    QueueService,
    StorageModule,
    AcademicsAccessService,
  ],
})
export class CommonModule {}
