import { SessionService } from './session.service';

describe('SessionService.revokeSession', () => {
  it('idempotently revokes the matching user refresh-token session', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { session: { updateMany } };

    await expect(
      SessionService.revokeSession(prisma as never, 'user-1', 'refresh-token'),
    ).resolves.toBeUndefined();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        token: 'refresh-token',
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
