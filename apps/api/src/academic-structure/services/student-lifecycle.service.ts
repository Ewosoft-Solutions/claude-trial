/**
 * Student-lifecycle service (WB2-3)
 *
 * Every change to WHERE a student sits is a durable, explainable lifecycle
 * EVENT with history — never a delete-and-retype. This service is the ONE
 * authoritative writer of placement changes; it keeps the WB2-2
 * `SectionEnrollment` (the "current membership" projection) in lock-step with
 * `StudentPlacementHistory` (the effective-dated ledger of spans) and the
 * `Student.enrollmentStatus` lifecycle flag — all in one transaction (the
 * request is `@TenantScoped`), audited, and campus-scoped via the WB1-6
 * `AccessScopeService`.
 *
 *   • register  — first placement into a section (admission-independent).
 *   • transfer  — CLOSE the current span + OPEN a new one; both survive with
 *                 dates (scenario 3: a mid-year transfer keeps both placements).
 *   • withdraw  — close the current span + flip status to 'withdrawn'.
 *   • graduate  — close the current span + flip status to 'graduated'.
 *   • explain   — the current placement + the full year-over-year history.
 *
 * Prior placements are NEVER destroyed — a transition only sets `effectiveTo` +
 * `status`, so the ledger is a complete, auditable trail (scenario 5).
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
  RegisterStudentDto,
  TransferStudentDto,
  WithdrawStudentDto,
  GraduateStudentDto,
  ListPlacementHistoryDto,
} from '../dto';

/**
 * The next student identifier for a `STU-<year>-NNNN` scheme: one past the max
 * numeric suffix already in use for that year's prefix. A pure sequence over
 * existing identifiers (NOT a parse of any academic-structure label) — unit-tested.
 */
