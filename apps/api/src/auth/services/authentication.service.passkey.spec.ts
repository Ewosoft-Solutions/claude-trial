jest.mock('@workspace/api', () => {
  const actual = jest.requireActual('@workspace/api');
  return {
    ...actual,
    SchoolSelectionService: {
      getAvailableSchools: jest.fn().mockResolvedValue([]),
    },
  };
});

import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';

describe('AuthenticationService — passwordless passkey login', () => {
  let jwtService: { generatePreAuthToken: jest.Mock };
  let mfaService: {
    beginWebAuthnLogin: jest.Mock;
    verifyChallenge: jest.Mock;
  };
  let service: AuthenticationService;

  beforeEach(() => {
    jwtService = { generatePreAuthToken: jest.fn() };
    mfaService = {
      beginWebAuthnLogin: jest.fn(),
      verifyChallenge: jest.fn(),
    };
    service = new AuthenticationService(
      jwtService as never,
      mfaService as never,
    );
  });

  describe('beginPasskeyLogin', () => {
    it('returns hasPasskey:false for an unknown account (no enumeration signal)', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      await expect(
        service.beginPasskeyLogin(prisma as never, 'nobody@x.com'),
      ).resolves.toEqual({ hasPasskey: false });
      expect(mfaService.beginWebAuthnLogin).not.toHaveBeenCalled();
    });

    it('returns hasPasskey:false for an inactive account', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }),
        },
      };
      await expect(
        service.beginPasskeyLogin(prisma as never, 'u@x.com'),
      ).resolves.toEqual({ hasPasskey: false });
    });

    it('returns hasPasskey:false when the account has no passkeys', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
        },
      };
      mfaService.beginWebAuthnLogin.mockResolvedValue(null);
      await expect(
        service.beginPasskeyLogin(prisma as never, 'u@x.com'),
      ).resolves.toEqual({ hasPasskey: false });
    });

    it('returns options when the account has passkeys', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
        },
      };
      mfaService.beginWebAuthnLogin.mockResolvedValue({
        challengeId: 'c1',
        options: { challenge: 'abc' },
      });
      await expect(
        service.beginPasskeyLogin(prisma as never, 'u@x.com'),
      ).resolves.toEqual({
        hasPasskey: true,
        challengeId: 'c1',
        options: { challenge: 'abc' },
      });
    });
  });

  describe('completePasskeyLogin', () => {
    const baseArgs = (prisma: unknown) => ({
      prisma: prisma as never,
      challengeId: 'c1',
      authenticationResponse: { id: 'cred' } as never,
    });

    it('rejects a challenge that is not a login challenge', async () => {
      const prisma = {
        mfaChallenge: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ userId: 'u1', operation: 'sensitive_operation' }),
        },
      };
      await expect(
        service.completePasskeyLogin(baseArgs(prisma)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mfaService.verifyChallenge).not.toHaveBeenCalled();
    });

    it('rejects when the assertion fails verification', async () => {
      const prisma = {
        mfaChallenge: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ userId: 'u1', operation: 'login' }),
        },
      };
      mfaService.verifyChallenge.mockResolvedValue(false);
      await expect(
        service.completePasskeyLogin(baseArgs(prisma)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues a pre-auth token + schools on a verified assertion', async () => {
      const prisma = {
        mfaChallenge: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ userId: 'u1', operation: 'login' }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'u@x.com',
            firstName: 'Jane',
            lastName: 'Doe',
            defaultUserTenantId: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        loginAttempt: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      mfaService.verifyChallenge.mockResolvedValue(true);
      jwtService.generatePreAuthToken.mockResolvedValue('pre-auth-token');

      const result = await service.completePasskeyLogin(baseArgs(prisma));

      expect(result).toMatchObject({
        success: true,
        token: 'pre-auth-token',
        requiresMfa: false,
        user: { id: 'u1', email: 'u@x.com' },
        schools: [],
      });
      // A successful login attempt is recorded for the user.
      expect(prisma.loginAttempt.create).toHaveBeenCalled();
    });
  });
});
