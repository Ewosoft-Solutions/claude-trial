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
    subjectOffering: {
      findFirst: jest.fn(async () => ({ curriculumSubjectId: 'subj-1' })),
    },
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

    await ctx.service
      .attachQuestions(TENANT, teacher as never, 'a1', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never)
      .catch(() => undefined);

    // It must not 404: the row was always there, the `class` relation filter
    // just could not see it, because a relation filter is a NOT-NULL test.
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

  it('refuses when the assessment has neither a subject nor a course', async () => {
    // Both anchors absent is the only case with no bank to draw from. It used
    // to be every structured assessment, because the bank was keyed on Course.
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      status: 'draft',
      class: null,
    } as never);
    ctx.client.subjectOffering.findFirst.mockResolvedValue(null as never);

    await expect(
      ctx.service.attachQuestions(TENANT, teacher as never, 'a1', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never),
    ).rejects.toThrow(/no subject or course/i);
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

/** The bank itself, once it stopped belonging to a Course. */
function makeBankService() {
  const client = {
    assessment: { findFirst: jest.fn() },
    subjectOffering: { findFirst: jest.fn(), findMany: jest.fn() },
    curriculumSubject: { findFirst: jest.fn(async () => ({ id: 'subj-1' })) },
    course: { findFirst: jest.fn(async () => ({ id: 'course-1' })) },
    question: {
      findMany: jest.fn(async () => [] as unknown[]),
      create: jest.fn(async () => ({ id: 'q1' })),
    },
    assessmentQuestion: {
      findMany: jest.fn(async () => [] as unknown[]),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  const access = {
    assertCanManageClass: jest.fn(),
    assertCanManageOffering: jest.fn(async () => undefined),
    assertCanManageCourseBank: jest.fn(async () => undefined),
    assertCanManageCurriculumSubject: jest.fn(async () => undefined),
    getTaughtCurriculumSubjectIds: jest.fn(async () => ['subj-1']),
    getTaughtCourseIds: jest.fn(async () => ['course-1']),
    getTaughtOfferingIds: jest.fn(async () => ['off-1']),
  };
  const service = new QuestionBankService(
    { client } as never,
    { isScoped: true, client } as never,
    access as never,
  );
  return { service, client, access };
}

describe('the bank belongs to a curriculum subject', () => {
  let ctx: ReturnType<typeof makeBankService>;

  beforeEach(() => {
    ctx = makeBankService();
  });

  it('creates an entry against the subject and leaves no course behind', async () => {
    await ctx.service.createQuestion(
      TENANT,
      teacher as never,
      {
        curriculumSubjectId: 'subj-1',
        text: 'Which pigment drives photosynthesis?',
        style: 'short_answer',
        correctAnswer: 'Chlorophyll',
      } as never,
    );

    expect(ctx.access.assertCanManageCurriculumSubject).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'subj-1',
    );
    const arg = ctx.client.question.create.mock.calls[0]![0] as {
      data: { curriculumSubjectId: string; courseId: string | null };
    };
    expect(arg.data.curriculumSubjectId).toBe('subj-1');
    expect(arg.data.courseId).toBeNull();
  });

  it('refuses an entry that names neither anchor', async () => {
    await expect(
      ctx.service.createQuestion(
        TENANT,
        teacher as never,
        {
          text: 'Orphan',
          style: 'essay',
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("narrows a teacher's bank to BOTH anchors", async () => {
    await ctx.service.listQuestions(TENANT, teacher as never, {} as never);

    const arg = ctx.client.question.findMany.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.OR).toEqual([
      { curriculumSubjectId: { in: ['subj-1'] } },
      { curriculumSubjectId: null, courseId: { in: ['course-1'] } },
    ]);
  });

  it('draws a STRUCTURED assessment’s paper from its offering’s subject', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      status: 'draft',
      class: null,
    } as never);
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      curriculumSubjectId: 'subj-1',
    } as never);
    ctx.client.question.findMany.mockResolvedValue([{ id: 'q1' }] as never);

    await ctx.service
      .attachQuestions(TENANT, teacher as never, 'a1', {
        questions: [{ questionId: 'q1', points: 1 }],
      } as never)
      .catch(() => undefined);

    // This is the case that used to be impossible: the bank was keyed on a
    // course the assessment did not have, so no question could ever attach.
    const arg = ctx.client.question.findMany.mock.calls[0]![0] as {
      where: { curriculumSubjectId: string };
    };
    expect(arg.where.curriculumSubjectId).toBe('subj-1');
  });

  it('lists one row per subject the teacher takes, not one per offering', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      { curriculumSubjectId: 'subj-1', subjectLabel: 'Mathematics' },
      { curriculumSubjectId: 'subj-1', subjectLabel: 'Mathematics' },
      { curriculumSubjectId: 'subj-2', subjectLabel: 'English' },
    ] as never);

    const subjects = await ctx.service.listTeachableSubjects(
      TENANT,
      teacher as never,
    );

    // A subject offered to several sections is still ONE bank; listing it
    // twice would suggest otherwise.
    expect(subjects).toEqual([
      { id: 'subj-1', name: 'Mathematics' },
      { id: 'subj-2', name: 'English' },
    ]);
  });
});
