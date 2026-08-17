import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { QuestionBankService } from './question-bank.service';

/**
 * The question paper hangs off an assessment, and assessments now carry either
 * anchor. Two things broke on the structured one: the lookup filtered through
 * the `class` relation (a NOT-NULL test, so the row was invisible and every
 * paper operation 404'd), and the bank itself is keyed on the legacy `Course`,
 * which an offering has no bridge to.
 */
const TENANT = 'tenant-1';
const teacher = {
  userId: 'u-teacher',
  profileId: 'p-teacher',
  canViewAll: true,
  canManageAll: false,
};

function makeService() {
  const client = {
    assessment: { findFirst: jest.fn() },
    question: { findMany: jest.fn(async () => [] as unknown[]) },
    assessmentQuestion: {
      findMany: jest.fn(async () => [] as unknown[]),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  const access = {
    assertCanManageClass: jest.fn(),
    assertCanManageOffering: jest.fn(async () => undefined),
  };
  const service = new QuestionBankService(
    { client } as never,
    { isScoped: true, client } as never,
    access as never,
  );
  return { service, client, access };
}

describe('the question paper finds a structured assessment at all', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('scopes the lookup by academic year, not through the class relation', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      status: 'draft',
      class: null,
    } as never);

    await expect(
      ctx.service.attachQuestions(TENANT, teacher as never, 'a1', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The point of the assertion above is that it is NOT a NotFoundException:
    // the row was always there, the `class` relation filter just could not see
    // it. The where-clause is the fix.
    const arg = ctx.client.assessment.findFirst.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.academicYear).toEqual({ tenantId: TENANT });
    expect(arg.where.class).toBeUndefined();
  });

  it('guards a structured assessment by its offering', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      status: 'draft',
      class: null,
    } as never);

    await ctx.service
      .attachQuestions(TENANT, teacher as never, 'a1', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never)
      .catch(() => undefined);

    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'off-1',
    );
    expect(ctx.access.assertCanManageClass).not.toHaveBeenCalled();
  });

  it('refuses clearly instead of reading a course off a null class', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      status: 'draft',
      class: null,
    } as never);

    await expect(
      ctx.service.attachQuestions(TENANT, teacher as never, 'a1', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never),
    ).rejects.toThrow(/question bank is still scoped to the legacy course/i);
    expect(ctx.client.question.findMany).not.toHaveBeenCalled();
  });

  it('still 404s an assessment that genuinely is not there', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue(null as never);

    await expect(
      ctx.service.attachQuestions(TENANT, teacher as never, 'nope', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still builds a LEGACY assessment’s paper from its course bank', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a2',
      classId: 'c1',
      subjectOfferingId: null,
      status: 'draft',
      class: { courseId: 'course-1' },
    } as never);
    ctx.client.question.findMany.mockResolvedValue([{ id: 'q1' }] as never);

    await ctx.service
      .attachQuestions(TENANT, teacher as never, 'a2', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never)
      .catch(() => undefined);

    expect(ctx.access.assertCanManageClass).toHaveBeenCalled();
    const arg = ctx.client.question.findMany.mock.calls[0]![0] as {
      where: { courseId: string };
    };
    expect(arg.where.courseId).toBe('course-1');
  });
});