export function nextStudentNumber(
  existingNumbers: string[],
  year: number,
): string {
  const prefix = `STU-${year}-`;
  let max = 0;
  for (const num of existingNumbers) {
    if (!num.startsWith(prefix)) continue;
    const seq = Number.parseInt(num.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

@Injectable()
export class StudentLifecycleService {
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

  // ======================= registration =======================

  /**
   * Register a student into a section as their FIRST active placement
   * (admission-independent). Creates the SectionEnrollment + opens the first
   * placement-history span + marks the student active — atomically.
   */
  async registerStudent(
    tenantId: string,
    actor: StructureActor,
    dto: RegisterStudentDto,
  ) {
    await this.assertStudent(tenantId, dto.studentId);
    const section = await this.assertSection(tenantId, dto.classSectionId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: section.campusId,
    });
    await this.assertAcademicYear(tenantId, dto.academicYearId);

    // Registration is the FIRST placement — a student already sitting somewhere
    // is a transfer, not a re-registration.
    const openSpan = await this.currentOpenPlacement(tenantId, dto.studentId);
    if (openSpan) {
      throw new ConflictException(
        'This student already has an active placement. Use transfer instead.',
      );
    }
    const dupEnrollment = await this.client.sectionEnrollment.findFirst({
      where: {
        studentId: dto.studentId,
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true, status: true },
    });
    if (dupEnrollment && dupEnrollment.status === 'active') {
      throw new ConflictException(
        'This student is already enrolled in this section for that year.',
      );
    }

    const now = new Date();
    const enrollment = await this.client.sectionEnrollment.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
        status: 'active',
        enrolledAt: now,
        createdBy: actor.userId,
      },
    });
    const placement = await this.client.studentPlacementHistory.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        campusId: section.campusId,
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
        eventType: 'registration',
        status: 'active',
        effectiveFrom: now,
        reason: dto.reason?.trim() || null,
        sectionEnrollmentId: enrollment.id,
        createdBy: actor.userId,
      },
    });
    await this.client.student.update({
      where: { id: dto.studentId },
      data: {
        enrollmentStatus: 'active',
        enrollmentDate: now,
        updatedBy: actor.userId,
      },
    });

    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.lifecycle.register',
      'student',
      dto.studentId,
      `registered student ${dto.studentId} into section ${dto.classSectionId}`,
      {
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
      },
    );
    return { enrollment, placement };
  }

  // ======================= transfer =======================

  /**
   * Transfer a student to another section. Closes the current span (keeping it
   * with an end date) and opens a new one — both placements survive. Enforces
   * scope on BOTH the source and destination campus, so a campus-scoped actor
   * can only move students within their own campus.
   */
  async transferStudent(
    tenantId: string,
    actor: StructureActor,
    dto: TransferStudentDto,
  ) {
    await this.assertStudent(tenantId, dto.studentId);
    const toSection = await this.assertSection(tenantId, dto.toClassSectionId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: toSection.campusId,
    });

    const currentEnrollment = await this.client.sectionEnrollment.findFirst({
      where: { tenantId, studentId: dto.studentId, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
    });
    if (!currentEnrollment) {
      throw new BadRequestException(
        'This student has no active placement to transfer from. Register them first.',
      );
    }
    if (currentEnrollment.classSectionId === dto.toClassSectionId) {
      throw new BadRequestException('The student is already in that section.');
    }
    const fromSection = await this.assertSection(
      tenantId,
      currentEnrollment.classSectionId,
    );
    // The actor must also be within the SOURCE campus's scope — a campus-scoped
    // actor cannot move a student OUT of a campus they don't hold.
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: fromSection.campusId,
    });

    const year = dto.academicYearId ?? currentEnrollment.academicYearId;
    if (dto.academicYearId) await this.assertAcademicYear(tenantId, year);

    // A pre-existing active enrollment in the destination for that year blocks
    // the transfer (the unique (student, section, year) would collide).
    const dupDest = await this.client.sectionEnrollment.findFirst({
      where: {
        studentId: dto.studentId,
        classSectionId: dto.toClassSectionId,
        academicYearId: year,
      },
      select: { id: true },
    });
    if (dupDest) {
      throw new ConflictException(
        'The student already has an enrollment in the destination section for that year.',
      );
    }

    const now = new Date();
    const reason = dto.reason.trim();

    // Close the source span (never delete it). If the student was enrolled via
    // WB2-2 before any lifecycle span existed, synthesise a closed source span
    // so the history is complete.
    await this.closeOpenPlacement(tenantId, dto.studentId, now, {
      synthesizeFrom: {
        campusId: fromSection.campusId,
        classSectionId: currentEnrollment.classSectionId,
        academicYearId: currentEnrollment.academicYearId,
        sectionEnrollmentId: currentEnrollment.id,
        actorId: actor.userId,
      },
    });
    // End the source membership.
    await this.client.sectionEnrollment.update({
      where: { id: currentEnrollment.id },
      data: {
        status: 'transferred',
        endedAt: now,
        endReason: reason,
        updatedBy: actor.userId,
      },
    });
    // Open the destination membership + span.
    const newEnrollment = await this.client.sectionEnrollment.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        classSectionId: dto.toClassSectionId,
        academicYearId: year,
        status: 'active',
        enrolledAt: now,
        createdBy: actor.userId,
      },
    });
    const newPlacement = await this.client.studentPlacementHistory.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        campusId: toSection.campusId,
        classSectionId: dto.toClassSectionId,
        academicYearId: year,
        eventType: 'transfer',
        status: 'active',
        effectiveFrom: now,
        reason,
        sectionEnrollmentId: newEnrollment.id,
        createdBy: actor.userId,
      },
    });
    await this.client.student.update({
      where: { id: dto.studentId },
      data: { transferDate: now, updatedBy: actor.userId },
    });

    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.lifecycle.transfer',
      'student',
      dto.studentId,
      `transferred student ${dto.studentId} from ${currentEnrollment.classSectionId} to ${dto.toClassSectionId}`,
      {
        fromClassSectionId: currentEnrollment.classSectionId,
        toClassSectionId: dto.toClassSectionId,
        academicYearId: year,
      },
    );
    return {
      fromEnrollmentId: currentEnrollment.id,
      newEnrollment,
      newPlacement,
    };
  }

  // ======================= withdrawal / graduation =======================

  async withdrawStudent(
    tenantId: string,
    actor: StructureActor,
    dto: WithdrawStudentDto,
  ) {
    return this.endLifecycle(tenantId, actor, {
      studentId: dto.studentId,
      reason: dto.reason.trim(),
      eventType: 'withdrawal',
      enrollmentStatus: 'withdrawn',
      sectionEnrollmentStatus: 'withdrawn',
      statusDateField: 'withdrawalDate',
      action: 'academics.lifecycle.withdraw',
    });
  }

  async graduateStudent(
    tenantId: string,
    actor: StructureActor,
    dto: GraduateStudentDto,
  ) {
    return this.endLifecycle(tenantId, actor, {
      studentId: dto.studentId,
      reason: dto.reason?.trim() || null,
      eventType: 'graduation',
      enrollmentStatus: 'graduated',
      sectionEnrollmentStatus: 'completed',
      statusDateField: 'graduationDate',
      action: 'academics.lifecycle.graduate',
    });
  }

  /** Shared close-out for withdrawal + graduation (both end the current span). */
  private async endLifecycle(
    tenantId: string,
    actor: StructureActor,
    input: {
      studentId: string;
      reason: string | null;
      eventType: 'withdrawal' | 'graduation';
      enrollmentStatus: 'withdrawn' | 'graduated';
      sectionEnrollmentStatus: 'withdrawn' | 'completed';
      statusDateField: 'withdrawalDate' | 'graduationDate';
      action: string;
    },
  ) {
    await this.assertStudent(tenantId, input.studentId);

    // The campus the student currently sits on (for scope + the closing span).
    const currentCampusId = await this.currentCampusId(
      tenantId,
      input.studentId,
    );
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: currentCampusId,
    });

    const now = new Date();

    // End every active section membership (never delete).
    const activeEnrollments = await this.client.sectionEnrollment.findMany({
      where: { tenantId, studentId: input.studentId, status: 'active' },
      select: { id: true },
    });
    for (const e of activeEnrollments) {
      await this.client.sectionEnrollment.update({
        where: { id: e.id },
        data: {
          status: input.sectionEnrollmentStatus,
          endedAt: now,
          endReason: input.reason,
          updatedBy: actor.userId,
        },
      });
    }
    // Drop any active per-course registrations (tertiary), too.
    await this.client.courseRegistration.updateMany({
      where: { tenantId, studentId: input.studentId, status: 'registered' },
      data: { status: 'dropped', endedAt: now, updatedBy: actor.userId },
    });

    // Close the open span, then record the terminal event as its own span (a
    // point-in-time event: effectiveFrom == effectiveTo). Only when we know a
    // campus — a student with no placement at all just flips status.
    await this.closeOpenPlacement(tenantId, input.studentId, now);
    let placement = null;
    if (currentCampusId) {
      placement = await this.client.studentPlacementHistory.create({
        data: {
          tenantId,
          studentId: input.studentId,
          campusId: currentCampusId,
          eventType: input.eventType,
          status: 'ended',
          effectiveFrom: now,
          effectiveTo: now,
          reason: input.reason,
          createdBy: actor.userId,
        },
      });
    }

    await this.client.student.update({
      where: { id: input.studentId },
      data: {
        enrollmentStatus: input.enrollmentStatus,
        [input.statusDateField]: now,
        updatedBy: actor.userId,
      },
    });

    await this.writeAudit(
      tenantId,
      actor.userId,
      input.action,
      'student',
      input.studentId,
      `${input.eventType} for student ${input.studentId}`,
      { endedEnrollments: activeEnrollments.length },
    );
    return {
      status: input.enrollmentStatus,
      studentId: input.studentId,
      placement,
    };
  }

  // ======================= explain / read =======================

  /**
   * Explain a student's placement: their current section (campus → section) and
   * the full year-over-year placement history behind it (scenario 5).
   */
  async explainPlacement(tenantId: string, studentId: string) {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        id: true,
        studentNumber: true,
        enrollmentStatus: true,
        gradeLevel: true,
        enrollmentDate: true,
        graduationDate: true,
        withdrawalDate: true,
        transferDate: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const history = await this.loadHistory(tenantId, studentId);
    const activeEnrollments = await this.loadActiveEnrollments(
      tenantId,
      studentId,
    );
    // History is ascending by effectiveFrom, so the LAST active span is the
    // most-recent placement (a promoted student can hold this-year + next-year
    // spans at once — the latest wins as "current").
    const actives = history.filter((h) => h.status === 'active');
    const current = actives[actives.length - 1] ?? null;

    return { student, current, history, activeEnrollments };
  }

  /**
   * Create a next-year placement for the WB2-4 promotion commit: a
   * SectionEnrollment (idempotent per (student, section, year)) plus a
   * 'promotion' placement-history span. Leaves the PRIOR year untouched — this
   * only creates next-year rows. Returns the resulting enrollment id.
   */
  async recordPromotionPlacement(
    tenantId: string,
    actorId: string,
    input: {
      studentId: string;
      classSectionId: string;
      campusId: string;
      academicYearId: string;
      effectiveFrom: Date;
      reason?: string | null;
    },
  ): Promise<{ enrollmentId: string; created: boolean }> {
    const existing = await this.client.sectionEnrollment.findFirst({
      where: {
        tenantId,
        studentId: input.studentId,
        classSectionId: input.classSectionId,
        academicYearId: input.academicYearId,
      },
      select: { id: true },
    });
    if (existing) {
      // Idempotent: a re-run (or a manual enrol done earlier) is not duplicated.
      return { enrollmentId: existing.id, created: false };
    }
    const enrollment = await this.client.sectionEnrollment.create({
      data: {
        tenantId,
        studentId: input.studentId,
        classSectionId: input.classSectionId,
        academicYearId: input.academicYearId,
        status: 'active',
        enrolledAt: input.effectiveFrom,
        createdBy: actorId,
      },
    });
    await this.client.studentPlacementHistory.create({
      data: {
        tenantId,
        studentId: input.studentId,
        campusId: input.campusId,
        classSectionId: input.classSectionId,
        academicYearId: input.academicYearId,
        eventType: 'promotion',
        status: 'active',
        effectiveFrom: input.effectiveFrom,
        reason: input.reason ?? null,
        sectionEnrollmentId: enrollment.id,
        createdBy: actorId,
      },
    });
    return { enrollmentId: enrollment.id, created: true };
  }

  async listPlacementHistory(
    tenantId: string,
    studentId: string,
    query: ListPlacementHistoryDto,
  ) {
    await this.assertStudent(tenantId, studentId);
    const history = await this.loadHistory(tenantId, studentId);
    return query.status
      ? history.filter((h) => h.status === query.status)
      : history;
  }

  /** Suggest the next student identifier for this tenant (identifier allocation). */
  async suggestStudentNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const existing = await this.client.student.findMany({
      where: { tenantId, studentNumber: { startsWith: `STU-${year}-` } },
      select: { studentNumber: true },
    });
    return {
      studentNumber: nextStudentNumber(
        existing.map((s) => s.studentNumber),
        year,
      ),
    };
  }

  // ======================= internals =======================

  /** The single open (status='active') placement span, if any. */
  private async currentOpenPlacement(tenantId: string, studentId: string) {
    return this.client.studentPlacementHistory.findFirst({
      where: { tenantId, studentId, status: 'active' },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Close the currently-open span (set effectiveTo + status='ended'). If none is
   * open but `synthesizeFrom` is given, insert a CLOSED span for the prior
   * placement so a student enrolled before WB2-3 still gets a complete history.
   */
  private async closeOpenPlacement(
    tenantId: string,
    studentId: string,
    at: Date,
    opts?: {
      synthesizeFrom?: {
        campusId: string;
        classSectionId: string;
        academicYearId: string;
        sectionEnrollmentId: string;
        actorId: string;
      };
    },
  ) {
    const open = await this.currentOpenPlacement(tenantId, studentId);
    if (open) {
      await this.client.studentPlacementHistory.update({
        where: { id: open.id },
        data: { status: 'ended', effectiveTo: at },
      });
      return;
    }
    if (opts?.synthesizeFrom) {
      const s = opts.synthesizeFrom;
      await this.client.studentPlacementHistory.create({
        data: {
          tenantId,
          studentId,
          campusId: s.campusId,
          classSectionId: s.classSectionId,
          academicYearId: s.academicYearId,
          eventType: 'registration',
          status: 'ended',
          effectiveTo: at,
          sectionEnrollmentId: s.sectionEnrollmentId,
          createdBy: s.actorId,
        },
      });
    }
  }

  /** The campus the student currently sits on, from span → enrollment → offering. */
  private async currentCampusId(
    tenantId: string,
    studentId: string,
  ): Promise<string | null> {
    const open = await this.currentOpenPlacement(tenantId, studentId);
    if (open?.campusId) return open.campusId;

    const enrollment = await this.client.sectionEnrollment.findFirst({
      where: { tenantId, studentId, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
      select: { classSectionId: true },
    });
    if (enrollment) {
      const section = await this.client.classSection.findFirst({
        where: { id: enrollment.classSectionId, tenantId },
        select: { campusId: true },
      });
      if (section) return section.campusId;
    }

    // CourseRegistration → offering is a soft ref (no Prisma relation, F6
    // convention), so resolve the offering (which DOES relate to its section) in
    // a second step.
    const registration = await this.client.courseRegistration.findFirst({
      where: { tenantId, studentId, status: 'registered' },
      orderBy: { registeredAt: 'desc' },
      select: { subjectOfferingId: true },
    });
    if (registration) {
      const offering = await this.client.subjectOffering.findFirst({
        where: { id: registration.subjectOfferingId, tenantId },
        select: { classSection: { select: { campusId: true } } },
      });
      return offering?.classSection?.campusId ?? null;
    }
    return null;
  }

  /** Placement history enriched with section labels + campus names. */
  private async loadHistory(tenantId: string, studentId: string) {
    const rows = await this.client.studentPlacementHistory.findMany({
      where: { tenantId, studentId },
      orderBy: { effectiveFrom: 'asc' },
    });
    const sectionIds = [
      ...new Set(
        rows.map((r) => r.classSectionId).filter((id): id is string => !!id),
      ),
    ];
    const campusIds = [...new Set(rows.map((r) => r.campusId))];
    const [sections, campuses] = await Promise.all([
      sectionIds.length
        ? this.client.classSection.findMany({
            where: { id: { in: sectionIds }, tenantId },
            select: { id: true, displayLabel: true },
          })
        : Promise.resolve([]),
      campusIds.length
        ? this.client.campus.findMany({
            where: { id: { in: campusIds }, tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const sectionLabel = new Map(sections.map((s) => [s.id, s.displayLabel]));
    const campusName = new Map(campuses.map((c) => [c.id, c.name]));
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      status: r.status,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      reason: r.reason,
      campusId: r.campusId,
      campusName: campusName.get(r.campusId) ?? null,
      classSectionId: r.classSectionId,
      sectionLabel: r.classSectionId
        ? (sectionLabel.get(r.classSectionId) ?? null)
        : null,
      academicYearId: r.academicYearId,
    }));
  }

  private async loadActiveEnrollments(tenantId: string, studentId: string) {
    const enrollments = await this.client.sectionEnrollment.findMany({
      where: { tenantId, studentId, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
    });
    const sectionIds = [...new Set(enrollments.map((e) => e.classSectionId))];
    const sections = sectionIds.length
      ? await this.client.classSection.findMany({
          where: { id: { in: sectionIds }, tenantId },
          select: { id: true, displayLabel: true },
        })
      : [];
    const label = new Map(sections.map((s) => [s.id, s.displayLabel]));
    return enrollments.map((e) => ({
      id: e.id,
      classSectionId: e.classSectionId,
      sectionLabel: label.get(e.classSectionId) ?? null,
      academicYearId: e.academicYearId,
      enrolledAt: e.enrolledAt,
    }));
  }

  private async assertStudent(tenantId: string, studentId: string) {
    const student = await this.client.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!student)
      throw new BadRequestException('Student not found for this tenant.');
  }

  private async assertAcademicYear(tenantId: string, academicYearId: string) {
    const year = await this.client.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true },
    });
    if (!year)
      throw new BadRequestException('Academic year not found for this tenant.');
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
}
