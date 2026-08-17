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
  curriculumSubjectId: true,
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

  /**
   * Guard a bank entry by its OWN anchor: the curriculum subject for a re-keyed
   * entry, the legacy course for one the backfill has not reached. Asking only
   * the course question would refuse every teacher on a subject-keyed entry —
   * the same trap the assessment anchors set, one layer down.
   */
  private async assertCanManageQuestionAnchor(
    tenantId: string,
    actor: AcademicsActor,
    question: { curriculumSubjectId: string | null; courseId: string | null },
  ): Promise<void> {
    if (question.curriculumSubjectId) {
      await this.access.assertCanManageCurriculumSubject(
        tenantId,
        actor,
        question.curriculumSubjectId,
      );
      return;
    }
    if (!question.courseId) {
      // Neither anchor: nothing can authorise it, so nobody but an admin may.
      if (actor.canManageAll) return;
      throw new ForbiddenException(
        'This bank entry has no subject or course, so its access cannot be checked',
      );
    }
    await this.access.assertCanManageCourseBank(
      tenantId,
      actor,
      question.courseId,
    );
  }

  /**
   * The curriculum subjects this actor may author bank entries for — the
   * picker behind the question-bank workbench.
   *
   * Served from here rather than pointing the workbench at
   * `/academics/structure/offerable-subjects`, which requires
   * `academics.structure.view`: a teacher holds `questions.view`, so the
   * registrar endpoint would 403 exactly the people who need the picker.
   */
  async listTeachableSubjects(tenantId: string, actor: AcademicsActor) {
    const offerings = await this.client.subjectOffering.findMany({
      where: {
        tenantId,
        status: 'active',
        ...(actor.canManageAll
          ? {}
          : {
              id: {
                in: await this.access.getTaughtOfferingIds(
                  tenantId,
                  actor.profileId,
                ),
              },
            }),
      },
      select: { curriculumSubjectId: true, subjectLabel: true },
      orderBy: [{ subjectLabel: 'asc' }],
    });

    // One row per SUBJECT: a subject offered to four sections is still one
    // bank, and listing it four times would suggest otherwise.
    const byId = new Map<string, { id: string; name: string }>();
    for (const offering of offerings) {
      if (!byId.has(offering.curriculumSubjectId)) {
        byId.set(offering.curriculumSubjectId, {
          id: offering.curriculumSubjectId,
          name: offering.subjectLabel,
        });
      }
    }
    return Array.from(byId.values());
  }

  // ---------- Question bank CRUD ----------

  async createQuestion(
    tenantId: string,
    actor: AcademicsActor,
    dto: CreateQuestionDto,
  ) {
    // Two anchors during the migration: the structured CurriculumSubject (what
    // a bank should key on) and the legacy Course. Exactly one is required, and
    // the subject wins when both arrive.
    if (!dto.curriculumSubjectId && !dto.courseId) {
      throw new BadRequestException(
        'A bank entry needs a curriculum subject (or, for legacy callers, a course).',
      );
    }

    if (dto.curriculumSubjectId) {
      // Soft reference across schemas — curriculum_subjects carries a nullable
      // tenant_id for shared national rows, so this is validated here rather
      // than by a foreign key, the same way SubjectOffering does it.
      const subject = await this.client.curriculumSubject.findFirst({
        where: { id: dto.curriculumSubjectId },
        select: { id: true },
      });
      if (!subject) throw new NotFoundException('Curriculum subject not found');
      await this.access.assertCanManageCurriculumSubject(
        tenantId,
        actor,
        dto.curriculumSubjectId,
      );
    } else {
      const course = await this.client.course.findFirst({
        where: { id: dto.courseId, tenantId },
        select: { id: true },
      });
      if (!course) throw new NotFoundException('Course not found');
      await this.access.assertCanManageCourseBank(
        tenantId,
        actor,
        dto.courseId!,
      );
    }

    const style = dto.style ?? 'mcq';
    this.validateStyleFields(style, dto.options, dto.correctAnswer);

    return this.client.question.create({
      data: {
        tenantId,
        curriculumSubjectId: dto.curriculumSubjectId ?? null,
        courseId: dto.curriculumSubjectId ? null : (dto.courseId ?? null),
        style,
        instruction: dto.instruction ?? null,
        text: dto.text,
        imageKey: dto.imageKey ?? null,
        options: dto.options
          ? (dto.options.map((o) => ({ ...o })) as object[])
          : undefined,
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
    // Narrowing to one anchor is an explicit filter; narrowing to "what this
    // teacher takes" has to ask BOTH, since the two anchors coexist until the
    // backfill has moved every entry.
    let anchorWhere: Record<string, unknown> = {};
    if (query.curriculumSubjectId) {
      if (!actor.canManageAll) {
        await this.access.assertCanManageCurriculumSubject(
          tenantId,
          actor,
          query.curriculumSubjectId,
        );
      }
      anchorWhere = { curriculumSubjectId: query.curriculumSubjectId };
    } else if (query.courseId) {
      if (!actor.canManageAll) {
        await this.access.assertCanManageCourseBank(
          tenantId,
          actor,
          query.courseId,
        );
      }
      anchorWhere = { courseId: query.courseId };
    } else if (!actor.canManageAll) {
      const [taughtSubjectIds, taughtCourseIds] = await Promise.all([
        this.access.getTaughtCurriculumSubjectIds(tenantId, actor.profileId),
        this.access.getTaughtCourseIds(tenantId, actor.profileId),
      ]);
      anchorWhere = {
        OR: [
          { curriculumSubjectId: { in: taughtSubjectIds } },
          { curriculumSubjectId: null, courseId: { in: taughtCourseIds } },
        ],
      };
    }

    return this.client.question.findMany({
      where: {
        tenantId,
        isActive: true,
        ...anchorWhere,
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
    await this.assertCanManageQuestionAnchor(tenantId, actor, question);
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
        curriculumSubjectId: true,
        courseId: true,
        style: true,
        options: true,
        correctAnswer: true,
      },
    });
    if (!question) throw new NotFoundException('Question not found');

    await this.assertCanManageQuestionAnchor(tenantId, actor, question);

    const style = (dto.style ?? question.style) as QuestionStyle;
    const options =
      dto.options ?? (question.options as unknown[] | null) ?? undefined;
    const correctAnswer =
      dto.correctAnswer ?? question.correctAnswer ?? undefined;
    this.validateStyleFields(style, options ?? undefined, correctAnswer);

    return this.client.question.update({
      where: { id },
      data: {
        ...(dto.style !== undefined ? { style: dto.style } : {}),
        ...(dto.instruction !== undefined
          ? { instruction: dto.instruction }
          : {}),
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
        curriculumSubjectId: true,
        courseId: true,
        _count: { select: { assessmentQuestions: true } },
      },
    });
    if (!question) throw new NotFoundException('Question not found');

    await this.assertCanManageQuestionAnchor(tenantId, actor, question);

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
      // Scoped through `academicYear`, not `class`. A relation filter on
      // `class` is a NOT-NULL test: a structured assessment has no class, so
      // every paper operation on one returned "Assessment not found" — the row
      // was there, the filter could not see it.
      where: { id: assessmentId, academicYear: { tenantId } },
      select: {
        id: true,
        classId: true,
        subjectOfferingId: true,
        status: true,
        class: { select: { courseId: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    // Which bank does this assessment's paper draw from? A structured one
    // draws from its offering's CURRICULUM SUBJECT; a legacy one from its
    // class's course. Resolved here so every paper operation asks the same
    // question once.
    let curriculumSubjectId: string | null = null;
    if (assessment.subjectOfferingId) {
      await this.access.assertCanManageOffering(
        tenantId,
        actor,
        assessment.subjectOfferingId,
      );
      // The offering is a soft reference, so this is its own read.
      const offering = await this.client.subjectOffering.findFirst({
        where: { id: assessment.subjectOfferingId, tenantId },
        select: { curriculumSubjectId: true },
      });
      curriculumSubjectId = offering?.curriculumSubjectId ?? null;
    } else {
      await this.access.assertCanManageClass(
        tenantId,
        actor,
        assessment.classId,
      );
    }
    return { ...assessment, curriculumSubjectId };
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

    // Paper questions must come from the bank of the SUBJECT being assessed —
    // or, for an assessment still on the legacy anchor, its course's bank.
    if (!assessment.curriculumSubjectId && !assessment.class) {
      throw new BadRequestException(
        'This assessment has no subject or course, so it has no bank to draw from.',
      );
    }

    const questions = await this.client.question.findMany({
      where: {
        id: { in: questionIds },
        tenantId,
        isActive: true,
        ...(assessment.curriculumSubjectId
          ? { curriculumSubjectId: assessment.curriculumSubjectId }
          : { courseId: assessment.class!.courseId }),
      },
      select: { id: true },
    });
    if (questions.length !== questionIds.length) {
      throw new BadRequestException(
        assessment.curriculumSubjectId
          ? "Some questions were not found in this subject's bank"
          : "Some questions were not found in this course's bank",
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
      throw new NotFoundException(
        'Question is not attached to this assessment',
      );
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
