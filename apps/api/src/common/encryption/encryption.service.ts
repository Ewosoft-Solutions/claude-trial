/**
 * Encryption Service
 *
 * Provides encryption/decryption functionality for sensitive database fields.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Encrypted fields:
 * - JWT secrets (TenantJWTConfig.jwtSecret)
 * - MFA secrets (MFA configurations)
 * - Other sensitive data
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EnvConfig } from '../config/env.config';

/**
 * Encryption Service
 *
 * Handles encryption and decryption of sensitive data using AES-256-GCM.
 * The encryption key is stored in environment variables.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;
  private readonly envConfig?: EnvConfig;

  constructor(private readonly configService: ConfigService) {
    const envConfig: EnvConfig = this.configService.getOrThrow<EnvConfig>('env', {
      infer: true,
    });
    this.envConfig = envConfig;
    const key = envConfig?.ENCRYPTION_KEY;

    if (!key) {
      this.logger.warn(
        'ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION).',
      );
      // Default key for development only - MUST be set in production
      // For development, use a fixed key derived from a constant
      const defaultKey = 'default-development-key-change-in-production';
      this.encryptionKey = crypto
        .createHash('sha256')
        .update(defaultKey)
        .digest();
    } else {
      // For production, prefer base64-encoded 32-byte keys; otherwise hash to 32 bytes
      const decodedKey = Buffer.from(key, 'base64');
      if (decodedKey.length === this.keyLength) {
        this.encryptionKey = decodedKey;
      } else {
        // Fallback: hash any other key input to derive a 32-byte key
        this.encryptionKey = crypto.createHash('sha256').update(key).digest();
      }
    }
  }

  /**
   * Encrypt sensitive data
   *
   * Uses AES-256-GCM for authenticated encryption.
   * Returns base64-encoded string containing: iv + tag + encryptedData
   *
   * @param plaintext - Plain text data to encrypt
   * @returns Encrypted data (base64 encoded)
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
        {
          authTagLength: this.tagLength,
        },
      );

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine IV + tag + encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'base64'),
      ]);

      return combined.toString('base64');
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   *
   * Decrypts data encrypted with encrypt() method.
   *
   * @param encryptedData - Encrypted data (base64 encoded)
   * @returns Decrypted plain text data
   * @throws Error if decryption fails or authentication tag is invalid
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const tag = combined.subarray(
        this.ivLength,
        this.ivLength + this.tagLength,
      );
      const encrypted = combined.subarray(this.ivLength + this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
        {
          authTagLength: this.tagLength,
        },
      );

      // Set authentication tag
      decipher.setAuthTag(tag);

      // Decrypt data
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data - invalid or corrupted data');
    }
  }

  /**
   * Encrypt data for database storage
   *
   * Wrapper around encrypt() for database fields.
   *
   * @param plaintext - Plain text data
   * @returns Encrypted data ready for database storage
   */
  encryptForStorage(plaintext: string): string {
    return this.encrypt(plaintext);
  }

  /**
   * Decrypt data from database storage
   *
   * Wrapper around decrypt() for database fields.
   *
   * @param encryptedData - Encrypted data from database
   * @returns Decrypted plain text data
   */
  decryptFromStorage(encryptedData: string): string {
    return this.decrypt(encryptedData);
  }

  /**
   * Check if encryption is properly configured
   *
   * @returns True if encryption key is set (not using default)
   */
  isProperlyConfigured(): boolean {
    return !!this.envConfig?.ENCRYPTION_KEY;
  }
}
