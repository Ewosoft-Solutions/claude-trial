import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AssessmentGradingService } from './assessment-grading.service';

/**
 * Step 3 re-keys assessments from the legacy Class onto SubjectOffering, and the
 * two anchors coexist while the migration runs. These pin the rules that keep
 * that safe: exactly one anchor is required, the offering wins when both are
 * given, a year-long offering still resolves a term, and access is checked
 * against the OFFERING (a structured assessment has no class to check).
 */
const TENANT = 'tenant-1';
const admin = {
  userId: 'u-admin',
  profileId: 'p-admin',
  canViewAll: true,
  canManageAll: true,
};
const teacher = {
  userId: 'u-teacher',
  profileId: 'p-teacher',
  canViewAll: true,
  canManageAll: false,
};

function makeService() {
  const client = {
    subjectOffering: { findFirst: jest.fn() },
    class: { findFirst: jest.fn() },
    term: { findFirst: jest.fn() },
    gradingSystem: { findFirst: jest.fn() },
    grade: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    student: { findMany: jest.fn(async () => [] as unknown[]) },
    enrollment: { findFirst: jest.fn() },
    offeringTeacher: { findFirst: jest.fn() },
    assessment: { create: jest.fn(), findFirst: jest.fn() },
  };
  const access = {
    assertCanManageClass: jest.fn(),
    assertCanManageOffering: jest.fn(async () => undefined),
  };
  // Real signature: (db, tenantDb, prismaTx, access). The private `client`
  // getter picks tenantDb when scoped, so a scoped stub is all this needs.
  const service = new AssessmentGradingService(
    { client } as never,
    { isScoped: true, client } as never,
    {} as never,
    access as never,
  );
  return { service, client, access };
}

describe('createAssessment anchors', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
    ctx.client.assessment.create.mockResolvedValue({ id: 'a1' } as never);
  });

  it('refuses when neither anchor is supplied', async () => {
    await expect(
      ctx.service.createAssessment(
        TENANT,
        admin as never,
        {
          name: 'Quiz',
          type: 'quiz',
          maxPoints: 10,
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keys on the offering and copies its year/term', async () => {
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      academicYearId: 'y1',
      termId: 't1',
      classSectionId: 'sec-1',
    } as never);

    await ctx.service.createAssessment(
      TENANT,
      admin as never,
      {
        subjectOfferingId: 'off-1',
        name: 'Quiz',
        type: 'quiz',
        maxPoints: 10,
      } as never,
    );

    const arg = ctx.client.assessment.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      subjectOfferingId: 'off-1',
      classId: null,
      academicYearId: 'y1',
      termId: 't1',
    });
  });

  it('resolves a term for a YEAR-LONG offering rather than failing', async () => {
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      academicYearId: 'y1',
      termId: null,
      classSectionId: 'sec-1',
    } as never);
    ctx.client.term.findFirst.mockResolvedValue({ id: 'first-term' } as never);

    await ctx.service.createAssessment(
      TENANT,
      admin as never,
      {
        subjectOfferingId: 'off-1',
        name: 'Quiz',
        type: 'quiz',
        maxPoints: 10,
      } as never,
    );

    const arg = ctx.client.assessment.create.mock.calls[0]![0] as {
      data: { termId: string };
    };
    expect(arg.data.termId).toBe('first-term');
  });

  it('scopes access to the OFFERING, not a class', async () => {
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      academicYearId: 'y1',
      termId: 't1',
      classSectionId: 'sec-1',
    } as never);
    // The guard now lives in AcademicsAccessService — this asserts the service
    // DELEGATES to it and refuses to write when it says no.
    ctx.access.assertCanManageOffering.mockRejectedValue(
      new ForbiddenException('nope') as never,
    );

    await expect(
      ctx.service.createAssessment(
        TENANT,
        teacher as never,
        {
          subjectOfferingId: 'off-1',
          name: 'Quiz',
          type: 'quiz',
          maxPoints: 10,
        } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.client.assessment.create).not.toHaveBeenCalled();
  });

  it('lets the assigned teacher through', async () => {
    ctx.client.subjectOffering.findFirst.mockResolvedValue({
      id: 'off-1',
      academicYearId: 'y1',
      termId: 't1',
      classSectionId: 'sec-1',
    } as never);
    await expect(
      ctx.service.createAssessment(
        TENANT,
        teacher as never,
        {
          subjectOfferingId: 'off-1',
          name: 'Quiz',
          type: 'quiz',
          maxPoints: 10,
        } as never,
      ),
    ).resolves.toBeDefined();
  });

  it('still supports the legacy class path while it exists', async () => {
    ctx.client.class.findFirst.mockResolvedValue({
      id: 'c1',
      academicYearId: 'y9',
      termId: 't9',
    } as never);

    await ctx.service.createAssessment(
      TENANT,
      admin as never,
      {
        classId: 'c1',
        name: 'Quiz',
        type: 'quiz',
        maxPoints: 10,
      } as never,
    );

    const arg = ctx.client.assessment.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      classId: 'c1',
      subjectOfferingId: null,
      academicYearId: 'y9',
    });
  });
});

