import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { LessonLibraryService } from './lesson-library.service';
import type { AcademicsActor } from '../../common/academics/academics-access.service';

/**
 * The library's value comes from ONE lesson serving many classes, so the rules
 * that protect that are what these pin:
 *
 *  - instantiating never copies content (the instance holds only per-class facts);
 *  - a lesson cannot be scheduled onto a different subject's offering;
 *  - un-scheduling one arm never deletes the shared lesson;
 *  - a teacher who teaches the subject may author it, one who doesn't may not —
 *    the class-teacher check cannot answer this, because a library lesson has no
 *    class.
 */
const TENANT = 'tenant-1';

const admin: AcademicsActor = {
  userId: 'admin-user',
  profileId: 'admin-profile',
  canViewAll: true,
  canManageAll: true,
};
const teacher: AcademicsActor = {
  userId: 'teacher-user',
  profileId: 'teacher-profile',
  canViewAll: true,
  canManageAll: false,
};

function makeService() {
  const client = {
    lesson: { findFirst: jest.fn() },
    subjectOffering: { findFirst: jest.fn(), findMany: jest.fn() },
    offeringTeacher: { findFirst: jest.fn() },
    lessonInstance: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    lessonChapter: { findFirst: jest.fn(), create: jest.fn() },
    curriculumSubject: { findFirst: jest.fn() },
  };
  const tenantDb = {
    client,
    runScoped: (
      _t: string,
      _u: string | undefined,
      fn: () => Promise<unknown>,
    ) => fn(),
  };
  const audit = { write: jest.fn() };
  const service = new LessonLibraryService(tenantDb as never, audit as never);
  return { service, client, audit };
}

describe('createInstance', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('binds a library lesson to an offering WITHOUT copying its content', async () => {
    ctx.client.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      title: 'Fractions',
      curriculumSubjectId: 'maths',
    } as never);
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      curriculumSubjectId: 'maths',
      subjectLabel: 'Mathematics',
    } as never);
    ctx.client.lessonInstance.findFirst.mockResolvedValue(null as never);
    ctx.client.lessonInstance.create.mockResolvedValue({
      id: 'inst-1',
    } as never);

    await ctx.service.createInstance(TENANT, admin, {
      lessonId: 'lesson-1',
      subjectOfferingId: 'off-1',
      notes: 'Emphasise equivalent fractions',
    } as never);

    const data = ctx.client.lessonInstance.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // Per-class facts only — no title/description/content/materials carried over.
    expect(data.data).toMatchObject({
      lessonId: 'lesson-1',
      subjectOfferingId: 'off-1',
      notes: 'Emphasise equivalent fractions',
    });
    for (const copied of ['content', 'description', 'materials', 'body']) {
      expect(data.data).not.toHaveProperty(copied);
    }
  });

  it('refuses to schedule a lesson onto another subject’s offering', async () => {
    ctx.client.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      title: 'Fractions',
      curriculumSubjectId: 'maths',
    } as never);
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-2',
      curriculumSubjectId: 'english',
      subjectLabel: 'English',
    } as never);

    await expect(
      ctx.service.createInstance(TENANT, admin, {
        lessonId: 'lesson-1',
        subjectOfferingId: 'off-2',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.client.lessonInstance.create).not.toHaveBeenCalled();
  });

  it('refuses a legacy lesson that is not in the library yet', async () => {
    ctx.client.lesson.findFirst.mockResolvedValue({
      id: 'legacy-1',
      title: 'Old lesson',
      curriculumSubjectId: null,
    } as never);

    await expect(
      ctx.service.createInstance(TENANT, admin, {
        lessonId: 'legacy-1',
        subjectOfferingId: 'off-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to schedule the same lesson twice for one class', async () => {
    ctx.client.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      title: 'Fractions',
      curriculumSubjectId: 'maths',
    } as never);
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      curriculumSubjectId: 'maths',
      subjectLabel: 'Mathematics',
    } as never);
    ctx.client.lessonInstance.findFirst.mockResolvedValue({
      id: 'existing',
    } as never);

    await expect(
      ctx.service.createInstance(TENANT, admin, {
        lessonId: 'lesson-1',
        subjectOfferingId: 'off-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('library access (a library lesson has no class to check)', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
    ctx.client.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      title: 'Fractions',
      curriculumSubjectId: 'maths',
    } as never);
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      curriculumSubjectId: 'maths',
      subjectLabel: 'Mathematics',
    } as never);
    ctx.client.lessonInstance.findFirst.mockResolvedValue(null as never);
    ctx.client.lessonInstance.create.mockResolvedValue({ id: 'i' } as never);
  });

  it('allows a teacher who teaches an offering of that subject', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      { id: 'off-1' },
      { id: 'off-9' },
    ] as never);
    ctx.client.offeringTeacher.findFirst.mockResolvedValue({
      id: 'assignment-1',
    } as never);

    await expect(
      ctx.service.createInstance(TENANT, teacher, {
        lessonId: 'lesson-1',
        subjectOfferingId: 'off-1',
      } as never),
    ).resolves.toBeDefined();
  });

  it('denies a teacher who teaches none of that subject’s offerings', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      { id: 'off-1' },
    ] as never);
    ctx.client.offeringTeacher.findFirst.mockResolvedValue(null as never);

    await expect(
      ctx.service.createInstance(TENANT, teacher, {
        lessonId: 'lesson-1',
        subjectOfferingId: 'off-1',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an admin through without consulting teacher assignments', async () => {
    await expect(
      ctx.service.createInstance(TENANT, admin, {
        lessonId: 'lesson-1',
        subjectOfferingId: 'off-1',
      } as never),
    ).resolves.toBeDefined();
    expect(ctx.client.offeringTeacher.findFirst).not.toHaveBeenCalled();
  });
});

