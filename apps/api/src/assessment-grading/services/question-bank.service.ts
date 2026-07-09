import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import {
  AttachQuestionsDto,
  CreateQuestionDto,
  ListQuestionsDto,
  UpdateQuestionDto,
  type QuestionStyle,
} from '../dto/question-bank.dto';

/** Full row minus grading secrets — safe for teachers (owners see answers). */
const QUESTION_SELECT = {
  id: true,
  courseId: true,
  style: true,
  instruction: true,
  text: true,
  imageKey: true,
  options: true,
  correctAnswer: true,
  solution: true,
  difficulty: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Course-scoped question bank (learn-lift/gau question module adapted to
 * Postgres + tenancy — docs/academics-reuse-assessment.md §2.3) and the
 * assessment "paper" (AssessmentQuestion attachments).
 *
 * Authoring bar: active ClassTeacher on any class of the course, or the
 * `assessments.manage.all` override.
 */
@Injectable()
export class QuestionBankService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly access: AcademicsAccessService,
  ) {}

  /** Scoped app_runtime client inside a @TenantScoped request; else privileged. */
  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  private validateStyleFields(
    style: QuestionStyle,
    options: unknown[] | undefined,
    correctAnswer: string | undefined,
  ) {
    if (style === 'mcq') {
      if (!options || options.length < 2) {
        throw new BadRequestException('MCQ questions need at least 2 options');
      }
      const labels = (options as Array<{ label: string }>).map((o) =>
        o.label.toUpperCase(),
      );
      if (new Set(labels).size !== labels.length) {
        throw new BadRequestException('Option labels must be unique');
      }
      if (!correctAnswer || !labels.includes(correctAnswer.toUpperCase())) {
        throw new BadRequestException(
          'correctAnswer must match one of the option labels',
        );
      }
    }
    if (style === 'true_false') {
      const normalized = correctAnswer?.trim().toLowerCase();
      if (normalized !== 'true' && normalized !== 'false') {
        throw new BadRequestException(
          "true_false questions need correctAnswer 'true' or 'false'",
        );
      }
    }
    if (style === 'short_answer' && !correctAnswer?.trim()) {
      throw new BadRequestException(
        'short_answer questions need a model correctAnswer',
      );
    }
  }

  // ---------- Question bank CRUD ----------

  async createQuestion(
    tenantId: string,
    actor: AcademicsActor,
    dto: CreateQuestionDto,
  ) {
    const course = await this.client.course.findFirst({
      where: { id: dto.courseId, tenantId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    await this.access.assertCanManageCourseBank(tenantId, actor, dto.courseId);

    const style = dto.style ?? 'mcq';
    this.validateStyleFields(style, dto.options, dto.correctAnswer);

    return this.client.question.create({
      data: {
        tenantId,
        courseId: dto.courseId,
        style,
        instruction: dto.instruction ?? null,
        text: dto.text,
        imageKey: dto.imageKey ?? null,
        options: dto.options ? (dto.options.map((o) => ({ ...o })) as object[]) : undefined,
        correctAnswer: dto.correctAnswer ?? null,
        solution: dto.solution ?? null,
        difficulty: dto.difficulty ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      select: QUESTION_SELECT,
    });
  }

  async listQuestions(
    tenantId: string,
    actor: AcademicsActor,
    query: ListQuestionsDto,
  ) {
    const taughtCourseIds = actor.canManageAll
      ? undefined
      : await this.access.getTaughtCourseIds(tenantId, actor.profileId);

    if (query.courseId && !actor.canManageAll) {
      await this.access.assertCanManageCourseBank(
        tenantId,
        actor,
        query.courseId,
      );
    }

    return this.client.question.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(query.courseId
          ? { courseId: query.courseId }
          : taughtCourseIds
            ? { courseId: { in: taughtCourseIds } }
            : {}),
        ...(query.style ? { style: query.style } : {}),
        ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      },
      select: QUESTION_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 10),
      take: query.limit ?? 10,
    });
  }

  async getQuestion(tenantId: string, actor: AcademicsActor, id: string) {
    const question = await this.client.question.findFirst({
      where: { id, tenantId },
      select: QUESTION_SELECT,
    });
    if (!question) throw new NotFoundException('Question not found');
    await this.access.assertCanManageCourseBank(
      tenantId,
      actor,
      question.courseId,
    );
    return question;
  }

  async updateQuestion(
    tenantId: string,
    actor: AcademicsActor,
    id: string,
    dto: UpdateQuestionDto,
  ) {
    const question = await this.client.question.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        courseId: true,
        style: true,
        options: true,
        correctAnswer: true,
      },
    });
    if (!question) throw new NotFoundException('Question not found');

    await this.access.assertCanManageCourseBank(
      tenantId,
      actor,
      question.courseId,
    );

    const style = (dto.style ?? question.style) as QuestionStyle;
    const options =
      dto.options ?? (question.options as unknown[] | null) ?? undefined;
    const correctAnswer = dto.correctAnswer ?? question.correctAnswer ?? undefined;
    this.validateStyleFields(style, options ?? undefined, correctAnswer);

    return this.client.question.update({
      where: { id },
      data: {
        ...(dto.style !== undefined ? { style: dto.style } : {}),
        ...(dto.instruction !== undefined ? { instruction: dto.instruction } : {}),
        ...(dto.text !== undefined ? { text: dto.text } : {}),
        ...(dto.imageKey !== undefined ? { imageKey: dto.imageKey } : {}),
        ...(dto.options !== undefined
          ? { options: dto.options.map((o) => ({ ...o })) as object[] }
          : {}),
        ...(dto.correctAnswer !== undefined
          ? { correctAnswer: dto.correctAnswer }
          : {}),
        ...(dto.solution !== undefined ? { solution: dto.solution } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedBy: actor.userId,
      },
      select: QUESTION_SELECT,
    });
  }

  async deleteQuestion(tenantId: string, actor: AcademicsActor, id: string) {
    const question = await this.client.question.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        courseId: true,
        _count: { select: { assessmentQuestions: true } },
      },
    });
    if (!question) throw new NotFoundException('Question not found');

    await this.access.assertCanManageCourseBank(
      tenantId,
      actor,
      question.courseId,
    );

    if (question._count.assessmentQuestions > 0) {
      // Attached questions are part of graded papers — retire instead of
      // destroying the history.
      await this.client.question.update({
        where: { id },
        data: { isActive: false, updatedBy: actor.userId },
      });
      return { deleted: false, retired: true };
    }

    await this.client.question.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- Assessment paper (attach/detach questions) ----------

  private async getManagedAssessment(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    const assessment = await this.client.assessment.findFirst({
      where: { id: assessmentId, class: { academicYear: { tenantId } } },
      select: {
        id: true,
        classId: true,
        status: true,
        class: { select: { courseId: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      assessment.classId,
    );
    return assessment;
  }

  async attachQuestions(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
    dto: AttachQuestionsDto,
  ) {
    const assessment = await this.getManagedAssessment(
      tenantId,
      actor,
      assessmentId,
    );

    const questionIds = dto.questions.map((q) => q.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException('Duplicate questionIds in request');
    }

    // Paper questions must come from the bank of the course being assessed.
    const questions = await this.client.question.findMany({
      where: {
        id: { in: questionIds },
        tenantId,
        courseId: assessment.class.courseId,
        isActive: true,
      },
      select: { id: true },
    });
    if (questions.length !== questionIds.length) {
      throw new BadRequestException(
        "Some questions were not found in this course's bank",
      );
    }

    const existing = await this.client.assessmentQuestion.findMany({
      where: { assessmentId, questionId: { in: questionIds } },
      select: { questionId: true },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        'Some questions are already attached to this assessment',
      );
    }

    const currentCount = await this.client.assessmentQuestion.count({
      where: { assessmentId },
    });

    await this.client.assessmentQuestion.createMany({
      data: dto.questions.map((q, index) => ({
        tenantId,
        assessmentId,
        questionId: q.questionId,
        order: q.order ?? currentCount + index,
        points: q.points ?? 1,
      })),
    });

    return this.listPaper(tenantId, actor, assessmentId);
  }

  async detachQuestion(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
    questionId: string,
  ) {
    await this.getManagedAssessment(tenantId, actor, assessmentId);

    const attachment = await this.client.assessmentQuestion.findFirst({
      where: { assessmentId, questionId },
      select: { id: true },
    });
    if (!attachment) {
      throw new NotFoundException('Question is not attached to this assessment');
    }

    await this.client.assessmentQuestion.delete({
      where: { id: attachment.id },
    });
    return { detached: true };
  }

  /** The paper as the teacher sees it (with answers/solutions). */
  async listPaper(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    await this.getManagedAssessment(tenantId, actor, assessmentId);

    return this.client.assessmentQuestion.findMany({
      where: { assessmentId, tenantId },
      include: { question: { select: QUESTION_SELECT } },
      orderBy: { order: 'asc' },
    });
  }
}
