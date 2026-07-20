import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../common';
import { STEP_UP_OPERATION } from './step-up.operations';
import { StepUpController } from './step-up.controller';
import { JwtAuthGuard } from './guards';
import { StepUpService } from './services/step-up.service';
import type { RequestUser } from './types/request-user';

describe('StepUpController', () => {
  let controller: StepUpController;
  let stepUpService: {
    begin: jest.Mock;
    verifyPassword: jest.Mock;
    verifyPasskey: jest.Mock;
    verifyTotp: jest.Mock;
    verifyRecoveryCode: jest.Mock;
  };
  let auditCreate: jest.Mock;

  const user: RequestUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    profileId: 'profile-1',
    roleId: 'role-1',
    email: 'user@example.test',
  };

  beforeEach(async () => {
    stepUpService = {
      begin: jest.fn(),
      verifyPassword: jest.fn(),
      verifyPasskey: jest.fn(),
      verifyTotp: jest.fn(),
      verifyRecoveryCode: jest.fn(),
    };
    auditCreate = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StepUpController],
      providers: [
        { provide: StepUpService, useValue: stepUpService },
        {
          provide: DatabaseService,
          useValue: { client: { auditLog: { create: auditCreate } } },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(StepUpController);
  });

  it('begins a ceremony for the authenticated user and exact operation', async () => {
    const result = { hasPasskey: false as const };
    stepUpService.begin.mockResolvedValue(result);

    await expect(
      controller.options(
        { operation: STEP_UP_OPERATION.BIOMETRICS_ENROLL },
        user,
      ),
    ).resolves.toBe(result);
    expect(stepUpService.begin).toHaveBeenCalledWith(
      expect.anything(),
      user.userId,
      STEP_UP_OPERATION.BIOMETRICS_ENROLL,
    );
  });

  it('verifies a password fallback without writing the password to audit', async () => {
    stepUpService.verifyPassword.mockResolvedValue('password-challenge');

    await expect(
      controller.verify(
        {
          operation: STEP_UP_OPERATION.BIOMETRICS_REMOVE,
          password: 'correct horse battery staple',
        },
        user,
      ),
    ).resolves.toEqual({ verified: true, challengeId: 'password-challenge' });

    expect(stepUpService.verifyPassword).toHaveBeenCalledWith(
      expect.anything(),
      user.userId,
      STEP_UP_OPERATION.BIOMETRICS_REMOVE,
      'correct horse battery staple',
    );
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'step_up_verified',
        metadata: {
          operation: STEP_UP_OPERATION.BIOMETRICS_REMOVE,
          method: 'password',
          challengeId: 'password-challenge',
        },
        status: 'success',
      }),
    });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain(
      'correct horse battery staple',
    );
  });

  it('verifies and audits a passkey assertion', async () => {
    const webauthnResponse = { id: 'credential-1' } as never;
    stepUpService.verifyPasskey.mockResolvedValue('passkey-challenge');

    await controller.verify(
      {
        operation: STEP_UP_OPERATION.BIOMETRICS_ENROLL,
        challengeId: 'passkey-challenge',
        webauthnResponse,
      },
      user,
    );

    expect(stepUpService.verifyPasskey).toHaveBeenCalledWith(
      expect.anything(),
      user.userId,
      STEP_UP_OPERATION.BIOMETRICS_ENROLL,
      'passkey-challenge',
      webauthnResponse,
    );
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'step_up_verified',
        metadata: expect.objectContaining({ method: 'passkey' }),
      }),
    });
  });

  it('verifies a TOTP fallback without writing the token to audit', async () => {
    stepUpService.verifyTotp.mockResolvedValue('totp-challenge');

    await expect(
      controller.verify(
        {
          operation: STEP_UP_OPERATION.BIOMETRICS_REMOVE,
          totpCode: '123456',
        },
        user,
      ),
    ).resolves.toEqual({ verified: true, challengeId: 'totp-challenge' });

    expect(stepUpService.verifyTotp).toHaveBeenCalledWith(
      expect.anything(),
      user.userId,
      STEP_UP_OPERATION.BIOMETRICS_REMOVE,
      '123456',
    );
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('123456');
  });

  it('verifies a one-time recovery-code fallback', async () => {
    stepUpService.verifyRecoveryCode.mockResolvedValue('recovery-challenge');

    await expect(
      controller.verify(
        {
          operation: STEP_UP_OPERATION.BIOMETRICS_REMOVE,
          recoveryCode: 'alpha-bravo',
        },
        user,
      ),
    ).resolves.toEqual({
      verified: true,
      challengeId: 'recovery-challenge',
    });

    expect(stepUpService.verifyRecoveryCode).toHaveBeenCalledWith(
      expect.anything(),
      user.userId,
      STEP_UP_OPERATION.BIOMETRICS_REMOVE,
      'alpha-bravo',
    );
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('alpha-bravo');
  });

  it('rejects an empty proof and records the failed attempt', async () => {
    await expect(
      controller.verify(
        { operation: STEP_UP_OPERATION.BIOMETRICS_REMOVE },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'step_up_failed',
        status: 'failure',
      }),
    });
  });
});
