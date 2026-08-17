import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';

import { AcademicsAccessService } from './academics-access.service';

/**
 * The offering/subject access rules that replace the class-teacher check as the
 * legacy `Class` retires. This coverage used to sit in two services that each
 * had their own copy of the rule; consolidating them means it is asserted once,
 * here, against the single implementation.
 */
const TENANT = 't1';
const admin = {
  userId: 'u1',
  profileId: 'p-admin',
  canViewAll: true,
  canManageAll: true,
};
const teacher = {
  userId: 'u2',
  profileId: 'p-teacher',
  canViewAll: true,
  canManageAll: false,
};

function makeService() {
  const client = {
    offeringTeacher: { findFirst: jest.fn() },
    subjectOffering: { findMany: jest.fn() },
  };
  const service = new AcademicsAccessService({ client } as never);
  Object.defineProperty(service, 'client', { get: () => client });
  return { service, client };
}

describe('assertCanManageOffering', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('lets an admin through without a lookup', async () => {
    await expect(
      ctx.service.assertCanManageOffering(TENANT, admin as never, 'off-1'),
    ).resolves.toBeUndefined();
    expect(ctx.client.offeringTeacher.findFirst).not.toHaveBeenCalled();
  });

  it('allows the assigned teacher', async () => {
    ctx.client.offeringTeacher.findFirst.mockResolvedValue({
      id: 'a',
    } as never);
    await expect(
      ctx.service.assertCanManageOffering(TENANT, teacher as never, 'off-1'),
    ).resolves.toBeUndefined();
  });

  it('denies a teacher not assigned to that offering', async () => {
    ctx.client.offeringTeacher.findFirst.mockResolvedValue(null as never);
    await expect(
      ctx.service.assertCanManageOffering(TENANT, teacher as never, 'off-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ignores inactive assignments', async () => {
    ctx.client.offeringTeacher.findFirst.mockResolvedValue(null as never);
    await ctx.service
      .assertCanManageOffering(TENANT, teacher as never, 'off-1')
      .catch(() => undefined);
    const where = (
      ctx.client.offeringTeacher.findFirst.mock.calls[0]![0] as {
        where: { isActive: boolean };
      }
    ).where;
    expect(where.isActive).toBe(true);
  });
});

describe('assertCanManageCurriculumSubject (library content)', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('allows a teacher who teaches ANY offering of the subject', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      { id: 'off-1' },
      { id: 'off-2' },
    ] as never);
    ctx.client.offeringTeacher.findFirst.mockResolvedValue({
      id: 'a',
    } as never);
    await expect(
      ctx.service.assertCanManageCurriculumSubject(
        TENANT,
        teacher as never,
        'maths',
      ),
    ).resolves.toBeUndefined();
    // It must consider every offering of the subject, not just one.
    const where = (
      ctx.client.offeringTeacher.findFirst.mock.calls[0]![0] as {
        where: { subjectOfferingId: { in: string[] } };
      }
    ).where;
    expect(where.subjectOfferingId.in).toEqual(['off-1', 'off-2']);
  });

  it('denies when the subject has no offerings at all', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([] as never);
    await expect(
      ctx.service.assertCanManageCurriculumSubject(
        TENANT,
        teacher as never,
        'maths',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.client.offeringTeacher.findFirst).not.toHaveBeenCalled();
  });

  it('denies a teacher who teaches none of them', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      { id: 'off-1' },
    ] as never);
    ctx.client.offeringTeacher.findFirst.mockResolvedValue(null as never);
    await expect(
      ctx.service.assertCanManageCurriculumSubject(
        TENANT,
        teacher as never,
        'maths',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
