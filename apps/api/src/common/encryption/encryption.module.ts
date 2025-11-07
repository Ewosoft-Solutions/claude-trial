import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * Encryption Module
 *
 * Provides encryption/decryption services for sensitive data.
 * This module is global to make encryption services available throughout the app.
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
