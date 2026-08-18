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
    subjectOffering: {
      findFirst: jest.fn(),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    campus: { findMany: jest.fn(async () => [] as unknown[]) },
    class: { findFirst: jest.fn() },
    term: { findFirst: jest.fn() },
    gradingSystem: { findFirst: jest.fn() },
    grade: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    student: { findMany: jest.fn(async () => [] as unknown[]) },
    enrollment: { findFirst: jest.fn() },
    offeringTeacher: { findFirst: jest.fn() },
    assessment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(async () => [] as unknown[]),
      count: jest.fn(async () => 0),
      update: jest.fn(async () => ({ id: 'a1' })),
      delete: jest.fn(async () => ({ id: 'a1' })),
    },
  };
  const access = {
    assertCanManageClass: jest.fn(),
    assertCanManageOffering: jest.fn(async () => undefined),
    getTaughtOfferingIds: jest.fn(async () => ['off-1']),
    getTaughtClassIds: jest.fn(async () => ['c-1']),
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

describe('the /assessments family follows the anchor', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it("narrows a teacher's list to BOTH anchors, not just their classes", async () => {
    // Regression: filtering only on `classId in taughtClassIds` omitted every
    // structured assessment, so a teacher's list simply did not contain the
    // work they had been assigned.
    await ctx.service.listAssessments(TENANT, teacher as never, {} as never);

    const arg = ctx.client.assessment.findMany.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.OR).toEqual([
      { subjectOfferingId: { in: ['off-1'] } },
      { subjectOfferingId: null, classId: { in: ['c-1'] } },
    ]);
    expect(arg.where.classId).toBeUndefined();
  });

  it('filters by an explicit offering, guarded by the offering rule', async () => {
    await ctx.service.listAssessments(
      TENANT,
      teacher as never,
      {
        subjectOfferingId: 'off-2',
      } as never,
    );

    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'off-2',
    );
    const arg = ctx.client.assessment.findMany.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.subjectOfferingId).toBe('off-2');
    expect(arg.where.OR).toBeUndefined();
  });

  it('does not narrow at all for the manage-all override', async () => {
    await ctx.service.listAssessments(TENANT, admin as never, {} as never);

    expect(ctx.access.getTaughtOfferingIds).not.toHaveBeenCalled();
    const arg = ctx.client.assessment.findMany.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.OR).toBeUndefined();
  });

  it('names the subject and class of a structured assessment', async () => {
    ctx.client.assessment.findMany.mockResolvedValue([
      {
        id: 'a1',
        subjectOfferingId: 'off-1',
        classId: null,
        class: null,
        name: 'Maths CA1',
      },
    ] as never);
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        subjectLabel: 'Mathematics',
        classSection: { displayLabel: 'JSS 1 Gold' },
      },
    ] as never);

    const page = await ctx.service.listAssessments(
      TENANT,
      admin as never,
      {} as never,
    );

    // Without this the UI reads a null `class` and labels the row "Unassigned".
    expect(page.data[0]).toMatchObject({
      anchor: 'offering',
      subjectLabel: 'Mathematics',
      classLabel: 'JSS 1 Gold',
    });
  });

  it('still names a LEGACY assessment from its class and course', async () => {
    ctx.client.assessment.findMany.mockResolvedValue([
      {
        id: 'a2',
        subjectOfferingId: null,
        classId: 'c1',
        class: {
          name: 'JSS 1',
          section: 'B',
          course: { subject: 'English', name: 'English Language' },
        },
      },
    ] as never);

    const page = await ctx.service.listAssessments(
      TENANT,
      admin as never,
      {} as never,
    );

    expect(page.data[0]).toMatchObject({
      anchor: 'class',
      subjectLabel: 'English',
      classLabel: 'JSS 1 B',
    });
    expect(ctx.client.subjectOffering.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['getAssessment', (s: AssessmentGradingService) => s.getAssessment],
    ['deleteAssessment', (s: AssessmentGradingService) => s.deleteAssessment],
  ])(
    'lets the assigned teacher through %s on a structured assessment',
    async (_name, pick) => {
      ctx.client.assessment.findFirst.mockResolvedValue({
        id: 'a1',
        classId: null,
        subjectOfferingId: 'off-1',
        class: null,
      } as never);

      await pick(ctx.service).call(ctx.service, TENANT, teacher as never, 'a1');

      expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
        TENANT,
        teacher,
        'off-1',
      );
      expect(ctx.access.assertCanManageClass).not.toHaveBeenCalled();
    },
  );

  it('lets the assigned teacher edit a structured assessment', async () => {
    ctx.client.assessment.findFirst.mockResolvedValue({
      id: 'a1',
      classId: null,
      subjectOfferingId: 'off-1',
    } as never);

    await ctx.service.updateAssessment(TENANT, teacher as never, 'a1', {
      name: 'Renamed',
    } as never);

    expect(ctx.access.assertCanManageOffering).toHaveBeenCalledWith(
      TENANT,
      teacher,
      'off-1',
    );
    expect(ctx.client.assessment.update).toHaveBeenCalled();
  });
});

