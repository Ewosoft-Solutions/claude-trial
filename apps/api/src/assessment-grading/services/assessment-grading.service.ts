import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { PrismaTransactionService } from '../../common/database/prisma-transaction.service';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';

/** Allow-listed sort columns for the assessments list; default is due-date. */
const ASSESSMENT_LIST_SORT: SortAllowList<Prisma.AssessmentOrderByWithRelationInput> =
  {
    name: (dir) => [{ name: dir }],
    dueDate: (dir) => [{ dueDate: dir }],
    status: (dir) => [{ status: dir }, { dueDate: 'asc' }],
    type: (dir) => [{ type: dir }, { dueDate: 'asc' }],
    createdAt: (dir) => [{ createdAt: dir }],
  };
import {
  CreateGradingSystemDto,
  UpdateGradingSystemDto,
  CreateAssessmentDto,
  UpdateAssessmentDto,
  CreateGradeDto,
  UpdateGradeDto,
  ListAssessmentsDto,
  GRADING_SYSTEM_TYPES,
  ASSESSMENT_STATUSES,
  GRADE_STATUSES,
} from '../dto';

/** One graded assessment as it appears on a report card. */
export interface ReportCardAssessment {
  assessmentId: string;
  name: string;
  type: string;
  weight?: number;
  maxPoints: number;
  pointsEarned?: number;
  percentage?: number;
  letterGrade?: string;
  gpaPoints?: number;
}

/** Prisma `Decimal | null` → a plain number, or undefined when unset. */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

