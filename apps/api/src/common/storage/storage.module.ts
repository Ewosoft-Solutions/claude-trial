import { Module } from '@nestjs/common';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { STORAGE_PROVIDER } from './storage.types';

/**
 * Binds the StorageProvider port to its configured implementation.
 * Only local disk exists today; an S3-compatible provider slots in here
 * later (env-selected) without touching call sites.
 */
@Module({
  providers: [
    LocalDiskStorageService,
    { provide: STORAGE_PROVIDER, useExisting: LocalDiskStorageService },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
