import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { PrismaTransactionService } from '../../common/database/prisma-transaction.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  CreateTermDto,
  UpdateTermDto,
  CreateCourseDto,
  UpdateCourseDto,
  CreateClassDto,
  UpdateClassDto,
  UpdateScheduleDto,
  AssignStudentToClassDto,
  AssignTeacherToClassDto,
  ListClassesDto,
  ACADEMIC_YEAR_STATUSES,
  TERM_STATUSES,
  COURSE_STATUSES,
  CLASS_STATUSES,
} from '../dto';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';

@Injectable()
export class AcademicStructureService {
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

  private assertStatus(value: string, allowed: readonly string[], message: string) {
    if (!allowed.includes(value)) {
      throw new BadRequestException(message);
    }
  }

  private addIdScope(where: any, ids: string[]) {
    const existingAnd = where.AND
      ? Array.isArray(where.AND)
        ? where.AND
        : [where.AND]
      : [];

    where.AND = [...existingAnd, { id: { in: ids } }];
  }

  private async scopeCoursesToActor(
    tenantId: string,
    where: any,
    actor?: AcademicsActor,
  ) {
    if (!actor || actor.canManageAll) return;
    this.addIdScope(
      where,
      await this.access.getTaughtCourseIds(tenantId, actor.profileId),
    );
  }

  private async scopeClassesToActor(
    tenantId: string,
    where: any,
    actor?: AcademicsActor,
  ) {
    if (!actor || actor.canManageAll) return;
    this.addIdScope(
      where,
      await this.access.getTaughtClassIds(tenantId, actor.profileId),
    );
  }

  // ---------- Academic Years ----------
  async createAcademicYear(tenantId: string, userId: string, dto: CreateAcademicYearDto) {
    if (dto.status) {
      this.assertStatus(dto.status, ACADEMIC_YEAR_STATUSES, 'Invalid academic year status');
    }
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.prismaTx.runInTransaction(
      async (tx) => {
        if (dto.isDefault) {
          await tx.academicYear.updateMany({
            where: { tenantId, isDefault: true },
            data: { isDefault: false },
          });
        }

        return tx.academicYear.create({
          data: {
            tenantId,
            name: dto.name,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            status: dto.status ?? 'planned',
            isDefault: dto.isDefault ?? false,
            description: dto.description,
            createdBy: userId,
          },
        });
      },
      tenantId,
      userId,
    );
  }

