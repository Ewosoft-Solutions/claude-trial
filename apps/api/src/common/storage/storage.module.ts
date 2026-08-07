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
    {
      provide: STORAGE_PROVIDER,
      // R2StorageService is constructed here (not a DI provider) so Nest never
      // tries to inject its `env` constructor arg; it reads process.env itself.
      useFactory: (local: LocalDiskStorageService): StorageProvider => {
        const provider = R2StorageService.isConfigured()
          ? new R2StorageService()
          : local;
        new Logger('StorageModule').log(
          `Document storage provider: ${provider.providerName}`,
        );
        return provider;
      },
      inject: [LocalDiskStorageService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
