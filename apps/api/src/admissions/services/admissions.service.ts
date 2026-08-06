/**
 * Admissions service (WB3-1 + WB3-2)
 *
 * Turns the flat page-first `AdmissionApplication` stub into a durable, Person-
 * linked pipeline that ends in a one-command conversion to a registered student:
 *
 *   • pipeline    — an explicit stage machine; every transition writes an
 *                   effective-dated `AdmissionStageEvent` (auditable, never a
 *                   silent overwrite).
 *   • reviews     — scored `AdmissionReview` decision history (fixes the
 *                   strings-only stage/decision of the stub).
 *   • offer/accept— dedicated transitions that stamp the offer/accept times.
 *   • convert     — from an ACCEPTED application, create the Person (F1) + a
 *                   login-less profile (User+UserTenant) + a `Student` (student
 *                   number allocated by the WB2-3 allocator) and REGISTER them
 *                   into a class section via the WB2-3 `StudentLifecycleService`.
 *
 * Runs entirely on the request's tenant-scoped client (RLS; NO privileged
 * `DatabaseService` — the stub's grandfathered read is removed) inside a
 * `@TenantScoped` transaction; audited; campus-scoped (WB1-6 `AccessScopeService`,
 * on the conversion's target section).
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
import { StudentLifecycleService } from '../../academic-structure/services/student-lifecycle.service';
import type { StructureActor } from '../../academic-structure/services/academic-structure-model.service';
import { AdmissionRequirementsService } from './admission-requirements.service';
import type {
  CreateApplicationDto,
  GuardianInputDto,
  ListApplicationsDto,
  UpdateApplicationDto,
  AdvanceStageDto,
  AddReviewDto,
  MakeOfferDto,
  DecisionNoteDto,
  ConvertToStudentDto,
} from '../dto/admissions.dto';

/** Stages the generic advance action may move TO (the offer/accept/reject/
 *  convert transitions are the only way to reach the decision/terminal stages). */
const ADVANCEABLE_STAGES = new Set([
  'enquiry',
  'applied',
  'screening',
  'interview',
  'withdrawn',
]);

/** Stages the generic advance action may move FROM. A decision has been taken
 *  (or the file is terminal) once past these, so advance may not regress an
 *  offer/acceptance/rejection/enrolment — that would let a lower-clearance
 *  `admissions.review` holder undo a higher-clearance decision. */
const ADVANCE_SOURCE_STAGES = new Set([
  'enquiry',
  'applied',
  'screening',
  'interview',
]);

/** Stages an offer may be made FROM (pre-decision, or re-offering an open
 *  offer to amend it) — never from an accepted / enrolled / closed file. */
const OFFERABLE_FROM_STAGES = new Set([
  'enquiry',
  'applied',
  'screening',
  'interview',
  'offer',
]);