describe('updateInstance / deleteInstance', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
    ctx.client.lessonInstance.findFirst.mockResolvedValue({
      id: 'inst-1',
      lesson: { curriculumSubjectId: 'maths', title: 'Fractions' },
    } as never);
    ctx.client.lessonInstance.update.mockResolvedValue({
      id: 'inst-1',
    } as never);
    ctx.client.lessonInstance.delete.mockResolvedValue({
      id: 'inst-1',
    } as never);
  });

  it('stamps taughtAt when an arm marks the lesson taught', async () => {
    await ctx.service.updateInstance(TENANT, admin, 'inst-1', {
      status: 'taught',
    } as never);
    const arg = ctx.client.lessonInstance.update.mock.calls[0]![0] as {
      data: { taughtAt?: Date; status?: string };
    };
    expect(arg.data.status).toBe('taught');
    expect(arg.data.taughtAt).toBeInstanceOf(Date);
  });

  it('clears taughtAt when it goes back to planned', async () => {
    await ctx.service.updateInstance(TENANT, admin, 'inst-1', {
      status: 'planned',
    } as never);
    const arg = ctx.client.lessonInstance.update.mock.calls[0]![0] as {
      data: { taughtAt?: Date | null };
    };
    expect(arg.data.taughtAt).toBeNull();
  });

  it('leaves taughtAt alone when the status is not being changed', async () => {
    await ctx.service.updateInstance(TENANT, admin, 'inst-1', {
      notes: 'revisit next week',
    } as never);
    const arg = ctx.client.lessonInstance.update.mock.calls[0]![0] as {
      data: { taughtAt?: Date | null };
    };
    expect(arg.data.taughtAt).toBeUndefined();
  });

  it('deletes ONLY the instance — the shared library lesson survives', async () => {
    await ctx.service.deleteInstance(TENANT, admin, 'inst-1');
    expect(ctx.client.lessonInstance.delete).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
    });
    // The whole point of instances: un-scheduling one arm must not remove the
    // content every other arm is using.
    expect(ctx.client.lesson.findFirst).not.toHaveBeenCalled();
  });
});
