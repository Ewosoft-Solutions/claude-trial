import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TenantDbService } from '../database/tenant-db.service';
import type { UserPermissionContext } from '../../auth/services/permission.service';

/**
 * Who is acting on academic content, and how wide their permissions reach.
 * Built from the PermissionGuard's cached UserPermissionContext by
 * `buildAcademicsActor` — services then enforce record-level rules
 * (class ownership, enrollment) that the flat permission check can't.
 */
export interface AcademicsActor {
  userId: string;
  profileId: string; // UserTenant id
  /** Holds the unrestricted view permission (teachers/admins). */
  canViewAll: boolean;
  /** Holds the admin override for content in classes they don't teach. */
  canManageAll: boolean;
}

export function buildAcademicsActor(
  userContext: UserPermissionContext,
  viewAllPermission: string,
  manageAllPermission: string,
): AcademicsActor {
  const has = (name: string) =>
    userContext.permissions.get(name)?.granted === true;
  return {
    userId: userContext.userId,
    profileId: userContext.profileId,
    canViewAll: has(viewAllPermission),
    canManageAll: has(manageAllPermission),
  };
}

/**
 * Record-level access rules shared by the academics modules (learning,
 * assessment-grading): teacher↔class allocation via ClassTeacher and
 * student↔class membership via Enrollment. Adopted from the reference
 * repos' "teachers author only their allocated subjects" principle
 * (docs/academics-reuse-assessment.md §2.5).
 *
 * Every method must be called inside an RLS scope (runScoped or
 * @TenantScoped) — it uses the same scoped/privileged client fallback as
 * the domain services.
 */
