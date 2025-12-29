/**
 * Password Service Unit Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PasswordService, PasswordPolicy } from './password.service';
import { createMockContext } from '../../common/__tests__/test-utils';
import { PrismaClient } from '@workspace/database';
import { DeepMockProxy } from 'jest-mock-extended';

describe('PasswordService', () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockContext().prisma;
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPassword123';
      const hash = await PasswordService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'SamePassword123';
      const hash1 = await PasswordService.hashPassword(password);
      const hash2 = await PasswordService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'TestPassword123';
      const hash = await PasswordService.hashPassword(password);
      const matches = await PasswordService.comparePassword(password, hash);

      expect(matches).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword123';
      const hash = await PasswordService.hashPassword(password);
      const matches = await PasswordService.comparePassword(
        wrongPassword,
        hash,
      );

      expect(matches).toBe(false);
    });
  });

  describe('validatePasswordPolicy', () => {
    it('should validate password with default policy', () => {
      const validPassword = 'ValidPass123';
      const result = PasswordService.validatePasswordPolicy(validPassword);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const shortPassword = 'Short1';
      const result = PasswordService.validatePasswordPolicy(shortPassword);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const noUpper = 'lowercase123';
      const result = PasswordService.validatePasswordPolicy(noUpper);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase', () => {
      const noLower = 'UPPERCASE123';
      const result = PasswordService.validatePasswordPolicy(noLower);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('lowercase'))).toBe(true);
    });

    it('should reject password without numbers', () => {
      const noNumbers = 'NoNumbers';
      const result = PasswordService.validatePasswordPolicy(noNumbers);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('number'))).toBe(true);
    });

    it('should validate password with custom policy', () => {
      const customPolicy: PasswordPolicy = {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      };

      const validPassword = 'ValidPass123!@#';
      const result = PasswordService.validatePasswordPolicy(
        validPassword,
        customPolicy,
      );

      expect(result.valid).toBe(true);
    });

    it('should reject password that does not meet custom policy', () => {
      const customPolicy: PasswordPolicy = {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      };

      const invalidPassword = 'Short1';
      const result = PasswordService.validatePasswordPolicy(
        invalidPassword,
        customPolicy,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validatePasswordAgainstAllSchools', () => {
    it('should use default policy when user has no schools', async () => {
      mockPrisma.userTenant.findMany.mockResolvedValue([]);

      const password = 'ValidPass123';
      const result = await PasswordService.validatePasswordAgainstAllSchools(
        mockPrisma as PrismaClient,
        'user-id',
        password,
      );

      expect(result.valid).toBe(true);
      expect(mockPrisma.userTenant.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        include: {
          tenant: {},
        },
      });
    });

    it('should validate password when user has schools', async () => {
      mockPrisma.userTenant.findMany.mockResolvedValue([
        {
          userId: 'user-id',
          tenantId: 'tenant-id',
          id: 'user-tenant-id',
          status: 'active',
          suspended: false,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          invitationToken: null,
          invitationExpiresAt: null,
          invitationAcceptedAt: null,
          addedBy: null,
          addedAt: new Date(),
        },
      ]);

      const password = 'ValidPass123';
      const result = await PasswordService.validatePasswordAgainstAllSchools(
        mockPrisma as PrismaClient,
        'user-id',
        password,
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('checkPasswordReuse', () => {
    it('should return false when password is new', async () => {
      const newPassword = 'NewPass123';
      mockPrisma.passwordHistory.findMany.mockResolvedValue([
        {
          id: 'history-1',
          userId: 'user-id',
          passwordHash: await PasswordService.hashPassword('OldPass123'),
          createdAt: new Date(),
        },
      ]);

      const reused = await PasswordService.checkPasswordReuse(
        mockPrisma as PrismaClient,
        'user-id',
        newPassword,
        5,
      );

      expect(reused).toBe(false);
    });

    it('should return true when password was recently used', async () => {
      const password = 'ReusedPass123';
      const passwordHash = await PasswordService.hashPassword(password);
      mockPrisma.passwordHistory.findMany.mockResolvedValue([
        {
          id: 'history-1',
          userId: 'user-id',
          passwordHash,
          createdAt: new Date(),
        },
      ]);

      const reused = await PasswordService.checkPasswordReuse(
        mockPrisma as PrismaClient,
        'user-id',
        password,
        5,
      );

      expect(reused).toBe(true);
    });

    it('should check only specified number of previous passwords', async () => {
      const password = 'NewPass123';
      mockPrisma.passwordHistory.findMany.mockResolvedValue([]);

      const reused = await PasswordService.checkPasswordReuse(
        mockPrisma as PrismaClient,
        'user-id',
        password,
        3,
      );

      expect(reused).toBe(false);
      expect(mockPrisma.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
    });
  });

  describe('savePasswordHistory', () => {
    it('should save password to history', async () => {
      const passwordHash = await PasswordService.hashPassword('NewPass123');
      mockPrisma.passwordHistory.create.mockResolvedValue({
        id: 'history-1',
        userId: 'user-id',
        passwordHash,
        createdAt: new Date(),
      });

      await PasswordService.savePasswordHistory(
        mockPrisma as PrismaClient,
        'user-id',
        passwordHash,
      );

      expect(mockPrisma.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          passwordHash,
        },
      });
    });
  });

  describe('isPasswordExpired', () => {
    it('should return false when password was recently changed', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        passwordChangedAt: recentDate,
        passwordHash: await PasswordService.hashPassword('NewPass123'),
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '1234567890',
        isActive: true,
        isVerified: true,
        emailVerifiedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        lastLoginAt: null,
      });

      const expired = await PasswordService.isPasswordExpired(
        mockPrisma as PrismaClient,
        'user-id',
        90,
      );

      expect(expired).toBe(false);
    });

    it('should return true when password is expired', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        passwordChangedAt: oldDate,
        passwordHash: await PasswordService.hashPassword('NewPass123'),
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '1234567890',
        isActive: true,
        isVerified: true,
        emailVerifiedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        lastLoginAt: null,
      });

      const expired = await PasswordService.isPasswordExpired(
        mockPrisma as PrismaClient,
        'user-id',
        90,
      );

      expect(expired).toBe(true);
    });

    it('should return false when password was never changed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        passwordChangedAt: null,  
        passwordHash: await PasswordService.hashPassword('NewPass123'),
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '1234567890',
        isActive: true,
        isVerified: true,
        emailVerifiedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        lastLoginAt: null,
      });

      const expired = await PasswordService.isPasswordExpired(
        mockPrisma as PrismaClient,
        'user-id',
        90,
      );

      expect(expired).toBe(false);
    });

    it('should use custom maxAgeDays', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        passwordChangedAt: oldDate,
        passwordHash: await PasswordService.hashPassword('NewPass123'),
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '1234567890',
        isActive: true,
        isVerified: true,
        emailVerifiedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        lastLoginAt: null,  
      });

      const expired = await PasswordService.isPasswordExpired(
        mockPrisma as PrismaClient,
        'user-id',
        30, // 30 days max age
      );

      expect(expired).toBe(true);
    });
  });
});
