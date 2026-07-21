jest.mock('@workspace/api', () => {
  const actual = jest.requireActual('@workspace/api');
  return {
    ...actual,
    SchoolSelectionService: {
      getAvailableSchools: jest.fn().mockResolvedValue([]),
    },
  };
});

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { PasswordService } from './password.service';
import { LoginAttemptService } from './login-attempt.service';
import { MfaBaseService } from './mfa-base.service';

describe('AuthenticationService — forced password rotation', () => {
  let jwtService: { generatePreAuthToken: jest.Mock };
  let mfaService: {
    initiateVerification: jest.Mock;
    verifyChallenge: jest.Mock;
  };
  let service: AuthenticationService;

  const auditLog = { create: jest.fn().mockResolvedValue({}) };

  beforeEach(() => {
    jest.restoreAllMocks();
    auditLog.create.mockClear();

    jwtService = {
      generatePreAuthToken: jest.fn().mockResolvedValue('pre-auth-token'),
    };
    mfaService = {
      initiateVerification: jest.fn(),
      verifyChallenge: jest.fn(),
    };
    service = new AuthenticationService(
      jwtService as never,
      mfaService as never,
    );

    jest
      .spyOn(LoginAttemptService, 'recordAttempt')
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(LoginAttemptService, 'checkLockoutStatus')
      .mockResolvedValue({ isLocked: false } as never);
    jest.spyOn(MfaBaseService, 'hasActiveMfaMethods').mockResolvedValue(false);
    jest.spyOn(PasswordService, 'comparePassword').mockResolvedValue(true);
  });

  const buildUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'architect@example.com',
    passwordHash: 'hashed',
    firstName: 'Platform',
    lastName: 'Architect',
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
    lockedUntil: null,
    mustChangePassword: false,
    defaultUserTenantId: null,
    ...overrides,
  });

  const buildPrisma = (user: unknown) => ({
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({}),
    },
    auditLog,
  });

  describe('login', () => {
    it('issues a pre-auth token when no rotation is pending', async () => {
      const prisma = buildPrisma(buildUser());

      const result = await service.login(
        prisma as never,
        'architect@example.com',
        'correct-password',
        '127.0.0.1',
      );

      expect(result.token).toBe('pre-auth-token');
      expect(result.mustChangePassword).toBeUndefined();
    });

    it('withholds the token when the password must be rotated', async () => {
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      const result = await service.login(
        prisma as never,
        'architect@example.com',
        'correct-password',
        '127.0.0.1',
      );

      expect(result.mustChangePassword).toBe(true);
      // The withheld token is the enforcement — every downstream step needs one.
      expect(result.token).toBeUndefined();
      expect(result.schools).toEqual([]);
      expect(jwtService.generatePreAuthToken).not.toHaveBeenCalled();
    });

    it('still rejects a wrong password rather than revealing the flag', async () => {
      jest.spyOn(PasswordService, 'comparePassword').mockResolvedValue(false);
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      await expect(
        service.login(
          prisma as never,
          'architect@example.com',
          'wrong-password',
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('challenges MFA before the rotation gate, so the second factor still applies', async () => {
      jest.spyOn(MfaBaseService, 'hasActiveMfaMethods').mockResolvedValue(true);
      jest
        .spyOn(MfaBaseService, 'getPrimaryMfaMethod')
        .mockResolvedValue({ id: 'm1', type: 'totp' } as never);
      mfaService.initiateVerification.mockResolvedValue({
        challengeId: 'c1',
        expiresAt: new Date(),
      });

      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      const result = await service.login(
        prisma as never,
        'architect@example.com',
        'correct-password',
        '127.0.0.1',
      );

      expect(result.requiresMfa).toBe(true);
      expect(result.token).toBeUndefined();
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      jest
        .spyOn(PasswordService, 'validatePasswordAgainstAllSchools')
        .mockResolvedValue({ valid: true, errors: [] });
      jest
        .spyOn(PasswordService, 'checkPasswordReuse')
        .mockResolvedValue(false);
      jest
        .spyOn(PasswordService, 'savePasswordHistory')
        .mockResolvedValue(undefined as never);
      jest.spyOn(PasswordService, 'hashPassword').mockResolvedValue('new-hash');
    });

    it('clears the flag and stamps passwordChangedAt', async () => {
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      const result = await service.changePassword(
        prisma as never,
        'architect@example.com',
        'correct-password',
        'BrandNewPassw0rd!2026',
        '127.0.0.1',
      );

      expect(result.success).toBe(true);

      const update = prisma.user.update.mock.calls[0][0];
      expect(update.data.mustChangePassword).toBe(false);
      expect(update.data.passwordHash).toBe('new-hash');
      expect(update.data.passwordChangedAt).toBeInstanceOf(Date);
    });

    it('rejects a wrong current password', async () => {
      jest.spyOn(PasswordService, 'comparePassword').mockResolvedValue(false);
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      await expect(
        service.changePassword(
          prisma as never,
          'architect@example.com',
          'wrong',
          'BrandNewPassw0rd!2026',
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses to re-set the same password, which would not be a rotation', async () => {
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      await expect(
        service.changePassword(
          prisma as never,
          'architect@example.com',
          'same-password',
          'same-password',
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('enforces the password policy on the new password', async () => {
      jest
        .spyOn(PasswordService, 'validatePasswordAgainstAllSchools')
        .mockResolvedValue({ valid: false, errors: ['Password too short'] });
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      await expect(
        service.changePassword(
          prisma as never,
          'architect@example.com',
          'correct-password',
          'short',
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a recently used password', async () => {
      jest.spyOn(PasswordService, 'checkPasswordReuse').mockResolvedValue(true);
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      await expect(
        service.changePassword(
          prisma as never,
          'architect@example.com',
          'correct-password',
          'PreviousPassw0rd!2025',
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('honours account lockout, so it cannot bypass login rate limiting', async () => {
      jest.spyOn(LoginAttemptService, 'checkLockoutStatus').mockResolvedValue({
        isLocked: true,
        lockedUntil: new Date('2026-01-01T00:00:00.000Z'),
      } as never);
      const prisma = buildPrisma(buildUser({ mustChangePassword: true }));

      await expect(
        service.changePassword(
          prisma as never,
          'architect@example.com',
          'correct-password',
          'BrandNewPassw0rd!2026',
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('gives the same error for an unknown account as for a wrong password', async () => {
      const prisma = buildPrisma(null);

      await expect(
        service.changePassword(
          prisma as never,
          'nobody@example.com',
          'whatever',
          'BrandNewPassw0rd!2026',
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
