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
    const isProduction = envConfig?.NODE_ENV === 'production';

    // Fail closed in production. Both branches below are development
    // conveniences that silently weaken the key — a missing key falls back to a
    // constant derived from source, and a short key is stretched by hashing so
    // that "password" appears to work. Either would leave real pupil data
    // encrypted under something an attacker can reproduce, while every log line
    // and health check reports success. Config validation (env.config.ts) also
    // requires the key in production; this is the second lock on the same door.
    if (isProduction) {
      if (!key) {
        throw new Error(
          'ENCRYPTION_KEY is required in production. Generate one with ' +
            '`openssl rand -base64 32`. Refusing to start with a development key.',
        );
      }
      const decoded = Buffer.from(key, 'base64');
      if (decoded.length !== this.keyLength) {
        throw new Error(
          `ENCRYPTION_KEY must be exactly ${this.keyLength} bytes, base64-encoded ` +
            `(got ${decoded.length}). Generate one with \`openssl rand -base64 32\`. ` +
            'Refusing to start with a stretched or truncated key.',
        );
      }
      this.encryptionKey = decoded;
      return;
    }

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
      // Prefer base64-encoded 32-byte keys; otherwise hash to 32 bytes so that
      // local/test setups can use an arbitrary string. Development only —
      // production takes the strict path above.
      const decodedKey = Buffer.from(key, 'base64');
      if (decodedKey.length === this.keyLength) {
        this.encryptionKey = decodedKey;
      } else {
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
   * Envelope prefix marking a value this service encrypted. Lets a read path
   * distinguish ciphertext from legacy plaintext during a field-by-field
   * migration, so decryption is only attempted on values we actually encrypted.
   */
  private readonly envelopePrefix = 'enc:v1:';

  /**
   * Encrypt a nullable field value for at-rest storage, tagged with the
   * envelope prefix. `null`/`undefined` pass through unchanged (an absent value
   * has nothing to hide and must stay queryable as NULL).
   */
  encryptEnveloped(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined) return null;
    return this.envelopePrefix + this.encrypt(plaintext);
  }

  /**
   * Inverse of `encryptEnveloped`. A value without the prefix is returned
   * unchanged — it is legacy plaintext that predates encryption (or is mid
   * backfill). This is what makes turning encryption on non-breaking; the
   * backfill script then rewrites those rows so the prefix becomes universal.
   */
  decryptEnveloped(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (!value.startsWith(this.envelopePrefix)) return value;
    return this.decrypt(value.slice(this.envelopePrefix.length));
  }

  /** Whether a stored value carries the encryption envelope. */
  isEnveloped(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith(this.envelopePrefix);
  }

  /**
   * Keyed one-way digest, for **blind indexes**.
   *
   * `encrypt()` uses a random IV, so the same plaintext yields different
   * ciphertext every time — which is what you want for confidentiality and what
   * makes encrypted columns unsearchable. This gives the opposite property on
   * purpose: the same input always produces the same digest, so equal values can
   * be matched in SQL without the database ever holding the plaintext.
   *
   * The trade-off is deliberate and bounded: an attacker with a database dump
   * sees which rows share a value, but cannot learn *which* value, because the
   * digest is keyed and they do not have the key. Only use this for low-entropy
   * values from a controlled vocabulary that must be searched — never as a
   * substitute for `encrypt()` on free text.
   *
   * `domain` separates uses so that the same input in two different features
   * never produces the same digest.
   *
   * @param value - Value to index (normalize before calling)
   * @param domain - Domain separator, e.g. 'health-flag'
   * @returns Hex-encoded HMAC-SHA256 digest
   */
  blindIndex(value: string, domain: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(`${domain}:${value}`)
      .digest('hex');
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
