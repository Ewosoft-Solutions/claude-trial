import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { AssessmentGradingService } from './assessment-grading.service';

/**
 * A student's grade report used to start from legacy `Enrollment` rows, so a
 * grade on a STRUCTURED assessment — which carries `studentId` and a null
 * `enrollmentId` — never appeared: the child saw an incomplete record with no
 * error. These pin the re-shape that fixed it: read by student, group by the
 * assessment's own anchor, take the term from that anchor, and scope a teacher
 * by the offerings they teach.
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

/** A grade on an offering-anchored assessment: no enrolment anywhere. */
function structuredGrade(over: Record<string, unknown> = {}) {
  return {
    id: 'g-structured',
    studentId: 'stu-1',
    enrollmentId: null,
    assessmentId: 'a-structured',
    pointsEarned: 80,
    percentage: 80,
    letterGrade: 'A',
    gpaPoints: 4,
    assessment: {
      id: 'a-structured',
      name: 'Maths CA1',
      type: 'quiz',
      weight: null,
      maxPoints: 100,
      subjectOfferingId: 'off-1',
      classId: null,
      academicYearId: 'y1',
      termId: 't1',
      class: null,
    },
    ...over,
  };
}

/** A grade on a legacy class-anchored assessment. */
function legacyGrade(over: Record<string, unknown> = {}) {
  return {
    id: 'g-legacy',
    studentId: 'stu-1',
    enrollmentId: 'enr-1',
    assessmentId: 'a-legacy',
    pointsEarned: 60,
    percentage: 60,
    letterGrade: 'C',
    gpaPoints: 2,
    assessment: {
      id: 'a-legacy',
      name: 'English Test',
      type: 'test',
      weight: null,
      maxPoints: 100,
      subjectOfferingId: null,
      classId: 'c-1',
      academicYearId: 'y1',
      termId: 't1',
      class: {
        id: 'c-1',
        name: 'JSS 1',
        section: 'B',
        termId: 't1',
        course: { subject: 'English', name: 'English Language' },
      },
    },
    ...over,
  };
}

function makeService() {
  const client = {
    student: { findFirst: jest.fn(async () => ({ id: 'stu-1' })) },
    grade: { findMany: jest.fn(async () => [] as unknown[]) },
    subjectOffering: { findMany: jest.fn(async () => [] as unknown[]) },
    term: {
      findMany: jest.fn(async () => [{ id: 't1', name: 'First Term' }]),
    },
  };
  const access = {
    getTaughtOfferingIds: jest.fn(async () => ['off-1']),
    getTaughtClassIds: jest.fn(async () => ['c-1']),
  };
  const service = new AssessmentGradingService(
    { client } as never,
    { isScoped: true, client } as never,
    {} as never,
    access as never,
  );
  return { service, client, access };
}

/** The `where` the service handed to grade.findMany on its first call. */
function whereFrom(client: ReturnType<typeof makeService>['client']) {
  const call = client.grade.findMany.mock.calls[0]![0] as {
    where: Record<string, any>;
  };
  return call.where;
}

