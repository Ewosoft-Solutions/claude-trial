import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { PrismaTransactionService } from '../../common/database/prisma-transaction.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  SearchStudentsDto,
  UpdateStudentStatusDto,
  UpdateStudentProfileDto,
  EnrollStudentDto,
  UpdateEnrollmentStatusDto,
} from '../dto';
import { withTenant } from '../../common/database/tenant-prisma.extension';
import {
  ENROLLMENT_STATUSES,
  STUDENT_ENROLLMENT_STATUSES,
} from '../dto/student.dto';

@Injectable()
export class StudentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly prismaTx: PrismaTransactionService,
  ) {}

  private studentInclude = {
    userTenant: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            isVerified: true,
          },
        },
        userTenantRoles: {
          include: {
            role: {
              select: { id: true, name: true, clearanceLevel: true },
            },
          },
        },
      },
    },
    enrollments: true,
  };

  private ensureValidStudentStatus(status: string) {
    if (!STUDENT_ENROLLMENT_STATUSES.includes(status as any)) {
      throw new BadRequestException('Invalid student enrollment status');
    }
  }

  private ensureValidEnrollmentStatus(status: string) {
    if (!ENROLLMENT_STATUSES.includes(status as any)) {
      throw new BadRequestException('Invalid enrollment status');
    }
  }

  private mergeJson<T extends Record<string, any>>(
    current: any,
    incoming?: T,
  ): Record<string, any> {
    if (!incoming) return current ?? {};
    if (typeof current !== 'object' || current === null) {
      return { ...incoming };
    }
    return { ...current, ...incoming };
  }

  async create(tenantId: string, createdBy: string, dto: CreateStudentDto) {
    this.ensureValidStudentStatus(dto.enrollmentStatus ?? 'active');

    // Validate userTenant belongs to tenant
    const profile = await this.db.client.userTenant.findFirst({
      where: { id: dto.userTenantId, tenantId },
      select: { id: true },
    });

    if (!profile) {
      throw new BadRequestException('UserTenant profile not found for tenant');
    }

    const tenantClient = withTenant(this.db.client, tenantId);

    return tenantClient.student.create({
      data: {
        userTenantId: dto.userTenantId,
        studentNumber: dto.studentNumber,
        admissionNumber: dto.admissionNumber,
        admissionDate: dto.admissionDate
          ? new Date(dto.admissionDate)
          : undefined,
        gradeLevel: dto.gradeLevel,
        enrollmentStatus: dto.enrollmentStatus ?? 'active',
        personalInfo: dto.personalInfo ?? {},
        academicInfo: dto.academicInfo ?? {},
        healthInfo: dto.healthInfo ?? {},
        emergencyContacts: dto.emergencyContacts ?? [],
        guardianInfo: dto.guardianInfo ?? [],
        specialNeeds: dto.specialNeeds ?? [],
        enrollmentDate: dto.enrollmentDate
          ? new Date(dto.enrollmentDate)
          : undefined,
        graduationDate: dto.graduationDate
          ? new Date(dto.graduationDate)
          : undefined,
        withdrawalDate: dto.withdrawalDate
          ? new Date(dto.withdrawalDate)
          : undefined,
        transferDate: dto.transferDate ? new Date(dto.transferDate) : undefined,
        createdBy,
      },
      include: this.studentInclude,
    });
  }

  async list(tenantId: string, filters: SearchStudentsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (filters.enrollmentStatus) {
      this.ensureValidStudentStatus(filters.enrollmentStatus);
      where.enrollmentStatus = filters.enrollmentStatus;
    }

    if (filters.gradeLevel) {
      where.gradeLevel = filters.gradeLevel;
    }

    if (filters.studentNumber) {
      where.studentNumber = {
        contains: filters.studentNumber,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { studentNumber: { contains: filters.search, mode: 'insensitive' } },
        { admissionNumber: { contains: filters.search, mode: 'insensitive' } },
        {
          userTenant: {
            user: {
              OR: [
                { email: { contains: filters.search, mode: 'insensitive' } },
                {
                  firstName: { contains: filters.search, mode: 'insensitive' },
                },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.client.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.studentInclude,
      }),
      this.db.client.student.count({ where }),
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

  async getById(tenantId: string, id: string) {
    const student = await this.db.client.student.findFirst({
      where: { id, tenantId },
      include: {
        ...this.studentInclude,
        enrollments: {
          include: {
            class: true,
            academicYear: true,
            term: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(
    tenantId: string,
    updatedBy: string,
    id: string,
    dto: UpdateStudentDto,
  ) {
    if (dto.enrollmentStatus) {
      this.ensureValidStudentStatus(dto.enrollmentStatus);
    }

    const student = await this.db.client.student.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        personalInfo: true,
        academicInfo: true,
        healthInfo: true,
        emergencyContacts: true,
        guardianInfo: true,
        specialNeeds: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const data: any = {
      studentNumber: dto.studentNumber ?? undefined,
      admissionNumber: dto.admissionNumber ?? undefined,
      admissionDate: dto.admissionDate
        ? new Date(dto.admissionDate)
        : undefined,
      gradeLevel: dto.gradeLevel ?? undefined,
      enrollmentStatus: dto.enrollmentStatus ?? undefined,
      enrollmentDate: dto.enrollmentDate
        ? new Date(dto.enrollmentDate)
        : undefined,
      graduationDate: dto.graduationDate
        ? new Date(dto.graduationDate)
        : undefined,
      withdrawalDate: dto.withdrawalDate
        ? new Date(dto.withdrawalDate)
        : undefined,
      transferDate: dto.transferDate ? new Date(dto.transferDate) : undefined,
      personalInfo: this.mergeJson(student.personalInfo, dto.personalInfo),
      academicInfo: this.mergeJson(student.academicInfo, dto.academicInfo),
      healthInfo: this.mergeJson(student.healthInfo, dto.healthInfo),
      emergencyContacts:
        dto.emergencyContacts ?? student.emergencyContacts ?? [],
      guardianInfo: dto.guardianInfo ?? student.guardianInfo ?? [],
      specialNeeds: dto.specialNeeds ?? student.specialNeeds ?? [],
      updatedBy,
    };

    return this.db.client.student.update({
      where: { id },
      data,
      include: this.studentInclude,
    });
  }

  async updateStatus(
    tenantId: string,
    updatedBy: string,
    id: string,
    dto: UpdateStudentStatusDto,
  ) {
    this.ensureValidStudentStatus(dto.enrollmentStatus);

    const exists = await this.db.client.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Student not found');
    }

    return this.db.client.student.update({
      where: { id },
      data: {
        enrollmentStatus: dto.enrollmentStatus,
        enrollmentDate: dto.enrollmentDate
          ? new Date(dto.enrollmentDate)
          : undefined,
        graduationDate: dto.graduationDate
          ? new Date(dto.graduationDate)
          : undefined,
        withdrawalDate: dto.withdrawalDate
          ? new Date(dto.withdrawalDate)
          : undefined,
        transferDate: dto.transferDate ? new Date(dto.transferDate) : undefined,
        updatedBy,
      },
      include: this.studentInclude,
    });
  }

  async updateProfile(
    tenantId: string,
    updatedBy: string,
    id: string,
    dto: UpdateStudentProfileDto,
  ) {
    const student = await this.db.client.student.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        personalInfo: true,
        academicInfo: true,
        healthInfo: true,
        emergencyContacts: true,
        guardianInfo: true,
        specialNeeds: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const personalInfo = this.mergeJson(student.personalInfo, dto.personalInfo);
    if (dto.photoUrl !== undefined) {
      personalInfo.photoUrl = dto.photoUrl;
    }
    if (dto.documents !== undefined) {
      personalInfo.documents = dto.documents;
    }

    const data: any = {
      personalInfo,
      academicInfo: this.mergeJson(student.academicInfo, dto.academicInfo),
      healthInfo: this.mergeJson(student.healthInfo, dto.healthInfo),
      emergencyContacts:
        dto.emergencyContacts ?? student.emergencyContacts ?? [],
      guardianInfo: dto.guardianInfo ?? student.guardianInfo ?? [],
      specialNeeds: dto.specialNeeds ?? student.specialNeeds ?? [],
      updatedBy,
    };

    return this.db.client.student.update({
      where: { id },
      data,
      include: this.studentInclude,
    });
  }

  async delete(tenantId: string, id: string) {
    const exists = await this.db.client.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Student not found');
    }

    await this.db.client.student.delete({
      where: { id },
    });

    return { success: true };
  }

  async enrollStudent(
    tenantId: string,
    userId: string,
    studentId: string,
    dto: EnrollStudentDto,
  ) {
    this.ensureValidEnrollmentStatus(dto.status ?? 'active');

    const student = await this.db.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const klass = await this.db.client.class.findFirst({
      where: {
        id: dto.classId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        academicYear: { tenantId },
      },
      include: { academicYear: true },
    });

    if (!klass) {
      throw new BadRequestException('Class not found for tenant/year/term');
    }

    if (klass.capacity && klass.currentEnrollment >= klass.capacity) {
      throw new BadRequestException('Class is full');
    }

    // Ensure not already enrolled
    const existing = await this.db.client.enrollment.findFirst({
      where: {
        studentId,
        classId: dto.classId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Student already enrolled in this class');
    }

    return this.prismaTx.runInTransaction(
      async (tx) => {
        const enrollment = await tx.enrollment.create({
          data: {
            studentId,
            classId: dto.classId,
            academicYearId: dto.academicYearId,
            termId: dto.termId,
            enrollmentDate: dto.enrollmentDate
              ? new Date(dto.enrollmentDate)
              : new Date(),
            status: dto.status ?? 'active',
            finalGrade: dto.finalGrade,
            creditsEarned: dto.creditsEarned as any,
            gpaPoints: dto.gpaPoints as any,
            notes: dto.notes,
            createdBy: userId,
          },
        });

        await tx.class.update({
          where: { id: dto.classId },
          data: { currentEnrollment: { increment: 1 } },
        });

        return enrollment;
      },
      tenantId,
      userId,
    );
  }

  async listEnrollments(tenantId: string, studentId: string) {
    const student = await this.db.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.db.client.enrollment.findMany({
      where: { studentId },
      orderBy: { enrollmentDate: 'desc' },
      include: { class: true, academicYear: true, term: true },
    });
  }

  async updateEnrollmentStatus(
    tenantId: string,
    userId: string,
    studentId: string,
    enrollmentId: string,
    dto: UpdateEnrollmentStatusDto,
  ) {
    this.ensureValidEnrollmentStatus(dto.status);

    const enrollment = await this.db.client.enrollment.findFirst({
      where: { id: enrollmentId, studentId },
      include: {
        student: { select: { tenantId: true } },
        class: true,
      },
    });

    if (!enrollment || enrollment.student.tenantId !== tenantId) {
      throw new NotFoundException('Enrollment not found');
    }

    const wasActive = enrollment.status === 'active';
    const willBeActive = dto.status === 'active';

    return this.prismaTx.runInTransaction(
      async (tx) => {
        const updated = await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { status: dto.status, updatedBy: userId },
        });

        // Adjust class counts when moving in/out of active
        if (wasActive && !willBeActive) {
          await tx.class.update({
            where: { id: enrollment.classId },
            data: { currentEnrollment: { decrement: 1 } },
          });
        } else if (!wasActive && willBeActive) {
          // Re-activating requires capacity check
          const klass = await tx.class.findUnique({
            where: { id: enrollment.classId },
          });
          if (klass?.capacity && klass.currentEnrollment >= klass.capacity) {
            throw new BadRequestException('Class is full');
          }
          await tx.class.update({
            where: { id: enrollment.classId },
            data: { currentEnrollment: { increment: 1 } },
          });
        }

        return updated;
      },
      tenantId,
      userId,
    );
  }
}
