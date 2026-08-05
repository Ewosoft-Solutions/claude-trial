/**
 * Enrollment service (WB2-2)
 *
 * Joins a Student to what they study, the way the tenant's AcademicProfile
 * demands — ADDITIVE over the legacy Enrollment(→ labeled-bag Class):
 *
 *   • 'class'  (K-12)     → SectionEnrollment: the student joins a ClassSection
 *                           and its SubjectOfferings ARE their subject set;
 *                           electives are chosen per-offering (StudentSubjectElection).
 *   • 'course' (tertiary) → CourseRegistration: the student registers per
 *                           SubjectOffering.
 *
 * The tenant's active `AcademicProfile.enrollmentModel` selects which path the
 * resolver uses; with no profile it falls back to deriving the model from
 * `Tenant.schoolType`. Teacher assignment binds a teacher to an OFFERING
 * (OfferingTeacher), never a free-text label. Everything is validated + written
 * on the request's tenant-scoped client (RLS; no privileged client) and campus-
 * scoped via the WB1-6 `AccessScopeService` (a section's / an offering's
 * `campusId` is the target).
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { AccessScopeService } from '../../auth/services/access-scope.service';
import type { StructureActor } from './academic-structure-model.service';
import type {
  CreateAcademicProfileDto,
  UpdateAcademicProfileDto,
  EnrollSectionDto,
  UpdateSectionEnrollmentDto,
  RegisterCourseDto,
  UpdateCourseRegistrationDto,
  ElectSubjectDto,
  UpdateElectionDto,
  AssignTeacherDto,
  UpdateOfferingTeacherDto,
  ListSectionEnrollmentsDto,
  ListOfferingTeachersDto,
} from '../dto';

export type EnrollmentModel = 'class' | 'course';

/** Map a tenant's schoolType to the fallback enrollment model. */
export function enrollmentModelForSchoolType(
  schoolType: string | null | undefined,
): EnrollmentModel {
  switch (schoolType) {
    case 'university':
    case 'college':
    case 'training_institute':
      return 'course';
    default:
      // nursery / primary / secondary / organization / unknown → K-12 default
      // (Release-1 is the NG K-12 profile).
      return 'class';
  }
}

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource,
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= AcademicProfile =======================

  async createProfile(
    tenantId: string,
    actorId: string,
    dto: CreateAcademicProfileDto,
  ) {
    if (dto.campusId) await this.assertCampus(tenantId, dto.campusId);

    // The @TenantScoped request already runs in one transaction, so these two
    // statements are atomic together — no nested $transaction.
    if (dto.isDefault) {
      await this.client.academicProfile.updateMany({
        where: { tenantId, campusId: dto.campusId ?? null, isDefault: true },
        data: { isDefault: false },
      });
    }
    const profile = await this.client.academicProfile.create({
      data: {
        tenantId,
        campusId: dto.campusId ?? null,
        name: dto.name.trim(),
        enrollmentModel: dto.enrollmentModel,
        isDefault: dto.isDefault ?? false,
        createdBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.enrollment.profile.create',
      'academic_profile',
      profile.id,
      `created academic profile ${profile.name} (${profile.enrollmentModel})`,
    );
    return profile;
  }

  async listProfiles(tenantId: string) {
    return this.client.academicProfile.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async updateProfile(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateAcademicProfileDto,
  ) {
    const existing = await this.client.academicProfile.findFirst({
      where: { id, tenantId },
      select: { id: true, campusId: true },
    });
    if (!existing) throw new NotFoundException('Academic profile not found');

    if (dto.isDefault) {
      await this.client.academicProfile.updateMany({
        where: {
          tenantId,
          campusId: existing.campusId,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }
    const profile = await this.client.academicProfile.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        enrollmentModel: dto.enrollmentModel,
        isDefault: dto.isDefault,
        status: dto.status,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.enrollment.profile.update',
      'academic_profile',
      id,
      `updated academic profile ${profile.name}`,
    );
    return profile;
  }

  /**
   * The active enrollment model for a tenant (optionally a campus): the default
   * active profile, else any active profile, else derived from Tenant.schoolType.
   */
  async resolveEnrollmentModel(
    tenantId: string,
    campusId?: string | null,
  ): Promise<{ model: EnrollmentModel; source: 'profile' | 'schoolType' }> {
    const profiles = await this.client.academicProfile.findMany({
      where: {
        tenantId,
        status: 'active',
        OR: [{ campusId: campusId ?? null }, { campusId: null }],
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    // Prefer a campus-specific match over a tenant-wide one.
    const preferred =
      profiles.find((p) => campusId && p.campusId === campusId) ?? profiles[0];
    if (preferred) {
      return {
        model: preferred.enrollmentModel as EnrollmentModel,
        source: 'profile',
      };
    }
    const tenant = await this.client.tenant.findFirst({
      where: { id: tenantId },
      select: { schoolType: true },
    });
    return {
      model: enrollmentModelForSchoolType(tenant?.schoolType),
      source: 'schoolType',
    };
  }

  // ======================= Section enrollment (K-12) =======================

  async enrollSection(
    tenantId: string,
    actor: StructureActor,
    dto: EnrollSectionDto,
  ) {
    await this.assertStudent(tenantId, dto.studentId);
    const section = await this.assertSection(tenantId, dto.classSectionId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: section.campusId,
    });
    await this.assertAcademicYear(tenantId, dto.academicYearId);

    const dup = await this.client.sectionEnrollment.findFirst({
      where: {
        studentId: dto.studentId,
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'This student is already enrolled in this section for that year.',
      );
    }

    const enrollment = await this.client.sectionEnrollment.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.section.enroll',
      'section_enrollment',
      enrollment.id,
      `enrolled student ${dto.studentId} into section ${dto.classSectionId}`,
      {
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
      },
    );
    return enrollment;
  }

  async listSectionEnrollments(
    tenantId: string,
    query: ListSectionEnrollmentsDto,
  ) {
    return this.client.sectionEnrollment.findMany({
      where: {
        tenantId,
        ...(query.classSectionId
          ? { classSectionId: query.classSectionId }
          : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      orderBy: [{ enrolledAt: 'desc' }],
    });
  }

  async updateSectionEnrollment(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: UpdateSectionEnrollmentDto,
  ) {
    const existing = await this.client.sectionEnrollment.findFirst({
      where: { id, tenantId },
      select: { id: true, classSectionId: true },
    });
    if (!existing) throw new NotFoundException('Section enrollment not found');
    const section = await this.assertSection(tenantId, existing.classSectionId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: section.campusId,
    });

    const ended = dto.status && dto.status !== 'active';
    const enrollment = await this.client.sectionEnrollment.update({
      where: { id },
      data: {
        status: dto.status,
        endReason: dto.endReason,
        endedAt: ended ? new Date() : undefined,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.section.update',
      'section_enrollment',
      id,
      `updated section enrollment ${id} -> ${enrollment.status}`,
    );
    return enrollment;
  }

  // ======================= Course registration (tertiary) =======================

  async registerCourse(
    tenantId: string,
    actor: StructureActor,
    dto: RegisterCourseDto,
  ) {
    await this.assertStudent(tenantId, dto.studentId);
    const offering = await this.assertOffering(tenantId, dto.subjectOfferingId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: offering.campusId,
    });

    const dup = await this.client.courseRegistration.findFirst({
      where: {
        studentId: dto.studentId,
        subjectOfferingId: dto.subjectOfferingId,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'This student is already registered for this offering.',
      );
    }

    const registration = await this.client.courseRegistration.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        subjectOfferingId: dto.subjectOfferingId,
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.course.register',
      'course_registration',
      registration.id,
      `registered student ${dto.studentId} for offering ${dto.subjectOfferingId}`,
    );
    return registration;
  }

  async updateCourseRegistration(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: UpdateCourseRegistrationDto,
  ) {
    const existing = await this.client.courseRegistration.findFirst({
      where: { id, tenantId },
      select: { id: true, subjectOfferingId: true },
    });
    if (!existing) throw new NotFoundException('Course registration not found');
    const offering = await this.assertOffering(
      tenantId,
      existing.subjectOfferingId,
    );
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: offering.campusId,
    });

    const ended = dto.status && dto.status !== 'registered';
    const registration = await this.client.courseRegistration.update({
      where: { id },
      data: {
        status: dto.status,
        endedAt: ended ? new Date() : undefined,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.course.update',
      'course_registration',
      id,
      `updated course registration ${id} -> ${registration.status}`,
    );
    return registration;
  }

  // ======================= Elective election (C036) =======================

  async electSubject(
    tenantId: string,
    actor: StructureActor,
    dto: ElectSubjectDto,
  ) {
    await this.assertStudent(tenantId, dto.studentId);
    const offering = await this.assertOffering(tenantId, dto.subjectOfferingId);
    // The election references an OFFERING, and that offering must be elective —
    // this is the "elective references an offering, not a free-text subject" bar.
    if (!offering.isElective) {
      throw new BadRequestException(
        'That subject offering is not marked elective.',
      );
    }
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: offering.campusId,
    });

    const dup = await this.client.studentSubjectElection.findFirst({
      where: {
        studentId: dto.studentId,
        subjectOfferingId: dto.subjectOfferingId,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'This student has already elected this offering.',
      );
    }

    const election = await this.client.studentSubjectElection.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        subjectOfferingId: dto.subjectOfferingId,
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.elective.elect',
      'student_subject_election',
      election.id,
      `elected offering ${dto.subjectOfferingId} for student ${dto.studentId}`,
    );
    return election;
  }

  async updateElection(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: UpdateElectionDto,
  ) {
    const existing = await this.client.studentSubjectElection.findFirst({
      where: { id, tenantId },
      select: { id: true, subjectOfferingId: true },
    });
    if (!existing) throw new NotFoundException('Election not found');
    const offering = await this.assertOffering(
      tenantId,
      existing.subjectOfferingId,
    );
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: offering.campusId,
    });
    const election = await this.client.studentSubjectElection.update({
      where: { id },
      data: { status: dto.status, updatedBy: actor.userId },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.elective.update',
      'student_subject_election',
      id,
      `updated election ${id} -> ${election.status}`,
    );
    return election;
  }

  // ======================= Teacher assignment (#30) =======================

  async assignTeacher(
    tenantId: string,
    actor: StructureActor,
    dto: AssignTeacherDto,
  ) {
    const offering = await this.assertOffering(tenantId, dto.subjectOfferingId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: offering.campusId,
    });
    await this.assertProfile(tenantId, dto.userTenantId);

    const existing = await this.client.offeringTeacher.findFirst({
      where: {
        subjectOfferingId: dto.subjectOfferingId,
        userTenantId: dto.userTenantId,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'That teacher is already assigned to this offering.',
      );
    }

    const assignment = await this.client.offeringTeacher.create({
      data: {
        tenantId,
        subjectOfferingId: dto.subjectOfferingId,
        userTenantId: dto.userTenantId,
        role: dto.role ?? 'teacher',
        assignedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.teacher.assign',
      'offering_teacher',
      assignment.id,
      `assigned teacher ${dto.userTenantId} to offering ${dto.subjectOfferingId}`,
    );
    return assignment;
  }

  async listOfferingTeachers(tenantId: string, query: ListOfferingTeachersDto) {
    return this.client.offeringTeacher.findMany({
      where: {
        tenantId,
        ...(query.subjectOfferingId
          ? { subjectOfferingId: query.subjectOfferingId }
          : {}),
        ...(query.userTenantId ? { userTenantId: query.userTenantId } : {}),
      },
      orderBy: [{ assignedAt: 'desc' }],
    });
  }

  async updateOfferingTeacher(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: UpdateOfferingTeacherDto,
  ) {
    const existing = await this.client.offeringTeacher.findFirst({
      where: { id, tenantId },
      select: { id: true, subjectOfferingId: true },
    });
    if (!existing) throw new NotFoundException('Teacher assignment not found');
    const offering = await this.assertOffering(
      tenantId,
      existing.subjectOfferingId,
    );
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: offering.campusId,
    });
    const deactivating = dto.isActive === false;
    const assignment = await this.client.offeringTeacher.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        role: dto.role,
        unassignedAt: deactivating ? new Date() : undefined,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.enrollment.teacher.update',
      'offering_teacher',
      id,
      `updated teacher assignment ${id} (active=${assignment.isActive})`,
    );
    return assignment;
  }

  // ======================= Resolver: student → subjects =======================

  /**
   * Resolve a student's subjects the way their tenant's profile demands. K-12
   * ('class'): the sections they're enrolled in → those sections' offerings
   * (source 'core') + their elected offerings (source 'elective'). Tertiary
   * ('course'): their course registrations (source 'registered'). The acceptance:
   * both models resolve student→subject through OFFERINGS, never a label.
   */
  async resolveStudentSubjects(tenantId: string, studentId: string) {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const { model, source: modelSource } =
      await this.resolveEnrollmentModel(tenantId);

    const subjects: Array<{
      subjectOfferingId: string;
      subjectLabel: string;
      source: 'core' | 'elective' | 'registered';
      classSectionId?: string;
    }> = [];

    if (model === 'class') {
      const enrollments = await this.client.sectionEnrollment.findMany({
        where: { tenantId, studentId, status: 'active' },
        select: { classSectionId: true },
      });
      const sectionIds = enrollments.map((e) => e.classSectionId);
      if (sectionIds.length > 0) {
        // Core = the section's NON-elective offerings (taken by every member of
        // the section). Elective offerings on the section only count once the
        // student has elected them (below).
        const offerings = await this.client.subjectOffering.findMany({
          where: {
            tenantId,
            classSectionId: { in: sectionIds },
            status: 'active',
            isElective: false,
          },
          select: {
            id: true,
            subjectLabel: true,
            classSectionId: true,
          },
        });
        for (const o of offerings) {
          subjects.push({
            subjectOfferingId: o.id,
            subjectLabel: o.subjectLabel,
            source: 'core',
            classSectionId: o.classSectionId,
          });
        }
      }
      // Electives the student picked, on top of their section's core set.
      const elections = await this.client.studentSubjectElection.findMany({
        where: { tenantId, studentId, status: 'elected' },
        select: { subjectOfferingId: true },
      });
      const electedIds = elections.map((e) => e.subjectOfferingId);
      if (electedIds.length > 0) {
        const electedOfferings = await this.client.subjectOffering.findMany({
          where: { tenantId, id: { in: electedIds } },
          select: { id: true, subjectLabel: true, classSectionId: true },
        });
        for (const o of electedOfferings) {
          if (!subjects.some((s) => s.subjectOfferingId === o.id)) {
            subjects.push({
              subjectOfferingId: o.id,
              subjectLabel: o.subjectLabel,
              source: 'elective',
              classSectionId: o.classSectionId,
            });
          }
        }
      }
    } else {
      const registrations = await this.client.courseRegistration.findMany({
        where: { tenantId, studentId, status: 'registered' },
        select: { subjectOfferingId: true },
      });
      const offeringIds = registrations.map((r) => r.subjectOfferingId);
      if (offeringIds.length > 0) {
        const offerings = await this.client.subjectOffering.findMany({
          where: { tenantId, id: { in: offeringIds } },
          select: { id: true, subjectLabel: true, classSectionId: true },
        });
        for (const o of offerings) {
          subjects.push({
            subjectOfferingId: o.id,
            subjectLabel: o.subjectLabel,
            source: 'registered',
            classSectionId: o.classSectionId,
          });
        }
      }
    }

    return { studentId, model, modelSource, subjects };
  }

  // ======================= validation helpers =======================

  private async assertStudent(tenantId: string, studentId: string) {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student)
      throw new BadRequestException('Student not found for this tenant.');
  }

  private async assertCampus(tenantId: string, campusId: string) {
    const campus = await this.client.campus.findFirst({
      where: { id: campusId, tenantId },
      select: { id: true },
    });
    if (!campus)
      throw new BadRequestException('Campus not found for this tenant.');
  }

  private async assertAcademicYear(tenantId: string, academicYearId: string) {
    const year = await this.client.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true },
    });
    if (!year)
      throw new BadRequestException('Academic year not found for this tenant.');
  }

  private async assertProfile(tenantId: string, userTenantId: string) {
    const profile = await this.client.userTenant.findFirst({
      where: { id: userTenantId, tenantId },
      select: { id: true },
    });
    if (!profile)
      throw new BadRequestException(
        'Teacher profile not found for this tenant.',
      );
  }

  /** A section that belongs to this tenant, with its campusId (scope target). */
  private async assertSection(tenantId: string, classSectionId: string) {
    const section = await this.client.classSection.findFirst({
      where: { id: classSectionId, tenantId },
      select: { id: true, campusId: true },
    });
    if (!section)
      throw new BadRequestException('Class section not found for this tenant.');
    return section;
  }

  /** An offering that belongs to this tenant, with its section's campusId. */
  private async assertOffering(tenantId: string, subjectOfferingId: string) {
    const offering = await this.client.subjectOffering.findFirst({
      where: { id: subjectOfferingId, tenantId },
      select: {
        id: true,
        isElective: true,
        classSection: { select: { campusId: true } },
      },
    });
    if (!offering)
      throw new BadRequestException(
        'Subject offering not found for this tenant.',
      );
    return {
      id: offering.id,
      isElective: offering.isElective,
      campusId: offering.classSection.campusId,
    };
  }
}
