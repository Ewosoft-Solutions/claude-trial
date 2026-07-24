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

const baseSession = {
  id: 'sess-A',
  familyId: 'fam-1',
  userId: 'user-1',
  userTenantId: 'profile-1',
  expiresAt: new Date('2026-08-01T00:00:00.000Z'),
  ipAddress: '1.2.3.4',
  userAgent: 'jest',
  deviceFingerprint: null,
};

describe('SessionService.rotateSession', () => {
  it('claims the rotation, then mints a successor carrying the same absolute expiry and family', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({});
    const prisma = { session: { updateMany, create } };

    const result = await SessionService.rotateSession(
      prisma as never,
      baseSession,
      'new-refresh-token',
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
    const claim = updateMany.mock.calls[0][0];
    // Only an un-rotated row can be claimed (single-use rotation).
    expect(claim.where).toEqual({ id: 'sess-A', rotatedAt: null });
    expect(claim.data.rotatedAt).toEqual(expect.any(Date));

    expect(create).toHaveBeenCalledTimes(1);
    const created = create.mock.calls[0][0].data;
    // The successor's id must equal the replacedById recorded on the parent.
    expect(created.id).toBe(claim.data.replacedById);
    // Absolute cap preserved: successor inherits the parent's expiresAt verbatim.
    expect(created.expiresAt).toBe(baseSession.expiresAt);
    expect(created.familyId).toBe('fam-1');
    expect(created.token).toBe('new-refresh-token');

    expect(result).toEqual({ id: created.id, token: 'new-refresh-token' });
  });

  it('returns null and creates no successor when it loses the rotation race', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn();
    const prisma = { session: { updateMany, create } };

    const result = await SessionService.rotateSession(
      prisma as never,
      baseSession,
      'new-refresh-token',
    );

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back to the row id as the family when familyId is null', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({});
    const prisma = { session: { updateMany, create } };

    await SessionService.rotateSession(
      prisma as never,
      { ...baseSession, familyId: null },
      'tok',
    );

    expect(create.mock.calls[0][0].data.familyId).toBe('sess-A');
  });
});

describe('SessionService.revokeFamily', () => {
  it('revokes every un-revoked session in the family and returns the count', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { session: { updateMany } };

    const count = await SessionService.revokeFamily(prisma as never, 'fam-1');

    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('SessionService.findSuccessor', () => {
  it('selects only the scalar fields needed for the grace decision', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = { session: { findUnique } };

    await SessionService.findSuccessor(prisma as never, 'sess-B');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'sess-B' },
      select: {
        id: true,
        token: true,
        rotatedAt: true,
        revokedAt: true,
        expiresAt: true,
      },
    });
  });
});
