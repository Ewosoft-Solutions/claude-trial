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
import { EnvConfigService } from '../config/env.config';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const mockEnvConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  } as unknown as EnvConfigService;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Silence logger noise for negative-path tests in this suite
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Default mock config
    mockEnvConfigService.get = jest
      .fn()
      .mockReturnValue('test-encryption-key-32-bytes-long!!');
    mockEnvConfigService.getOrThrow = jest
      .fn()
      .mockReturnValue('test-encryption-key-32-bytes-long!!');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: EnvConfigService, useValue: mockEnvConfigService },
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
      mockEnvConfigService.get = jest.fn().mockReturnValue('valid-key');
      mockEnvConfigService.getOrThrow = jest.fn().mockReturnValue('valid-key');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: EnvConfigService, useValue: mockEnvConfigService },
        ],
      }).compile();

      const newService = module.get<EncryptionService>(EncryptionService);
      expect(newService.isProperlyConfigured()).toBe(true);
    });

    it('should return false when encryption key is not set', async () => {
      mockEnvConfigService.get = jest.fn().mockReturnValue(undefined);
      mockEnvConfigService.getOrThrow = jest.fn().mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: EnvConfigService, useValue: mockEnvConfigService },
        ],
      }).compile();

      const newService = module.get<EncryptionService>(EncryptionService);
      expect(newService.isProperlyConfigured()).toBe(false);
    });
  });

  describe('encryption key handling', () => {
    it('should use default key when ENCRYPTION_KEY is not set', async () => {
      mockEnvConfigService.get = jest.fn().mockReturnValue(undefined);
      mockEnvConfigService.getOrThrow = jest.fn().mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: EnvConfigService, useValue: mockEnvConfigService },
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
      mockEnvConfigService.get = jest.fn().mockReturnValue(base64Key);
      mockEnvConfigService.getOrThrow = jest.fn().mockReturnValue(base64Key);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: EnvConfigService, useValue: mockEnvConfigService },
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
