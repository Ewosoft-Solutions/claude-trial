import { StepUpService } from './step-up.service';

describe('StepUpService.verifyAndConsume', () => {
  let service: StepUpService;
  let updateMany: jest.Mock;
  let prisma: { mfaChallenge: { updateMany: jest.Mock } };

  beforeEach(() => {
    service = new StepUpService();
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
