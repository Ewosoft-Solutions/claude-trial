import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import { AssessmentGradingService } from './assessment-grading.service';
import {
  AUTO_GRADABLE_STYLES,
  GradeSubmissionDto,
  SubmitAssessmentDto,
  type QuestionStyle,
} from '../dto/question-bank.dto';

/** Late-submission grace after the timer expires (network/clock slack). */
const DURATION_GRACE_MS = 30 * 1000;

const SUBMISSION_SELECT = {
  id: true,
  assessmentId: true,
  enrollmentId: true,
  attempt: true,
  answers: true,
  pointsEarned: true,
  maxPoints: true,
  percentage: true,
  needsManualGrading: true,
  status: true,
  startedAt: true,
  submittedAt: true,
  gradedAt: true,
  gradedBy: true,
} as const;

interface PaperQuestion {
  questionId: string;
  points: number;
  style: QuestionStyle;
  correctAnswer: string | null;
}

/**
 * Online assessment taking: students start (timed), receive the paper
 * without answers, and submit; objective styles are marked server-side
 * (never trusting client scores — learn-lift answer-sheet workflow,
 * docs/academics-reuse-assessment.md §2.4) and fully-objective papers
 * grade straight into the gradebook (Grade upsert). Papers with essays
 * park as needs-manual-grading for the teacher.
 */