@Injectable()
export class AssessmentGradingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly prismaTx: PrismaTransactionService,
    private readonly access: AcademicsAccessService,
  ) {}

  /** Scoped app_runtime client inside a @TenantScoped request; else privileged. */
  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  private assertValue(
    value: string,
    allowed: readonly string[],
    message: string,
  ) {
    if (!allowed.includes(value)) {
      throw new BadRequestException(message);
    }
  }

  // ---------- Grading Systems ----------
  async createGradingSystem(
    tenantId: string,
    userId: string,
    dto: CreateGradingSystemDto,
  ) {
    this.assertValue(
      dto.systemType,
      GRADING_SYSTEM_TYPES,
      'Invalid grading system type',
    );

    const existingName = await this.client.gradingSystem.findFirst({
      where: { tenantId, name: dto.name },
      select: { id: true },
    });
    if (existingName) {
      throw new BadRequestException('Grading system name already exists');
    }

    return this.prismaTx.runInTransaction(
      async (tx) => {
        if (dto.isDefault) {
          await tx.gradingSystem.updateMany({
            where: { tenantId, isDefault: true },
            data: { isDefault: false },
          });
        }

        return tx.gradingSystem.create({
          data: {
            tenantId,
            name: dto.name,
            systemType: dto.systemType,
            gradeScale: dto.gradeScale,
            isDefault: dto.isDefault ?? false,
            isActive: dto.isActive ?? true,
            description: dto.description,
            createdBy: userId,
          },
        });
      },
      tenantId,
      userId,
    );
  }

  async listGradingSystems(tenantId: string, active?: boolean) {
    const where: any = { tenantId };
    if (active !== undefined) {
      where.isActive = active;
    }
    return this.client.gradingSystem.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async updateGradingSystem(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateGradingSystemDto,
  ) {
    if (dto.systemType) {
      this.assertValue(
        dto.systemType,
        GRADING_SYSTEM_TYPES,
        'Invalid grading system type',
      );
    }

    const system = await this.client.gradingSystem.findFirst({
      where: { id, tenantId },
    });
    if (!system) throw new NotFoundException('Grading system not found');

    if (dto.name && dto.name !== system.name) {
      const nameExists = await this.client.gradingSystem.findFirst({
        where: { tenantId, name: dto.name },
        select: { id: true },
      });
      if (nameExists)
        throw new BadRequestException('Grading system name already exists');
    }

    return this.prismaTx.runInTransaction(
      async (tx) => {
        if (dto.isDefault) {
          await tx.gradingSystem.updateMany({
            where: { tenantId, isDefault: true, NOT: { id } },
            data: { isDefault: false },
          });
        }

        return tx.gradingSystem.update({
          where: { id },
          data: {
            name: dto.name ?? undefined,
            systemType: dto.systemType ?? undefined,
            gradeScale: dto.gradeScale ?? undefined,
            isDefault: dto.isDefault ?? undefined,
            isActive: dto.isActive ?? undefined,
            description: dto.description ?? undefined,
            updatedBy: userId,
          },
        });
      },
      tenantId,
      userId,
    );
  }

  async deleteGradingSystem(tenantId: string, id: string) {
    const system = await this.client.gradingSystem.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!system) throw new NotFoundException('Grading system not found');

    await this.client.gradingSystem.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Assessments ----------
  async createAssessment(
    tenantId: string,
    actor: AcademicsActor,
    dto: CreateAssessmentDto,
  ) {
    this.assertValue(
      dto.status ?? 'draft',
      ASSESSMENT_STATUSES,
      'Invalid assessment status',
    );

    // Two anchors during the migration: the structured SubjectOffering (what
    // everything should key on) and the legacy Class. Exactly one is required,
    // and the offering wins when both arrive.
    if (!dto.subjectOfferingId && !dto.classId) {
      throw new BadRequestException(
        'An assessment needs a subject offering (or, for legacy callers, a class).',
      );
    }

    let academicYearId: string;
    let termId: string;

    if (dto.subjectOfferingId) {
      const offering = await this.client.subjectOffering.findFirst({
        where: { id: dto.subjectOfferingId, tenantId },
        select: {
          id: true,
          academicYearId: true,
          termId: true,
          classSectionId: true,
        },
      });
      if (!offering) {
        throw new BadRequestException('Subject offering not found for tenant');
      }
      // An offering may be year-long (no term); the legacy column is NOT NULL,
      // so fall back to the year's current/first term rather than inventing one.
      const term =
        offering.termId ??
        (
          await this.client.term.findFirst({
            where: { tenantId, academicYearId: offering.academicYearId },
            orderBy: { order: 'asc' },
            select: { id: true },
          })
        )?.id;
      if (!term) {
        throw new BadRequestException(
          'That academic year has no terms yet, so an assessment cannot be dated.',
        );
      }
      academicYearId = offering.academicYearId;
      termId = term;
      await this.access.assertCanManageOffering(tenantId, actor, offering.id);
    } else {
      const cls = await this.client.class.findFirst({
        where: { id: dto.classId, academicYear: { tenantId } },
        include: { term: true, academicYear: true },
      });
      if (!cls) throw new BadRequestException('Class not found for tenant');
      await this.access.assertCanManageClass(tenantId, actor, dto.classId!);
      academicYearId = cls.academicYearId;
      termId = cls.termId;
    }

    if (dto.gradingSystemId) {
      const gs = await this.client.gradingSystem.findFirst({
        where: { id: dto.gradingSystemId, tenantId },
        select: { id: true },
      });
      if (!gs)
        throw new BadRequestException('Grading system not found for tenant');
    }

    return this.client.assessment.create({
      data: {
        subjectOfferingId: dto.subjectOfferingId ?? null,
        classId: dto.classId ?? null,
        academicYearId,
        termId,
        name: dto.name,
        type: dto.type,
        maxPoints: dto.maxPoints as any,
        weight: dto.weight as any,
        gradingSystemId: dto.gradingSystemId,
        assignedDate: dto.assignedDate ? new Date(dto.assignedDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? 'draft',
        instructions: dto.instructions,
        rubric: dto.rubric,
        durationMinutes: dto.durationMinutes,
        maxAttempts: dto.maxAttempts ?? 1,
        createdBy: actor.userId,
      },
    });
  }

  async listAssessments(
    tenantId: string,
    actor: AcademicsActor,
    filters: ListAssessmentsDto,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      academicYear: { tenantId },
    };

    if (filters.classId) {
      if (!actor.canManageAll) {
        await this.access.assertCanManageClass(
          tenantId,
          actor,
          filters.classId,
        );
      }
      where.classId = filters.classId;
    } else if (!actor.canManageAll) {
      where.classId = {
        in: await this.access.getTaughtClassIds(tenantId, actor.profileId),
      };
    }
    if (filters.status) {
      this.assertValue(
        filters.status,
        ASSESSMENT_STATUSES,
        'Invalid assessment status',
      );
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.client.assessment.findMany({
        where,
        skip,
        take: limit,
        orderBy: resolvePaginationOrderBy(
          filters.sortBy,
          filters.sortOrder,
          ASSESSMENT_LIST_SORT,
          [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        ),
        include: {
          class: true,
          term: true,
          academicYear: true,
          gradingSystem: true,
        },
      }),
      this.client.assessment.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getAssessment(tenantId: string, actor: AcademicsActor, id: string) {
    const assessment = await this.client.assessment.findFirst({
      where: { id, academicYear: { tenantId } },
      include: {
        class: true,
        term: true,
        academicYear: true,
        gradingSystem: true,
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (!actor.canManageAll) {
      await this.access.assertCanManageClass(
        tenantId,
        actor,
        assessment.classId,
      );
    }
    return assessment;
  }

  async updateAssessment(
    tenantId: string,
    actor: AcademicsActor,
    id: string,
    dto: UpdateAssessmentDto,
  ) {
    if (dto.status) {
      this.assertValue(
        dto.status,
        ASSESSMENT_STATUSES,
        'Invalid assessment status',
      );
    }

    const assessment = await this.client.assessment.findFirst({
      where: { id, academicYear: { tenantId } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.access.assertCanManageClass(tenantId, actor, assessment.classId);

    if (dto.gradingSystemId) {
      const gs = await this.client.gradingSystem.findFirst({
        where: { id: dto.gradingSystemId, tenantId },
        select: { id: true },
      });
      if (!gs)
        throw new BadRequestException('Grading system not found for tenant');
    }

    return this.client.assessment.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        type: dto.type ?? undefined,
        maxPoints: dto.maxPoints as any,
        weight: dto.weight as any,
        gradingSystemId: dto.gradingSystemId ?? undefined,
        assignedDate: dto.assignedDate ? new Date(dto.assignedDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? undefined,
        instructions: dto.instructions ?? undefined,
        rubric: dto.rubric ?? undefined,
        durationMinutes: dto.durationMinutes ?? undefined,
        maxAttempts: dto.maxAttempts ?? undefined,
        updatedBy: actor.userId,
      },
    });
  }

  async deleteAssessment(tenantId: string, actor: AcademicsActor, id: string) {
    const assessment = await this.client.assessment.findFirst({
      where: { id, academicYear: { tenantId } },
      select: { id: true, classId: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.access.assertCanManageClass(tenantId, actor, assessment.classId);

    await this.client.assessment.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Grades ----------
  /** Points → percentage/letter/GPA via a grading-system scale. Shared with the taking flow. */
  computeGrade(
    pointsEarned: number | undefined,
    maxPoints: number | undefined,
    gradeScale: any | undefined,
  ): { percentage?: number; letterGrade?: string; gpaPoints?: number } {
    if (!pointsEarned || !maxPoints || maxPoints === 0) {
      return {};
    }
    const percentage = (pointsEarned / maxPoints) * 100;

    if (!gradeScale) {
      return { percentage };
    }

    // gradeScale expected shape: { "A": { min: 90, max: 100, points: 4.0 }, ... }
    let letterGrade: string | undefined;
    let gpaPoints: number | undefined;
    const entries = Object.entries(gradeScale as Record<string, any>);
    for (const [letter, range] of entries) {
      if (
        typeof range === 'object' &&
        range.min !== undefined &&
        range.max !== undefined &&
        percentage >= Number(range.min) &&
        percentage <= Number(range.max)
      ) {
        letterGrade = letter;
        if (range.points !== undefined) {
          gpaPoints = Number(range.points);
        }
        break;
      }
    }
    return { percentage, letterGrade, gpaPoints };
  }

  async createGrade(
    tenantId: string,
    actor: AcademicsActor,
    dto: CreateGradeDto,
  ) {
    this.assertValue(
      dto.status ?? 'draft',
      GRADE_STATUSES,
      'Invalid grade status',
    );

    // Validate assessment
    const assessment = await this.client.assessment.findFirst({
      where: { id: dto.assessmentId, academicYear: { tenantId } },
      include: { gradingSystem: true },
    });
    if (!assessment)
      throw new BadRequestException('Assessment not found for tenant');
    // Access follows the assessment's OWN anchor. A structured assessment has
    // no class, so asking the class-teacher question would refuse every teacher
    // — which is exactly what happened until this branch existed.
    if (assessment.subjectOfferingId) {
      await this.access.assertCanManageOffering(
        tenantId,
        actor,
        assessment.subjectOfferingId,
      );
    } else {
      await this.access.assertCanManageClass(
        tenantId,
        actor,
        assessment.classId,
      );
    }

    // Resolve who is being graded. `studentId` is the anchor a grade keeps;
    // `enrollmentId` is the legacy path and is translated to a student here so
    // both routes store the same thing.
    if (!dto.studentId && !dto.enrollmentId) {
      throw new BadRequestException(
        'A grade needs a student (or, for legacy callers, an enrollment).',
      );
    }
    let studentId = dto.studentId ?? null;
    if (!studentId && dto.enrollmentId) {
      const enrollment = await this.client.enrollment.findFirst({
        where: {
          id: dto.enrollmentId,
          ...(assessment.classId ? { classId: assessment.classId } : {}),
          academicYearId: assessment.academicYearId,
        },
        select: { studentId: true },
      });
      if (!enrollment) {
        throw new BadRequestException(
          'Enrollment not found for this assessment',
        );
      }
      studentId = enrollment.studentId;
    }

    // One grade per student per assessment, whichever route was used to name
    // the student.
    const existing = await this.client.grade.findFirst({
      where: {
        assessmentId: dto.assessmentId,
        OR: [
          { studentId },
          ...(dto.enrollmentId ? [{ enrollmentId: dto.enrollmentId }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing)
      throw new BadRequestException('Grade already exists for this student');

    const computed = this.computeGrade(
      dto.pointsEarned,
      Number(assessment.maxPoints),
      assessment.gradingSystem?.gradeScale,
    );

    return this.client.grade.create({
      data: {
        tenantId,
        studentId,
        enrollmentId: dto.enrollmentId ?? null,
        assessmentId: dto.assessmentId,
        pointsEarned: dto.pointsEarned as any,
        percentage: dto.percentage ?? computed.percentage,
        letterGrade: dto.letterGrade ?? computed.letterGrade,
        gpaPoints: dto.gpaPoints ?? computed.gpaPoints,
        status: dto.status ?? 'draft',
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
        gradedAt: dto.gradedAt ? new Date(dto.gradedAt) : undefined,
        gradedBy: actor.profileId,
        feedback: dto.feedback,
        rubricScore: dto.rubricScore,
        notes: dto.notes,
        createdBy: actor.userId,
      },
    });
  }

  async updateGrade(
    tenantId: string,
    actor: AcademicsActor,
    id: string,
    dto: UpdateGradeDto,
  ) {
    if (dto.status) {
      this.assertValue(dto.status, GRADE_STATUSES, 'Invalid grade status');
    }

    const grade = await this.client.grade.findFirst({
      where: { id, assessment: { academicYear: { tenantId } } },
      include: {
        assessment: { include: { gradingSystem: true } },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      grade.assessment.classId,
    );

    const currentPoints =
      dto.pointsEarned !== undefined && dto.pointsEarned !== null
        ? dto.pointsEarned
        : grade.pointsEarned !== null && grade.pointsEarned !== undefined
          ? Number(grade.pointsEarned)
          : undefined;

    const computed = this.computeGrade(
      currentPoints,
      Number(grade.assessment.maxPoints),
      grade.assessment.gradingSystem?.gradeScale,
    );

    return this.client.grade.update({
      where: { id },
      data: {
        pointsEarned:
          dto.pointsEarned !== undefined && dto.pointsEarned !== null
            ? dto.pointsEarned
            : undefined,
        percentage: dto.percentage ?? computed.percentage,
        letterGrade: dto.letterGrade ?? computed.letterGrade,
        gpaPoints: dto.gpaPoints ?? computed.gpaPoints,
        status: dto.status ?? undefined,
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
        gradedAt: dto.gradedAt ? new Date(dto.gradedAt) : undefined,
        feedback: dto.feedback ?? undefined,
        rubricScore: dto.rubricScore ?? undefined,
        notes: dto.notes ?? undefined,
        updatedBy: actor.userId,
      },
    });
  }

  async listGradesForAssessment(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
  ) {
    const assessment = await this.client.assessment.findFirst({
      where: { id: assessmentId, academicYear: { tenantId } },
      select: { id: true, classId: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.access.assertCanManageClass(tenantId, actor, assessment.classId);

    return this.client.grade.findMany({
      where: { assessmentId },
      include: {
        enrollment: {
          include: {
            student: {
              include: {
                userTenant: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Where-clause for "every grade this student earned", narrowed to what the
   * actor is allowed to see.
   *
   * A grade belongs to the STUDENT (migration 20260817200000), so a grade on a
   * structured assessment carries `studentId` with a null `enrollmentId` — any
   * read that starts from `Enrollment` loses it silently. The enrolment arm
   * here is NOT a second anchor: it is a bridge for rows the re-key backfill
   * has not reached yet, and it comes out with the column.
   *
   * Scoping follows each assessment's OWN anchor, the same rule createGrade
   * uses — a structured assessment is this teacher's if they hold the
   * offering, a legacy one if they hold the class. Asking only the offering
   * question would hide legacy marks from the teacher who recorded them;
   * asking only the class question is what hid the structured ones.
   */
  private async studentGradeScope(
    tenantId: string,
    actor: AcademicsActor,
    studentId: string,
    academicYearId?: string,
  ): Promise<Prisma.GradeWhereInput> {
    const assessment: Prisma.AssessmentWhereInput = {
      academicYear: { tenantId },
      ...(academicYearId ? { academicYearId } : {}),
    };

    if (!actor.canManageAll) {
      const [taughtOfferingIds, taughtClassIds] = await Promise.all([
        this.access.getTaughtOfferingIds(tenantId, actor.profileId),
        this.access.getTaughtClassIds(tenantId, actor.profileId),
      ]);
      assessment.OR = [
        { subjectOfferingId: { in: taughtOfferingIds } },
        { subjectOfferingId: null, classId: { in: taughtClassIds } },
      ];
    }

    return {
      OR: [{ studentId }, { enrollment: { studentId } }],
      assessment,
    };
  }

  async listGradesForStudent(
    tenantId: string,
    actor: AcademicsActor,
    studentId: string,
  ) {
    // Validate student belongs to tenant
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.client.grade.findMany({
      where: await this.studentGradeScope(tenantId, actor, studentId),
      include: {
        assessment: true,
        enrollment: true,
      },
    });
  }

  async getAssessmentAnalytics(
    tenantId: string,
    actor: AcademicsActor,
    assessmentId: string,
    bucketSize = 10,
  ) {
    const assessment = await this.client.assessment.findFirst({
      where: { id: assessmentId, academicYear: { tenantId } },
      select: { id: true, classId: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await this.access.assertCanManageClass(tenantId, actor, assessment.classId);

    const grades = await this.client.grade.findMany({
      where: { assessmentId },
      select: { percentage: true, pointsEarned: true },
    });

    const agg = await this.client.grade.aggregate({
      where: { assessmentId },
      _avg: { percentage: true, pointsEarned: true },
      _min: { percentage: true, pointsEarned: true },
      _max: { percentage: true, pointsEarned: true },
      _count: { _all: true },
    });

    const percentages = grades
      .map((g) => (g.percentage === null ? undefined : Number(g.percentage)))
      .filter((v): v is number => v !== undefined && !Number.isNaN(v));

    const histogram: Record<string, number> = {};
    if (bucketSize <= 0) bucketSize = 10;
    for (const p of percentages) {
      const bucketStart = Math.floor(p / bucketSize) * bucketSize;
      const bucketEnd = bucketStart + bucketSize - 0.0001; // inclusive upper bound
      const label = `${bucketStart}-${bucketEnd.toFixed(0)}`;
      histogram[label] = (histogram[label] ?? 0) + 1;
    }

    const sorted = [...percentages].sort((a, b) => b - a);
    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5).reverse();

    return {
      count: agg._count._all,
      avgPercentage: agg._avg.percentage,
      avgPoints: agg._avg.pointsEarned,
      minPercentage: agg._min.percentage,
      maxPercentage: agg._max.percentage,
      minPoints: agg._min.pointsEarned,
      maxPoints: agg._max.pointsEarned,
      histogram,
      top5,
      bottom5,
    };
  }

  // ---------- Report cards / transcripts (simplified scaffolding) ----------
  async getStudentReportCard(
    tenantId: string,
    actor: AcademicsActor,
    studentId: string,
    academicYearId?: string,
  ) {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Read the child's marks by STUDENT and group them by the subject they
    // were earned in — the offering for structured assessments, the legacy
    // class for the ones not re-keyed yet. Starting from `Enrollment` (as this
    // did until stage B) dropped every structured grade on the floor without
    // saying so.
    const grades = await this.client.grade.findMany({
      where: await this.studentGradeScope(
        tenantId,
        actor,
        studentId,
        academicYearId,
      ),
      include: {
        assessment: { include: { class: { include: { course: true } } } },
      },
    });

    // `subjectOfferingId` is a soft reference (the WB2 convention keeps the
    // modules decoupled), so naming the subject is a second read.
    const offeringIds = Array.from(
      new Set(
        grades
          .map((g) => g.assessment.subjectOfferingId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const offerings =
      offeringIds.length > 0
        ? await this.client.subjectOffering.findMany({
            where: { id: { in: offeringIds }, tenantId },
            select: {
              id: true,
              subjectLabel: true,
              termId: true,
              classSection: { select: { displayLabel: true } },
            },
          })
        : [];
    const offeringById = new Map(offerings.map((o) => [o.id, o]));

    interface SubjectBucket {
      key: string;
      anchor: 'offering' | 'class';
      subjectOfferingId: string | null;
      classId: string | null;
      subjectLabel?: string;
      classLabel?: string;
      academicYearId: string;
      termId: string;
      assessments: ReportCardAssessment[];
    }

    const subjectBuckets = new Map<string, SubjectBucket>();
    for (const grade of grades) {
      const assessment = grade.assessment;
      const offeringId = assessment.subjectOfferingId ?? null;
      const offering = offeringId ? offeringById.get(offeringId) : undefined;
      const legacyClass = assessment.class;

      // An assessment always has one of the two anchors. The third arm is
      // there so that an anchorless row — which should not exist — stands on
      // its own rather than collapsing every such row into one fake subject.
      const key = offeringId
        ? `offering:${offeringId}`
        : assessment.classId
          ? `class:${assessment.classId}`
          : `assessment:${assessment.id}`;

      let bucket = subjectBuckets.get(key);
      if (!bucket) {
        const classLabel = offeringId
          ? offering?.classSection?.displayLabel
          : [legacyClass?.name, legacyClass?.section]
              .filter(Boolean)
              .join(' ') || undefined;
        bucket = {
          key,
          anchor: offeringId ? 'offering' : 'class',
          subjectOfferingId: offeringId,
          classId: assessment.classId ?? null,
          subjectLabel: offeringId
            ? offering?.subjectLabel
            : (legacyClass?.course?.subject ??
              legacyClass?.course?.name ??
              undefined),
          classLabel,
          academicYearId: assessment.academicYearId,
          // The term comes from the subject's own anchor. A year-long offering
          // has no term of its own, so fall back to the term the assessment
          // was dated into — which createAssessment copied off that offering.
          termId: offeringId
            ? (offering?.termId ?? assessment.termId)
            : (legacyClass?.termId ?? assessment.termId),
          assessments: [],
        };
        subjectBuckets.set(key, bucket);
      }

      bucket.assessments.push({
        assessmentId: grade.assessmentId,
        name: assessment.name,
        type: assessment.type,
        weight: toNumber(assessment.weight),
        maxPoints: toNumber(assessment.maxPoints) ?? 0,
        pointsEarned: toNumber(grade.pointsEarned),
        percentage: toNumber(grade.percentage),
        letterGrade: grade.letterGrade ?? undefined,
        gpaPoints: toNumber(grade.gpaPoints),
      });
    }

    const termIds = Array.from(
      new Set(Array.from(subjectBuckets.values()).map((b) => b.termId)),
    );
    const terms =
      termIds.length > 0
        ? await this.client.term.findMany({
            where: { id: { in: termIds }, tenantId },
            select: { id: true, name: true },
          })
        : [];
    const termNameById = new Map(terms.map((t) => [t.id, t.name]));

    const subjects = Array.from(subjectBuckets.values()).map((bucket) => ({
      ...bucket,
      termName: termNameById.get(bucket.termId),
      summary: this.summariseAssessments(bucket.assessments),
    }));

    // Term-level aggregation
    const termBuckets = new Map<
      string,
      {
        termId: string;
        termName?: string;
        percentages: number[];
        gpas: number[];
      }
    >();
    for (const subject of subjects) {
      let bucket = termBuckets.get(subject.termId);
      if (!bucket) {
        bucket = {
          termId: subject.termId,
          termName: subject.termName,
          percentages: [],
          gpas: [],
        };
        termBuckets.set(subject.termId, bucket);
      }
      if (subject.summary.percentage !== undefined) {
        bucket.percentages.push(subject.summary.percentage);
      }
      if (subject.summary.gpa !== undefined) {
        bucket.gpas.push(subject.summary.gpa);
      }
    }

    const termSummaries = Array.from(termBuckets.values()).map((t) => ({
      termId: t.termId,
      termName: t.termName,
      avgPercentage: average(t.percentages),
      avgGpa: average(t.gpas),
    }));

    // Overall aggregates
    const overall = {
      avgPercentage: average(
        termSummaries
          .map((t) => t.avgPercentage)
          .filter((v): v is number => v !== undefined),
      ),
      avgGpa: average(
        termSummaries
          .map((t) => t.avgGpa)
          .filter((v): v is number => v !== undefined),
      ),
    };

    return {
      studentId,
      academicYearId,
      subjects,
      termSummaries,
      overall,
    };
  }

  /**
   * A subject's standing from its graded assessments: weighted by assessment
   * weight when any is set, a plain mean of the available percentages when
   * none is.
   */
  private summariseAssessments(assessments: ReportCardAssessment[]): {
    percentage?: number;
    gpa?: number;
  } {
    const hasWeights = assessments.some((a) => a.weight !== undefined);

    let percentage: number | undefined;
    if (hasWeights) {
      let totalWeight = 0;
      let weighted = 0;
      for (const a of assessments) {
        if (a.percentage !== undefined && a.weight !== undefined) {
          weighted += a.percentage * a.weight;
          totalWeight += a.weight;
        }
      }
      if (totalWeight > 0) percentage = weighted / totalWeight;
    } else {
      percentage = average(
        assessments
          .map((a) => a.percentage)
          .filter((v): v is number => v !== undefined),
      );
    }

    return {
      percentage,
      gpa: average(
        assessments
          .map((a) => a.gpaPoints)
          .filter((v): v is number => v !== undefined),
      ),
    };
  }
}