describe('getStudentReportCard reads by student, not by enrolment', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        subjectLabel: 'Mathematics',
        termId: 't1',
        classSection: { displayLabel: 'JSS 1 Gold' },
      },
    ] as never);
  });

  it('includes a STRUCTURED grade, which the enrolment-first read lost', async () => {
    ctx.client.grade.findMany.mockResolvedValue([structuredGrade()] as never);

    const report = await ctx.service.getStudentReportCard(
      TENANT,
      admin as never,
      'stu-1',
    );

    expect(report.subjects).toHaveLength(1);
    expect(report.subjects[0]).toMatchObject({
      anchor: 'offering',
      subjectOfferingId: 'off-1',
      classId: null,
      subjectLabel: 'Mathematics',
      classLabel: 'JSS 1 Gold',
      termId: 't1',
      termName: 'First Term',
    });
    expect(report.subjects[0]!.summary.percentage).toBe(80);
    expect(report.overall.avgPercentage).toBe(80);
  });

  it('anchors the query on studentId (the enrolment arm is only a bridge)', async () => {
    await ctx.service.getStudentReportCard(TENANT, admin as never, 'stu-1');

    // Rows the re-key backfill has not reached yet still carry only an
    // enrolment, so both arms have to be there until the column is dropped.
    expect(whereFrom(ctx.client).OR).toEqual([
      { studentId: 'stu-1' },
      { enrollment: { studentId: 'stu-1' } },
    ]);
  });

  it('groups structured and legacy grades as separate subjects', async () => {
    ctx.client.grade.findMany.mockResolvedValue([
      structuredGrade(),
      legacyGrade(),
    ] as never);

    const report = await ctx.service.getStudentReportCard(
      TENANT,
      admin as never,
      'stu-1',
    );

    expect(report.subjects.map((s) => s.anchor).sort()).toEqual([
      'class',
      'offering',
    ]);
    const legacy = report.subjects.find((s) => s.anchor === 'class');
    expect(legacy).toMatchObject({
      classId: 'c-1',
      subjectLabel: 'English',
      classLabel: 'JSS 1 B',
    });
    // Both subjects sit in the same term, so the term average spans them.
    expect(report.termSummaries).toHaveLength(1);
    expect(report.termSummaries[0]!.avgPercentage).toBe(70);
  });

  it('groups every grade of one offering into a single subject row', async () => {
    ctx.client.grade.findMany.mockResolvedValue([
      structuredGrade({ id: 'g1', assessmentId: 'a-structured' }),
      structuredGrade({
        id: 'g2',
        percentage: 60,
        assessment: {
          ...structuredGrade().assessment,
          id: 'a-structured-2',
          name: 'Maths CA2',
        },
      }),
    ] as never);

    const report = await ctx.service.getStudentReportCard(
      TENANT,
      admin as never,
      'stu-1',
    );

    expect(report.subjects).toHaveLength(1);
    expect(report.subjects[0]!.assessments).toHaveLength(2);
    expect(report.subjects[0]!.summary.percentage).toBe(70);
  });

  it('takes the term from a YEAR-LONG offering by falling back to the assessment', async () => {
    ctx.client.subjectOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        subjectLabel: 'Mathematics',
        termId: null, // year-long: no term of its own
        classSection: { displayLabel: 'JSS 1 Gold' },
      },
    ] as never);
    ctx.client.grade.findMany.mockResolvedValue([structuredGrade()] as never);

    const report = await ctx.service.getStudentReportCard(
      TENANT,
      admin as never,
      'stu-1',
    );

    expect(report.subjects[0]!.termId).toBe('t1');
    expect(report.termSummaries[0]!.termName).toBe('First Term');
  });
});

describe('a teacher is scoped by the offerings they teach', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('narrows structured rows to taught offerings and legacy rows to taught classes', async () => {
    await ctx.service.getStudentReportCard(TENANT, teacher as never, 'stu-1');

    expect(ctx.access.getTaughtOfferingIds).toHaveBeenCalledWith(
      TENANT,
      'p-teacher',
    );
    expect(whereFrom(ctx.client).assessment.OR).toEqual([
      { subjectOfferingId: { in: ['off-1'] } },
      { subjectOfferingId: null, classId: { in: ['c-1'] } },
    ]);
  });

  it('does not narrow at all for an actor holding the manage-all override', async () => {
    await ctx.service.getStudentReportCard(TENANT, admin as never, 'stu-1');

    expect(ctx.access.getTaughtOfferingIds).not.toHaveBeenCalled();
    expect(whereFrom(ctx.client).assessment.OR).toBeUndefined();
  });
});

describe('listGradesForStudent shares the same anchor', () => {
  it('reads by student and scopes by offering', async () => {
    const ctx = makeService();
    ctx.client.grade.findMany.mockResolvedValue([structuredGrade()] as never);

    const grades = await ctx.service.listGradesForStudent(
      TENANT,
      teacher as never,
      'stu-1',
    );

    expect(grades).toHaveLength(1);
    const where = whereFrom(ctx.client);
    expect(where.OR).toEqual([
      { studentId: 'stu-1' },
      { enrollment: { studentId: 'stu-1' } },
    ]);
    expect(where.assessment.OR[0]).toEqual({
      subjectOfferingId: { in: ['off-1'] },
    });
  });
});