  async listAcademicYears(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) {
      this.assertStatus(status, ACADEMIC_YEAR_STATUSES, 'Invalid academic year status');
      where.status = status;
    }
    return this.client.academicYear.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { startDate: 'desc' }],
    });
  }

  async getAcademicYear(tenantId: string, id: string) {
    const year = await this.client.academicYear.findFirst({
      where: { id, tenantId },
      include: { terms: true },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    return year;
  }

  async updateAcademicYear(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateAcademicYearDto,
  ) {
    if (dto.status) {
      this.assertStatus(dto.status, ACADEMIC_YEAR_STATUSES, 'Invalid academic year status');
    }

    const existing = await this.client.academicYear.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Academic year not found');

    if (dto.startDate && dto.endDate) {
      if (new Date(dto.startDate) >= new Date(dto.endDate)) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    return this.prismaTx.runInTransaction(
      async (tx) => {
        if (dto.isDefault) {
          await tx.academicYear.updateMany({
            where: { tenantId, isDefault: true, NOT: { id } },
            data: { isDefault: false },
          });
        }

        return tx.academicYear.update({
          where: { id },
          data: {
            name: dto.name ?? undefined,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            status: dto.status ?? undefined,
            isDefault: dto.isDefault ?? undefined,
            description: dto.description ?? undefined,
            updatedBy: userId,
          },
        });
      },
      tenantId,
      userId,
    );
  }

  async deleteAcademicYear(tenantId: string, id: string) {
    const existing = await this.client.academicYear.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Academic year not found');

    await this.client.academicYear.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Terms ----------
  async createTerm(
    tenantId: string,
    userId: string,
    academicYearId: string,
    dto: CreateTermDto,
  ) {
    this.assertStatus(dto.status ?? 'planned', TERM_STATUSES, 'Invalid term status');

    const year = await this.client.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.client.term.create({
      data: {
        academicYearId,
        name: dto.name,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        order: dto.order,
        status: dto.status ?? 'planned',
        description: dto.description,
        createdBy: userId,
      },
    });
  }

  async listTerms(tenantId: string, academicYearId: string) {
    const year = await this.client.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    return this.client.term.findMany({
      where: { academicYearId },
      orderBy: [{ order: 'asc' }, { startDate: 'asc' }],
    });
  }

  async getTerm(tenantId: string, termId: string) {
    const term = await this.client.term.findFirst({
      where: { id: termId, academicYear: { tenantId } },
    });
    if (!term) throw new NotFoundException('Term not found');
    return term;
  }

  async updateTerm(tenantId: string, userId: string, termId: string, dto: UpdateTermDto) {
    if (dto.status) {
      this.assertStatus(dto.status, TERM_STATUSES, 'Invalid term status');
    }

    const term = await this.client.term.findFirst({
      where: { id: termId, academicYear: { tenantId } },
    });
    if (!term) throw new NotFoundException('Term not found');

    if (dto.startDate && dto.endDate) {
      if (new Date(dto.startDate) >= new Date(dto.endDate)) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    return this.client.term.update({
      where: { id: termId },
      data: {
        name: dto.name ?? undefined,
        type: dto.type ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        order: dto.order ?? undefined,
        status: dto.status ?? undefined,
        description: dto.description ?? undefined,
        updatedBy: userId,
      },
    });
  }

  async deleteTerm(tenantId: string, termId: string) {
    const term = await this.client.term.findFirst({
      where: { id: termId, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!term) throw new NotFoundException('Term not found');

    await this.client.term.delete({ where: { id: termId } });
    return { success: true };
  }

  // ---------- Courses ----------
  async createCourse(tenantId: string, userId: string, dto: CreateCourseDto) {
    this.assertStatus(dto.status ?? 'active', COURSE_STATUSES, 'Invalid course status');

    // Ensure unique code per tenant
    const existing = await this.client.course.findFirst({
      where: { tenantId, code: dto.code },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Course code already exists');

    return this.client.course.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        subject: dto.subject,
        gradeLevels: dto.gradeLevels ?? [],
        credits: dto.credits as any,
        hours: dto.hours as any,
        prerequisites: dto.prerequisites,
        objectives: dto.objectives,
        status: dto.status ?? 'active',
        createdBy: userId,
      },
    });
  }

  async listCourses(
    tenantId: string,
    search?: string,
    status?: string,
    actor?: AcademicsActor,
  ) {
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      this.assertStatus(status, COURSE_STATUSES, 'Invalid course status');
      where.status = status;
    }
    await this.scopeCoursesToActor(tenantId, where, actor);

    return this.client.course.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async getCourse(tenantId: string, id: string, actor?: AcademicsActor) {
    const where: any = { id, tenantId };
    await this.scopeCoursesToActor(tenantId, where, actor);

    const course = await this.client.course.findFirst({
      where,
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(tenantId: string, userId: string, id: string, dto: UpdateCourseDto) {
    if (dto.status) {
      this.assertStatus(dto.status, COURSE_STATUSES, 'Invalid course status');
    }

    const course = await this.client.course.findFirst({
      where: { id, tenantId },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (dto.code && dto.code !== course.code) {
      const exists = await this.client.course.findFirst({
        where: { tenantId, code: dto.code },
        select: { id: true },
      });
      if (exists) throw new BadRequestException('Course code already exists');
    }

    return this.client.course.update({
      where: { id },
      data: {
        code: dto.code ?? undefined,
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        category: dto.category ?? undefined,
        subject: dto.subject ?? undefined,
        gradeLevels: dto.gradeLevels ?? undefined,
        credits: dto.credits as any,
        hours: dto.hours as any,
        prerequisites: dto.prerequisites ?? undefined,
        objectives: dto.objectives ?? undefined,
        status: dto.status ?? undefined,
        updatedBy: userId,
      },
    });
  }

  async deleteCourse(tenantId: string, id: string) {
    const course = await this.client.course.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    await this.client.course.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Classes ----------
  async createClass(tenantId: string, userId: string, dto: CreateClassDto) {
    this.assertStatus(dto.status ?? 'active', CLASS_STATUSES, 'Invalid class status');

    const course = await this.client.course.findFirst({
      where: { id: dto.courseId, tenantId },
      select: { id: true },
    });
    if (!course) throw new BadRequestException('Course not found for tenant');

    const term = await this.client.term.findFirst({
      where: { id: dto.termId, academicYear: { id: dto.academicYearId, tenantId } },
      select: { id: true },
    });
    if (!term) throw new BadRequestException('Term not found for tenant/year');

    // Ensure unique section for course+term
    const existing = await this.client.class.findFirst({
      where: { courseId: dto.courseId, termId: dto.termId, section: dto.section },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Section already exists for course and term');

    return this.client.class.create({
      data: {
        courseId: dto.courseId,
        termId: dto.termId,
        academicYearId: dto.academicYearId,
        section: dto.section,
        name: dto.name,
        capacity: dto.capacity ?? 30,
        schedule: dto.schedule,
        room: dto.room,
        status: dto.status ?? 'active',
        description: dto.description,
        currentEnrollment: 0,
        createdBy: userId,
      },
    });
  }

  async listClasses(
    tenantId: string,
    filters: ListClassesDto,
    actor?: AcademicsActor,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      academicYear: { tenantId },
    };

    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.termId) where.termId = filters.termId;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.status) {
      this.assertStatus(filters.status, CLASS_STATUSES, 'Invalid class status');
      where.status = filters.status;
    }
    await this.scopeClassesToActor(tenantId, where, actor);

    const [data, total] = await Promise.all([
      this.client.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ academicYear: { startDate: 'desc' } }, { term: { order: 'asc' } }],
        include: {
          course: true,
          term: true,
          academicYear: true,
        },
      }),
      this.client.class.count({ where }),
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

  async getClass(tenantId: string, id: string, actor?: AcademicsActor) {
    const where: any = { id, academicYear: { tenantId } };
    await this.scopeClassesToActor(tenantId, where, actor);

    const cls = await this.client.class.findFirst({
      where,
      include: {
        course: true,
        term: true,
        academicYear: true,
        enrollments: {
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
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async updateClass(tenantId: string, userId: string, id: string, dto: UpdateClassDto) {
    if (dto.status) {
      this.assertStatus(dto.status, CLASS_STATUSES, 'Invalid class status');
    }

    const cls = await this.client.class.findFirst({
      where: { id, academicYear: { tenantId } },
    });
    if (!cls) throw new NotFoundException('Class not found');

    if (dto.capacity !== undefined && dto.capacity < cls.currentEnrollment) {
      throw new BadRequestException('Capacity cannot be less than current enrollment');
    }

    return this.client.class.update({
      where: { id },
      data: {
        section: dto.section ?? undefined,
        name: dto.name ?? undefined,
        capacity: dto.capacity ?? undefined,
        schedule: dto.schedule ?? undefined,
        room: dto.room ?? undefined,
        status: dto.status ?? undefined,
        description: dto.description ?? undefined,
        updatedBy: userId,
      },
    });
  }

  async deleteClass(tenantId: string, id: string) {
    const cls = await this.client.class.findFirst({
      where: { id, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    await this.client.class.delete({ where: { id } });
    return { success: true };
  }

  async updateSchedule(tenantId: string, userId: string, id: string, dto: UpdateScheduleDto) {
    const cls = await this.client.class.findFirst({
      where: { id, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    return this.client.class.update({
      where: { id },
      data: {
        schedule: dto.schedule,
        updatedBy: userId,
      },
    });
  }

  // ---------- Class-Student assignment (enrollment from class perspective) ----------
  async assignStudentToClass(
    tenantId: string,
    userId: string,
    classId: string,
    dto: AssignStudentToClassDto,
  ) {
    const cls = await this.client.class.findFirst({
      where: { id: classId, academicYear: { tenantId } },
    });
    if (!cls) throw new NotFoundException('Class not found');

    // Validate student
    const student = await this.client.student.findFirst({
      where: { id: dto.studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Existing enrollment?
    const existing = await this.client.enrollment.findFirst({
      where: {
        studentId: dto.studentId,
        classId,
        academicYearId: cls.academicYearId,
      },
      select: { id: true, status: true },
    });
    if (existing) throw new BadRequestException('Student already enrolled in this class');

    if (cls.capacity && cls.currentEnrollment >= cls.capacity) {
      throw new BadRequestException('Class is full');
    }

    return this.prismaTx.runInTransaction(
      async (tx) => {
        const enrollment = await tx.enrollment.create({
          data: {
            studentId: dto.studentId,
            classId,
            academicYearId: cls.academicYearId,
            termId: cls.termId,
            status: 'active',
            enrollmentDate: new Date(),
            createdBy: userId,
          },
        });

        await tx.class.update({
          where: { id: classId },
          data: { currentEnrollment: { increment: 1 } },
        });

        return enrollment;
      },
      tenantId,
      userId,
    );
  }

  async removeStudentFromClass(
    tenantId: string,
    userId: string,
    classId: string,
    studentId: string,
  ) {
    const enrollment = await this.client.enrollment.findFirst({
      where: { classId, studentId, class: { academicYear: { tenantId } } },
      select: { id: true, status: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found for class/student');

    return this.prismaTx.runInTransaction(
      async (tx) => {
        await tx.enrollment.delete({ where: { id: enrollment.id } });

        if (enrollment.status === 'active') {
          await tx.class.update({
            where: { id: classId },
            data: { currentEnrollment: { decrement: 1 } },
          });
        }

        return { success: true };
      },
      tenantId,
      userId,
    );
  }

  async listClassStudents(
    tenantId: string,
    classId: string,
    actor?: AcademicsActor,
  ) {
    const classWhere: any = { id: classId, academicYear: { tenantId } };
    await this.scopeClassesToActor(tenantId, classWhere, actor);

    const cls = await this.client.class.findFirst({
      where: classWhere,
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    return this.client.enrollment.findMany({
      where: { classId },
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
    });
  }

  // ---------- Class-teacher allocation (subject allocation to teachers) ----------

  async assignTeacherToClass(
    tenantId: string,
    userId: string,
    classId: string,
    dto: AssignTeacherToClassDto,
  ) {
    const cls = await this.client.class.findFirst({
      where: { id: classId, academicYear: { tenantId } },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    const profile = await this.client.userTenant.findFirst({
      where: { id: dto.userTenantId, tenantId, status: 'active' },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Active staff profile not found');
    }

    const existing = await this.client.classTeacher.findFirst({
      where: { classId, userTenantId: dto.userTenantId },
      select: { id: true, isActive: true },
    });

    if (existing?.isActive) {
      throw new BadRequestException('Teacher is already assigned to this class');
    }

    if (existing) {
      // Re-activate a previous assignment instead of duplicating it.
      return this.client.classTeacher.update({
        where: { id: existing.id },
        data: {
          role: dto.role ?? 'teacher',
          isActive: true,
          assignedAt: new Date(),
          assignedBy: userId,
          unassignedAt: null,
          unassignedBy: null,
        },
      });
    }

    return this.client.classTeacher.create({
      data: {
        classId,
        userTenantId: dto.userTenantId,
        tenantId,
        role: dto.role ?? 'teacher',
        assignedBy: userId,
      },
    });
  }

  async removeTeacherFromClass(
    tenantId: string,
    userId: string,
    classId: string,
    userTenantId: string,
  ) {
    const assignment = await this.client.classTeacher.findFirst({
      where: {
        classId,
        userTenantId,
        isActive: true,
        class: { academicYear: { tenantId } },
      },
      select: { id: true },
    });
    if (!assignment) {
      throw new NotFoundException('Active teacher assignment not found');
    }

    // Soft-unassign: keeps the allocation history (who taught what, when).
    return this.client.classTeacher.update({
      where: { id: assignment.id },
      data: {
        isActive: false,
        unassignedAt: new Date(),
        unassignedBy: userId,
      },
    });
  }

  async listClassTeachers(
    tenantId: string,
    classId: string,
    actor?: AcademicsActor,
  ) {
    const classWhere: any = { id: classId, academicYear: { tenantId } };
    await this.scopeClassesToActor(tenantId, classWhere, actor);

    const cls = await this.client.class.findFirst({
      where: classWhere,
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    return this.client.classTeacher.findMany({
      where: { classId },
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
      orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }],
    });
  }
}
