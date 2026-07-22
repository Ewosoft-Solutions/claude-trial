/**
 * Encryption Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Logger } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';
import { EnvironmentConfig } from '../config/env.config';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  } as unknown as ConfigService;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Silence logger noise for negative-path tests in this suite
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Default mock config
    const defaultConfig = {
      ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long!!',
    } as Partial<EnvironmentConfig>;
    mockConfigService.get = jest.fn().mockReturnValue(defaultConfig);
    mockConfigService.getOrThrow = jest.fn().mockReturnValue(defaultConfig);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive-data-123';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different encrypted values for same input (IV randomness)', () => {
      const plaintext = 'same-input';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting invalid data', () => {
      expect(() => {
        service.decrypt('invalid-encrypted-data');
      }).toThrow('Failed to decrypt data');
    });

    it('should throw error when decrypting corrupted data', () => {
      const encrypted = service.encrypt('test');
      const corrupted = encrypted.slice(0, -10); // Remove last 10 chars

      expect(() => {
        service.decrypt(corrupted);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('encryptForStorage and decryptFromStorage', () => {
    it('should encrypt data for storage', () => {
      const plaintext = 'data-for-storage';
      const encrypted = service.encryptForStorage(plaintext);
      const decrypted = service.decryptFromStorage(encrypted);

      expect(encrypted).toBeDefined();
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('isProperlyConfigured', () => {
    it('should return true when encryption key is set', async () => {
      const value = {
        ENCRYPTION_KEY: 'valid-key',
      } as Partial<EnvironmentConfig>;
      mockConfigService.get = jest.fn().mockReturnValue(value);
      mockConfigService.getOrThrow = jest.fn().mockReturnValue(value);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const newService = module.get<EncryptionService>(EncryptionService);
      expect(newService.isProperlyConfigured()).toBe(true);
    });

    it('should return false when encryption key is not set', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);
      mockConfigService.getOrThrow = jest.fn().mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const newService = module.get<EncryptionService>(EncryptionService);
      expect(newService.isProperlyConfigured()).toBe(false);
    });
  });

  describe('enveloped field encryption', () => {
    it('round-trips a value through the envelope', () => {
      expect(service.decryptEnveloped(service.encryptEnveloped('O+'))).toBe('O+');
    });

    it('tags encrypted values so ciphertext is distinguishable from plaintext', () => {
      const enc = service.encryptEnveloped('peanut allergy');
      expect(enc?.startsWith('enc:v1:')).toBe(true);
      expect(service.isEnveloped(enc)).toBe(true);
      expect(enc).not.toContain('peanut');
    });

    it('passes legacy plaintext through decryption unchanged (migration-safe)', () => {
      // A value written before encryption was enabled has no envelope; the read
      // path must return it as-is rather than throwing.
      expect(service.decryptEnveloped('legacy plaintext allergy')).toBe(
        'legacy plaintext allergy',
      );
      expect(service.isEnveloped('legacy plaintext allergy')).toBe(false);
    });

    it('preserves null / undefined (absent values stay queryable as NULL)', () => {
      expect(service.encryptEnveloped(null)).toBeNull();
      expect(service.encryptEnveloped(undefined)).toBeNull();
      expect(service.decryptEnveloped(null)).toBeNull();
    });

    it('decrypts a value produced by the backfill script wire format', () => {
      // Guard against drift between EncryptionService and the standalone
      // backfill script (packages/database .../backfill-health-encryption.ts),
      // which duplicates this layout because it cannot import the Nest service.
      // Build ciphertext exactly as the script does — iv + tag + ciphertext,
      // base64, `enc:v1:` prefix — with the same key the test service uses.
      const crypto = require('node:crypto') as typeof import('node:crypto');
      // The service hashes a non-base64 key to 32 bytes; mirror that so the keys
      // match (see EncryptionService dev-key handling).
      const derivedKey = crypto
        .createHash('sha256')
        .update('test-encryption-key-32-bytes-long!!')
        .digest();

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
      const enc = Buffer.concat([
        cipher.update('penicillin', 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      const wire =
        'enc:v1:' +
        Buffer.concat([iv, tag, enc]).toString('base64');

      expect(service.decryptEnveloped(wire)).toBe('penicillin');
    });
  });

  describe('production key enforcement', () => {
    // A silently-weak key is worse than no encryption: pupil health data would
    // be encrypted under something an attacker can reproduce, while logs and
    // health checks report success. Production must refuse to start instead.
    async function buildWith(config: Partial<EnvironmentConfig>) {
      mockConfigService.get = jest.fn().mockReturnValue(config);
      mockConfigService.getOrThrow = jest.fn().mockReturnValue(config);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      return module.get<EncryptionService>(EncryptionService);
    }

    const validKey = Buffer.alloc(32, 7).toString('base64');

    it('refuses to start in production without a key', async () => {
      await expect(
        buildWith({ NODE_ENV: 'production' } as Partial<EnvironmentConfig>),
      ).rejects.toThrow(/ENCRYPTION_KEY is required in production/);
    });

    it('refuses to start in production with a stretched short key', async () => {
      // Previously "password" was silently hashed to 32 bytes and accepted.
      await expect(
        buildWith({
          NODE_ENV: 'production',
          ENCRYPTION_KEY: 'password',
        } as Partial<EnvironmentConfig>),
      ).rejects.toThrow(/must be exactly 32 bytes/);
    });

    it('starts in production with a valid 32-byte base64 key', async () => {
      const svc = await buildWith({
        NODE_ENV: 'production',
        ENCRYPTION_KEY: validKey,
      } as Partial<EnvironmentConfig>);
      expect(svc.decrypt(svc.encrypt('pupil-health'))).toBe('pupil-health');
    });

    it('still allows the development fallback outside production', async () => {
      const svc = await buildWith({
        NODE_ENV: 'development',
      } as Partial<EnvironmentConfig>);
      expect(svc.decrypt(svc.encrypt('test-data'))).toBe('test-data');
    });
  });

  describe('encryption key handling', () => {
    it('should use default key when ENCRYPTION_KEY is not set', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);
      mockConfigService.getOrThrow = jest.fn().mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const newService = module.get<EncryptionService>(EncryptionService);
      const plaintext = 'test-data';
      const encrypted = newService.encrypt(plaintext);
      const decrypted = newService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle base64-encoded key', async () => {
      const base64Key = Buffer.from('test-key-32-bytes-long!!').toString(
        'base64',
      );
      mockConfigService.get = jest.fn().mockReturnValue({
        ENCRYPTION_KEY: base64Key,
      } as Partial<EnvironmentConfig>);
      mockConfigService.getOrThrow = jest.fn().mockReturnValue({
        ENCRYPTION_KEY: base64Key,
      } as Partial<EnvironmentConfig>);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const newService = module.get<EncryptionService>(EncryptionService);
      const plaintext = 'test-data';
      const encrypted = newService.encrypt(plaintext);
      const decrypted = newService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