@Injectable()
export class AssessmentTakingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly access: AcademicsAccessService,
    private readonly grading: AssessmentGradingService,
  ) {}

  /** Scoped app_runtime client inside a @TenantScoped request; else privileged. */
  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  // ---------- Student-side helpers ----------

  private async getTakeableAssessment(tenantId: string, assessmentId: string) {
    const assessment = await this.client.assessment.findFirst({
      where: { id: assessmentId, class: { academicYear: { tenantId } } },
      include: {
        gradingSystem: { select: { gradeScale: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== 'published') {
      throw new BadRequestException('Assessment is not open for taking');
    }
    if (assessment.dueDate && assessment.dueDate.getTime() < Date.now()) {
      throw new BadRequestException('The deadline for this assessment has passed');
    }
    return assessment;
  }

  private async getOwnEnrollment(
    tenantId: string,
    actor: AcademicsActor,
    classId: string,
  ) {
    const enrollment = await this.access.findActiveEnrollment(
      tenantId,
      actor.profileId,
      classId,
    );
    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this class');
    }
    return enrollment;
  }

  /**
   * The paper as a student sees it: ordered questions with options but
   * WITHOUT correctAnswer/solution.
   */
  async getPaperForStudent(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    const assessment = await this.getTakeableAssessment(tenantId, assessmentId);
    await this.getOwnEnrollment(tenantId, actor, assessment.classId);

    const paper = await this.client.assessmentQuestion.findMany({
      where: { assessmentId, tenantId },
      select: {
        order: true,
        points: true,
        question: {
          select: {
            id: true,
            style: true,
            instruction: true,
            text: true,
            imageKey: true,
            options: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });
    if (paper.length === 0) {
      throw new BadRequestException('This assessment has no questions yet');
    }

    return {
      assessment: {
        id: assessment.id,
        name: assessment.name,
        type: assessment.type,
        instructions: assessment.instructions,
        dueDate: assessment.dueDate,
        durationMinutes: assessment.durationMinutes,
        maxAttempts: assessment.maxAttempts,
        maxPoints: assessment.maxPoints,
      },
      questions: paper,
    };
  }

  /**
   * Start a (timed) attempt. Counts against maxAttempts immediately so
   * parallel/abandoned attempts can't be farmed.
   */
  async startAttempt(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    const assessment = await this.getTakeableAssessment(tenantId, assessmentId);
    const enrollment = await this.getOwnEnrollment(
      tenantId,
      actor,
      assessment.classId,
    );

    const attempts = await this.client.assessmentSubmission.findMany({
      where: { assessmentId, enrollmentId: enrollment.id },
      select: { id: true, attempt: true, status: true },
      orderBy: { attempt: 'desc' },
    });

    const open = attempts.find((a) => a.status === 'in_progress');
    if (open) {
      // Resume rather than burning another attempt.
      return this.client.assessmentSubmission.findFirst({
        where: { id: open.id },
        select: SUBMISSION_SELECT,
      });
    }

    if (attempts.length >= assessment.maxAttempts) {
      throw new BadRequestException(
        `You have used all ${assessment.maxAttempts} attempt(s)`,
      );
    }

    return this.client.assessmentSubmission.create({
      data: {
        tenantId,
        assessmentId,
        enrollmentId: enrollment.id,
        attempt: (attempts[0]?.attempt ?? 0) + 1,
        answers: [],
        status: 'in_progress',
      },
      select: SUBMISSION_SELECT,
    });
  }

  /**
   * Submit answers. Marks objective questions server-side; if the whole
   * paper is auto-gradable the submission grades immediately and the
   * gradebook Grade is upserted. Essay/short-answer papers park as
   * 'submitted' + needsManualGrading for the teacher.
   */
  async submit(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
    dto: SubmitAssessmentDto,
  ) {
    const assessment = await this.getTakeableAssessment(tenantId, assessmentId);
    const enrollment = await this.getOwnEnrollment(
      tenantId,
      actor,
      assessment.classId,
    );

    const paperRows = await this.client.assessmentQuestion.findMany({
      where: { assessmentId, tenantId },
      select: {
        questionId: true,
        points: true,
        question: { select: { style: true, correctAnswer: true } },
      },
    });
    if (paperRows.length === 0) {
      throw new BadRequestException('This assessment has no questions yet');
    }
    const paper: PaperQuestion[] = paperRows.map((row) => ({
      questionId: row.questionId,
      points: Number(row.points),
      style: row.question.style as QuestionStyle,
      correctAnswer: row.question.correctAnswer,
    }));

    const knownIds = new Set(paper.map((q) => q.questionId));
    const answeredIds = new Set<string>();
    for (const answer of dto.answers) {
      if (!knownIds.has(answer.questionId)) {
        throw new BadRequestException(
          `Question ${answer.questionId} is not on this assessment`,
        );
      }
      if (answeredIds.has(answer.questionId)) {
        throw new BadRequestException(
          `Duplicate answer for question ${answer.questionId}`,
        );
      }
      answeredIds.add(answer.questionId);
    }

    const attempts = await this.client.assessmentSubmission.findMany({
      where: { assessmentId, enrollmentId: enrollment.id },
      select: { id: true, attempt: true, status: true, startedAt: true },
      orderBy: { attempt: 'desc' },
    });
    const open = attempts.find((a) => a.status === 'in_progress');

    if (!open && attempts.length >= assessment.maxAttempts) {
      throw new BadRequestException(
        `You have used all ${assessment.maxAttempts} attempt(s)`,
      );
    }

    // Timer enforcement for started attempts.
    if (open && assessment.durationMinutes) {
      const deadline =
        open.startedAt.getTime() +
        assessment.durationMinutes * 60 * 1000 +
        DURATION_GRACE_MS;
      if (Date.now() > deadline) {
        throw new BadRequestException('Time is up for this attempt');
      }
    }

    const marking = this.mark(paper, dto.answers);

    const data = {
      answers: dto.answers as object[],
      pointsEarned: marking.autoPoints,
      maxPoints: marking.maxPoints,
      percentage: marking.needsManualGrading
        ? null
        : this.percentage(marking.autoPoints, marking.maxPoints),
      needsManualGrading: marking.needsManualGrading,
      status: marking.needsManualGrading ? 'submitted' : 'graded',
      submittedAt: new Date(),
      ...(marking.needsManualGrading ? {} : { gradedAt: new Date() }),
    };

    const submission = open
      ? await this.client.assessmentSubmission.update({
          where: { id: open.id },
          data,
          select: SUBMISSION_SELECT,
        })
      : await this.client.assessmentSubmission.create({
          data: {
            tenantId,
            assessmentId,
            enrollmentId: enrollment.id,
            attempt: (attempts[0]?.attempt ?? 0) + 1,
            ...data,
          },
          select: SUBMISSION_SELECT,
        });

    if (!marking.needsManualGrading) {
      await this.upsertGrade(
        tenantId,
        enrollment.id,
        assessment,
        marking.autoPoints,
        null,
        null,
      );
    }

    return submission;
  }

  /** Objective marking: exact label match (case-insensitive, trimmed). */
  private mark(
    paper: PaperQuestion[],
    answers: Array<{ questionId: string; answer: string }>,
  ): { autoPoints: number; maxPoints: number; needsManualGrading: boolean } {
    const byQuestion = new Map(answers.map((a) => [a.questionId, a.answer]));
    let autoPoints = 0;
    let maxPoints = 0;
    let needsManualGrading = false;

    for (const question of paper) {
      maxPoints += question.points;
      if (!AUTO_GRADABLE_STYLES.includes(question.style)) {
        needsManualGrading = true;
        continue;
      }
      const given = byQuestion.get(question.questionId);
      if (!given || !question.correctAnswer) continue;
      if (
        given.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase()
      ) {
        autoPoints += question.points;
      }
    }

    return { autoPoints, maxPoints, needsManualGrading };
  }

  private percentage(points: number, maxPoints: number): number | null {
    if (!maxPoints) return null;
    return Math.round((points / maxPoints) * 10000) / 100;
  }

  /** Latest graded attempt lands in the gradebook (one Grade per enrollment+assessment). */
  private async upsertGrade(
    tenantId: string,
    enrollmentId: string,
    assessment: {
      id: string;
      maxPoints: unknown;
      gradingSystem: { gradeScale: unknown } | null;
    },
    pointsEarned: number,
    gradedBy: string | null,
    feedback: string | null,
  ) {
    const maxPoints = Number(assessment.maxPoints);
    const computed = this.grading.computeGrade(
      pointsEarned,
      maxPoints,
      assessment.gradingSystem?.gradeScale,
    );

    const values = {
      pointsEarned,
      percentage: computed.percentage ?? this.percentage(pointsEarned, maxPoints),
      letterGrade: computed.letterGrade ?? null,
      gpaPoints: computed.gpaPoints ?? null,
      status: 'graded',
      gradedAt: new Date(),
      gradedBy,
      ...(feedback !== null ? { feedback } : {}),
    };

    await this.client.grade.upsert({
      where: {
        enrollmentId_assessmentId: {
          enrollmentId,
          assessmentId: assessment.id,
        },
      },
      update: values,
      create: {
        tenantId,
        enrollmentId,
        assessmentId: assessment.id,
        submittedAt: new Date(),
        ...values,
      },
    });
  }

  // ---------- Submission review (teacher + student) ----------

  async listSubmissions(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    const assessment = await this.client.assessment.findFirst({
      where: { id: assessmentId, class: { academicYear: { tenantId } } },
      select: { id: true, classId: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.access.assertCanManageClass(tenantId, actor, assessment.classId);

    return this.client.assessmentSubmission.findMany({
      where: { assessmentId, tenantId },
      select: {
        ...SUBMISSION_SELECT,
        enrollment: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                studentNumber: true,
                userTenant: {
                  select: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }],
    });
  }

  /** A student's own attempts for one assessment (no answer keys). */
  async listOwnSubmissions(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    const assessment = await this.client.assessment.findFirst({
      where: { id: assessmentId, class: { academicYear: { tenantId } } },
      select: { id: true, classId: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const enrollment = await this.getOwnEnrollment(
      tenantId,
      actor,
      assessment.classId,
    );

    return this.client.assessmentSubmission.findMany({
      where: { assessmentId, enrollmentId: enrollment.id },
      select: SUBMISSION_SELECT,
      orderBy: { attempt: 'asc' },
    });
  }

  /**
   * Manual grading: the teacher reviews non-auto-gradable answers and
   * records the final total; the gradebook Grade is upserted with it.
   */
  async gradeSubmission(
    tenantId: string,
    actor: AcademicsActor,
    submissionId: string,
    dto: GradeSubmissionDto,
  ) {
    const submission = await this.client.assessmentSubmission.findFirst({
      where: { id: submissionId, tenantId },
      include: {
        assessment: {
          include: { gradingSystem: { select: { gradeScale: true } } },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status === 'in_progress') {
      throw new BadRequestException('Submission has not been handed in yet');
    }
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      submission.assessment.classId,
    );

    const maxPoints = Number(submission.maxPoints ?? 0);
    if (maxPoints && dto.pointsEarned > maxPoints) {
      throw new BadRequestException(
        `pointsEarned cannot exceed the paper total (${maxPoints})`,
      );
    }

    const updated = await this.client.assessmentSubmission.update({
      where: { id: submission.id },
      data: {
        pointsEarned: dto.pointsEarned,
        percentage: this.percentage(dto.pointsEarned, maxPoints),
        needsManualGrading: false,
        status: 'graded',
        gradedAt: new Date(),
        gradedBy: actor.profileId,
      },
      select: SUBMISSION_SELECT,
    });

    await this.upsertGrade(
      tenantId,
      submission.enrollmentId,
      submission.assessment,
      dto.pointsEarned,
      actor.profileId,
      dto.feedback ?? null,
    );

    return updated;
  }
}