@Injectable()
export class AcademicsAccessService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  /** True if the actor holds an active teaching assignment for the class. */
  /**
   * Does this actor teach a given OFFERING (section × subject × year/term)?
   *
   * The offering-scoped counterpart to isClassTeacher, and the check that
   * replaces it as the legacy `Class` retires. Written here once because both
   * the lesson library and the assessment re-key grew their own copy of it —
   * three subtly different answers to "can this teacher touch this content" is
   * exactly how an authorisation hole gets in.
   */
  async teachesOffering(
    tenantId: string,
    profileId: string,
    subjectOfferingId: string,
  ): Promise<boolean> {
    const assignment = await this.client.offeringTeacher.findFirst({
      where: {
        tenantId,
        subjectOfferingId,
        userTenantId: profileId,
        isActive: true,
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  /**
   * Active offering ids taught by this profile — the offering-scoped
   * counterpart to getTaughtClassIds, for LIST reads that must be narrowed to
   * "the subjects this teacher actually takes" rather than checked one record
   * at a time.
   */
  async getTaughtOfferingIds(
    tenantId: string,
    profileId: string,
  ): Promise<string[]> {
    const assignments = await this.client.offeringTeacher.findMany({
      where: { tenantId, userTenantId: profileId, isActive: true },
      select: { subjectOfferingId: true },
    });
    return assignments.map((assignment) => assignment.subjectOfferingId);
  }

  /**
   * Curriculum subject ids this profile teaches at least one offering of — the
   * subject-scoped counterpart to getTaughtCourseIds, for the question bank and
   * any other library content that belongs to a SUBJECT rather than a class.
   */
  async getTaughtCurriculumSubjectIds(
    tenantId: string,
    profileId: string,
  ): Promise<string[]> {
    // OfferingTeacher has no Prisma relation to SubjectOffering (the WB2
    // convention keeps the modules decoupled), so this is two reads.
    const assignments = await this.client.offeringTeacher.findMany({
      where: { tenantId, userTenantId: profileId, isActive: true },
      select: { subjectOfferingId: true },
    });
    if (assignments.length === 0) return [];
    const offerings = await this.client.subjectOffering.findMany({
      where: {
        tenantId,
        id: { in: assignments.map((a) => a.subjectOfferingId) },
      },
      select: { curriculumSubjectId: true },
    });
    return Array.from(new Set(offerings.map((o) => o.curriculumSubjectId)));
  }

  /**
   * Does this actor teach ANY offering of a curriculum subject? This is the
   * right question for LIBRARY content, which belongs to a subject rather than
   * to one class, so no single offering can answer it.
   */
  async teachesCurriculumSubject(
    tenantId: string,
    profileId: string,
    curriculumSubjectId: string,
  ): Promise<boolean> {
    // OfferingTeacher has no Prisma relation to SubjectOffering (the WB2
    // convention keeps the modules decoupled), so this is two reads.
    const offerings = await this.client.subjectOffering.findMany({
      where: { tenantId, curriculumSubjectId },
      select: { id: true },
    });
    if (offerings.length === 0) return false;
    const assignment = await this.client.offeringTeacher.findFirst({
      where: {
        tenantId,
        userTenantId: profileId,
        isActive: true,
        subjectOfferingId: { in: offerings.map((o) => o.id) },
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  /** Offering-scoped equivalent of assertCanManageClass. */
  async assertCanManageOffering(
    tenantId: string,
    actor: AcademicsActor,
    subjectOfferingId: string,
  ): Promise<void> {
    if (actor.canManageAll) return;
    if (
      await this.teachesOffering(tenantId, actor.profileId, subjectOfferingId)
    ) {
      return;
    }
    throw new ForbiddenException(
      'You are not assigned to teach this subject for this class',
    );
  }

  /** Subject-scoped guard for library content (no class to check). */
  async assertCanManageCurriculumSubject(
    tenantId: string,
    actor: AcademicsActor,
    curriculumSubjectId: string,
  ): Promise<void> {
    if (actor.canManageAll) return;
    if (
      await this.teachesCurriculumSubject(
        tenantId,
        actor.profileId,
        curriculumSubjectId,
      )
    ) {
      return;
    }
    throw new ForbiddenException(
      'You do not teach this subject, so you cannot change its library content',
    );
  }

  async isClassTeacher(
    tenantId: string,
    profileId: string,
    classId: string,
  ): Promise<boolean> {
    const assignment = await this.client.classTeacher.findFirst({
      where: { classId, userTenantId: profileId, isActive: true, tenantId },
      select: { id: true },
    });
    return assignment !== null;
  }

  /** Active class ids taught by this profile in the tenant. */
  async getTaughtClassIds(
    tenantId: string,
    profileId: string,
  ): Promise<string[]> {
    const assignments = await this.client.classTeacher.findMany({
      where: {
        userTenantId: profileId,
        isActive: true,
        class: { tenantId },
      },
      select: { classId: true },
    });
    return assignments.map((assignment) => assignment.classId);
  }

  /**
   * Throw unless the actor may author/modify content for the class:
   * admins with the manage-all override pass, otherwise the actor must be
   * an active ClassTeacher of that class.
   */
  async assertCanManageClass(
    tenantId: string,
    actor: AcademicsActor,
    /**
     * Nullable since the lesson library landed: a library lesson belongs to a
     * curriculum subject, not a class. This app is NOT strict-null-checked, so
     * nothing would have flagged the null flowing in here — and a bare
     * `isClassTeacher(…, null)` would have quietly denied every teacher. Callers
     * holding a class-less record must use the library check instead, and this
     * says so out loud rather than 403-ing with a misleading message.
     */
    classId: string | null,
  ): Promise<void> {
    if (actor.canManageAll) return;
    if (!classId) {
      throw new ForbiddenException(
        'This content is not scoped to a class; check subject-level access instead',
      );
    }
    if (await this.isClassTeacher(tenantId, actor.profileId, classId)) return;
    throw new ForbiddenException('You are not assigned to teach this class');
  }

  /**
   * True if the actor actively teaches any class offering of the course —
   * the authoring bar for the course's question bank.
   */
  async teachesCourse(
    tenantId: string,
    profileId: string,
    courseId: string,
  ): Promise<boolean> {
    const assignment = await this.client.classTeacher.findFirst({
      where: {
        userTenantId: profileId,
        isActive: true,
        class: { courseId, tenantId },
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  /** Course ids for which this profile teaches at least one active class. */
  async getTaughtCourseIds(
    tenantId: string,
    profileId: string,
  ): Promise<string[]> {
    const assignments = await this.client.classTeacher.findMany({
      where: {
        userTenantId: profileId,
        isActive: true,
        class: { tenantId },
      },
      select: { class: { select: { courseId: true } } },
      distinct: ['classId'],
    });
    return Array.from(
      new Set(assignments.map((assignment) => assignment.class.courseId)),
    );
  }

  /**
   * Throw unless the actor may author question-bank entries for the
   * course: manage-all override or an active assignment to one of the
   * course's classes.
   */
  async assertCanManageCourseBank(
    tenantId: string,
    actor: AcademicsActor,
    courseId: string,
  ): Promise<void> {
    if (actor.canManageAll) return;
    if (await this.teachesCourse(tenantId, actor.profileId, courseId)) return;
    throw new ForbiddenException(
      'You are not assigned to teach any class of this course',
    );
  }

  /**
   * The student's active enrollment for a class, or null. Resolves the
   * actor's Student record through their UserTenant profile.
   */
  async findActiveEnrollment(
    tenantId: string,
    profileId: string,
    classId: string,
  ) {
    return this.client.enrollment.findFirst({
      where: {
        classId,
        status: 'active',
        student: { tenantId, userTenantId: profileId },
      },
      select: { id: true, studentId: true, classId: true },
    });
  }

  /** Class ids the student (by profile) is actively enrolled in. */
  async getEnrolledClassIds(
    tenantId: string,
    profileId: string,
  ): Promise<string[]> {
    const enrollments = await this.client.enrollment.findMany({
      where: {
        status: 'active',
        student: { tenantId, userTenantId: profileId },
      },
      select: { classId: true },
    });
    return enrollments.map((enrollment) => enrollment.classId);
  }
}