describe('grading an assessment follows ITS anchor', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
    ctx.client.grade.findFirst.mockResolvedValue(null as never);
    ctx.client.grade.create.mockResolvedValue({ id: 'g1' } as never);
  });

  it('grades a STRUCTURED assessment via the offering guard', async () => {
    // Regression: while assessments could be offering-anchored but grading
    // still asked the class-teacher question, `classId` was null and every
    // teacher was refused — grading a structured assessment was impossible.
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      academicYearId: 'y1',
      maxPoints: 100,
      gradingSystem: null,
    } as never);

    await ctx.service.createGrade(
      TENANT,
      admin as never,
      {
        studentId: 'stu-1',
        assessmentId: 'a1',
        pointsEarned: 80,
      } as never,
    );

    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      admin,
      'off-1',
    );
    expect(ctx.access.assertCanManageClass).not.toHaveBeenCalled();
    const arg = ctx.client.grade.create.mock.calls[0]![0] as {
      data: { studentId: string; enrollmentId: string | null };
    };
    expect(arg.data.studentId).toBe('stu-1');
    expect(arg.data.enrollmentId).toBeNull();
  });

  it('still grades a LEGACY assessment through the class guard', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a2',
      classId: 'c1',
      subjectOfferingId: null,
      academicYearId: 'y1',
      maxPoints: 100,
      gradingSystem: null,
    } as never);
    ctx.client.enrollment.findFirst.mockResolvedValue({
      studentId: 'stu-9',
    } as never);

    await ctx.service.createGrade(
      TENANT,
      admin as never,
      {
        enrollmentId: 'enr-1',
        assessmentId: 'a2',
        pointsEarned: 55,
      } as never,
    );

    expect(ctx.access.assertCanManageClass).toHaveBeenCalled();
    // The legacy route still lands on a student, so both routes store the same
    // thing and the enrolment column can eventually be dropped.
    const arg = ctx.client.grade.create.mock.calls[0]![0] as {
      data: { studentId: string };
    };
    expect(arg.data.studentId).toBe('stu-9');
  });

  it('updates a grade on a STRUCTURED assessment through the offering guard', async () => {
    ctx.client.grade.findFirst.mockResolvedValue({
      id: 'g1',
      pointsEarned: 40,
      assessment: {
        id: 'a1',
        classId: null,
        subjectOfferingId: 'off-1',
        maxPoints: 100,
        gradingSystem: null,
      },
    } as never);
    ctx.client.grade.update = jest.fn(async () => ({ id: 'g1' })) as never;

    await ctx.service.updateGrade(TENANT, teacher as never, 'g1', {
      pointsEarned: 90,
    } as never);

    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'off-1',
    );
    expect(ctx.access.assertCanManageClass).not.toHaveBeenCalled();
  });

  it('refuses when neither a student nor an enrollment is named', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
      academicYearId: 'y1',
      maxPoints: 100,
      gradingSystem: null,
    } as never);

    await expect(
      ctx.service.createGrade(
        TENANT,
        admin as never,
        {
          assessmentId: 'a1',
          pointsEarned: 80,
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('listGradesForAssessment names the student from either anchor', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
    ctx.client.student.findMany.mockResolvedValue([
      {
        id: 'stu-1',
        studentNumber: 'STU-001',
        userTenant: {
          user: {
            id: 'u1',
            email: 'ada@school.test',
            firstName: 'Ada',
            lastName: 'Okoro',
          },
        },
      },
      {
        id: 'stu-9',
        studentNumber: 'STU-009',
        userTenant: {
          user: {
            id: 'u9',
            email: 'bola@school.test',
            firstName: 'Bola',
            lastName: 'Eze',
          },
        },
      },
    ] as never);
  });

  it('names the student on a STRUCTURED grade, which had no enrolment to reach through', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
    } as never);
    ctx.client.grade.findMany.mockResolvedValue([
      { id: 'g1', studentId: 'stu-1', enrollmentId: null, enrollment: null },
    ] as never);

    const grades = await ctx.service.listGradesForAssessment(
      TENANT,
      teacher as never,
      'a1',
    );

    // Before this, the include reached the student through `enrollment` — null
    // on every structured grade — so the gradebook rendered a blank name.
    expect(grades[0]!.student).toMatchObject({
      id: 'stu-1',
      studentNumber: 'STU-001',
      firstName: 'Ada',
      lastName: 'Okoro',
    });
    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'off-1',
    );
  });

  it('still names the student on a LEGACY grade, through its enrolment', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a2',
      classId: 'c1',
      subjectOfferingId: null,
    } as never);
    ctx.client.grade.findMany.mockResolvedValue([
      {
        id: 'g2',
        studentId: null,
        enrollmentId: 'enr-1',
        enrollment: { id: 'enr-1', studentId: 'stu-9' },
      },
    ] as never);

    const grades = await ctx.service.listGradesForAssessment(
      TENANT,
      teacher as never,
      'a2',
    );

    expect(grades[0]!.student).toMatchObject({ studentNumber: 'STU-009' });
    // The resolved student is surfaced on the row itself, so a consumer never
    // has to know which anchor the grade happened to carry.
    expect(grades[0]!.studentId).toBe('stu-9');
    expect(ctx.access.assertCanManageClass).toHaveBeenCalled();
  });

  it('returns a null student rather than throwing when the row names nobody', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
    } as never);
    ctx.client.grade.findMany.mockResolvedValue([
      { id: 'g3', studentId: null, enrollmentId: null, enrollment: null },
    ] as never);

    const grades = await ctx.service.listGradesForAssessment(
      TENANT,
      teacher as never,
      'a1',
    );

    expect(grades[0]!.student).toBeNull();
    expect(ctx.client.student.findMany).not.toHaveBeenCalled();
  });
});

describe('assessment analytics follows the anchor too', () => {
  it('does not ask the class question for a structured assessment', async () => {
    const ctx = makeService();
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
    } as never);
    ctx.client.grade.findMany.mockResolvedValue([] as never);
    ctx.client.grade.aggregate = jest.fn(async () => ({
      _avg: {},
      _min: {},
      _max: {},
      _count: { _all: 0 },
    })) as never;

    await ctx.service.getAssessmentAnalytics(TENANT, teacher as never, 'a1');

    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'off-1',
    );
    expect(ctx.access.assertCanManageClass).not.toHaveBeenCalled();
  });
});
