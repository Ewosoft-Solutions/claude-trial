import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PasswordService } from './password.service';
import { STEP_UP_OPERATION } from '../step-up.operations';
import { StepUpService } from './step-up.service';

describe('StepUpService.verifyAndConsume', () => {
  let service: StepUpService;
  let webauthn: {
    generateAuthenticationOptions: jest.Mock;
    verifyAuthentication: jest.Mock;
  };
  let updateMany: jest.Mock;
  let prisma: { mfaChallenge: { updateMany: jest.Mock } };

  beforeEach(() => {
    webauthn = {
      generateAuthenticationOptions: jest.fn(),
      verifyAuthentication: jest.fn(),
    };
    service = new StepUpService(webauthn as never);
    updateMany = jest.fn();
    prisma = { mfaChallenge: { updateMany } };
  });

  it('returns false and does not touch the DB when challengeId is empty', async () => {
    const ok = await service.verifyAndConsume(
      prisma as never,
      'user-1',
      'sensitive_operation',
      '',
    );
    expect(ok).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('scopes the update to user + operation + verified + unconsumed + unexpired and consumes it', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const before = Date.now();

    const ok = await service.verifyAndConsume(
      prisma as never,
      'user-1',
      'sensitive_operation',
      'chal-1',
    );

    expect(ok).toBe(true);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      id: 'chal-1',
      userId: 'user-1',
      operation: 'sensitive_operation',
      verified: true,
      consumedAt: null,
    });
    // Freshness: only challenges expiring in the future match.
    expect(arg.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(arg.where.expiresAt.gt.getTime()).toBeGreaterThanOrEqual(before);
    // Consumed atomically in the same statement.
    expect(arg.data.consumedAt).toBeInstanceOf(Date);
  });

  it('returns false when no row matches (expired / wrong user / wrong operation / already consumed)', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const ok = await service.verifyAndConsume(
      prisma as never,
      'user-1',
      'sensitive_operation',
      'chal-1',
    );
    expect(ok).toBe(false);
  });

  it('is single-use: a second consume of the same challenge no longer matches', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await service.verifyAndConsume(
      prisma as never,
      'u',
      'sensitive_operation',
      'c',
    );
    const second = await service.verifyAndConsume(
      prisma as never,
      'u',
      'sensitive_operation',
      'c',
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

describe('StepUpService ceremonies', () => {
  let service: StepUpService;
  let webauthn: {
    generateAuthenticationOptions: jest.Mock;
    verifyAuthentication: jest.Mock;
  };

  beforeEach(() => {
    webauthn = {
      generateAuthenticationOptions: jest.fn(),
      verifyAuthentication: jest.fn(),
    };
    service = new StepUpService(webauthn as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers a platform passkey ceremony when the user has one', async () => {
    const prisma = {
      mfaMethod: { count: jest.fn().mockResolvedValue(1) },
    };
    const options = { challengeId: 'challenge-1', challenge: 'abc' };
    webauthn.generateAuthenticationOptions.mockResolvedValue(options);

    await expect(
      service.begin(
        prisma as never,
        'user-1',
        STEP_UP_OPERATION.BIOMETRICS_REMOVE,
      ),
    ).resolves.toEqual({
      hasPasskey: true,
      challengeId: 'challenge-1',
      options,
    });
    expect(webauthn.generateAuthenticationOptions).toHaveBeenCalledWith(
      prisma,
      'user-1',
      STEP_UP_OPERATION.BIOMETRICS_REMOVE,
      'required',
      'platform',
    );
  });

  it('offers password fallback when no platform passkey is enrolled', async () => {
    const prisma = {
      mfaMethod: { count: jest.fn().mockResolvedValue(0) },
    };

    await expect(
      service.begin(
        prisma as never,
        'user-1',
        STEP_UP_OPERATION.BIOMETRICS_ENROLL,
      ),
    ).resolves.toEqual({ hasPasskey: false });
    expect(webauthn.generateAuthenticationOptions).not.toHaveBeenCalled();
  });

  it('rejects operations outside the platform-owned catalog', async () => {
    await expect(
      service.begin(
        { mfaMethod: { count: jest.fn() } } as never,
        'user-1',
        'untrusted.operation',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies a passkey challenge only when it is bound to this user and operation', async () => {
    const prisma = {
      mfaChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          userId: 'user-1',
          operation: STEP_UP_OPERATION.BIOMETRICS_REMOVE,
          type: 'webauthn',
          verified: false,
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };
    webauthn.verifyAuthentication.mockResolvedValue(true);
    const response = { id: 'credential-1' };

    await expect(
      service.verifyPasskey(
        prisma as never,
        'user-1',
        STEP_UP_OPERATION.BIOMETRICS_REMOVE,
        'challenge-1',
        response as never,
      ),
    ).resolves.toBe('challenge-1');
    expect(webauthn.verifyAuthentication).toHaveBeenCalledWith(
      prisma,
      'challenge-1',
      response,
    );
  });

  it('rejects a passkey challenge created for another operation', async () => {
    const prisma = {
      mfaChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          userId: 'user-1',
          operation: STEP_UP_OPERATION.BIOMETRICS_ENROLL,
          type: 'webauthn',
          verified: false,
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };

    await expect(
      service.verifyPasskey(
        prisma as never,
        'user-1',
        STEP_UP_OPERATION.BIOMETRICS_REMOVE,
        'challenge-1',
        { id: 'credential-1' } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webauthn.verifyAuthentication).not.toHaveBeenCalled();
  });

  it('turns a fresh password check into a short-lived verified challenge', async () => {
    jest.spyOn(PasswordService, 'comparePassword').mockResolvedValue(true);
    const create = jest.fn().mockResolvedValue({ id: 'password-challenge' });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ passwordHash: 'hash' }),
      },
      mfaChallenge: { create },
    };

    await expect(
      service.verifyPassword(
        prisma as never,
        'user-1',
        STEP_UP_OPERATION.BIOMETRICS_ENROLL,
        'password',
      ),
    ).resolves.toBe('password-challenge');
    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      type: 'password',
      operation: STEP_UP_OPERATION.BIOMETRICS_ENROLL,
      verified: true,
      consumedAt: null,
    });
    expect(create.mock.calls[0][0].data.verifiedAt).toBeInstanceOf(Date);
    expect(create.mock.calls[0][0].data.expiresAt).toBeInstanceOf(Date);
  });

  it('does not create a challenge when the password is wrong', async () => {
    jest.spyOn(PasswordService, 'comparePassword').mockResolvedValue(false);
    const create = jest.fn();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ passwordHash: 'hash' }),
      },
      mfaChallenge: { create },
    };

    await expect(
      service.verifyPassword(
        prisma as never,
        'user-1',
        STEP_UP_OPERATION.BIOMETRICS_REMOVE,
        'wrong',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(create).not.toHaveBeenCalled();
  });
});
