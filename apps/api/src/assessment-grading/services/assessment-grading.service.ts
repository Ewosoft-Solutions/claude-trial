import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { PrismaTransactionService } from '../../common/database/prisma-transaction.service';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
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

    const cls = await this.client.class.findFirst({
      where: { id: dto.classId, academicYear: { tenantId } },
      include: { term: true, academicYear: true },
    });
    if (!cls) throw new BadRequestException('Class not found for tenant');
    await this.access.assertCanManageClass(tenantId, actor, dto.classId);

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
        classId: dto.classId,
        academicYearId: cls.academicYearId,
        termId: cls.termId,
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

    const [data, total] = await Promise.all([
      this.client.assessment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
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
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      assessment.classId,
    );

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
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      assessment.classId,
    );

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
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      assessment.classId,
    );

    // Validate enrollment belongs to same class/academic year
    const enrollment = await this.client.enrollment.findFirst({
      where: {
        id: dto.enrollmentId,
        classId: assessment.classId,
        academicYearId: assessment.academicYearId,
      },
      include: { student: true },
    });
    if (!enrollment)
      throw new BadRequestException('Enrollment not found for this assessment');

    const existing = await this.client.grade.findFirst({
      where: { enrollmentId: dto.enrollmentId, assessmentId: dto.assessmentId },
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
        enrollmentId: dto.enrollmentId,
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
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      assessment.classId,
    );

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

    const taughtClassIds = actor.canManageAll
      ? undefined
      : await this.access.getTaughtClassIds(tenantId, actor.profileId);

    return this.client.grade.findMany({
      where: {
        enrollment: {
          studentId,
          ...(taughtClassIds ? { classId: { in: taughtClassIds } } : {}),
        },
      },
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
    await this.access.assertCanManageClass(
      tenantId,
      actor,
      assessment.classId,
    );

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

    const taughtClassIds = actor.canManageAll
      ? undefined
      : await this.access.getTaughtClassIds(tenantId, actor.profileId);

    const enrollments = await this.client.enrollment.findMany({
      where: {
        studentId,
        academicYearId: academicYearId ?? undefined,
        ...(taughtClassIds ? { classId: { in: taughtClassIds } } : {}),
      },
      include: {
        class: {
          include: { course: true, term: true, academicYear: true },
        },
        grades: {
          include: {
            assessment: true,
          },
        },
      },
    });

    const enrollmentsWithStats = enrollments.map((enrollment) => {
      const assessments = enrollment.grades.map((g) => ({
        assessmentId: g.assessmentId,
        name: g.assessment.name,
        type: g.assessment.type,
        weight: g.assessment.weight ? Number(g.assessment.weight) : undefined,
        maxPoints: Number(g.assessment.maxPoints),
        pointsEarned:
          g.pointsEarned !== null && g.pointsEarned !== undefined
            ? Number(g.pointsEarned)
            : undefined,
        percentage:
          g.percentage !== null && g.percentage !== undefined
            ? Number(g.percentage)
            : undefined,
        letterGrade: g.letterGrade ?? undefined,
        gpaPoints:
          g.gpaPoints !== null && g.gpaPoints !== undefined
            ? Number(g.gpaPoints)
            : undefined,
      }));

      // Weighted percentage: if any weight present, use weights; else average available percentages.
      const hasWeights = assessments.some((a) => a.weight !== undefined);
      let coursePercentage: number | undefined;
      if (hasWeights) {
        let totalWeight = 0;
        let weighted = 0;
        for (const a of assessments) {
          if (a.percentage !== undefined && a.weight !== undefined) {
            weighted += a.percentage * a.weight;
            totalWeight += a.weight;
          }
        }
        if (totalWeight > 0) {
          coursePercentage = weighted / totalWeight;
        }
      } else {
        const ps = assessments
          .map((a) => a.percentage)
          .filter((v): v is number => v !== undefined);
        if (ps.length > 0) {
          coursePercentage = ps.reduce((a, b) => a + b, 0) / ps.length;
        }
      }

      const gpas = assessments
        .map((a) => a.gpaPoints)
        .filter((v): v is number => v !== undefined);
      const courseGpa =
        gpas.length > 0
          ? gpas.reduce((a, b) => a + b, 0) / gpas.length
          : undefined;

      return {
        ...enrollment,
        summary: {
          coursePercentage,
          courseGpa,
        },
        assessments,
      };
    });

    // Term-level aggregation
    const termBuckets: Record<
      string,
      {
        percentages: number[];
        gpas: number[];
        termName?: string;
        termId?: string;
      }
    > = {};
    for (const e of enrollmentsWithStats) {
      const termId = e.class.termId;
      termBuckets[termId] = termBuckets[termId] ?? {
        percentages: [],
        gpas: [],
        termName: e.class.term?.name,
        termId,
      };
      if (e.summary.coursePercentage !== undefined) {
        termBuckets[termId].percentages.push(e.summary.coursePercentage);
      }
      if (e.summary.courseGpa !== undefined) {
        termBuckets[termId].gpas.push(e.summary.courseGpa);
      }
    }

    const termSummaries = Object.values(termBuckets).map((t) => ({
      termId: t.termId,
      termName: t.termName,
      avgPercentage:
        t.percentages.length > 0
          ? t.percentages.reduce((a, b) => a + b, 0) / t.percentages.length
          : undefined,
      avgGpa:
        t.gpas.length > 0
          ? t.gpas.reduce((a, b) => a + b, 0) / t.gpas.length
          : undefined,
    }));

    // Overall aggregates
    const overallPercentages = termSummaries
      .map((t) => t.avgPercentage)
      .filter((v): v is number => v !== undefined);
    const overallGpas = termSummaries
      .map((t) => t.avgGpa)
      .filter((v): v is number => v !== undefined);

    const overall = {
      avgPercentage:
        overallPercentages.length > 0
          ? overallPercentages.reduce((a, b) => a + b, 0) /
            overallPercentages.length
          : undefined,
      avgGpa:
        overallGpas.length > 0
          ? overallGpas.reduce((a, b) => a + b, 0) / overallGpas.length
          : undefined,
    };

    return {
      studentId,
      academicYearId,
      enrollments: enrollmentsWithStats,
      termSummaries,
      overall,
    };
  }
}
