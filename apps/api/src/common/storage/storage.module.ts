import { Module, Logger } from '@nestjs/common';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { R2StorageService } from './r2-storage.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage.types';

/**
 * Binds the StorageProvider port to its configured implementation. Cloudflare
 * R2 (S3-compatible) is used whenever the four `R2_*` env vars are set; local
 * disk is the fallback for dev/CI. The selection happens once here — call sites
 * (DocumentService) only ever see the port.
 */
@Module({
  providers: [
    LocalDiskStorageService,
    R2StorageService,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        local: LocalDiskStorageService,
        r2: R2StorageService,
      ): StorageProvider => {
        const provider = R2StorageService.isConfigured() ? r2 : local;
        new Logger('StorageModule').log(
          `Document storage provider: ${provider.providerName}`,
        );
        return provider;
      },
      inject: [LocalDiskStorageService, R2StorageService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