/** Split a full name into first/last for the F1 Person (last word = surname). */
export function splitApplicantName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0)
    return { firstName: 'Unknown', lastName: 'Applicant' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]!,
  };
}

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
    private readonly lifecycle: StudentLifecycleService,
    private readonly requirements: AdmissionRequirementsService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resourceId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'admission_application',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  private async writeStageEvent(
    tenantId: string,
    applicationId: string,
    fromStage: string | null,
    toStage: string,
    actorId: string,
    note?: string | null,
  ) {
    await this.client.admissionStageEvent.create({
      data: {
        tenantId,
        applicationId,
        fromStage,
        toStage,
        note: note ?? null,
        actorId,
      },
    });
  }

  // ======================= reads =======================

  async listApplications(tenantId: string, query: ListApplicationsDto) {
    return this.client.admissionApplication.findMany({
      where: {
        tenantId,
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.decision ? { decision: query.decision } : {}),
        ...(query.applyingFor ? { applyingFor: query.applyingFor } : {}),
        ...(query.query
          ? {
              OR: [
                {
                  applicantName: {
                    contains: query.query,
                    mode: 'insensitive',
                  },
                },
                {
                  guardianName: { contains: query.query, mode: 'insensitive' },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ submittedDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** A single application enriched with guardians, requirements + history. */
  async getApplication(tenantId: string, id: string) {
    const application = await this.client.admissionApplication.findFirst({
      where: { id, tenantId },
      include: {
        guardians: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        requirements: {
          orderBy: [{ collectStage: 'asc' }, { label: 'asc' }],
        },
        stageEvents: { orderBy: { createdAt: 'asc' } },
        reviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /**
   * The academic structure the intake form cascades over (WB2-1) — so the school
   * keeps NO separate admissions list and an admit lands in a real class with no
   * re-keying. Read on the tenant client (RLS); campuses come back so a
   * multi-campus school can target one.
   */
  async getIntakeStructure(tenantId: string) {
    const [campuses, stages, yearLevels, streams] = await Promise.all([
      this.client.campus.findMany({
        where: { tenantId },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.client.stage.findMany({
        where: { tenantId },
        select: { id: true, name: true, code: true, order: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
      this.client.yearLevel.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          code: true,
          order: true,
          stageId: true,
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
      this.client.stream.findMany({
        where: { tenantId },
        select: { id: true, name: true, code: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return { campuses, stages, yearLevels, streams };
  }

  async pipelineSummary(tenantId: string) {
    const applications = await this.client.admissionApplication.findMany({
      where: { tenantId },
      select: { stage: true, decision: true },
    });
    const stageCounts: Record<string, number> = {};
    const decisionCounts: Record<string, number> = {};
    for (const app of applications) {
      stageCounts[app.stage] = (stageCounts[app.stage] ?? 0) + 1;
      decisionCounts[app.decision] = (decisionCounts[app.decision] ?? 0) + 1;
    }
    return {
      totalApplications: applications.length,
      stageCounts,
      decisionCounts,
    };
  }

  // ======================= create / update =======================

  /**
   * Submit a structured application: the "applying for" is the WB2-1 cascade
   * (class = year level, its level = stage, optional department = stream), from
   * which the stored label is COMPOSED (never parsed). Guardians are captured
   * structurally (multi, with phone + WhatsApp), and the tenant's requirement
   * checklist is snapshotted onto the application. All in the one tenant tx.
   */
  async createApplication(
    tenantId: string,
    dto: CreateApplicationDto,
    actorId: string,
  ) {
    const cascade = await this.resolveCascade(tenantId, dto);
    const guardians = this.normalizeGuardians(dto.guardians);
    const primary = guardians.find((g) => g.isPrimary) ?? guardians[0]!;

    const application = await this.client.admissionApplication.create({
      data: {
        tenantId,
        applicantName: dto.applicantName.trim(),
        applyingFor: cascade.label,
        stageId: cascade.stageId,
        yearLevelId: cascade.yearLevelId,
        streamId: cascade.streamId,
        campusId: cascade.campusId,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        stateOfOrigin: dto.stateOfOrigin?.trim() || null,
        religion: dto.religion?.trim() || null,
        healthNotes: dto.healthNotes?.trim() || null,
        // Legacy flat guardian fields mirror the primary guardian (back-compat +
        // the list search still matches on guardianName).
        guardianName: primary.fullName,
        guardianEmail: primary.email,
        guardianPhone: this.composePhone(
          primary.phoneCountryCode,
          primary.phoneNumber,
        ),
        submittedDate: dto.submittedDate
          ? new Date(dto.submittedDate)
          : new Date(),
        stage: 'applied',
        decision: 'pending',
        notes: dto.notes ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    await this.client.admissionGuardian.createMany({
      data: guardians.map((g) => ({
        tenantId,
        applicationId: application.id,
        fullName: g.fullName,
        relationship: g.relationship,
        email: g.email,
        address: g.address,
        phoneCountryCode: g.phoneCountryCode,
        phoneNumber: g.phoneNumber,
        whatsappSameAsPhone: g.whatsappSameAsPhone,
        whatsappCountryCode: g.whatsappCountryCode,
        whatsappNumber: g.whatsappNumber,
        isPrimary: g.isPrimary,
        createdBy: actorId,
      })),
    });

    // Snapshot the requirement checklist onto the application (seeds defaults if
    // the tenant has no template yet).
    await this.requirements.instantiateForApplication(
      tenantId,
      application.id,
      actorId,
    );

    await this.writeStageEvent(
      tenantId,
      application.id,
      null,
      'applied',
      actorId,
      'Application submitted',
    );
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.application.create',
      application.id,
      `submitted application for ${application.applicantName} (${application.applyingFor})`,
    );
    return this.getApplication(tenantId, application.id);
  }

  /**
   * Validate the structured cascade against the tenant's academic structure and
   * COMPOSE the stored display label from it (year level + optional stream).
   */
  private async resolveCascade(tenantId: string, dto: CreateApplicationDto) {
    const yearLevel = await this.client.yearLevel.findFirst({
      where: { id: dto.yearLevelId, tenantId },
      select: { id: true, name: true, stageId: true },
    });
    if (!yearLevel) {
      throw new BadRequestException('Year level not found for this tenant.');
    }
    // The stage is derived from the year level; if the caller passed one it must agree.
    if (dto.stageId && dto.stageId !== yearLevel.stageId) {
      throw new BadRequestException(
        'The selected level does not match the class.',
      );
    }

    let streamName: string | null = null;
    if (dto.streamId) {
      const stream = await this.client.stream.findFirst({
        where: { id: dto.streamId, tenantId },
        select: { id: true, name: true },
      });
      if (!stream) {
        throw new BadRequestException('Stream not found for this tenant.');
      }
      streamName = stream.name;
    }

    if (dto.campusId) {
      const campus = await this.client.campus.findFirst({
        where: { id: dto.campusId, tenantId },
        select: { id: true },
      });
      if (!campus) {
        throw new BadRequestException('Campus not found for this tenant.');
      }
    }

    const label = [yearLevel.name, streamName].filter(Boolean).join(' ');
    return {
      stageId: yearLevel.stageId,
      yearLevelId: yearLevel.id,
      streamId: dto.streamId ?? null,
      campusId: dto.campusId ?? null,
      label,
    };
  }

  private composePhone(countryCode: string | undefined, number: string): string {
    return `${(countryCode ?? '+234').trim()} ${number.trim()}`.trim();
  }

  /** Normalize the guardian block: defaults, trimming, WhatsApp reuse. */
  private normalizeGuardians(input: GuardianInputDto[]) {
    return input.map((g, i) => {
      const phoneCountryCode = (g.phoneCountryCode ?? '+234').trim();
      const phoneNumber = g.phoneNumber.trim();
      const whatsappSameAsPhone = g.whatsappSameAsPhone ?? true;
      return {
        fullName: g.fullName.trim(),
        relationship: g.relationship,
        email: g.email?.trim() || null,
        address: g.address?.trim() || null,
        phoneCountryCode,
        phoneNumber,
        whatsappSameAsPhone,
        // When reusing the phone, store nulls and let the reader fall back — one
        // source of truth. Otherwise persist the distinct WhatsApp number.
        whatsappCountryCode: whatsappSameAsPhone
          ? null
          : (g.whatsappCountryCode ?? phoneCountryCode).trim(),
        whatsappNumber: whatsappSameAsPhone
          ? null
          : (g.whatsappNumber?.trim() ?? null),
        isPrimary: g.isPrimary ?? i === 0,
      };
    });
  }

  async updateApplication(
    tenantId: string,
    id: string,
    dto: UpdateApplicationDto,
    actorId: string,
  ) {
    await this.assertApplication(tenantId, id);
    return this.client.admissionApplication.update({
      where: { id },
      data: { notes: dto.notes, updatedBy: actorId },
    });
  }

  // ======================= pipeline =======================

  async advanceStage(
    tenantId: string,
    id: string,
    dto: AdvanceStageDto,
    actorId: string,
  ) {
    const app = await this.assertApplication(tenantId, id);
    // Source-state validation: advance moves through the PRE-decision pipeline
    // only. Once a decision is taken (offer/accepted/rejected/enrolled) or the
    // file is withdrawn, advance may not regress it — that path is what let a
    // clearance-7 actor undo a clearance-8 decision.
    if (!ADVANCE_SOURCE_STAGES.has(app.stage)) {
      throw new BadRequestException(
        `Cannot advance a '${app.stage}' application — use the dedicated offer / accept / reject / convert action.`,
      );
    }
    if (!ADVANCEABLE_STAGES.has(dto.toStage)) {
      throw new BadRequestException(
        `Use the dedicated action to reach '${dto.toStage}' (offer / accept / reject / convert).`,
      );
    }
    if (dto.toStage === app.stage) {
      throw new BadRequestException(
        `The application is already at '${app.stage}'.`,
      );
    }
    const updated = await this.client.admissionApplication.update({
      where: { id },
      data: { stage: dto.toStage, updatedBy: actorId },
    });
    await this.writeStageEvent(
      tenantId,
      id,
      app.stage,
      dto.toStage,
      actorId,
      dto.note,
    );
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.application.advance',
      id,
      `advanced application ${id}: ${app.stage} -> ${dto.toStage}`,
    );
    return updated;
  }

  // ======================= reviews =======================

  async addReview(
    tenantId: string,
    id: string,
    dto: AddReviewDto,
    actorId: string,
  ) {
    await this.assertApplication(tenantId, id);
    const review = await this.client.admissionReview.create({
      data: {
        tenantId,
        applicationId: id,
        reviewerId: actorId,
        score: dto.score ?? null,
        recommendation: dto.recommendation,
        note: dto.note ?? null,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.application.review',
      id,
      `reviewed application ${id}: ${dto.recommendation}${
        dto.score != null ? ` (score ${dto.score})` : ''
      }`,
    );
    return review;
  }

  // ======================= offer / accept / reject =======================

  async makeOffer(
    tenantId: string,
    id: string,
    dto: MakeOfferDto,
    actorId: string,
  ) {
    const app = await this.assertApplication(tenantId, id);
    // Offer only from a pre-decision stage (or re-offer an open offer) — never
    // re-offer an already-accepted/closed file.
    if (!OFFERABLE_FROM_STAGES.has(app.stage)) {
      throw new BadRequestException(
        `Cannot offer a place on a '${app.stage}' application.`,
      );
    }
    if (dto.targetClassSectionId) {
      await this.assertSection(tenantId, dto.targetClassSectionId);
    }
    if (dto.academicYearId) {
      await this.assertAcademicYear(tenantId, dto.academicYearId);
    }
    const updated = await this.client.admissionApplication.update({
      where: { id },
      data: {
        stage: 'offer',
        offeredAt: new Date(),
        targetClassSectionId:
          dto.targetClassSectionId ?? app.targetClassSectionId,
        academicYearId: dto.academicYearId ?? app.academicYearId,
        // The transition note lives on the stage event only — it must not
        // clobber the application's running admissions notes.
        updatedBy: actorId,
      },
    });
    await this.writeStageEvent(
      tenantId,
      id,
      app.stage,
      'offer',
      actorId,
      dto.note,
    );
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.application.offer',
      id,
      `offered a place to ${app.applicantName}`,
    );
    // F5 offer notification to the guardian is a light follow-up hook (WB6).
    return updated;
  }

  async recordAcceptance(tenantId: string, id: string, actorId: string) {
    const app = await this.assertApplication(tenantId, id);
    if (app.stage !== 'offer') {
      throw new BadRequestException(
        'Only an offered application can be accepted.',
      );
    }
    const updated = await this.client.admissionApplication.update({
      where: { id },
      data: {
        stage: 'accepted',
        decision: 'accepted',
        acceptedAt: new Date(),
        decisionAt: new Date(),
        updatedBy: actorId,
      },
    });
    await this.writeStageEvent(tenantId, id, app.stage, 'accepted', actorId);
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.application.accept',
      id,
      `${app.applicantName} accepted the offer`,
    );
    return updated;
  }

  async reject(
    tenantId: string,
    id: string,
    dto: DecisionNoteDto,
    actorId: string,
  ) {
    const app = await this.assertApplication(tenantId, id);
    // Reject from any live stage (including rescinding an offer/acceptance),
    // never a closed file.
    if (['enrolled', 'rejected', 'withdrawn'].includes(app.stage)) {
      throw new BadRequestException(
        `Cannot reject a '${app.stage}' application.`,
      );
    }
    const updated = await this.client.admissionApplication.update({
      where: { id },
      data: {
        stage: 'rejected',
        decision: 'rejected',
        decisionAt: new Date(),
        // Transition note stays on the stage event; don't clobber notes.
        updatedBy: actorId,
      },
    });
    await this.writeStageEvent(
      tenantId,
      id,
      app.stage,
      'rejected',
      actorId,
      dto.note,
    );
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.application.reject',
      id,
      `rejected application for ${app.applicantName}`,
    );
    return updated;
  }

  // ======================= conversion (WB3-2 headline) =======================

  /**
   * One-command conversion of an ACCEPTED application into a registered student:
   * Person (F1) + login-less profile (User+UserTenant) + `Student` (allocated
   * number) + registration into the chosen section via the WB2-3 lifecycle. All
   * on the tenant-scoped client, in one tx, audited, campus-scoped. Idempotent —
   * a second conversion is refused.
   */
  async convertToStudent(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: ConvertToStudentDto,
  ) {
    const app = await this.assertApplication(tenantId, id);
    if (app.resultingStudentId) {
      throw new ConflictException(
        'This application has already been converted to a student.',
      );
    }
    if (app.stage !== 'accepted') {
      throw new BadRequestException(
        'Only an accepted application can be converted (accept the offer first).',
      );
    }
    const section = await this.assertSection(tenantId, dto.classSectionId);
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: section.campusId,
    });
    await this.assertAcademicYear(tenantId, dto.academicYearId);

    const now = new Date();
    const { firstName, lastName } = splitApplicantName(app.applicantName);

    // 1. F1 Person for the applicant.
    const person = await this.client.person.create({
      data: {
        tenantId,
        firstName,
        lastName,
        status: 'active',
        createdBy: actor.userId,
      },
    });

    // 2. Login-less profile: a global User (no password, inactive until properly
    // provisioned via WB1-3) + a UserTenant. The email is a placeholder that is
    // globally unique (application id is a uuid) — the Student schema requires a
    // UserTenant, so a profile shell is created even for a login-less pupil.
    // `suggestStudentNumber` is read-then-insert (not locked); the
    // `@@unique([tenantId, studentNumber])` on Student is the backstop, so a
    // concurrent double-conversion fails on the constraint rather than
    // duplicating — acceptable at admissions volume.
    const { studentNumber } =
      await this.lifecycle.suggestStudentNumber(tenantId);
    const email = `${studentNumber.toLowerCase()}.${id}@student.noreply.local`;
    const user = await this.client.user.create({
      data: { email, isActive: false, isVerified: false },
    });
    const profile = await this.client.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        status: 'active',
        addedBy: actor.userId,
      },
    });

    // 3. The Student record.
    const student = await this.client.student.create({
      data: {
        tenantId,
        userTenantId: profile.id,
        personId: person.id,
        studentNumber,
        admissionNumber: studentNumber,
        admissionDate: now,
        gradeLevel: app.applyingFor,
        enrollmentStatus: 'active',
        createdBy: actor.userId,
      },
    });

    // 4. Register into the chosen section via the WB2-3 lifecycle (creates the
    // SectionEnrollment + the first placement span + marks the student active).
    await this.lifecycle.registerStudent(tenantId, actor, {
      studentId: student.id,
      classSectionId: dto.classSectionId,
      academicYearId: dto.academicYearId,
      reason: `Admitted via application ${id}`,
    });

    // 5. Close out the application.
    const updated = await this.client.admissionApplication.update({
      where: { id },
      data: {
        stage: 'enrolled',
        decision: 'accepted',
        resultingStudentId: student.id,
        personId: person.id,
        campusId: section.campusId,
        targetClassSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
        updatedBy: actor.userId,
      },
    });
    await this.writeStageEvent(
      tenantId,
      id,
      app.stage,
      'enrolled',
      actor.userId,
      `Converted to student ${studentNumber}`,
    );
    await this.writeAudit(
      tenantId,
      actor.userId,
      'admissions.application.convert',
      id,
      `converted ${app.applicantName} to student ${studentNumber} (${student.id})`,
      {
        studentId: student.id,
        personId: person.id,
        classSectionId: dto.classSectionId,
      },
    );

    return {
      application: updated,
      studentId: student.id,
      personId: person.id,
      studentNumber,
    };
  }

  // ======================= validation helpers =======================

  private async assertApplication(tenantId: string, id: string) {
    const app = await this.client.admissionApplication.findFirst({
      where: { id, tenantId },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  private async assertSection(tenantId: string, classSectionId: string) {
    const section = await this.client.classSection.findFirst({
      where: { id: classSectionId, tenantId },
      select: { id: true, campusId: true },
    });
    if (!section)
      throw new BadRequestException('Class section not found for this tenant.');
    return section;
  }

  private async assertAcademicYear(tenantId: string, academicYearId: string) {
    const year = await this.client.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true },
    });
    if (!year)
      throw new BadRequestException('Academic year not found for this tenant.');
  }
}