describe('the workbench offering picker', () => {
  it("lists only the teacher's own offerings", async () => {
    const ctx = makeService();
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        subjectLabel: 'Mathematics',
        academicYearId: 'y1',
        termId: 't1',
        classSection: {
          id: 'sec-1',
          displayLabel: 'JSS 1 Gold',
          campusId: 'camp-1',
        },
      },
    ] as never);

    const offerings = await ctx.service.listTeachableOfferings(
      TENANT,
      teacher as never,
    );

    const arg = ctx.client.subjectOffering.findMany.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.id).toEqual({ in: ['off-1'] });
    expect(offerings[0]).toEqual({
      id: 'off-1',
      subjectLabel: 'Mathematics',
      classLabel: 'JSS 1 Gold',
      classSectionId: 'sec-1',
      campusId: 'camp-1',
      academicYearId: 'y1',
      termId: 't1',
    });
  });

  it('lists every active offering for the manage-all override', async () => {
    const ctx = makeService();

    await ctx.service.listTeachableOfferings(TENANT, admin as never);

    expect(ctx.access.getTaughtOfferingIds).not.toHaveBeenCalled();
    const arg = ctx.client.subjectOffering.findMany.mock.calls[0]![0] as {
      where: Record<string, any>;
    };
    expect(arg.where.id).toBeUndefined();
    expect(arg.where.status).toBe('active');
  });
});

describe('the offering picker disambiguates identical section labels', () => {
  it('appends the campus only when two campuses share a label', async () => {
    const ctx = makeService();
    // `displayLabel` is composed from year level + stream + arm and omits the
    // campus, so a two-campus school really does have two "SSS1 Science A".
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        subjectLabel: 'Economics',
        curriculumSubjectId: 'subj-1',
        academicYearId: 'y1',
        termId: null,
        classSection: {
          id: 'sec-1',
          displayLabel: 'SSS1 Science A',
          campusId: 'camp-main',
        },
      },
      {
        id: 'off-2',
        subjectLabel: 'Economics',
        curriculumSubjectId: 'subj-1',
        academicYearId: 'y1',
        termId: null,
        classSection: {
          id: 'sec-2',
          displayLabel: 'SSS1 Science A',
          campusId: 'camp-annex',
        },
      },
      {
        id: 'off-3',
        subjectLabel: 'Mathematics',
        curriculumSubjectId: 'subj-2',
        academicYearId: 'y1',
        termId: null,
        classSection: {
          id: 'sec-3',
          displayLabel: 'JSS1 A',
          campusId: 'camp-main',
        },
      },
    ] as never);
    ctx.client.campus.findMany.mockResolvedValue([
      { id: 'camp-main', name: 'Main Campus' },
      { id: 'camp-annex', name: 'Lakeside Annex' },
    ] as never);

    const offerings = await ctx.service.listTeachableOfferings(
      TENANT,
      admin as never,
    );

    expect(offerings.map((o) => o.classLabel)).toEqual([
      'SSS1 Science A \u00b7 Main Campus',
      'SSS1 Science A \u00b7 Lakeside Annex',
      // Unambiguous on its own, so it stays clean.
      'JSS1 A',
    ]);
  });

  it('does not read campuses at all for a single-campus school', async () => {
    const ctx = makeService();
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        subjectLabel: 'Mathematics',
        curriculumSubjectId: 'subj-1',
        academicYearId: 'y1',
        termId: null,
        classSection: {
          id: 'sec-1',
          displayLabel: 'JSS1 A',
          campusId: 'camp-main',
        },
      },
    ] as never);

    const offerings = await ctx.service.listTeachableOfferings(
      TENANT,
      admin as never,
    );

    expect(offerings[0]!.classLabel).toBe('JSS1 A');
    expect(ctx.client.campus.findMany).not.toHaveBeenCalled();
  });
});
