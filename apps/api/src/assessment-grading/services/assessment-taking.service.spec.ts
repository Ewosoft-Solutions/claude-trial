/**
 * AssessmentTakingService unit tests — the server-side marking contract
 * (docs/academics-reuse-assessment.md §2.4): objective answers are marked
 * from the bank's answer key (never client scores), fully-objective papers
 * grade straight into the gradebook, essays park for manual grading, and
 * attempt/deadline/timer limits are enforced.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AssessmentTakingService } from './assessment-taking.service';

const TENANT = 'tenant-1';
const ACTOR = {
  userId: 'user-1',
  profileId: 'profile-1',
  canViewAll: false,
  canManageAll: false,
};
const TEACHER = { ...ACTOR, canViewAll: true, canManageAll: true };

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

function paperRow(
  questionId: string,
  points: number,
  style: string,
  correctAnswer: string | null,
) {
  return { questionId, points, question: { style, correctAnswer } };
}

function makeService(overrides: {
  assessment?: Record<string, unknown> | null;
  paper?: ReturnType<typeof paperRow>[];
  attempts?: Array<Record<string, unknown>>;
  enrollment?: Record<string, unknown> | null;
  submissionUpdateCount?: number;
}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const gradeUpserts: Record<string, unknown>[] = [];

  const client = {
    assessment: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.assessment === undefined
          ? {
              id: 'assessment-1',
              classId: 'class-1',
              status: 'published',
              dueDate: futureDate,
              durationMinutes: null,
              maxAttempts: 1,
              maxPoints: 10,
              name: 'Quiz',
              type: 'quiz',
              instructions: null,
              gradingSystem: null,
            }
          : overrides.assessment,
      ),
    },
    assessmentQuestion: {
      findMany: jest.fn().mockResolvedValue(overrides.paper ?? []),
    },
    assessmentSubmission: {
      findMany: jest.fn().mockResolvedValue(overrides.attempts ?? []),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve({
          id: 'submission-1',
          ...(updated.at(-1) ?? {}),
        }),
      ),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return Promise.resolve({ id: 'submission-1', ...data });
        }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          updated.push(data);
          return Promise.resolve({ id: 'submission-1', ...data });
        }),
      updateMany: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          if (overrides.submissionUpdateCount === 0) {
            return Promise.resolve({ count: 0 });
          }
          updated.push(data);
          return Promise.resolve({ count: 1 });
        }),
    },
    grade: {
      upsert: jest.fn().mockImplementation((args: Record<string, unknown>) => {
        gradeUpserts.push(args);
        return Promise.resolve({});
      }),
    },
  };

  const access = {
    findActiveEnrollment: jest
      .fn()
      .mockResolvedValue(
        overrides.enrollment === undefined
          ? { id: 'enrollment-1', studentId: 'student-1', classId: 'class-1' }
          : overrides.enrollment,
      ),
    assertCanManageClass: jest.fn().mockResolvedValue(undefined),
  };

  const grading = {
    computeGrade: jest.fn().mockReturnValue({ percentage: undefined }),
  };

  const service = new AssessmentTakingService(
    { client } as never,
    { isScoped: false, client: null } as never,
    access as never,
    grading as never,
  );

  return { service, client, access, grading, created, updated, gradeUpserts };
}

describe('AssessmentTakingService.submit', () => {
  it('auto-marks objective papers and upserts the gradebook Grade', async () => {
    const { service, created, gradeUpserts } = makeService({
      paper: [
        paperRow('q1', 2, 'mcq', 'A'),
        paperRow('q2', 3, 'true_false', 'true'),
        paperRow('q3', 5, 'short_answer', 'Chlorophyll'),
      ],
    });

    const submission = await service.submit(TENANT, ACTOR, 'assessment-1', {
      answers: [
        { questionId: 'q1', answer: 'a' }, // correct (case-insensitive)
        { questionId: 'q2', answer: 'false' }, // wrong
        { questionId: 'q3', answer: '  chlorophyll ' }, // correct (trimmed)
      ],
    });

    expect(created).toHaveLength(1);
    expect(submission.status).toBe('graded');
    expect(submission.needsManualGrading).toBe(false);
    expect(Number(submission.pointsEarned)).toBe(7);
    expect(Number(submission.maxPoints)).toBe(10);
    expect(Number(submission.percentage)).toBe(70);
    expect(gradeUpserts).toHaveLength(1);
    expect(gradeUpserts[0].where).toEqual({
      enrollmentId_assessmentId: {
        enrollmentId: 'enrollment-1',
        assessmentId: 'assessment-1',
      },
    });
  });

  it('parks papers with essays as needs-manual-grading without touching the gradebook', async () => {
    const { service, gradeUpserts } = makeService({
      paper: [paperRow('q1', 2, 'mcq', 'A'), paperRow('q2', 8, 'essay', null)],
    });

    const submission = await service.submit(TENANT, ACTOR, 'assessment-1', {
      answers: [
        { questionId: 'q1', answer: 'A' },
        { questionId: 'q2', answer: 'Long essay text…' },
      ],
    });

    expect(submission.status).toBe('submitted');
    expect(submission.needsManualGrading).toBe(true);
    expect(Number(submission.pointsEarned)).toBe(2); // objective part pre-marked
    expect(submission.percentage).toBeNull();
    expect(gradeUpserts).toHaveLength(0);
  });

  it('rejects answers for questions not on the paper', async () => {
    const { service } = makeService({ paper: [paperRow('q1', 1, 'mcq', 'A')] });
    await expect(
      service.submit(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q-other', answer: 'A' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces maxAttempts', async () => {
    const { service } = makeService({
      paper: [paperRow('q1', 1, 'mcq', 'A')],
      attempts: [
        { id: 's1', attempt: 1, status: 'graded', startedAt: new Date() },
      ],
    });
    await expect(
      service.submit(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q1', answer: 'A' }],
      }),
    ).rejects.toThrow(/attempt/);
  });

  it('enforces the timer on started attempts (with grace)', async () => {
    const { service } = makeService({
      assessment: {
        id: 'assessment-1',
        classId: 'class-1',
        status: 'published',
        dueDate: futureDate,
        durationMinutes: 30,
        maxAttempts: 1,
        maxPoints: 10,
        gradingSystem: null,
      },
      paper: [paperRow('q1', 1, 'mcq', 'A')],
      attempts: [
        {
          id: 's1',
          attempt: 1,
          status: 'in_progress',
          startedAt: new Date(Date.now() - 45 * 60 * 1000), // started 45m ago
        },
      ],
    });
    await expect(
      service.submit(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q1', answer: 'A' }],
      }),
    ).rejects.toThrow(/Time is up/);
  });

  it('does not overwrite an attempt concurrently submitted elsewhere', async () => {
    const { service } = makeService({
      paper: [paperRow('q1', 1, 'mcq', 'A')],
      attempts: [
        {
          id: 's1',
          attempt: 1,
          status: 'in_progress',
          startedAt: new Date(),
        },
      ],
      submissionUpdateCount: 0,
    });

    await expect(
      service.submit(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q1', answer: 'A' }],
      }),
    ).rejects.toThrow(/already been submitted/);
  });

  it('refuses unpublished assessments and non-enrolled students', async () => {
    const draft = makeService({
      assessment: {
        id: 'assessment-1',
        classId: 'class-1',
        status: 'draft',
        dueDate: null,
        maxAttempts: 1,
        gradingSystem: null,
      },
    });
    await expect(
      draft.service.submit(TENANT, ACTOR, 'assessment-1', { answers: [] }),
    ).rejects.toThrow(/not open/);

    const notEnrolled = makeService({
      paper: [paperRow('q1', 1, 'mcq', 'A')],
      enrollment: null,
    });
    await expect(
      notEnrolled.service.submit(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q1', answer: 'A' }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('AssessmentTakingService.saveDraft', () => {
  it('persists answers only on the active attempt without grading', async () => {
    const { service, client, updated, gradeUpserts } = makeService({
      paper: [paperRow('q1', 2, 'mcq', 'A')],
    });
    client.assessmentSubmission.findFirst.mockResolvedValue({
      id: 'submission-1',
      startedAt: new Date(),
    });

    const result = await service.saveDraft(TENANT, ACTOR, 'assessment-1', {
      answers: [{ questionId: 'q1', answer: 'B' }],
    });

    expect(updated).toEqual([{ answers: [{ questionId: 'q1', answer: 'B' }] }]);
    expect(result).toEqual(
      expect.objectContaining({
        id: 'submission-1',
        answers: [{ questionId: 'q1', answer: 'B' }],
      }),
    );
    expect(gradeUpserts).toHaveLength(0);
  });

  it('rejects draft writes without an active attempt', async () => {
    const { service } = makeService({
      paper: [paperRow('q1', 2, 'mcq', 'A')],
    });

    await expect(
      service.saveDraft(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q1', answer: 'B' }],
      }),
    ).rejects.toThrow(/Start the assessment/);
  });

  it('does not let a late draft overwrite a submitted attempt', async () => {
    const { service, client } = makeService({
      paper: [paperRow('q1', 2, 'mcq', 'A')],
      submissionUpdateCount: 0,
    });
    client.assessmentSubmission.findFirst.mockResolvedValue({
      id: 'submission-1',
      startedAt: new Date(),
    });

    await expect(
      service.saveDraft(TENANT, ACTOR, 'assessment-1', {
        answers: [{ questionId: 'q1', answer: 'B' }],
      }),
    ).rejects.toThrow(/no longer active/);
  });
});

describe('AssessmentTakingService.gradeSubmission', () => {
  function makeGradingService(submission: Record<string, unknown> | null) {
    const gradeUpserts: unknown[] = [];
    const updates: Array<{ data: Record<string, unknown> }> = [];
    const client = {
      assessmentSubmission: {
        findFirst: jest.fn().mockResolvedValue(submission),
        update: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) => {
            updates.push(args);
            return Promise.resolve({ id: 'submission-1', ...args.data });
          }),
      },
      grade: {
        upsert: jest.fn().mockImplementation((args) => {
          gradeUpserts.push(args);
          return Promise.resolve({});
        }),
      },
    };
    const access = {
      assertCanManageClass: jest.fn().mockResolvedValue(undefined),
    };
    const grading = { computeGrade: jest.fn().mockReturnValue({}) };
    const service = new AssessmentTakingService(
      { client } as never,
      { isScoped: false, client: null } as never,
      access as never,
      grading as never,
    );
    return { service, gradeUpserts, updates };
  }

  const baseSubmission = {
    id: 'submission-1',
    enrollmentId: 'enrollment-1',
    status: 'submitted',
    maxPoints: 10,
    assessment: {
      id: 'assessment-1',
      classId: 'class-1',
      maxPoints: 10,
      gradingSystem: null,
    },
  };

  it('records the manual total and upserts the Grade', async () => {
    const { service, gradeUpserts, updates } =
      makeGradingService(baseSubmission);
    const result = await service.gradeSubmission(
      TENANT,
      TEACHER,
      'submission-1',
      {
        pointsEarned: 8,
      },
    );
    expect(result.status).toBe('graded');
    expect(updates[0].data.needsManualGrading).toBe(false);
    expect(gradeUpserts).toHaveLength(1);
  });

  it('rejects totals above the paper maximum and ungraded in-progress attempts', async () => {
    const { service } = makeGradingService(baseSubmission);
    await expect(
      service.gradeSubmission(TENANT, TEACHER, 'submission-1', {
        pointsEarned: 11,
      }),
    ).rejects.toThrow(/cannot exceed/);

    const inProgress = makeGradingService({
      ...baseSubmission,
      status: 'in_progress',
    });
    await expect(
      inProgress.service.gradeSubmission(TENANT, TEACHER, 'submission-1', {
        pointsEarned: 5,
      }),
    ).rejects.toThrow(/not been handed in/);
  });
});
