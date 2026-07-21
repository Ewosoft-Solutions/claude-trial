import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { PasswordResetService, hashResetToken } from './password-reset.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

describe('PasswordResetService — tokens are stored hashed', () => {
  let service: PasswordResetService;

  const sha256 = (v: string) =>
    crypto.createHash('sha256').update(v).digest('hex');

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new PasswordResetService();

    jest
      .spyOn(PasswordService, 'validatePasswordAgainstAllSchools')
      .mockResolvedValue({ valid: true, errors: [] });
    jest.spyOn(PasswordService, 'checkPasswordReuse').mockResolvedValue(false);
    jest
      .spyOn(PasswordService, 'savePasswordHistory')
      .mockResolvedValue(undefined as never);
    jest.spyOn(PasswordService, 'hashPassword').mockResolvedValue('new-hash');
    jest
      .spyOn(SessionService, 'revokeAllUserSessions')
      .mockResolvedValue(undefined as never);
  });

  describe('hashResetToken', () => {
    it('is plain sha256, so the reset flow can look a token up directly', () => {
      expect(hashResetToken('abc')).toBe(sha256('abc'));
    });
  });

  describe('requestPasswordReset', () => {
    it('persists the hash and returns the raw token to the caller', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true }),
          update,
        },
        loginAttempt: { count: jest.fn().mockResolvedValue(0) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };

      const { token } = await service.requestPasswordReset(
        prisma as never,
        'a@b.com',
        '127.0.0.1',
      );

      const stored = update.mock.calls[0][0].data.passwordResetToken;

      // The row must never hold anything replayable.
      expect(stored).not.toBe(token);
      expect(stored).toBe(sha256(token));
    });
  });

  describe('resetPassword', () => {
    const buildPrisma = (
      storedToken: string | null,
      expiresAt: Date | null,
    ) => ({
      user: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          storedToken && where.passwordResetToken === storedToken
            ? {
                id: 'u1',
                email: 'a@b.com',
                passwordResetToken: storedToken,
                passwordResetExpiresAt: expiresAt,
                isActive: true,
              }
            : null,
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      passwordHistory: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    });

    const future = () => new Date(Date.now() + 60_000);

    it('accepts the raw token by matching it against the stored hash', async () => {
      const raw = 'a'.repeat(64);
      const prisma = buildPrisma(sha256(raw), future());

      await service.resetPassword(prisma as never, raw, 'NewPassw0rd!2026');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('rejects the stored hash being replayed as if it were the token', async () => {
      // The point of hashing: a database leak must not yield a usable token.
      const raw = 'b'.repeat(64);
      const stored = sha256(raw);
      const prisma = buildPrisma(stored, future());

      await expect(
        service.resetPassword(prisma as never, stored, 'NewPassw0rd!2026'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      const prisma = buildPrisma(sha256('real'), future());

      await expect(
        service.resetPassword(prisma as never, 'wrong', 'NewPassw0rd!2026'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      const raw = 'c'.repeat(64);
      const prisma = buildPrisma(sha256(raw), new Date(Date.now() - 60_000));

      await expect(
        service.resetPassword(prisma as never, raw, 'NewPassw0rd!2026'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('clears the token and the forced-rotation flag on success', async () => {
      const raw = 'd'.repeat(64);
      const prisma = buildPrisma(sha256(raw), future());

      await service.resetPassword(prisma as never, raw, 'NewPassw0rd!2026');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.passwordResetToken).toBeNull();
      expect(data.mustChangePassword).toBe(false);
      expect(data.passwordChangedAt).toBeInstanceOf(Date);
    });
  });
});
