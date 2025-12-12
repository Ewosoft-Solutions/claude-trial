import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { PrismaTransactionService } from '../../common/database/prisma-transaction.service';
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
    private readonly prismaTx: PrismaTransactionService,
  ) {}

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

    const existingName = await this.db.client.gradingSystem.findFirst({
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
    return this.db.client.gradingSystem.findMany({
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

    const system = await this.db.client.gradingSystem.findFirst({
      where: { id, tenantId },
    });
    if (!system) throw new NotFoundException('Grading system not found');

    if (dto.name && dto.name !== system.name) {
      const nameExists = await this.db.client.gradingSystem.findFirst({
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
    const system = await this.db.client.gradingSystem.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!system) throw new NotFoundException('Grading system not found');

    await this.db.client.gradingSystem.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Assessments ----------
  async createAssessment(
    tenantId: string,
    userId: string,
    dto: CreateAssessmentDto,
  ) {
    this.assertValue(
      dto.status ?? 'draft',
      ASSESSMENT_STATUSES,
      'Invalid assessment status',
    );

    const cls = await this.db.client.class.findFirst({
      where: { id: dto.classId, academicYear: { tenantId } },
      include: { term: true, academicYear: true },
    });
    if (!cls) throw new BadRequestException('Class not found for tenant');

    if (dto.gradingSystemId) {
      const gs = await this.db.client.gradingSystem.findFirst({
        where: { id: dto.gradingSystemId, tenantId },
        select: { id: true },
      });
      if (!gs)
        throw new BadRequestException('Grading system not found for tenant');
    }

    return this.db.client.assessment.create({
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
        createdBy: userId,
      },
    });
  }

  async listAssessments(tenantId: string, filters: ListAssessmentsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      academicYear: { tenantId },
    };

    if (filters.classId) where.classId = filters.classId;
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
      this.db.client.assessment.findMany({
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
      this.db.client.assessment.count({ where }),
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

  async getAssessment(tenantId: string, id: string) {
    const assessment = await this.db.client.assessment.findFirst({
      where: { id, academicYear: { tenantId } },
      include: {
        class: true,
        term: true,
        academicYear: true,
        gradingSystem: true,
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async updateAssessment(
    tenantId: string,
    userId: string,
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

    const assessment = await this.db.client.assessment.findFirst({
      where: { id, academicYear: { tenantId } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (dto.gradingSystemId) {
      const gs = await this.db.client.gradingSystem.findFirst({
        where: { id: dto.gradingSystemId, tenantId },
        select: { id: true },
      });
      if (!gs)
        throw new BadRequestException('Grading system not found for tenant');
    }

    return this.db.client.assessment.update({
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
        updatedBy: userId,
      },
    });
  }

  async deleteAssessment(tenantId: string, id: string) {
    const assessment = await this.db.client.assessment.findFirst({
      where: { id, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    await this.db.client.assessment.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Grades ----------
  private computeGrade(
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
    for (const [letter, range] of Object.entries<any>(gradeScale)) {
      if (
        typeof range === 'object' &&
        range.min !== undefined &&
        range.max !== undefined &&
        percentage >= range.min &&
        percentage <= range.max
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

  async createGrade(tenantId: string, userId: string, dto: CreateGradeDto) {
    this.assertValue(
      dto.status ?? 'draft',
      GRADE_STATUSES,
      'Invalid grade status',
    );

    // Validate assessment
    const assessment = await this.db.client.assessment.findFirst({
      where: { id: dto.assessmentId, academicYear: { tenantId } },
      include: { gradingSystem: true },
    });
    if (!assessment)
      throw new BadRequestException('Assessment not found for tenant');

    // Validate enrollment belongs to same class/academic year
    const enrollment = await this.db.client.enrollment.findFirst({
      where: {
        id: dto.enrollmentId,
        classId: assessment.classId,
        academicYearId: assessment.academicYearId,
      },
      include: { student: true },
    });
    if (!enrollment)
      throw new BadRequestException('Enrollment not found for this assessment');

    const existing = await this.db.client.grade.findFirst({
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

    return this.db.client.grade.create({
      data: {
        enrollmentId: dto.enrollmentId,
        assessmentId: dto.assessmentId,
        pointsEarned: dto.pointsEarned as any,
        percentage: dto.percentage ?? computed.percentage,
        letterGrade: dto.letterGrade ?? computed.letterGrade,
        gpaPoints: dto.gpaPoints ?? computed.gpaPoints,
        status: dto.status ?? 'draft',
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
        gradedAt: dto.gradedAt ? new Date(dto.gradedAt) : undefined,
        gradedBy: userId,
        feedback: dto.feedback,
        rubricScore: dto.rubricScore,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async updateGrade(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateGradeDto,
  ) {
    if (dto.status) {
      this.assertValue(dto.status, GRADE_STATUSES, 'Invalid grade status');
    }

    const grade = await this.db.client.grade.findFirst({
      where: { id, assessment: { academicYear: { tenantId } } },
      include: {
        assessment: { include: { gradingSystem: true } },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');

    const computed = this.computeGrade(
      dto.pointsEarned ?? (grade.pointsEarned as any),
      Number(grade.assessment.maxPoints),
      grade.assessment.gradingSystem?.gradeScale,
    );

    return this.db.client.grade.update({
      where: { id },
      data: {
        pointsEarned: dto.pointsEarned as any,
        percentage: dto.percentage ?? computed.percentage,
        letterGrade: dto.letterGrade ?? computed.letterGrade,
        gpaPoints: dto.gpaPoints ?? computed.gpaPoints,
        status: dto.status ?? undefined,
        submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : undefined,
        gradedAt: dto.gradedAt ? new Date(dto.gradedAt) : undefined,
        feedback: dto.feedback ?? undefined,
        rubricScore: dto.rubricScore ?? undefined,
        notes: dto.notes ?? undefined,
        updatedBy: userId,
      },
    });
  }

  async listGradesForAssessment(tenantId: string, assessmentId: string) {
    const assessment = await this.db.client.assessment.findFirst({
      where: { id: assessmentId, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    return this.db.client.grade.findMany({
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

  async listGradesForStudent(tenantId: string, studentId: string) {
    // Validate student belongs to tenant
    const student = await this.db.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.db.client.grade.findMany({
      where: {
        enrollment: {
          studentId,
        },
      },
      include: {
        assessment: true,
        enrollment: true,
      },
    });
  }

  async getAssessmentStats(tenantId: string, assessmentId: string) {
    const assessment = await this.db.client.assessment.findFirst({
      where: { id: assessmentId, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const agg = await this.db.client.grade.aggregate({
      where: { assessmentId },
      _avg: { percentage: true, pointsEarned: true },
      _min: { percentage: true, pointsEarned: true },
      _max: { percentage: true, pointsEarned: true },
      _count: { _all: true },
    });

    return {
      count: agg._count._all,
      avgPercentage: agg._avg.percentage,
      avgPoints: agg._avg.pointsEarned,
      minPercentage: agg._min.percentage,
      maxPercentage: agg._max.percentage,
      minPoints: agg._min.pointsEarned,
      maxPoints: agg._max.pointsEarned,
    };
  }

  // ---------- Report cards / transcripts (simplified scaffolding) ----------
  async getStudentReportCard(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ) {
    const student = await this.db.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const enrollments = await this.db.client.enrollment.findMany({
      where: {
        studentId,
        academicYearId: academicYearId ?? undefined,
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

    return {
      studentId,
      academicYearId,
      enrollments,
    };
  }
}
