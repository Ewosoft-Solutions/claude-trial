import { ForbiddenException } from '@nestjs/common';
import { StepUpGuard } from './step-up.guard';

function context(req: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe('StepUpGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let dbService: { client: object };
  let stepUpService: {
    requiresStepUp: jest.Mock;
    verifyAndConsume: jest.Mock;
  };
  let guard: StepUpGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    dbService = { client: {} };
    stepUpService = {
      requiresStepUp: jest.fn().mockResolvedValue(true),
      verifyAndConsume: jest.fn(),
    };
    guard = new StepUpGuard(
      reflector as never,
      dbService as never,
      stepUpService as never,
    );
  });

  it('allows routes with no step-up metadata without touching the DB', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(context({}))).resolves.toBe(true);
    expect(stepUpService.verifyAndConsume).not.toHaveBeenCalled();
  });

  it('rejects when the caller is not authenticated', async () => {
    reflector.getAllAndOverride.mockReturnValue('sensitive_operation');
    await expect(
      guard.canActivate(context({ body: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ignores forged x-mfa-verified headers — only the body challenge id counts', async () => {
    reflector.getAllAndOverride.mockReturnValue('sensitive_operation');
    const req = {
      user: { userId: 'u1' },
      headers: { 'x-mfa-verified': 'true', 'x-mfa-challenge-id': 'anything' },
      body: {},
    };
    await expect(guard.canActivate(context(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(stepUpService.verifyAndConsume).not.toHaveBeenCalled();
  });

  it('passes the body challenge id + bound operation to the service and allows on success', async () => {
    reflector.getAllAndOverride.mockReturnValue('sensitive_operation');
    stepUpService.verifyAndConsume.mockResolvedValue(true);
    const req = { user: { userId: 'u1' }, body: { stepUpChallengeId: 'c1' } };

    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(stepUpService.verifyAndConsume).toHaveBeenCalledWith(
      dbService.client,
      'u1',
      'sensitive_operation',
      'c1',
    );
    expect(req.body).toEqual({});
  });

  it('allows the operation when the platform policy disables step-up', async () => {
    reflector.getAllAndOverride.mockReturnValue('sensitive_operation');
    stepUpService.requiresStepUp.mockResolvedValue(false);
    const req = { user: { userId: 'u1' }, body: { stepUpChallengeId: 'c1' } };

    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(stepUpService.verifyAndConsume).not.toHaveBeenCalled();
    expect(req.body).toEqual({});
  });

  it('rejects when the service reports no valid/consumable challenge', async () => {
    reflector.getAllAndOverride.mockReturnValue('sensitive_operation');
    stepUpService.verifyAndConsume.mockResolvedValue(false);
    const req = { user: { userId: 'u1' }, body: { stepUpChallengeId: 'c1' } };

    await expect(guard.canActivate(context(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
